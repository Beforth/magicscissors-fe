# Shift late/half-day rules + wage payroll — Design

Date: 2026-10-06 · Repos: `magicscissors-fe` (this) and `magicscissors-be` (`./magicscissors-be`, own git)
Builds on branch `feat/pwa-geofence-attendance` (not yet merged) → work happens on a new branch `feat/shift-rules-payroll` cut from it in both repos.

## Goal
1. Per-shift late-fine and half-day rules, applied automatically to attendance.
2. Owner-defined wages (daily or monthly) per employee, and an owner-only monthly payroll report where hourly rate = wage ÷ shift hours.

## Decisions (agreed with the user)
- Late rules and half-day rules live **on the shift** and are editable by the **owner only**.
- Wages are **dynamic**, defined in the system by the **owner only** (no hard-coded values). Two pay types: `daily` and `monthly`.
- Late fine is expressed in **hours deducted** (not rupees), tiered, after a per-shift grace period.
- Half day: per shift, a day is `half_day` if check-in is later than X minutes after shift start **or** hours worked are below Y. Either threshold may be blank (rule off).
- Pay for a day = `hourly rate × hours worked − hourly rate × late deduction hours` (never below 0). Daily: `hourly = daily wage ÷ shift hours`. Monthly: `hourly = monthly salary ÷ divisor ÷ shift hours`; divisor = days in that month, or a fixed number, chosen in an owner-only payroll setting (default: calendar days).
- Payroll output now = live monthly report (month + branch) with CSV export. No locking/payout/expense integration yet.
- The Shift API is built in this backend, matching what the existing Shift pages already send/expect (`/shifts`, `/shifts/:id`, `/shifts/:id/toggle-active`, `/shifts/assignments`).

## Findings that shape the design
- `attendance.service.js` has a hard-coded late rule (`LATE_GRACE_MINUTES = 15`, floor `2h`), stored in `Attendance.latePenaltyHours`. `half_day` exists in `AttendanceStatus` and is counted as a worked day by reports/incentives, but nothing sets it. `recomputeAttendance` always sets `present` (or keeps `on_leave`).
- No Shift / ShiftAssignment tables or routes exist in the backend, but the frontend (`ShiftPage`, `ShiftAssignmentsPage`, `shift.service.js`) already uses them: shift = `{id, name, start_time, end_time, color_code, grace_period, is_active, employee_count}`; assignment = `{id, employee_id, shift_id, shift_date 'YYYY-MM-DD'}`, listed by `?month=YYYY-MM`. Shifts are global (not branch-scoped); the branch picker only filters employees.
- `EmployeeDetail.baseSalary` is used by the incentive engine; payroll must NOT change its meaning.

## Backend (`magicscissors-be`)
1. **Prisma (additive)**
   - `Shift { id, name, startTime(VarChar5), endTime(VarChar5), colorCode, gracePeriod Int @default(5), lateTiers Json?, halfDayLateAfterMin Int?, halfDayMinHours Decimal(4,2)?, isActive, createdAt, updatedAt }`. `lateTiers` = `[{ after_min:int, deduct_hours:number }]`, validated: ascending `after_min` > grace, `deduct_hours` > 0 and ≤ 24.
   - `ShiftAssignment { id, employeeId→EmployeeDetail, shiftId→Shift, shiftDate Date, createdById?, @@unique([employeeId, shiftDate]) }`.
   - `EmployeeDetail` gets `payType PayType?` (enum `daily|monthly`) and `wageAmount Decimal(10,2)?` — separate from `baseSalary`.
   - `Attendance` gets `shiftId String?` and `shiftHours Decimal(4,2)?` (snapshot of the shift used when the row was last recomputed, so later shift edits don't silently change past payroll).
   - Settings (owner-only writer endpoint): `payroll_monthly_days_mode` (`calendar|fixed`, default `calendar`), `payroll_monthly_fixed_days` (default 30).
2. **Pure rule module** `src/utils/shiftRules.js` (unit-tested): `shiftHours(start,end)` (handles overnight, e.g. 22:00–06:00 = 8), `lateMinutes(checkIn,start)`, `lateDeductionHours(lateMin, shift)`, `isHalfDay({lateMin, workingHours, hasCheckOut}, shift)`, `hourlyRate({payType, wageAmount, shiftHours, daysInMonth, monthlyFixedDays, mode})`, `dayPay({hoursWorked, lateDeductionHours, hourlyRate})`.
3. **Shift API** (`/shifts`): GET list (owner, developer, manager); GET one; POST/PUT/PATCH toggle-active (**owner only**); `GET /shifts/assignments?month=`, `POST /shifts/assignments {employee_id, shift_id, shift_date}` (owner, developer, manager; upsert-by-unique, 409/replace semantics matching the UI), `DELETE /shifts/assignments/:id`. `employee_count` = distinct employees assigned to that shift in the current calendar month.
4. **Attendance integration** (`recomputeAttendance`): resolve the shift for `(employeeId, shopDate)` from `ShiftAssignment`; 
   - **With a shift:** `latePenaltyHours` = tier deduction after `gracePeriod` (no tiers → 0); set `status = half_day` per the shift's half-day rule (late-threshold evaluated from check-in; min-hours evaluated only once there is a check-out/auto-close); snapshot `shiftId`, `shiftHours`.
   - **Without a shift assignment:** existing behaviour unchanged (employee `shiftStart/shiftEnd`, 15-min grace, 2h floor, `present`), so nothing regresses for current staff. Flexible-timing staff still exempt from late rules.
   - `on_leave` is never overwritten. Half-day does not add a further deduction by itself (hours worked already reflect it).
5. **Payroll API** (`/payroll`, all **owner only**): `PUT /payroll/wages/:employeeId {pay_type, wage_amount}`; `GET /payroll/wages?branch_id=`; `GET|PUT /payroll/settings`; `GET /payroll/report?branch_id=&month=YYYY-MM` → rows `{employee_id, name, code, pay_type, wage_amount, days_present, half_days, hours_worked, late_deduction_hours, hourly_rate (varies by day if shift hours differ → also per-day breakdown), gross, late_deduction_amount, net_pay, warnings:[...]}`. Pay is summed per attendance day using that day's `shiftHours`. Days with no `shiftHours` (flexible/no shift, or no wage set) contribute 0 and add a warning ("no shift hours" / "no wage set").
6. **Tests** (Jest): `shiftRules` exhaustively (grace boundary, tier selection, overnight shift hours, half-day either/or/blank, daily vs monthly rate, calendar vs fixed divisor, floor at 0); attendance recompute with/without shift (mock prisma); payroll report math with mocked rows; validators; owner-only authorization on every payroll/shift-write route.

## Frontend (`magicscissors-fe`)
1. `ShiftPage` shift form (owner only section): late tiers editor (rows of "late by ≥ X min → deduct Y h") and half-day fields ("late by more than X min" / "worked fewer than Y hours"); read-only summary for non-owners. `shift.service.js` unchanged endpoints.
2. New owner-only **Payroll** page (`/payroll`, sidebar item visible to `owner` only): tabs **Wages** (employee table with pay type + amount inline edit), **Report** (month + branch, table, warnings, CSV via existing `export-utils.js`), and a small **Settings** card (monthly divisor mode / fixed days).
3. New `payroll.service.js`; route + Sidebar entry; changelog entry in `versionHistory.js`.

## Security / permissions
Every write to shift rules, wages, payroll settings and every payroll read is `authorize('owner')` server-side; frontend hides them for other roles. Managers keep reading shifts and assigning employees to shifts (existing behaviour of the Shift pages).

## Known limits (accepted)
- Rule changes are not retroactive: stored `latePenaltyHours`/`status`/`shiftHours` reflect the rules at the time the day was last recomputed (a punch or auto-close). A bulk "recompute month" tool is out of scope.
- Absent / on-leave days earn 0 for both pay types (no paid-leave concept yet); monthly staff with weekly offs will be underpaid unless the owner picks a fixed divisor that matches their working days (e.g. 26).
- A day with several shift assignments is not supported (unique per employee per date).
- No payroll locking, payout, tax/PF or payslip PDF.

## Rollout
`npm run db:push` (additive) on the backend DB; backfill nothing (employees without an assignment keep the legacy rule). Owner then creates shifts with rules, assigns staff, sets wages, and opens the Payroll page.

## Testing / verification
Backend unit tests as above; frontend has no test runner → `npm run build` plus a node assertion script for any pure frontend helper (CSV shaping), and manual browser checks once a database is available (none was available in the previous session).
