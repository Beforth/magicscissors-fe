# Shift Rules + Wage Payroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-shift late-fine and half-day rules applied automatically to attendance, plus owner-defined daily/monthly wages and an owner-only monthly payroll report.

**Architecture:** A pure, unit-tested rule module (`shiftRules`) holds all the maths. The backend gains the missing Shift + ShiftAssignment tables/API (matching what the existing Shift pages already call), `recomputeAttendance` consults the day's assigned shift (falling back to the legacy rule when none), and a new owner-only `/payroll` API computes pay per attendance day from the stored hours, late deductions and shift-hours snapshot. The frontend extends the Shift form with the rules and adds an owner-only Payroll page.

**Tech Stack:** Backend: Node/Express, Prisma (`db push`), Zod, Jest + supertest. Frontend: React 18, Vite, TanStack Query, shadcn/ui. The frontend has no test runner and no ESLint config; its gates are `npm run build` and a node assertion script for pure helpers.

**Spec:** `docs/superpowers/specs/2026-10-06-shift-rules-payroll-design.md`

## Repos and paths

- Frontend repo: `/Users/ady/Documents/magicscissors-fe` (git root).
- Backend repo: `/Users/ady/Documents/magicscissors-fe/magicscissors-be` — it has **its own `.git`**; backend commits happen inside it. Frontend commits must never `git add` anything under `magicscissors-be/`, and never `git add -A` / `git add .`.
- No database exists in the dev environment unless the user starts one; everything is verified with unit tests, `npm run build` and node scripts. Do not claim runtime behaviour you did not observe.
- Commit trailer on every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Commit steps only apply because the user chose subagent-driven execution; do not push.

## Global Constraints

- Shift rules (late tiers, half-day) and wages are editable by the **owner only** (`authorize('owner')`, frontend `user.role === 'owner'`); `developer` is NOT allowed. All payroll routes (reads too) are owner only.
- Managers (and developer/owner) keep **reading shifts and assigning employees** to shifts: `GET /shifts`, `GET/POST/DELETE /shifts/assignments` allow `owner, developer, manager`.
- Late fine is in **hours deducted**, tiered, after a per-shift grace period. A shift with no tiers deducts nothing.
- Half day (per shift): `half_day` if late by **more than** `half_day_late_after_min` minutes **or** (once checked out) hours worked `< half_day_min_hours`. Either may be blank (rule off). Half day adds **no extra deduction**.
- Pay for a day = `hourly × hours_worked − hourly × late_deduction_hours`, floored at 0. Daily: `hourly = wage ÷ shift_hours`. Monthly: `hourly = wage ÷ divisor ÷ shift_hours`, divisor = days in the month (`calendar`, default) or `payroll_monthly_fixed_days` (`fixed`, default 30).
- Employees **without** an assigned shift for the day keep the existing behaviour exactly (employee `shiftStart/shiftEnd`, 15-minute grace, 2-hour floor, status `present`). Flexible-timing staff are exempt from late rules.
- `EmployeeDetail.baseSalary` keeps its current meaning (incentive engine); wages use the new `payType` / `wageAmount` fields.
- Rule changes are not retroactive; absent/on-leave days earn 0; one assignment per employee per date.
- Plan-level ruling (refines the spec, same intent): for payroll, when an attendance row has no `shiftHours` snapshot, use the employee's own `shiftStart/shiftEnd` hours as the shift; only if neither exists is the day skipped with a warning.
- Schema changes are additive and applied with `prisma db push`; no migrations folder.

## Review Focus

- Employee with **no shift assignment** must behave exactly as before (late 15 min / 2 h floor, `present`). → Task 4 test.
- **Overnight shifts** (22:00–06:00): hours = 8, and a check-in after midnight is not "20 hours late". → Task 1 tests.
- **Boundaries:** late exactly at grace → 0; late exactly at a tier's `after_min` → that tier applies; half-day late threshold is strictly "more than". → Task 1 tests.
- **No wage set / no shift hours:** payroll row must show a warning and 0 pay, never `NaN`/`null` math. → Task 5 tests.
- **Month length:** 28/29/30/31-day months in `calendar` mode and `fixed` mode give the right hourly rate. → Task 1 and Task 5 tests.
- **Authorization:** manager/developer/cashier/unauthenticated hitting shift writes or any payroll route → 403/401; generic `/settings` routes must not be able to write the two payroll setting keys. → Task 3, 5 route tests.

---

## File Structure

Backend (`magicscissors-be/`):
- Create `src/utils/shiftRules.js` (+ `.test.js`) — all pure rule/pay maths and tier validation.
- Create `src/test-utils/routeApp.js` — tiny express harness for route/authorization tests.
- Create `src/validators/shift.validator.js`, `src/services/shift.service.js`, `src/controllers/shift.controller.js`, `src/routes/shift.routes.js` (+ tests).
- Create `src/utils/payrollCalc.js` (+ test), `src/validators/payroll.validator.js`, `src/services/payroll.service.js`, `src/controllers/payroll.controller.js`, `src/routes/payroll.routes.js` (+ tests).
- Modify `prisma/schema.prisma`, `src/services/settings.service.js`, `src/routes/settings.routes.js`, `src/routes/index.js`, `src/services/attendance.service.js` (+ its test).

Frontend (`/`):
- Create `src/lib/shiftRules.js`, `src/lib/payroll.js`, `scripts/check-shift-payroll.mjs`, `src/services/payroll.service.js`, `src/pages/PayrollPage.jsx`.
- Modify `src/pages/ShiftPage.jsx`, `src/App.jsx`, `src/components/layout/Sidebar.jsx`, `src/data/versionHistory.js`.

---

## Task 0: Pre-flight (controller, not a subagent task)

- [ ] **Step 1:** The working trees contain uncommitted "worked time" changes from the previous feature. Commit them first so review packages start clean.
  - Backend repo: `git add src/services/selfPunch.service.js src/services/selfPunch.service.test.js && git commit -m "feat(attendance): return worked hours and break minutes on self config"`.
  - Frontend repo: `git add src/lib/utils.js src/pages/MyAttendancePage.jsx src/pages/AttendancePage.jsx src/components/attendance/PunchMeta.jsx && git commit -m "feat(attendance): show worked time and clearer distance label"`.
  - Also commit the docs: `git add docs/superpowers/specs/2026-10-06-shift-rules-payroll-design.md docs/superpowers/plans/2026-10-06-shift-rules-payroll.md` in the frontend repo only.
- [ ] **Step 2:** In BOTH repos cut the work branch: `git checkout -b feat/shift-rules-payroll` (from `feat/pwa-geofence-attendance`).
- [ ] **Step 3:** Record `git rev-parse HEAD` of both repos as the BASEs for review packages.

---

## Task 1: Pure rule module (backend)

**Files:**
- Create: `magicscissors-be/src/utils/shiftRules.js`
- Test: `magicscissors-be/src/utils/shiftRules.test.js`

**Interfaces:**
- Consumes: `parseHHMM(value): number|null` from `./shopDay` (minutes since midnight).
- Produces (all exported):
  - `shiftHours(startTime, endTime): number|null` — hours, overnight-aware, `null` for invalid or equal times.
  - `lateMinutes(checkIn: Date, startTime: string): number` — IST-as-UTC `Date`, never negative, handles check-in after midnight for overnight shifts.
  - `lateDeductionHours(lateMin: number, shift: {gracePeriod, lateTiers}): number`.
  - `isHalfDay({lateMin, workingHours, hasCheckOut}, shift: {halfDayLateAfterMin, halfDayMinHours}): boolean`.
  - `evaluateShiftDay({shift, checkIn, workingHours, hasCheckOut, flexible}): { shiftId, shiftHours, latePenaltyHours, halfDay }`.
  - `validateLateTiers(tiers, gracePeriod): string|null` — error message or `null`.
  - `hourlyRate({payType, wageAmount, shiftHours, daysInMonth, mode, fixedDays}): number|null`.
  - `dayPay({hoursWorked, lateDeductionHours, hourlyRate}): { gross, lateDeductionAmount, net }` (2-decimals, `net >= 0`).
  - A `shift` object uses camelCase Prisma fields: `id, startTime, endTime, gracePeriod, lateTiers (array of {after_min, deduct_hours}|null), halfDayLateAfterMin (int|null), halfDayMinHours (number|string|Decimal|null)`.

- [ ] **Step 1: Write the failing test** — `src/utils/shiftRules.test.js`

```js
const {
  shiftHours, lateMinutes, lateDeductionHours, isHalfDay, evaluateShiftDay,
  validateLateTiers, hourlyRate, dayPay,
} = require('./shiftRules');

const ist = (h, m = 0) => new Date(Date.UTC(2026, 9, 6, h, m, 0));

describe('shiftHours', () => {
  test.each([
    ['10:00', '20:00', 10],
    ['09:30', '18:00', 8.5],
    ['22:00', '06:00', 8],
    ['00:00', '23:59', 23.98],
  ])('%s-%s = %p', (s, e, h) => expect(shiftHours(s, e)).toBe(h));
  test('equal or invalid times → null', () => {
    expect(shiftHours('10:00', '10:00')).toBeNull();
    expect(shiftHours('xx', '10:00')).toBeNull();
    expect(shiftHours(null, '10:00')).toBeNull();
  });
});

describe('lateMinutes', () => {
  test('on time / early → 0', () => {
    expect(lateMinutes(ist(10, 0), '10:00')).toBe(0);
    expect(lateMinutes(ist(9, 40), '10:00')).toBe(0);
  });
  test('late by 25 min', () => expect(lateMinutes(ist(10, 25), '10:00')).toBe(25));
  test('overnight shift, check-in after midnight is not ~20h late', () => {
    // shift 22:00-06:00, checked in at 00:30 the next calendar day → 150 min late
    expect(lateMinutes(ist(0, 30), '22:00')).toBe(150);
  });
  test('null check-in or bad start → 0', () => {
    expect(lateMinutes(null, '10:00')).toBe(0);
    expect(lateMinutes(ist(10, 5), null)).toBe(0);
  });
});

describe('lateDeductionHours', () => {
  const shift = {
    gracePeriod: 10,
    lateTiers: [{ after_min: 15, deduct_hours: 0.5 }, { after_min: 30, deduct_hours: 1 }, { after_min: 60, deduct_hours: 2 }],
  };
  test.each([
    [0, 0], [10, 0], [11, 0], [14, 0], [15, 0.5], [29, 0.5], [30, 1], [59, 1], [60, 2], [300, 2],
  ])('late %p min → %p h', (late, h) => expect(lateDeductionHours(late, shift)).toBe(h));
  test('no tiers → 0 even when late', () => {
    expect(lateDeductionHours(90, { gracePeriod: 5, lateTiers: null })).toBe(0);
    expect(lateDeductionHours(90, { gracePeriod: 5, lateTiers: [] })).toBe(0);
  });
  test('inside grace never deducts even if a tier has a smaller after_min', () => {
    expect(lateDeductionHours(8, { gracePeriod: 10, lateTiers: [{ after_min: 5, deduct_hours: 1 }] })).toBe(0);
  });
  test('unsorted tiers still pick the highest qualifying', () => {
    const s = { gracePeriod: 0, lateTiers: [{ after_min: 30, deduct_hours: 1 }, { after_min: 15, deduct_hours: 0.5 }] };
    expect(lateDeductionHours(40, s)).toBe(1);
  });
});

describe('isHalfDay', () => {
  const both = { halfDayLateAfterMin: 60, halfDayMinHours: '4.00' };
  test('late strictly more than threshold', () => {
    expect(isHalfDay({ lateMin: 60, workingHours: 9, hasCheckOut: true }, both)).toBe(false);
    expect(isHalfDay({ lateMin: 61, workingHours: 9, hasCheckOut: true }, both)).toBe(true);
  });
  test('hours below minimum only after check-out', () => {
    expect(isHalfDay({ lateMin: 0, workingHours: 3.5, hasCheckOut: true }, both)).toBe(true);
    expect(isHalfDay({ lateMin: 0, workingHours: 4, hasCheckOut: true }, both)).toBe(false);
    expect(isHalfDay({ lateMin: 0, workingHours: 1, hasCheckOut: false }, both)).toBe(false);
  });
  test('blank rules are off', () => {
    const off = { halfDayLateAfterMin: null, halfDayMinHours: null };
    expect(isHalfDay({ lateMin: 500, workingHours: 0.5, hasCheckOut: true }, off)).toBe(false);
  });
});

describe('evaluateShiftDay', () => {
  const shift = {
    id: 's1', startTime: '10:00', endTime: '20:00', gracePeriod: 5,
    lateTiers: [{ after_min: 15, deduct_hours: 1 }], halfDayLateAfterMin: 90, halfDayMinHours: 4,
  };
  test('on-time full day', () => {
    expect(evaluateShiftDay({ shift, checkIn: ist(10, 0), workingHours: 9, hasCheckOut: true, flexible: false }))
      .toEqual({ shiftId: 's1', shiftHours: 10, latePenaltyHours: 0, halfDay: false });
  });
  test('20 min late → 1 h deduction, still full day', () => {
    const r = evaluateShiftDay({ shift, checkIn: ist(10, 20), workingHours: 9, hasCheckOut: true, flexible: false });
    expect(r.latePenaltyHours).toBe(1);
    expect(r.halfDay).toBe(false);
  });
  test('flexible staff are exempt from lateness', () => {
    const r = evaluateShiftDay({ shift, checkIn: ist(13, 0), workingHours: 9, hasCheckOut: true, flexible: true });
    expect(r.latePenaltyHours).toBe(0);
    expect(r.halfDay).toBe(false);
  });
  test('no check-in → no deduction', () => {
    const r = evaluateShiftDay({ shift, checkIn: null, workingHours: null, hasCheckOut: false, flexible: false });
    expect(r.latePenaltyHours).toBe(0);
    expect(r.halfDay).toBe(false);
  });
});

describe('validateLateTiers', () => {
  test('valid / empty / null', () => {
    expect(validateLateTiers([{ after_min: 15, deduct_hours: 0.5 }, { after_min: 30, deduct_hours: 1 }], 10)).toBeNull();
    expect(validateLateTiers([], 10)).toBeNull();
    expect(validateLateTiers(null, 10)).toBeNull();
  });
  test.each([
    ['not ascending', [{ after_min: 30, deduct_hours: 1 }, { after_min: 15, deduct_hours: 1 }], 10],
    ['duplicate after_min', [{ after_min: 15, deduct_hours: 1 }, { after_min: 15, deduct_hours: 2 }], 10],
    ['after_min not above grace', [{ after_min: 10, deduct_hours: 1 }], 10],
    ['zero deduction', [{ after_min: 20, deduct_hours: 0 }], 10],
    ['deduction over 24h', [{ after_min: 20, deduct_hours: 25 }], 10],
    ['non-integer after_min', [{ after_min: 20.5, deduct_hours: 1 }], 10],
  ])('rejects %s', (_l, tiers, grace) => expect(typeof validateLateTiers(tiers, grace)).toBe('string'));
});

describe('hourlyRate', () => {
  test('daily: 500 over a 10h shift = 50/h', () => {
    expect(hourlyRate({ payType: 'daily', wageAmount: 500, shiftHours: 10 })).toBe(50);
  });
  test('monthly calendar mode uses days in month', () => {
    expect(hourlyRate({ payType: 'monthly', wageAmount: 31000, shiftHours: 10, daysInMonth: 31, mode: 'calendar', fixedDays: 30 })).toBe(100);
    expect(hourlyRate({ payType: 'monthly', wageAmount: 28000, shiftHours: 10, daysInMonth: 28, mode: 'calendar', fixedDays: 30 })).toBe(100);
  });
  test('monthly fixed mode ignores month length', () => {
    expect(hourlyRate({ payType: 'monthly', wageAmount: 26000, shiftHours: 10, daysInMonth: 31, mode: 'fixed', fixedDays: 26 })).toBe(100);
  });
  test('missing inputs → null (never NaN)', () => {
    expect(hourlyRate({ payType: null, wageAmount: 500, shiftHours: 10 })).toBeNull();
    expect(hourlyRate({ payType: 'daily', wageAmount: null, shiftHours: 10 })).toBeNull();
    expect(hourlyRate({ payType: 'daily', wageAmount: 500, shiftHours: null })).toBeNull();
    expect(hourlyRate({ payType: 'daily', wageAmount: 500, shiftHours: 0 })).toBeNull();
    expect(hourlyRate({ payType: 'monthly', wageAmount: 500, shiftHours: 10, daysInMonth: 0, mode: 'calendar', fixedDays: 30 })).toBeNull();
  });
  test('wage as string/Decimal-like is accepted', () => {
    expect(hourlyRate({ payType: 'daily', wageAmount: '500.00', shiftHours: 10 })).toBe(50);
  });
});

describe('dayPay', () => {
  test('8h worked, 1h late deduction at 50/h', () => {
    expect(dayPay({ hoursWorked: 8, lateDeductionHours: 1, hourlyRate: 50 }))
      .toEqual({ gross: 400, lateDeductionAmount: 50, net: 350 });
  });
  test('net never below 0', () => {
    expect(dayPay({ hoursWorked: 1, lateDeductionHours: 5, hourlyRate: 50 }).net).toBe(0);
  });
  test('null rate → zeros', () => {
    expect(dayPay({ hoursWorked: 8, lateDeductionHours: 1, hourlyRate: null })).toEqual({ gross: 0, lateDeductionAmount: 0, net: 0 });
  });
  test('rounds to 2 decimals', () => {
    expect(dayPay({ hoursWorked: 7.33, lateDeductionHours: 0, hourlyRate: 33.3333 }).gross).toBe(244.33);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — in `magicscissors-be/`: `npx jest src/utils/shiftRules.test.js --coverage=false` → FAIL (`Cannot find module './shiftRules'`).

- [ ] **Step 3: Implement** — `src/utils/shiftRules.js`

```js
const { parseHHMM } = require('./shopDay');

const MIN_PER_DAY = 24 * 60;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Hours between two HH:MM strings; overnight-aware; null when invalid or equal. */
function shiftHours(startTime, endTime) {
  const s = parseHHMM(startTime);
  const e = parseHHMM(endTime);
  if (s == null || e == null || s === e) return null;
  const diff = e > s ? e - s : e + MIN_PER_DAY - s;
  return round2(diff / 60);
}

/** Minutes late vs shift start (IST-as-UTC Date). Never negative. */
function lateMinutes(checkIn, startTime) {
  const start = parseHHMM(startTime);
  if (!checkIn || start == null) return 0;
  const inMin = checkIn.getUTCHours() * 60 + checkIn.getUTCMinutes();
  let late = inMin - start;
  // Overnight shift, check-in after midnight: treat as the following day.
  if (late < -12 * 60) late += MIN_PER_DAY;
  return Math.max(0, late);
}

/** Highest tier whose after_min <= lateMin, only when lateMin is past the grace period. */
function lateDeductionHours(lateMin, shift) {
  const grace = Number(shift?.gracePeriod ?? 0);
  if (!(lateMin > grace)) return 0;
  const tiers = Array.isArray(shift?.lateTiers) ? shift.lateTiers : [];
  let best = null;
  for (const t of tiers) {
    if (lateMin >= t.after_min && (best == null || t.after_min > best.after_min)) best = t;
  }
  return best ? Number(best.deduct_hours) : 0;
}

function isHalfDay({ lateMin, workingHours, hasCheckOut }, shift) {
  const lateAfter = shift?.halfDayLateAfterMin;
  const minHours = shift?.halfDayMinHours;
  const lateRule = lateAfter != null && lateMin > Number(lateAfter);
  const hoursRule =
    minHours != null && hasCheckOut && workingHours != null && Number(workingHours) < Number(minHours);
  return Boolean(lateRule || hoursRule);
}

function evaluateShiftDay({ shift, checkIn, workingHours, hasCheckOut, flexible }) {
  const lateMin = checkIn && !flexible ? lateMinutes(checkIn, shift.startTime) : 0;
  return {
    shiftId: shift.id,
    shiftHours: shiftHours(shift.startTime, shift.endTime),
    latePenaltyHours: lateDeductionHours(lateMin, shift),
    halfDay: isHalfDay({ lateMin, workingHours, hasCheckOut }, shift),
  };
}

/** Returns an error string or null. Tiers must be strictly ascending and above the grace period. */
function validateLateTiers(tiers, gracePeriod) {
  if (tiers == null) return null;
  if (!Array.isArray(tiers)) return 'late_tiers must be a list';
  let prev = Number(gracePeriod ?? 0);
  for (const t of tiers) {
    if (!Number.isInteger(t?.after_min) || t.after_min < 1 || t.after_min > MIN_PER_DAY) {
      return 'Each late tier needs a whole number of minutes (1-1440)';
    }
    if (!(t.after_min > prev)) {
      return 'Late tiers must be in increasing order and above the grace period';
    }
    if (!(Number(t.deduct_hours) > 0) || Number(t.deduct_hours) > 24) {
      return 'Each late tier must deduct more than 0 and at most 24 hours';
    }
    prev = t.after_min;
  }
  return null;
}

function hourlyRate({ payType, wageAmount, shiftHours: hours, daysInMonth, mode, fixedDays }) {
  const wage = wageAmount == null ? NaN : Number(wageAmount);
  if (!payType || !Number.isFinite(wage) || !(Number(hours) > 0)) return null;
  if (payType === 'daily') return wage / Number(hours);
  if (payType === 'monthly') {
    const divisor = mode === 'fixed' ? Number(fixedDays) : Number(daysInMonth);
    if (!(divisor > 0)) return null;
    return wage / divisor / Number(hours);
  }
  return null;
}

function dayPay({ hoursWorked, lateDeductionHours: lateHours, hourlyRate: rate }) {
  if (rate == null || !Number.isFinite(rate)) return { gross: 0, lateDeductionAmount: 0, net: 0 };
  const gross = round2(rate * Number(hoursWorked || 0));
  const lateDeductionAmount = round2(rate * Number(lateHours || 0));
  return { gross, lateDeductionAmount, net: Math.max(0, round2(gross - lateDeductionAmount)) };
}

module.exports = {
  shiftHours, lateMinutes, lateDeductionHours, isHalfDay, evaluateShiftDay,
  validateLateTiers, hourlyRate, dayPay, round2,
};
```

- [ ] **Step 4: Run to verify it passes** — `npx jest src/utils/shiftRules.test.js --coverage=false` → PASS.
- [ ] **Step 5: Commit** (inside `magicscissors-be/`)

```bash
git add src/utils/shiftRules.js src/utils/shiftRules.test.js
git commit -m "feat(shifts): pure shift late/half-day and wage rules"
```

---

## Task 2: Schema, settings defaults, settings-route guard (backend)

**Files:**
- Modify: `magicscissors-be/prisma/schema.prisma` (enum block ~line 121, `model EmployeeDetail` ~line 1038, `model Attendance` ~line 1140)
- Modify: `magicscissors-be/src/services/settings.service.js` (`DEFAULT_SETTINGS`)
- Modify: `magicscissors-be/src/routes/settings.routes.js` (`PUT /` and `PUT /:key`)

**Interfaces:**
- Produces: Prisma models `shift`, `shiftAssignment`; enum `PayType { daily monthly }`; `employeeDetail.payType`, `employeeDetail.wageAmount`; `attendance.shiftId`, `attendance.shiftHours`; setting keys `payroll_monthly_days_mode` (string, default `calendar`) and `payroll_monthly_fixed_days` (number, default `30`), both non-public; exported const `PAYROLL_SETTING_KEYS = ['payroll_monthly_days_mode','payroll_monthly_fixed_days']` from `settings.service.js` (named export alongside the existing singleton default: `module.exports = settingsService; module.exports.PAYROLL_SETTING_KEYS = [...]`).

- [ ] **Step 1: Edit `schema.prisma`.** Add near the other enums:

```prisma
enum PayType {
  daily
  monthly
}
```

In `model EmployeeDetail`, add fields (before the relation block) and a back-relation:

```prisma
  payType               PayType?  @map("pay_type")
  wageAmount            Decimal?  @map("wage_amount") @db.Decimal(10, 2)
  shiftAssignments      ShiftAssignment[]
```

In `model Attendance`, add:

```prisma
  shiftId           String?          @map("shift_id") @db.Uuid
  shiftHours        Decimal?         @map("shift_hours") @db.Decimal(4, 2)
```

Add new models (after `AttendanceGeofence`):

```prisma
model Shift {
  id                  String   @id @default(uuid()) @db.Uuid
  name                String   @db.VarChar(100)
  startTime           String   @map("start_time") @db.VarChar(5)
  endTime             String   @map("end_time") @db.VarChar(5)
  colorCode           String   @default("#6366f1") @map("color_code") @db.VarChar(9)
  gracePeriod         Int      @default(5) @map("grace_period")
  lateTiers           Json?    @map("late_tiers")
  halfDayLateAfterMin Int?     @map("half_day_late_after_min")
  halfDayMinHours     Decimal? @map("half_day_min_hours") @db.Decimal(4, 2)
  isActive            Boolean  @default(true) @map("is_active")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  assignments ShiftAssignment[]

  @@map("shifts")
}

model ShiftAssignment {
  id          String   @id @default(uuid()) @db.Uuid
  employeeId  String   @map("employee_id") @db.Uuid
  shiftId     String   @map("shift_id") @db.Uuid
  shiftDate   DateTime @map("shift_date") @db.Date
  createdById String?  @map("created_by") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at")

  employee EmployeeDetail @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  shift    Shift          @relation(fields: [shiftId], references: [id])

  @@unique([employeeId, shiftDate])
  @@index([shiftDate])
  @@index([shiftId])
  @@map("shift_assignments")
}
```

- [ ] **Step 2: Validate and generate** — `npx prisma validate && npx prisma generate` (use a dummy `DATABASE_URL=postgresql://u:p@localhost:5432/x` env var if none is set). Expected: valid, client generated. If a database is reachable, also `npm run db:migrate-deploy -- --dry-run` and confirm the diff is purely additive; otherwise say it was skipped.

- [ ] **Step 3: Settings defaults** — in `DEFAULT_SETTINGS` (under `// Employee Settings`):

```js
  payroll_monthly_days_mode: { value: 'calendar', type: 'string', public: false },
  payroll_monthly_fixed_days: { value: '30', type: 'number', public: false },
```

At the bottom of `settings.service.js`, after `module.exports = new SettingsService();`, add:

```js
module.exports.PAYROLL_SETTING_KEYS = ['payroll_monthly_days_mode', 'payroll_monthly_fixed_days'];
```

- [ ] **Step 4: Guard the generic settings routes** (same pattern already used for `attendance_require_selfie`). In `settings.routes.js` import `const { PAYROLL_SETTING_KEYS } = require('../services/settings.service');`. In `PUT /` add, next to the existing delete: `PAYROLL_SETTING_KEYS.forEach((k) => delete req.body[k]);` (guard `req.body` is an object). In `PUT /:key` add: `if (PAYROLL_SETTING_KEYS.includes(req.params.key)) throw new AppError('Use the payroll settings endpoint', 403, 'FORBIDDEN');`. Leave the existing `attendance_require_selfie` guards untouched.

- [ ] **Step 5: Verify** — `node -e "require('./src/app')"` exits cleanly; `npx jest --coverage=false` passes (no regression).
- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/services/settings.service.js src/routes/settings.routes.js
git commit -m "feat(shifts): shift, assignment and wage schema; payroll setting defaults"
```

---

## Task 3: Shift API (backend)

**Files:**
- Create: `src/test-utils/routeApp.js`, `src/validators/shift.validator.js`, `src/services/shift.service.js`, `src/controllers/shift.controller.js`, `src/routes/shift.routes.js`
- Modify: `src/routes/index.js` (mount `/shifts`)
- Test: `src/validators/shift.validator.test.js`, `src/services/shift.service.test.js`, `src/routes/shift.routes.test.js`

**Interfaces:**
- Consumes: `validateLateTiers` (Task 1), prisma models (Task 2), `authenticate/authorize` from `../middleware/auth`, `validate` from `../middleware/validate`, `catchAsync`, `sendResponse`, `AppError`.
- Produces — response bodies are `{success, data, meta}` via `sendResponse`; shift DTO: `{ id, name, start_time, end_time, color_code, grace_period, late_tiers: [{after_min,deduct_hours}], half_day_late_after_min: number|null, half_day_min_hours: number|null, is_active, employee_count }`; assignment DTO: `{ id, employee_id, shift_id, shift_date: 'YYYY-MM-DD' }`.
  - `GET /shifts` (owner, developer, manager) → `data: Shift[]`
  - `GET /shifts/:id` (same roles)
  - `POST /shifts` (**owner**) body `{name,start_time,end_time,color_code?,grace_period?,late_tiers?,half_day_late_after_min?,half_day_min_hours?}` → 201
  - `PUT /shifts/:id` (**owner**) any subset → 200
  - `PATCH /shifts/:id/toggle-active` (**owner**) → 200 shift
  - `GET /shifts/assignments?month=YYYY-MM` (owner, developer, manager) → `data: Assignment[]`
  - `POST /shifts/assignments` (owner, developer, manager) body `{employee_id, shift_id, shift_date}` → 201 assignment (upsert: replaces an existing assignment for that employee+date)
  - `DELETE /shifts/assignments/:id` (owner, developer, manager) → 200 `{id}`
  - Service exports: `listShifts, getShift, createShift, updateShift, toggleActive, listAssignments, assign, removeAssignment, toShiftDto`.
  - Test helper: `makeApp(mountPath, router)` from `src/test-utils/routeApp.js`.

- [ ] **Step 1: Helper** — `src/test-utils/routeApp.js`

```js
const express = require('express');
const errorHandler = require('../middleware/errorHandler');

/** Minimal express app for route/authorization tests. */
function makeApp(mountPath, router) {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  app.use(errorHandler);
  return app;
}

module.exports = { makeApp };
```

- [ ] **Step 2: Write failing validator tests** — `src/validators/shift.validator.test.js`

```js
const { createShiftSchema, updateShiftSchema, assignSchema, listAssignmentsSchema } = require('./shift.validator');

const base = { name: 'Morning', start_time: '10:00', end_time: '20:00' };
const parse = (schema, body = {}, query = {}, params = {}) => schema.safeParse({ body, query, params });

describe('createShiftSchema', () => {
  test('accepts minimal body and defaults grace to 5', () => {
    const r = parse(createShiftSchema, base);
    expect(r.success).toBe(true);
    expect(r.data.body.grace_period).toBe(5);
  });
  test('accepts rules', () => {
    expect(parse(createShiftSchema, {
      ...base, grace_period: 10,
      late_tiers: [{ after_min: 15, deduct_hours: 0.5 }],
      half_day_late_after_min: 90, half_day_min_hours: 4,
    }).success).toBe(true);
  });
  test('accepts null (blank) half-day fields', () => {
    expect(parse(createShiftSchema, { ...base, half_day_late_after_min: null, half_day_min_hours: null }).success).toBe(true);
  });
  test.each([
    ['empty name', { name: ' ' }],
    ['bad start', { start_time: '25:00' }],
    ['bad end', { end_time: '9am' }],
    ['same start/end', { start_time: '10:00', end_time: '10:00' }],
    ['grace 121', { grace_period: 121 }],
    ['bad colour', { color_code: 'red' }],
    ['tier deduct 0', { late_tiers: [{ after_min: 20, deduct_hours: 0 }] }],
    ['half-day hours 25', { half_day_min_hours: 25 }],
    ['half-day late 1441', { half_day_late_after_min: 1441 }],
  ])('rejects %s', (_l, over) => expect(parse(createShiftSchema, { ...base, ...over }).success).toBe(false));
});

describe('updateShiftSchema', () => {
  const id = '3f2b6d2e-5b53-4b8a-9d57-0d1f6f8f0a11';
  test('accepts a subset', () => expect(parse(updateShiftSchema, { name: 'X' }, {}, { id }).success).toBe(true));
  test('rejects bad id', () => expect(parse(updateShiftSchema, {}, {}, { id: 'nope' }).success).toBe(false));
});

describe('assignSchema / listAssignmentsSchema', () => {
  const uuid = '3f2b6d2e-5b53-4b8a-9d57-0d1f6f8f0a11';
  test('assign ok', () =>
    expect(parse(assignSchema, { employee_id: uuid, shift_id: uuid, shift_date: '2026-10-06' }).success).toBe(true));
  test.each([['2026-13-01'], ['06-10-2026'], ['2026-10-6']])('assign rejects date %s', (d) =>
    expect(parse(assignSchema, { employee_id: uuid, shift_id: uuid, shift_date: d }).success).toBe(false));
  test('month format', () => {
    expect(parse(listAssignmentsSchema, {}, { month: '2026-10' }).success).toBe(true);
    expect(parse(listAssignmentsSchema, {}, { month: '2026-1' }).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run → fail** (`npx jest src/validators/shift.validator.test.js --coverage=false`, module not found). **Implement** `src/validators/shift.validator.js`:

```js
const { z } = require('zod');

const empty = z.object({}).optional();
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const hhmm = z.string().regex(HHMM, 'Time must be HH:MM');
const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colour must be #RRGGBB');
const grace = z.number().int().min(0).max(120);
const tier = z.object({
  after_min: z.number().int().min(1).max(1440),
  deduct_hours: z.number().gt(0).max(24),
});
const tiers = z.array(tier).max(10);
const halfLate = z.number().int().min(0).max(1440);
const halfHours = z.number().gt(0).max(24);
const uuid = (m) => z.string().uuid(m);

const notSame = (b) => !(b.start_time && b.end_time && b.start_time === b.end_time);

const createShiftSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'Name is required').max(100),
      start_time: hhmm,
      end_time: hhmm,
      color_code: colour.optional(),
      grace_period: grace.default(5),
      late_tiers: tiers.nullable().optional(),
      half_day_late_after_min: halfLate.nullable().optional(),
      half_day_min_hours: halfHours.nullable().optional(),
    })
    .refine(notSame, { message: 'Start and end time cannot be the same', path: ['end_time'] }),
  query: empty,
  params: empty,
});

const updateShiftSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      start_time: hhmm.optional(),
      end_time: hhmm.optional(),
      color_code: colour.optional(),
      grace_period: grace.optional(),
      late_tiers: tiers.nullable().optional(),
      half_day_late_after_min: halfLate.nullable().optional(),
      half_day_min_hours: halfHours.nullable().optional(),
    })
    .refine(notSame, { message: 'Start and end time cannot be the same', path: ['end_time'] }),
  query: empty,
  params: z.object({ id: uuid('Invalid shift ID') }),
});

const shiftIdParamSchema = z.object({
  body: empty,
  query: empty,
  params: z.object({ id: uuid('Invalid ID') }),
});

const listAssignmentsSchema = z.object({
  body: empty,
  query: z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM') }),
  params: empty,
});

const assignSchema = z.object({
  body: z.object({
    employee_id: uuid('Invalid employee ID'),
    shift_id: uuid('Invalid shift ID'),
    shift_date: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Date must be YYYY-MM-DD'),
  }),
  query: empty,
  params: empty,
});

module.exports = {
  createShiftSchema, updateShiftSchema, shiftIdParamSchema, listAssignmentsSchema, assignSchema,
};
```

Run → PASS.

- [ ] **Step 4: Write failing service tests** — `src/services/shift.service.test.js`

```js
jest.mock('../config/database', () => ({
  shift: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  shiftAssignment: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), delete: jest.fn() },
  employeeDetail: { findUnique: jest.fn() },
}));
const prisma = require('../config/database');
const svc = require('./shift.service');

const row = (over = {}) => ({
  id: 's1', name: 'Morning', startTime: '10:00', endTime: '20:00', colorCode: '#6366f1',
  gracePeriod: 5, lateTiers: [{ after_min: 15, deduct_hours: 1 }], halfDayLateAfterMin: null,
  halfDayMinHours: null, isActive: true, ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.shiftAssignment.findMany.mockResolvedValue([]); // employee_count lookups
});

describe('toShiftDto', () => {
  test('maps to the shape the Shift pages use', () => {
    expect(svc.toShiftDto(row({ halfDayMinHours: '4.00' }), 3)).toEqual({
      id: 's1', name: 'Morning', start_time: '10:00', end_time: '20:00', color_code: '#6366f1',
      grace_period: 5, late_tiers: [{ after_min: 15, deduct_hours: 1 }],
      half_day_late_after_min: null, half_day_min_hours: 4, is_active: true, employee_count: 3,
    });
  });
  test('null tiers become []', () => {
    expect(svc.toShiftDto(row({ lateTiers: null }), 0).late_tiers).toEqual([]);
  });
});

describe('createShift', () => {
  test('rejects tiers that are not above the grace period', async () => {
    await expect(svc.createShift({
      name: 'X', start_time: '10:00', end_time: '20:00', grace_period: 10,
      late_tiers: [{ after_min: 10, deduct_hours: 1 }],
    })).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    expect(prisma.shift.create).not.toHaveBeenCalled();
  });
  test('creates with mapped columns', async () => {
    prisma.shift.create.mockResolvedValue(row());
    await svc.createShift({
      name: 'Morning', start_time: '10:00', end_time: '20:00', grace_period: 5,
      late_tiers: [{ after_min: 15, deduct_hours: 1 }], half_day_late_after_min: 90, half_day_min_hours: 4,
    });
    expect(prisma.shift.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Morning', startTime: '10:00', endTime: '20:00', gracePeriod: 5,
        lateTiers: [{ after_min: 15, deduct_hours: 1 }], halfDayLateAfterMin: 90, halfDayMinHours: 4,
      }),
    });
  });
});

describe('updateShift', () => {
  test('clearing tiers writes Prisma.DbNull, not a plain null', async () => {
    const { Prisma } = require('@prisma/client');
    prisma.shift.findUnique.mockResolvedValue(row());
    prisma.shift.update.mockResolvedValue(row({ lateTiers: null }));
    await svc.updateShift('s1', { late_tiers: null });
    expect(prisma.shift.update.mock.calls[0][0].data.lateTiers).toBe(Prisma.DbNull);
  });
  test('404 when missing', async () => {
    prisma.shift.findUnique.mockResolvedValue(null);
    await expect(svc.updateShift('s1', { name: 'x' })).rejects.toMatchObject({ statusCode: 404 });
  });
  test('validates merged tiers against the NEW grace period', async () => {
    prisma.shift.findUnique.mockResolvedValue(row({ gracePeriod: 5, lateTiers: [{ after_min: 15, deduct_hours: 1 }] }));
    await expect(svc.updateShift('s1', { grace_period: 20 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  test('explicit null clears the half-day rule', async () => {
    prisma.shift.findUnique.mockResolvedValue(row({ halfDayLateAfterMin: 90 }));
    prisma.shift.update.mockResolvedValue(row());
    await svc.updateShift('s1', { half_day_late_after_min: null });
    expect(prisma.shift.update.mock.calls[0][0].data.halfDayLateAfterMin).toBeNull();
  });
});

describe('assign', () => {
  const input = { employee_id: 'e1', shift_id: 's1', shift_date: '2026-10-06' };
  test('unknown employee → 404', async () => {
    prisma.employeeDetail.findUnique.mockResolvedValue(null);
    prisma.shift.findUnique.mockResolvedValue(row());
    await expect(svc.assign(input, 'owner1')).rejects.toMatchObject({ statusCode: 404 });
  });
  test('inactive shift → 409', async () => {
    prisma.employeeDetail.findUnique.mockResolvedValue({ id: 'e1' });
    prisma.shift.findUnique.mockResolvedValue(row({ isActive: false }));
    await expect(svc.assign(input, 'owner1')).rejects.toMatchObject({ statusCode: 409 });
  });
  test('upserts on (employee, date) with a UTC-midnight date', async () => {
    prisma.employeeDetail.findUnique.mockResolvedValue({ id: 'e1' });
    prisma.shift.findUnique.mockResolvedValue(row());
    prisma.shiftAssignment.upsert.mockResolvedValue({ id: 'a1', employeeId: 'e1', shiftId: 's1', shiftDate: new Date('2026-10-06T00:00:00.000Z') });
    const r = await svc.assign(input, 'owner1');
    const arg = prisma.shiftAssignment.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ employeeId_shiftDate: { employeeId: 'e1', shiftDate: new Date('2026-10-06T00:00:00.000Z') } });
    expect(r).toEqual({ id: 'a1', employee_id: 'e1', shift_id: 's1', shift_date: '2026-10-06' });
  });
});

describe('listAssignments', () => {
  test('queries the month range inclusive', async () => {
    prisma.shiftAssignment.findMany.mockResolvedValue([]);
    await svc.listAssignments('2026-02');
    const where = prisma.shiftAssignment.findMany.mock.calls[0][0].where;
    expect(where.shiftDate.gte).toEqual(new Date('2026-02-01T00:00:00.000Z'));
    expect(where.shiftDate.lte).toEqual(new Date('2026-02-28T00:00:00.000Z'));
  });
});

describe('removeAssignment', () => {
  test('404 when missing', async () => {
    prisma.shiftAssignment.findUnique.mockResolvedValue(null);
    await expect(svc.removeAssignment('a1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
```

Run → fail. **Implement** `src/services/shift.service.js`:

```js
const { Prisma } = require('@prisma/client');
const prisma = require('../config/database');
const AppError = require('../utils/AppError');
const { validateLateTiers } = require('../utils/shiftRules');

// A nullable Json column cannot be written with a plain JS null — Prisma needs DbNull.
const jsonOrNull = (v) => (v == null ? Prisma.DbNull : v);

const dateKey = (d) => d.toISOString().split('T')[0];
const dayStart = (s) => new Date(`${s}T00:00:00.000Z`);

function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 0)) };
}

function toShiftDto(s, employeeCount = 0) {
  return {
    id: s.id,
    name: s.name,
    start_time: s.startTime,
    end_time: s.endTime,
    color_code: s.colorCode,
    grace_period: s.gracePeriod,
    late_tiers: Array.isArray(s.lateTiers) ? s.lateTiers : [],
    half_day_late_after_min: s.halfDayLateAfterMin ?? null,
    half_day_min_hours: s.halfDayMinHours == null ? null : Number(s.halfDayMinHours),
    is_active: s.isActive,
    employee_count: employeeCount,
  };
}

const toAssignmentDto = (a) => ({
  id: a.id, employee_id: a.employeeId, shift_id: a.shiftId, shift_date: dateKey(a.shiftDate),
});

async function employeeCounts() {
  const now = new Date();
  const { start, end } = monthRange(`${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`);
  const rows = await prisma.shiftAssignment.findMany({
    where: { shiftDate: { gte: start, lte: end } },
    select: { shiftId: true, employeeId: true },
    distinct: ['shiftId', 'employeeId'],
  });
  const counts = new Map();
  rows.forEach((r) => counts.set(r.shiftId, (counts.get(r.shiftId) || 0) + 1));
  return counts;
}

async function listShifts() {
  const [shifts, counts] = await Promise.all([
    prisma.shift.findMany({ orderBy: [{ startTime: 'asc' }, { name: 'asc' }] }),
    employeeCounts(),
  ]);
  return shifts.map((s) => toShiftDto(s, counts.get(s.id) || 0));
}

async function getShift(id) {
  const s = await prisma.shift.findUnique({ where: { id } });
  if (!s) throw new AppError('Shift not found', 404, 'NOT_FOUND');
  return toShiftDto(s, (await employeeCounts()).get(id) || 0);
}

function assertTiers(tiers, grace) {
  const err = validateLateTiers(tiers, grace);
  if (err) throw new AppError(err, 400, 'VALIDATION_ERROR');
}

async function createShift(input) {
  assertTiers(input.late_tiers ?? null, input.grace_period ?? 5);
  const s = await prisma.shift.create({
    data: {
      name: input.name,
      startTime: input.start_time,
      endTime: input.end_time,
      colorCode: input.color_code ?? '#6366f1',
      gracePeriod: input.grace_period ?? 5,
      lateTiers: jsonOrNull(input.late_tiers),
      halfDayLateAfterMin: input.half_day_late_after_min ?? null,
      halfDayMinHours: input.half_day_min_hours ?? null,
    },
  });
  return toShiftDto(s, 0);
}

async function updateShift(id, input) {
  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) throw new AppError('Shift not found', 404, 'NOT_FOUND');

  const grace = input.grace_period ?? existing.gracePeriod;
  const tiers = input.late_tiers !== undefined ? input.late_tiers : existing.lateTiers;
  assertTiers(tiers, grace);
  const start = input.start_time ?? existing.startTime;
  const end = input.end_time ?? existing.endTime;
  if (start === end) throw new AppError('Start and end time cannot be the same', 400, 'VALIDATION_ERROR');

  const data = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.start_time !== undefined) data.startTime = input.start_time;
  if (input.end_time !== undefined) data.endTime = input.end_time;
  if (input.color_code !== undefined) data.colorCode = input.color_code;
  if (input.grace_period !== undefined) data.gracePeriod = input.grace_period;
  if (input.late_tiers !== undefined) data.lateTiers = jsonOrNull(input.late_tiers);
  if (input.half_day_late_after_min !== undefined) data.halfDayLateAfterMin = input.half_day_late_after_min;
  if (input.half_day_min_hours !== undefined) data.halfDayMinHours = input.half_day_min_hours;

  const s = await prisma.shift.update({ where: { id }, data });
  return toShiftDto(s, (await employeeCounts()).get(id) || 0);
}

async function toggleActive(id) {
  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) throw new AppError('Shift not found', 404, 'NOT_FOUND');
  const s = await prisma.shift.update({ where: { id }, data: { isActive: !existing.isActive } });
  return toShiftDto(s, (await employeeCounts()).get(id) || 0);
}

async function listAssignments(month) {
  const { start, end } = monthRange(month);
  const rows = await prisma.shiftAssignment.findMany({
    where: { shiftDate: { gte: start, lte: end } },
    orderBy: [{ shiftDate: 'asc' }],
  });
  return rows.map(toAssignmentDto);
}

async function assign({ employee_id, shift_id, shift_date }, userId) {
  const [employee, shift] = await Promise.all([
    prisma.employeeDetail.findUnique({ where: { id: employee_id }, select: { id: true } }),
    prisma.shift.findUnique({ where: { id: shift_id } }),
  ]);
  if (!employee) throw new AppError('Employee not found', 404, 'NOT_FOUND');
  if (!shift) throw new AppError('Shift not found', 404, 'NOT_FOUND');
  if (!shift.isActive) throw new AppError('Shift is inactive', 409, 'SHIFT_INACTIVE');

  const date = dayStart(shift_date);
  const row = await prisma.shiftAssignment.upsert({
    where: { employeeId_shiftDate: { employeeId: employee_id, shiftDate: date } },
    create: { employeeId: employee_id, shiftId: shift_id, shiftDate: date, createdById: userId || null },
    update: { shiftId: shift_id, createdById: userId || null },
  });
  return toAssignmentDto(row);
}

async function removeAssignment(id) {
  const existing = await prisma.shiftAssignment.findUnique({ where: { id } });
  if (!existing) throw new AppError('Assignment not found', 404, 'NOT_FOUND');
  await prisma.shiftAssignment.delete({ where: { id } });
  return { id };
}

module.exports = {
  toShiftDto, listShifts, getShift, createShift, updateShift, toggleActive,
  listAssignments, assign, removeAssignment,
};
```

Run → PASS.

- [ ] **Step 5: Controller, routes, mount.** `src/controllers/shift.controller.js`:

```js
const shiftService = require('../services/shift.service');
const catchAsync = require('../utils/catchAsync');
const { sendResponse } = require('../utils/response');

exports.list = catchAsync(async (req, res) => sendResponse(res, 200, await shiftService.listShifts()));
exports.get = catchAsync(async (req, res) => sendResponse(res, 200, await shiftService.getShift(req.params.id)));
exports.create = catchAsync(async (req, res) => sendResponse(res, 201, await shiftService.createShift(req.body)));
exports.update = catchAsync(async (req, res) =>
  sendResponse(res, 200, await shiftService.updateShift(req.params.id, req.body)));
exports.toggleActive = catchAsync(async (req, res) =>
  sendResponse(res, 200, await shiftService.toggleActive(req.params.id)));
exports.listAssignments = catchAsync(async (req, res) =>
  sendResponse(res, 200, await shiftService.listAssignments(req.query.month)));
exports.assign = catchAsync(async (req, res) =>
  sendResponse(res, 201, await shiftService.assign(req.body, req.user.id)));
exports.removeAssignment = catchAsync(async (req, res) =>
  sendResponse(res, 200, await shiftService.removeAssignment(req.params.id)));
```

`src/routes/shift.routes.js` (assignment routes MUST come before `/:id`):

```js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/shift.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createShiftSchema, updateShiftSchema, shiftIdParamSchema, listAssignmentsSchema, assignSchema,
} = require('../validators/shift.validator');

const READ = ['owner', 'developer', 'manager'];

router.get('/assignments', authenticate, authorize(...READ), validate(listAssignmentsSchema), ctrl.listAssignments);
router.post('/assignments', authenticate, authorize(...READ), validate(assignSchema), ctrl.assign);
router.delete('/assignments/:id', authenticate, authorize(...READ), validate(shiftIdParamSchema), ctrl.removeAssignment);

router.get('/', authenticate, authorize(...READ), ctrl.list);
router.post('/', authenticate, authorize('owner'), validate(createShiftSchema), ctrl.create);
router.get('/:id', authenticate, authorize(...READ), validate(shiftIdParamSchema), ctrl.get);
router.put('/:id', authenticate, authorize('owner'), validate(updateShiftSchema), ctrl.update);
router.patch('/:id/toggle-active', authenticate, authorize('owner'), validate(shiftIdParamSchema), ctrl.toggleActive);

module.exports = router;
```

In `src/routes/index.js` add `const shiftRoutes = require('./shift.routes');` with the other requires and `router.use('/shifts', shiftRoutes);` next to the other `router.use(...)` lines.

- [ ] **Step 6: Authorization route test** — `src/routes/shift.routes.test.js`

```js
jest.mock('../middleware/auth', () => {
  const real = jest.requireActual('../middleware/auth');
  return {
    ...real,
    authenticate: (req, res, next) => {
      if (!req.headers['x-role']) return next(new (require('../utils/AppError'))('No token', 401, 'UNAUTHORIZED'));
      req.user = { id: 'u1', role: req.headers['x-role'] };
      next();
    },
  };
});
jest.mock('../services/shift.service', () => ({
  listShifts: jest.fn().mockResolvedValue([]),
  getShift: jest.fn().mockResolvedValue({}),
  createShift: jest.fn().mockResolvedValue({ id: 's1' }),
  updateShift: jest.fn().mockResolvedValue({ id: 's1' }),
  toggleActive: jest.fn().mockResolvedValue({ id: 's1' }),
  listAssignments: jest.fn().mockResolvedValue([]),
  assign: jest.fn().mockResolvedValue({ id: 'a1' }),
  removeAssignment: jest.fn().mockResolvedValue({ id: 'a1' }),
}));

const request = require('supertest');
const { makeApp } = require('../test-utils/routeApp');
const router = require('./shift.routes');
const app = makeApp('/shifts', router);

const uuid = '3f2b6d2e-5b53-4b8a-9d57-0d1f6f8f0a11';
const body = { name: 'M', start_time: '10:00', end_time: '20:00' };

describe('shift write routes are owner only', () => {
  test.each(['manager', 'developer', 'cashier', 'employee'])('%s cannot create/update/toggle', async (role) => {
    expect((await request(app).post('/shifts').set('x-role', role).send(body)).status).toBe(403);
    expect((await request(app).put(`/shifts/${uuid}`).set('x-role', role).send({ name: 'x' })).status).toBe(403);
    expect((await request(app).patch(`/shifts/${uuid}/toggle-active`).set('x-role', role)).status).toBe(403);
  });
  test('owner can create', async () => {
    expect((await request(app).post('/shifts').set('x-role', 'owner').send(body)).status).toBe(201);
  });
  test('unauthenticated → 401', async () => {
    expect((await request(app).post('/shifts').send(body)).status).toBe(401);
  });
});

describe('reads and assignments', () => {
  test.each(['owner', 'developer', 'manager'])('%s can list shifts and assignments', async (role) => {
    expect((await request(app).get('/shifts').set('x-role', role)).status).toBe(200);
    expect((await request(app).get('/shifts/assignments?month=2026-10').set('x-role', role)).status).toBe(200);
  });
  test('manager can assign; cashier cannot', async () => {
    const a = { employee_id: uuid, shift_id: uuid, shift_date: '2026-10-06' };
    expect((await request(app).post('/shifts/assignments').set('x-role', 'manager').send(a)).status).toBe(201);
    expect((await request(app).post('/shifts/assignments').set('x-role', 'cashier').send(a)).status).toBe(403);
  });
  test('/assignments is not captured by /:id', async () => {
    const r = await request(app).get('/shifts/assignments?month=2026-10').set('x-role', 'owner');
    expect(r.status).toBe(200);
  });
});
```

Run all: `npx jest src/validators/shift.validator.test.js src/services/shift.service.test.js src/routes/shift.routes.test.js --coverage=false` → PASS; then `npx jest --coverage=false` (all) and `node -e "require('./src/app')"`.

- [ ] **Step 7: Commit**

```bash
git add src/test-utils src/validators/shift.validator.js src/validators/shift.validator.test.js src/services/shift.service.js src/services/shift.service.test.js src/controllers/shift.controller.js src/routes/shift.routes.js src/routes/shift.routes.test.js src/routes/index.js
git commit -m "feat(shifts): shift and assignment API with owner-only rule editing"
```

---

## Task 4: Apply shift rules in `recomputeAttendance` (backend)

**Files:**
- Modify: `magicscissors-be/src/services/attendance.service.js` (`recomputeAttendance`, ~lines 201-258; imports at top)
- Test: `magicscissors-be/src/services/attendance.service.test.js` (append)

**Interfaces:**
- Consumes: `evaluateShiftDay` (Task 1), `tx.shiftAssignment.findUnique({ where: { employeeId_shiftDate }, include: { shift: true } })` (Task 2), existing `computeLatePenaltyHours`, `rollupPunches`, `computeOutsideShiftHours`.
- Produces: `recomputeAttendance(attendanceId, tx)` now also writes `shiftId`, `shiftHours` and may set `status: 'half_day'`. Contract: with a shift for the day → `latePenaltyHours` from tiers, `status` `half_day|present`, `shiftId`/`shiftHours` set; without → previous behaviour, `shiftId`/`shiftHours` = `null`. `on_leave` is never overwritten. The function is already exported.

- [ ] **Step 1: Write the failing test** — append to `attendance.service.test.js` (uses the existing `ist(...)` helper at the top of that file; do not redefine it):

```js
const { recomputeAttendance } = require('./attendance.service');

describe('recomputeAttendance with shift rules', () => {
  const baseAttendance = {
    id: 'a1', employeeId: 'e1', attendanceDate: ist(2026, 10, 6), status: 'present', autoCheckout: false, checkOut: null,
    employee: { shiftStart: '10:00', shiftEnd: '20:00', hasFlexibleTiming: false },
  };
  const shift = {
    id: 's1', startTime: '10:00', endTime: '20:00', gracePeriod: 5,
    lateTiers: [{ after_min: 15, deduct_hours: 1 }], halfDayLateAfterMin: 90, halfDayMinHours: '4.00', isActive: true,
  };
  const punches = (inH, inM, outH, outM) => [
    { id: 'p1', punchType: 'in', punchTime: ist(2026, 10, 6, inH, inM) },
    ...(outH == null ? [] : [{ id: 'p2', punchType: 'out', punchTime: ist(2026, 10, 6, outH, outM) }]),
  ];

  function fakeTx({ assignment, attendance = baseAttendance, punchRows }) {
    return {
      attendance: {
        findUnique: jest.fn().mockResolvedValue(attendance),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
      attendancePunch: { findMany: jest.fn().mockResolvedValue(punchRows) },
      shiftAssignment: { findUnique: jest.fn().mockResolvedValue(assignment) },
    };
  }

  test('assigned shift: tier deduction and snapshot', async () => {
    const tx = fakeTx({ assignment: { shift }, punchRows: punches(10, 20, 19, 0) });
    const data = await recomputeAttendance('a1', tx);
    expect(tx.shiftAssignment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeId_shiftDate: { employeeId: 'e1', shiftDate: baseAttendance.attendanceDate } } })
    );
    expect(data.latePenaltyHours).toBe(1);
    expect(data.status).toBe('present');
    expect(data.shiftId).toBe('s1');
    expect(data.shiftHours).toBe(10);
  });

  test('assigned shift: half day when hours worked below minimum after checkout', async () => {
    const tx = fakeTx({ assignment: { shift }, punchRows: punches(10, 0, 13, 0) });
    expect((await recomputeAttendance('a1', tx)).status).toBe('half_day');
  });

  test('assigned shift: half day when later than threshold', async () => {
    const tx = fakeTx({ assignment: { shift }, punchRows: punches(11, 40, 20, 0) });
    expect((await recomputeAttendance('a1', tx)).status).toBe('half_day');
  });

  test('assigned shift: still checked in (no check-out) is not judged on hours', async () => {
    const tx = fakeTx({ assignment: { shift }, punchRows: punches(10, 0, null) });
    expect((await recomputeAttendance('a1', tx)).status).toBe('present');
  });

  test('NO assignment: legacy rule unchanged (15 min grace, 2h floor, present, no snapshot)', async () => {
    const tx = fakeTx({ assignment: null, punchRows: punches(10, 20, 19, 0) });
    const data = await recomputeAttendance('a1', tx);
    expect(data.latePenaltyHours).toBe(2); // 20 min late > 15 grace → max(0.33h, 2h)
    expect(data.status).toBe('present');
    expect(data.shiftId).toBeNull();
    expect(data.shiftHours).toBeNull();
  });

  test('on_leave is never overwritten', async () => {
    const tx = fakeTx({ assignment: { shift }, attendance: { ...baseAttendance, status: 'on_leave' }, punchRows: punches(10, 0, 13, 0) });
    expect((await recomputeAttendance('a1', tx)).status).toBe('on_leave');
  });

  test('flexible-timing staff are exempt from late deductions even with a shift', async () => {
    const tx = fakeTx({
      assignment: { shift },
      attendance: { ...baseAttendance, employee: { ...baseAttendance.employee, hasFlexibleTiming: true } },
      punchRows: punches(13, 0, 20, 0),
    });
    const data = await recomputeAttendance('a1', tx);
    expect(data.latePenaltyHours).toBe(0);
    expect(data.status).toBe('present');
  });

  test('deactivated shift still applies to days it was assigned', async () => {
    const tx = fakeTx({ assignment: { shift: { ...shift, isActive: false } }, punchRows: punches(10, 20, 19, 0) });
    expect((await recomputeAttendance('a1', tx)).latePenaltyHours).toBe(1);
  });
});
```

- [ ] **Step 2: Run → fail** — `npx jest src/services/attendance.service.test.js --coverage=false -t "shift rules"` (expect failures: no `shiftAssignment` handling, `shiftId` undefined).

- [ ] **Step 3: Implement.** Add near the top of `attendance.service.js`: `const { evaluateShiftDay } = require('../utils/shiftRules');`. In `recomputeAttendance`, after `effectiveWorkingHours` is final and where `latePenaltyHours`/`outsideShiftHours` are computed, replace the single `computeLatePenaltyHours(...)` line and the `status` line:

```js
  const assignment = await tx.shiftAssignment.findUnique({
    where: { employeeId_shiftDate: { employeeId: attendance.employeeId, shiftDate: attendance.attendanceDate } },
    include: { shift: true },
  });
  const shiftEval = assignment?.shift
    ? evaluateShiftDay({
        shift: assignment.shift,
        checkIn: rollup.checkIn,
        workingHours: effectiveWorkingHours,
        hasCheckOut: Boolean(effectiveCheckOut),
        flexible: Boolean(attendance.employee?.hasFlexibleTiming),
      })
    : null;

  const latePenaltyHours = shiftEval
    ? shiftEval.latePenaltyHours
    : computeLatePenaltyHours(rollup.checkIn, attendance.employee);
```

and in the `update` `data`:

```js
      status:
        attendance.status === 'on_leave' ? 'on_leave' : shiftEval?.halfDay ? 'half_day' : 'present',
      shiftId: shiftEval ? shiftEval.shiftId : null,
      shiftHours: shiftEval ? shiftEval.shiftHours : null,
```

Keep `latePenaltyHours,` in `data` as is. The `findUnique` for the attendance row (top of the function) already selects `employee`; no change needed there.

- [ ] **Step 4: Run → pass** — `npx jest src/services/attendance.service.test.js --coverage=false`, then the full backend suite `npx jest --coverage=false` (every pre-existing test must pass) and `node -e "require('./src/app')"`.
- [ ] **Step 5: Commit**

```bash
git add src/services/attendance.service.js src/services/attendance.service.test.js
git commit -m "feat(attendance): apply per-shift late fines and half-day rules"
```

---

## Task 5: Payroll API (backend, owner only)

**Files:**
- Create: `src/utils/payrollCalc.js`, `src/validators/payroll.validator.js`, `src/services/payroll.service.js`, `src/controllers/payroll.controller.js`, `src/routes/payroll.routes.js`
- Modify: `src/routes/index.js` (mount `/payroll`)
- Test: `src/utils/payrollCalc.test.js`, `src/validators/payroll.validator.test.js`, `src/services/payroll.service.test.js`, `src/routes/payroll.routes.test.js`

**Interfaces:**
- Consumes: `shiftHours, hourlyRate, dayPay, round2` (Task 1), `settingsService.getSetting/updateSettings` and `PAYROLL_SETTING_KEYS` (Task 2), prisma fields (Task 2).
- Produces (all `authenticate` + `authorize('owner')`):
  - `GET /payroll/wages?branch_id=<uuid>` → `data: [{ employee_id, full_name, employee_code, role, pay_type: 'daily'|'monthly'|null, wage_amount: number|null }]`
  - `PUT /payroll/wages/:employeeId` body `{ pay_type: 'daily'|'monthly'|null, wage_amount: number|null }` (both set or both null; amount 0–99,999,999) → the updated row
  - `GET /payroll/settings` → `{ monthly_days_mode: 'calendar'|'fixed', monthly_fixed_days: number }`; `PUT /payroll/settings` same body → same
  - `GET /payroll/report?branch_id=&month=YYYY-MM` → `data: { month, branch_id, settings, rows: [{ employee_id, full_name, employee_code, pay_type, wage_amount, days_worked, half_days, hours_worked, late_deduction_hours, gross, late_deduction_amount, net_pay, warnings: string[] }] }`
  - `computePayrollRow({ employee, days, daysInMonth, settings }): row` where `employee = { id, full_name, employee_code, pay_type, wage_amount, shift_start, shift_end }`, `days = [{ status, workingHours, latePenaltyHours, shiftHours }]` (numbers/strings/Decimals; `shiftHours` may be null), `settings = { monthly_days_mode, monthly_fixed_days }`.

- [ ] **Step 1: Failing test for the calculator** — `src/utils/payrollCalc.test.js`

```js
const { computePayrollRow } = require('./payrollCalc');

const settings = { monthly_days_mode: 'calendar', monthly_fixed_days: 30 };
const emp = (over = {}) => ({
  id: 'e1', full_name: 'Ramesh', employee_code: 'EMP001', pay_type: 'daily', wage_amount: 500,
  shift_start: null, shift_end: null, ...over,
});
const day = (over = {}) => ({ status: 'present', workingHours: 8, latePenaltyHours: 0, shiftHours: 10, ...over });

describe('computePayrollRow — daily wage', () => {
  test('500/day over a 10h shift, 8h worked, 1h late → 350', () => {
    const r = computePayrollRow({ employee: emp(), days: [day({ latePenaltyHours: 1 })], daysInMonth: 31, settings });
    expect(r).toMatchObject({ days_worked: 1, hours_worked: 8, late_deduction_hours: 1, gross: 400, late_deduction_amount: 50, net_pay: 350, warnings: [] });
  });
  test('sums several days and counts half days', () => {
    const r = computePayrollRow({
      employee: emp(),
      days: [day(), day({ status: 'half_day', workingHours: 4 }), day({ status: 'on_leave', workingHours: null, shiftHours: null })],
      daysInMonth: 30, settings,
    });
    expect(r.days_worked).toBe(2);
    expect(r.half_days).toBe(1);
    expect(r.hours_worked).toBe(12);
    expect(r.net_pay).toBe(600);
  });
  test('absent and leave days earn nothing and raise no warning', () => {
    const r = computePayrollRow({ employee: emp(), days: [day({ status: 'absent', workingHours: null, shiftHours: null })], daysInMonth: 30, settings });
    expect(r.net_pay).toBe(0);
    expect(r.warnings).toEqual([]);
  });
});

describe('computePayrollRow — monthly wage', () => {
  const m = emp({ pay_type: 'monthly', wage_amount: 31000 });
  test('calendar mode divides by days in the month', () => {
    const r31 = computePayrollRow({ employee: m, days: [day()], daysInMonth: 31, settings });
    expect(r31.gross).toBe(800); // 31000/31/10 = 100/h × 8h
    const r28 = computePayrollRow({ employee: emp({ pay_type: 'monthly', wage_amount: 28000 }), days: [day()], daysInMonth: 28, settings });
    expect(r28.gross).toBe(800);
  });
  test('fixed mode divides by the configured days', () => {
    const r = computePayrollRow({
      employee: emp({ pay_type: 'monthly', wage_amount: 26000 }), days: [day()], daysInMonth: 31,
      settings: { monthly_days_mode: 'fixed', monthly_fixed_days: 26 },
    });
    expect(r.gross).toBe(800);
  });
});

describe('computePayrollRow — missing data never produces NaN', () => {
  test('no wage set → warning, zero pay, hours still reported', () => {
    const r = computePayrollRow({ employee: emp({ pay_type: null, wage_amount: null }), days: [day()], daysInMonth: 30, settings });
    expect(r.net_pay).toBe(0);
    expect(r.hours_worked).toBe(8);
    expect(r.warnings).toContain('No wage set');
  });
  test('worked day with no shift hours anywhere → skipped with a warning', () => {
    const r = computePayrollRow({ employee: emp(), days: [day({ shiftHours: null })], daysInMonth: 30, settings });
    expect(r.net_pay).toBe(0);
    expect(r.warnings).toEqual(['No shift hours on 1 day(s) — pay skipped for those days']);
  });
  test("falls back to the employee's own shift times when the day has no snapshot", () => {
    const r = computePayrollRow({
      employee: emp({ shift_start: '10:00', shift_end: '20:00' }), days: [day({ shiftHours: null })], daysInMonth: 30, settings,
    });
    expect(r.net_pay).toBe(400);
    expect(r.warnings).toEqual([]);
  });
  test('Decimal-like string inputs are handled', () => {
    const r = computePayrollRow({ employee: emp({ wage_amount: '500.00' }), days: [day({ workingHours: '8.00', shiftHours: '10.00', latePenaltyHours: '0.00' })], daysInMonth: 30, settings });
    expect(r.net_pay).toBe(400);
  });
  test('no days at all → zero row', () => {
    const r = computePayrollRow({ employee: emp(), days: [], daysInMonth: 30, settings });
    expect(r).toMatchObject({ days_worked: 0, hours_worked: 0, net_pay: 0 });
  });
});
```

Run → fail (module not found). **Implement** `src/utils/payrollCalc.js`:

```js
const { shiftHours, hourlyRate, dayPay, round2 } = require('./shiftRules');

const WORKED = new Set(['present', 'late', 'half_day']);

function computePayrollRow({ employee, days, daysInMonth, settings }) {
  const personalShiftHours = shiftHours(employee.shift_start, employee.shift_end);
  const warnings = [];
  let daysWorked = 0;
  let halfDays = 0;
  let hours = 0;
  let lateHours = 0;
  let gross = 0;
  let lateAmount = 0;
  let net = 0;
  let missingShift = 0;

  for (const d of days) {
    if (!WORKED.has(d.status)) continue;
    daysWorked += 1;
    if (d.status === 'half_day') halfDays += 1;
    const worked = Number(d.workingHours || 0);
    const late = Number(d.latePenaltyHours || 0);
    hours += worked;
    lateHours += late;

    const dayShiftHours = d.shiftHours != null ? Number(d.shiftHours) : personalShiftHours;
    if (!(dayShiftHours > 0)) {
      if (employee.pay_type && employee.wage_amount != null) missingShift += 1;
      continue;
    }
    const rate = hourlyRate({
      payType: employee.pay_type,
      wageAmount: employee.wage_amount,
      shiftHours: dayShiftHours,
      daysInMonth,
      mode: settings.monthly_days_mode,
      fixedDays: settings.monthly_fixed_days,
    });
    const pay = dayPay({ hoursWorked: worked, lateDeductionHours: late, hourlyRate: rate });
    gross += pay.gross;
    lateAmount += pay.lateDeductionAmount;
    net += pay.net;
  }

  if (!employee.pay_type || employee.wage_amount == null) warnings.push('No wage set');
  if (missingShift > 0) warnings.push(`No shift hours on ${missingShift} day(s) — pay skipped for those days`);

  return {
    employee_id: employee.id,
    full_name: employee.full_name,
    employee_code: employee.employee_code,
    pay_type: employee.pay_type ?? null,
    wage_amount: employee.wage_amount == null ? null : Number(employee.wage_amount),
    days_worked: daysWorked,
    half_days: halfDays,
    hours_worked: round2(hours),
    late_deduction_hours: round2(lateHours),
    gross: round2(gross),
    late_deduction_amount: round2(lateAmount),
    net_pay: round2(net),
    warnings,
  };
}

module.exports = { computePayrollRow };
```

Run → PASS.

- [ ] **Step 2: Validator test + implementation.** `src/validators/payroll.validator.test.js`:

```js
const { wagesQuerySchema, setWageSchema, settingsSchema, reportSchema } = require('./payroll.validator');

const uuid = '3f2b6d2e-5b53-4b8a-9d57-0d1f6f8f0a11';
const p = (schema, body = {}, query = {}, params = {}) => schema.safeParse({ body, query, params });

describe('setWageSchema', () => {
  test('daily with amount', () => expect(p(setWageSchema, { pay_type: 'daily', wage_amount: 500 }, {}, { employeeId: uuid }).success).toBe(true));
  test('clearing both is allowed', () => expect(p(setWageSchema, { pay_type: null, wage_amount: null }, {}, { employeeId: uuid }).success).toBe(true));
  test.each([
    ['type without amount', { pay_type: 'daily', wage_amount: null }],
    ['amount without type', { pay_type: null, wage_amount: 100 }],
    ['negative amount', { pay_type: 'daily', wage_amount: -1 }],
    ['absurd amount', { pay_type: 'monthly', wage_amount: 1e9 }],
    ['unknown type', { pay_type: 'hourly', wage_amount: 10 }],
  ])('rejects %s', (_l, body) => expect(p(setWageSchema, body, {}, { employeeId: uuid }).success).toBe(false));
});

describe('settingsSchema', () => {
  test('valid', () => expect(p(settingsSchema, { monthly_days_mode: 'fixed', monthly_fixed_days: 26 }).success).toBe(true));
  test.each([[{ monthly_days_mode: 'weekly', monthly_fixed_days: 26 }], [{ monthly_days_mode: 'fixed', monthly_fixed_days: 0 }], [{ monthly_days_mode: 'fixed', monthly_fixed_days: 32 }]])('rejects %j', (b) =>
    expect(p(settingsSchema, b).success).toBe(false));
});

describe('reportSchema / wagesQuerySchema', () => {
  test('report needs branch and month', () => {
    expect(p(reportSchema, {}, { branch_id: uuid, month: '2026-10' }).success).toBe(true);
    expect(p(reportSchema, {}, { branch_id: uuid, month: '2026-13' }).success).toBe(false);
    expect(p(reportSchema, {}, { month: '2026-10' }).success).toBe(false);
  });
  test('wages needs branch', () => {
    expect(p(wagesQuerySchema, {}, { branch_id: uuid }).success).toBe(true);
    expect(p(wagesQuerySchema, {}, {}).success).toBe(false);
  });
});
```

`src/validators/payroll.validator.js`:

```js
const { z } = require('zod');

const empty = z.object({}).optional();
const branchId = z.string().uuid('Invalid branch ID');

const wagesQuerySchema = z.object({ body: empty, query: z.object({ branch_id: branchId }), params: empty });

const setWageSchema = z.object({
  body: z
    .object({
      pay_type: z.enum(['daily', 'monthly']).nullable(),
      wage_amount: z.number().min(0).max(99999999).nullable(),
    })
    .refine((b) => (b.pay_type === null) === (b.wage_amount === null), {
      message: 'pay_type and wage_amount must both be set or both be cleared',
      path: ['wage_amount'],
    }),
  query: empty,
  params: z.object({ employeeId: z.string().uuid('Invalid employee ID') }),
});

const settingsSchema = z.object({
  body: z.object({
    monthly_days_mode: z.enum(['calendar', 'fixed']),
    monthly_fixed_days: z.number().int().min(1).max(31),
  }),
  query: empty,
  params: empty,
});

const reportSchema = z.object({
  body: empty,
  query: z.object({
    branch_id: branchId,
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM'),
  }),
  params: empty,
});

module.exports = { wagesQuerySchema, setWageSchema, settingsSchema, reportSchema };
```

Run validator tests → PASS.

- [ ] **Step 3: Service test (mocked prisma/settings)** — `src/services/payroll.service.test.js`

```js
jest.mock('../config/database', () => ({
  user: { findMany: jest.fn() },
  attendance: { findMany: jest.fn() },
  employeeDetail: { findUnique: jest.fn(), update: jest.fn() },
}));
jest.mock('./settings.service', () => ({
  getSetting: jest.fn(),
  updateSettings: jest.fn().mockResolvedValue({}),
  PAYROLL_SETTING_KEYS: ['payroll_monthly_days_mode', 'payroll_monthly_fixed_days'],
}));

const prisma = require('../config/database');
const settings = require('./settings.service');
const svc = require('./payroll.service');

const userRow = (over = {}) => ({
  id: 'e1', fullName: 'Ramesh', role: 'employee',
  employeeDetails: { id: 'e1', employeeCode: 'EMP001', payType: 'daily', wageAmount: '500.00', shiftStart: null, shiftEnd: null },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  settings.getSetting.mockImplementation(async (k) => ({
    payroll_monthly_days_mode: { value: 'calendar' },
    payroll_monthly_fixed_days: { value: 30 },
  }[k]));
});

test('getSettings maps the two keys', async () => {
  expect(await svc.getSettings()).toEqual({ monthly_days_mode: 'calendar', monthly_fixed_days: 30 });
});

test('setSettings writes both keys', async () => {
  await svc.setSettings({ monthly_days_mode: 'fixed', monthly_fixed_days: 26 }, 'owner1');
  expect(settings.updateSettings).toHaveBeenCalledWith(
    { payroll_monthly_days_mode: 'fixed', payroll_monthly_fixed_days: 26 }, 'owner1'
  );
});

test('listWages returns employees with their wage config', async () => {
  prisma.user.findMany.mockResolvedValue([userRow()]);
  expect(await svc.listWages('b1')).toEqual([
    { employee_id: 'e1', full_name: 'Ramesh', employee_code: 'EMP001', role: 'employee', pay_type: 'daily', wage_amount: 500 },
  ]);
});

describe('setWage', () => {
  test('404 for unknown employee', async () => {
    prisma.employeeDetail.findUnique.mockResolvedValue(null);
    await expect(svc.setWage('x', { pay_type: 'daily', wage_amount: 1 })).rejects.toMatchObject({ statusCode: 404 });
  });
  test('updates payType and wageAmount (null clears)', async () => {
    prisma.employeeDetail.findUnique.mockResolvedValue({ id: 'e1' });
    prisma.employeeDetail.update.mockResolvedValue({ id: 'e1', payType: null, wageAmount: null });
    await svc.setWage('e1', { pay_type: null, wage_amount: null });
    expect(prisma.employeeDetail.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { payType: null, wageAmount: null } });
  });
});

describe('report', () => {
  test('queries the month range for the branch and computes rows', async () => {
    prisma.user.findMany.mockResolvedValue([userRow()]);
    prisma.attendance.findMany.mockResolvedValue([
      { employeeId: 'e1', status: 'present', workingHours: '8.00', latePenaltyHours: '1.00', shiftHours: '10.00' },
    ]);
    const r = await svc.report('b1', '2026-10');
    const where = prisma.attendance.findMany.mock.calls[0][0].where;
    expect(where.branchId).toBe('b1');
    expect(where.attendanceDate.gte).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    expect(where.attendanceDate.lte).toEqual(new Date('2026-10-31T00:00:00.000Z'));
    expect(r.month).toBe('2026-10');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ employee_id: 'e1', gross: 400, late_deduction_amount: 50, net_pay: 350 });
  });
  test('monthly calendar mode uses the real month length (Feb 2028 has 29 days)', async () => {
    prisma.user.findMany.mockResolvedValue([userRow({ employeeDetails: { id: 'e1', employeeCode: 'E', payType: 'monthly', wageAmount: '29000', shiftStart: null, shiftEnd: null } })]);
    prisma.attendance.findMany.mockResolvedValue([{ employeeId: 'e1', status: 'present', workingHours: '10.00', latePenaltyHours: '0', shiftHours: '10.00' }]);
    const r = await svc.report('b1', '2028-02');
    expect(r.rows[0].gross).toBe(1000); // 29000 / 29 / 10 = 100/h × 10h
  });
  test('employees without employeeDetails are skipped', async () => {
    prisma.user.findMany.mockResolvedValue([userRow({ employeeDetails: null })]);
    prisma.attendance.findMany.mockResolvedValue([]);
    expect((await svc.report('b1', '2026-10')).rows).toEqual([]);
  });
});
```

Run → fail. **Implement** `src/services/payroll.service.js`:

```js
const prisma = require('../config/database');
const AppError = require('../utils/AppError');
const settingsService = require('./settings.service');
const { computePayrollRow } = require('../utils/payrollCalc');

const STAFF_ROLES = ['employee', 'manager', 'cashier'];

async function getSettings() {
  const [mode, days] = await Promise.all([
    settingsService.getSetting('payroll_monthly_days_mode'),
    settingsService.getSetting('payroll_monthly_fixed_days'),
  ]);
  return {
    monthly_days_mode: mode?.value === 'fixed' ? 'fixed' : 'calendar',
    monthly_fixed_days: Number(days?.value) > 0 ? Number(days.value) : 30,
  };
}

async function setSettings({ monthly_days_mode, monthly_fixed_days }, userId) {
  await settingsService.updateSettings(
    { payroll_monthly_days_mode: monthly_days_mode, payroll_monthly_fixed_days: monthly_fixed_days },
    userId
  );
  return { monthly_days_mode, monthly_fixed_days };
}

function branchStaff(branchId) {
  return prisma.user.findMany({
    where: { branchId, isActive: true, role: { in: STAFF_ROLES } },
    include: {
      employeeDetails: {
        select: { id: true, employeeCode: true, payType: true, wageAmount: true, shiftStart: true, shiftEnd: true },
      },
    },
    orderBy: { fullName: 'asc' },
  });
}

async function listWages(branchId) {
  const users = await branchStaff(branchId);
  return users
    .filter((u) => u.employeeDetails)
    .map((u) => ({
      employee_id: u.employeeDetails.id,
      full_name: u.fullName,
      employee_code: u.employeeDetails.employeeCode,
      role: u.role,
      pay_type: u.employeeDetails.payType ?? null,
      wage_amount: u.employeeDetails.wageAmount == null ? null : Number(u.employeeDetails.wageAmount),
    }));
}

async function setWage(employeeId, { pay_type, wage_amount }) {
  const existing = await prisma.employeeDetail.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!existing) throw new AppError('Employee not found', 404, 'NOT_FOUND');
  const row = await prisma.employeeDetail.update({
    where: { id: employeeId },
    data: { payType: pay_type, wageAmount: wage_amount },
  });
  return {
    employee_id: row.id,
    pay_type: row.payType ?? null,
    wage_amount: row.wageAmount == null ? null : Number(row.wageAmount),
  };
}

async function report(branchId, month) {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const daysInMonth = end.getUTCDate();

  const [settings, users] = await Promise.all([getSettings(), branchStaff(branchId)]);
  const staff = users.filter((u) => u.employeeDetails);
  const ids = staff.map((u) => u.employeeDetails.id);

  const attendance = ids.length
    ? await prisma.attendance.findMany({
        where: { branchId, employeeId: { in: ids }, attendanceDate: { gte: start, lte: end } },
        select: { employeeId: true, status: true, workingHours: true, latePenaltyHours: true, shiftHours: true },
      })
    : [];
  const byEmployee = new Map();
  attendance.forEach((a) => {
    if (!byEmployee.has(a.employeeId)) byEmployee.set(a.employeeId, []);
    byEmployee.get(a.employeeId).push(a);
  });

  const rows = staff.map((u) =>
    computePayrollRow({
      employee: {
        id: u.employeeDetails.id,
        full_name: u.fullName,
        employee_code: u.employeeDetails.employeeCode,
        pay_type: u.employeeDetails.payType ?? null,
        wage_amount: u.employeeDetails.wageAmount,
        shift_start: u.employeeDetails.shiftStart,
        shift_end: u.employeeDetails.shiftEnd,
      },
      days: byEmployee.get(u.employeeDetails.id) || [],
      daysInMonth,
      settings,
    })
  );

  return { month, branch_id: branchId, settings, rows };
}

module.exports = { getSettings, setSettings, listWages, setWage, report };
```

Run → PASS.

- [ ] **Step 4: Controller, routes, mount.** `src/controllers/payroll.controller.js`:

```js
const payrollService = require('../services/payroll.service');
const catchAsync = require('../utils/catchAsync');
const { sendResponse } = require('../utils/response');

exports.listWages = catchAsync(async (req, res) => sendResponse(res, 200, await payrollService.listWages(req.query.branch_id)));
exports.setWage = catchAsync(async (req, res) =>
  sendResponse(res, 200, await payrollService.setWage(req.params.employeeId, req.body)));
exports.getSettings = catchAsync(async (req, res) => sendResponse(res, 200, await payrollService.getSettings()));
exports.setSettings = catchAsync(async (req, res) =>
  sendResponse(res, 200, await payrollService.setSettings(req.body, req.user.id)));
exports.report = catchAsync(async (req, res) =>
  sendResponse(res, 200, await payrollService.report(req.query.branch_id, req.query.month)));
```

`src/routes/payroll.routes.js`:

```js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/payroll.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { wagesQuerySchema, setWageSchema, settingsSchema, reportSchema } = require('../validators/payroll.validator');

router.use(authenticate, authorize('owner'));

router.get('/wages', validate(wagesQuerySchema), ctrl.listWages);
router.put('/wages/:employeeId', validate(setWageSchema), ctrl.setWage);
router.get('/settings', ctrl.getSettings);
router.put('/settings', validate(settingsSchema), ctrl.setSettings);
router.get('/report', validate(reportSchema), ctrl.report);

module.exports = router;
```

Mount in `src/routes/index.js`: `const payrollRoutes = require('./payroll.routes');` and `router.use('/payroll', payrollRoutes);`.

- [ ] **Step 5: Authorization route test** — `src/routes/payroll.routes.test.js`

```js
jest.mock('../middleware/auth', () => {
  const real = jest.requireActual('../middleware/auth');
  return {
    ...real,
    authenticate: (req, res, next) => {
      if (!req.headers['x-role']) return next(new (require('../utils/AppError'))('No token', 401, 'UNAUTHORIZED'));
      req.user = { id: 'u1', role: req.headers['x-role'] };
      next();
    },
  };
});
jest.mock('../services/payroll.service', () => ({
  listWages: jest.fn().mockResolvedValue([]),
  setWage: jest.fn().mockResolvedValue({}),
  getSettings: jest.fn().mockResolvedValue({}),
  setSettings: jest.fn().mockResolvedValue({}),
  report: jest.fn().mockResolvedValue({ rows: [] }),
}));

const request = require('supertest');
const { makeApp } = require('../test-utils/routeApp');
const app = makeApp('/payroll', require('./payroll.routes'));

const uuid = '3f2b6d2e-5b53-4b8a-9d57-0d1f6f8f0a11';
const calls = (role) => [
  request(app).get(`/payroll/wages?branch_id=${uuid}`).set('x-role', role),
  request(app).put(`/payroll/wages/${uuid}`).set('x-role', role).send({ pay_type: 'daily', wage_amount: 500 }),
  request(app).get('/payroll/settings').set('x-role', role),
  request(app).put('/payroll/settings').set('x-role', role).send({ monthly_days_mode: 'calendar', monthly_fixed_days: 30 }),
  request(app).get(`/payroll/report?branch_id=${uuid}&month=2026-10`).set('x-role', role),
];

test.each(['developer', 'manager', 'cashier', 'employee'])('%s gets 403 on every payroll route', async (role) => {
  for (const r of await Promise.all(calls(role))) expect(r.status).toBe(403);
});

test('owner gets 200 on every payroll route', async () => {
  for (const r of await Promise.all(calls('owner'))) expect(r.status).toBe(200);
});

test('unauthenticated gets 401', async () => {
  expect((await request(app).get('/payroll/settings')).status).toBe(401);
});
```

Add one more test file `src/routes/settings.guard.test.js` is NOT required; instead verify manually in Step 6 that the generic settings routes strip/refuse the keys (grep the diff from Task 2).

- [ ] **Step 6: Run everything** — `npx jest --coverage=false` (all suites pass), `node -e "require('./src/app')"`.
- [ ] **Step 7: Commit**

```bash
git add src/utils/payrollCalc.js src/utils/payrollCalc.test.js src/validators/payroll.validator.js src/validators/payroll.validator.test.js src/services/payroll.service.js src/services/payroll.service.test.js src/controllers/payroll.controller.js src/routes/payroll.routes.js src/routes/payroll.routes.test.js src/routes/index.js
git commit -m "feat(payroll): owner-only wages, payroll settings and monthly report API"
```

---

## Task 6: Shift form rules (frontend)

**Files:**
- Create: `src/lib/shiftRules.js`, `scripts/check-shift-payroll.mjs` (shared with Task 7; this task adds the shift section)
- Modify: `src/pages/ShiftPage.jsx` (`initialShiftForm` ~line 37, `ShiftModal` ~lines 61-205, the shifts table actions ~lines 405-445)

**Interfaces:**
- Consumes: backend shift DTO (Task 3: `late_tiers`, `half_day_late_after_min`, `half_day_min_hours`, `grace_period`), existing `shiftService.createShift/updateShift`.
- Produces: `buildRulesPayload({ grace, tiers, halfDayLateAfterMin, halfDayMinHours })` in `src/lib/shiftRules.js` returning `{ ok: true, value: { late_tiers, half_day_late_after_min, half_day_min_hours } }` or `{ ok: false, error: string }`. Inputs are raw form strings; `tiers` = `[{ after_min: string, deduct_hours: string }]`; blank tier rows are ignored; blank half-day fields become `null`.

- [ ] **Step 1: Setup.** Frontend repo is on `feat/shift-rules-payroll` (Task 0). 
- [ ] **Step 2: Failing node check first** — create `scripts/check-shift-payroll.mjs`:

```js
import assert from 'node:assert/strict'
import { buildRulesPayload } from '../src/lib/shiftRules.js'

const ok = (r) => { assert.equal(r.ok, true, r.error); return r.value }
const bad = (r) => { assert.equal(r.ok, false); return r.error }

// valid tiers + half-day
assert.deepEqual(
  ok(buildRulesPayload({ grace: 10, tiers: [{ after_min: '15', deduct_hours: '0.5' }, { after_min: '30', deduct_hours: '1' }], halfDayLateAfterMin: '90', halfDayMinHours: '4' })),
  { late_tiers: [{ after_min: 15, deduct_hours: 0.5 }, { after_min: 30, deduct_hours: 1 }], half_day_late_after_min: 90, half_day_min_hours: 4 }
)
// blank rows ignored, blank half-day → null
assert.deepEqual(
  ok(buildRulesPayload({ grace: 5, tiers: [{ after_min: '', deduct_hours: '' }], halfDayLateAfterMin: '', halfDayMinHours: '' })),
  { late_tiers: [], half_day_late_after_min: null, half_day_min_hours: null }
)
// invalid cases
assert.match(bad(buildRulesPayload({ grace: 10, tiers: [{ after_min: '10', deduct_hours: '1' }], halfDayLateAfterMin: '', halfDayMinHours: '' })), /above the grace/i)
assert.match(bad(buildRulesPayload({ grace: 5, tiers: [{ after_min: '30', deduct_hours: '1' }, { after_min: '15', deduct_hours: '1' }], halfDayLateAfterMin: '', halfDayMinHours: '' })), /increasing/i)
assert.match(bad(buildRulesPayload({ grace: 5, tiers: [{ after_min: '20', deduct_hours: '0' }], halfDayLateAfterMin: '', halfDayMinHours: '' })), /deduct/i)
assert.match(bad(buildRulesPayload({ grace: 5, tiers: [{ after_min: '20', deduct_hours: '' }], halfDayLateAfterMin: '', halfDayMinHours: '' })), /both/i)
assert.match(bad(buildRulesPayload({ grace: 5, tiers: [], halfDayLateAfterMin: '1500', halfDayMinHours: '' })), /half/i)
assert.match(bad(buildRulesPayload({ grace: 5, tiers: [], halfDayLateAfterMin: '', halfDayMinHours: '30' })), /hours/i)
assert.match(bad(buildRulesPayload({ grace: 5, tiers: [], halfDayLateAfterMin: '1.5', halfDayMinHours: '' })), /whole/i)

console.log('shift rule checks passed')
```

Run `node scripts/check-shift-payroll.mjs` → FAIL (`ERR_MODULE_NOT_FOUND`). Then implement `src/lib/shiftRules.js` (no React, no `@/` alias imports — node must load it):

```js
const toNum = (v) => (String(v).trim() === '' ? null : Number(v))

/** Validates the shift-rule fields of the Shift form and builds the API payload. */
export function buildRulesPayload({ grace, tiers, halfDayLateAfterMin, halfDayMinHours }) {
  const rows = []
  let prev = Number(grace) || 0

  for (const t of tiers || []) {
    const a = toNum(t.after_min)
    const d = toNum(t.deduct_hours)
    if (a == null && d == null) continue
    if (a == null || d == null) return { ok: false, error: 'Fill both minutes and hours for each late tier' }
    if (!Number.isInteger(a) || a < 1 || a > 1440) return { ok: false, error: 'Late tier minutes must be a whole number (1-1440)' }
    if (!(a > prev)) return { ok: false, error: 'Late tiers must be in increasing order and above the grace period' }
    if (!(d > 0) || d > 24) return { ok: false, error: 'Late tier must deduct more than 0 and at most 24 hours' }
    rows.push({ after_min: a, deduct_hours: d })
    prev = a
  }

  const lateAfter = toNum(halfDayLateAfterMin)
  if (lateAfter != null && (!Number.isInteger(lateAfter) || lateAfter < 0 || lateAfter > 1440)) {
    return { ok: false, error: 'Half-day late minutes must be a whole number (0-1440)' }
  }
  const minHours = toNum(halfDayMinHours)
  if (minHours != null && (!(minHours > 0) || minHours > 24)) {
    return { ok: false, error: 'Half-day minimum hours must be more than 0 and at most 24' }
  }

  return {
    ok: true,
    value: { late_tiers: rows, half_day_late_after_min: lateAfter, half_day_min_hours: minHours },
  }
}
```

Run → `shift rule checks passed`.

Note on the test strings: the check script asserts messages by regex (`/above the grace/i`, `/increasing/i`, `/deduct/i`, `/both/i`, `/half/i`, `/hours/i`, `/whole/i`) — the implementation messages above were written to match; if a regex does not match, adjust the **message**, not the assertion's intent.

- [ ] **Step 3: Wire into `ShiftModal`.** Read the whole `ShiftModal` first. Then:
  - Add `import { useSelector } from 'react-redux'` if missing (the file already imports it for `ShiftPage`) and `import { buildRulesPayload } from '@/lib/shiftRules'`.
  - Inside `ShiftModal` add `const { user } = useSelector((s) => s.auth)` and `const canEditRules = user?.role === 'owner'`.
  - Extend `initialShiftForm` with `half_day_late_after_min: ''`, `half_day_min_hours: ''`, and add state `const [tiers, setTiers] = useState([])`.
  - In the `useEffect` that loads `shift`, also set `half_day_late_after_min: shift.half_day_late_after_min == null ? '' : String(shift.half_day_late_after_min)`, `half_day_min_hours: shift.half_day_min_hours == null ? '' : String(shift.half_day_min_hours)` and `setTiers((shift.late_tiers || []).map((t) => ({ after_min: String(t.after_min), deduct_hours: String(t.deduct_hours) })))`; in the else branch `setTiers([])`.
  - In `handleSubmit`, after the grace validation, build the payload (rules only when `canEditRules`):

```js
    let rules = {}
    if (canEditRules) {
      const built = buildRulesPayload({
        grace,
        tiers,
        halfDayLateAfterMin: form.half_day_late_after_min,
        halfDayMinHours: form.half_day_min_hours,
      })
      if (!built.ok) { toast.error(built.error); return }
      rules = built.value
    }
    const { half_day_late_after_min, half_day_min_hours, ...rest } = form
    const payload = { ...rest, grace_period: grace, ...rules }
```

    (replace the existing `const payload = { ...form, grace_period: grace }`; avoid unused-variable warnings by not destructuring names you don't use — if the destructured `half_day_*` names are unused, build `rest` with a small `Object.fromEntries(Object.entries(form).filter(([k]) => !k.startsWith('half_day')))` instead.)
  - Make the dialog wider (`sm:max-w-[520px]`) and, below the Color field and above `<DialogFooter>`, render the rules block only when `canEditRules` (otherwise a short read-only text "Late and half-day rules can be changed by the owner"): a heading "Late fine rules", the tiers list (each row: number input "Late by (min) ≥", number input "Deduct (hours)", a remove button; an "Add tier" button), a helper line "Applies after the grace period. Leave empty for no late fine.", then a heading "Half day" with two number inputs: "Half day if late by more than (min)" and "Half day if worked less than (hours)" with helper "Leave blank to turn a rule off". Use existing `Input`, `Label`, `Button` components and `Plus`/`Trash2` icons already imported in this file.
- [ ] **Step 4: Owner-only shift management in `ShiftPage`.** Add `const isOwner = user?.role === 'owner'` (next to the existing `isOwnerDev`) and wrap the "Add Shift" button, the per-row edit pencil and the power/toggle button in `{isOwner && (...)}` so managers keep the assignments tab and read-only list (the backend now returns 403 for their writes).
- [ ] **Step 5: Verify** — `node scripts/check-shift-payroll.mjs` passes; `npm run build` passes. State plainly that the UI was not exercised against a backend.
- [ ] **Step 6: Commit** (frontend repo; add only these files)

```bash
git add src/lib/shiftRules.js scripts/check-shift-payroll.mjs src/pages/ShiftPage.jsx
git commit -m "feat(shifts): late fine tiers and half-day rules in the shift form"
```

---

## Task 7: Payroll page (frontend, owner only)

**Files:**
- Create: `src/services/payroll.service.js`, `src/lib/payroll.js`, `src/pages/PayrollPage.jsx`
- Modify: `scripts/check-shift-payroll.mjs` (append), `src/App.jsx`, `src/components/layout/Sidebar.jsx`, `src/data/versionHistory.js`

**Interfaces:**
- Consumes: backend payroll API (Task 5); `branchService.getBranches({ is_active: 'true' })` (branch objects have `branch_id` and `name`); `exportToCSV(data, filename, { columns, headers })` from `@/lib/export-utils`.
- Produces: `payrollService = { getWages(branchId), setWage(employeeId, data), getSettings(), setSettings(data), getReport(branchId, month) }`; `payrollTotals(rows): { days_worked, half_days, hours_worked, late_deduction_hours, gross, late_deduction_amount, net_pay }`; `reportCsvRows(rows): object[]` (flat rows for CSV); `formatMoney(n): string` (`₹1,234.50`); `PayrollPage` default export, route `/payroll`.

- [ ] **Step 1: Failing check first** — append to `scripts/check-shift-payroll.mjs` (before the final `console.log`s; keep a single final log line per section):

```js
import { payrollTotals, reportCsvRows, formatMoney } from '../src/lib/payroll.js'

const rows = [
  { employee_id: 'a', full_name: 'A', employee_code: 'E1', pay_type: 'daily', wage_amount: 500, days_worked: 2, half_days: 1, hours_worked: 12, late_deduction_hours: 1, gross: 600, late_deduction_amount: 50, net_pay: 550, warnings: [] },
  { employee_id: 'b', full_name: 'B', employee_code: 'E2', pay_type: null, wage_amount: null, days_worked: 1, half_days: 0, hours_worked: 8, late_deduction_hours: 0, gross: 0, late_deduction_amount: 0, net_pay: 0, warnings: ['No wage set'] },
]
assert.deepEqual(payrollTotals(rows), { days_worked: 3, half_days: 1, hours_worked: 20, late_deduction_hours: 1, gross: 600, late_deduction_amount: 50, net_pay: 550 })
assert.deepEqual(payrollTotals([]), { days_worked: 0, half_days: 0, hours_worked: 0, late_deduction_hours: 0, gross: 0, late_deduction_amount: 0, net_pay: 0 })
const csv = reportCsvRows(rows)
assert.equal(csv.length, 2)
assert.equal(csv[0].pay_type, 'Daily')
assert.equal(csv[1].pay_type, '—')
assert.equal(csv[1].warnings, 'No wage set')
assert.equal(formatMoney(1234.5), '₹1,234.50')
assert.equal(formatMoney(0), '₹0.00')
assert.equal(formatMoney(null), '—')
console.log('payroll helper checks passed')
```

Run → FAIL (module missing). Implement `src/lib/payroll.js` (pure; no `@/` imports):

```js
const SUM_KEYS = ['days_worked', 'half_days', 'hours_worked', 'late_deduction_hours', 'gross', 'late_deduction_amount', 'net_pay']
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

export function payrollTotals(rows) {
  const totals = Object.fromEntries(SUM_KEYS.map((k) => [k, 0]))
  for (const r of rows || []) for (const k of SUM_KEYS) totals[k] += Number(r[k] || 0)
  for (const k of SUM_KEYS) totals[k] = round2(totals[k])
  return totals
}

const PAY_TYPE_LABEL = { daily: 'Daily', monthly: 'Monthly' }

export function reportCsvRows(rows) {
  return (rows || []).map((r) => ({
    employee_code: r.employee_code || '',
    full_name: r.full_name,
    pay_type: PAY_TYPE_LABEL[r.pay_type] || '—',
    wage_amount: r.wage_amount ?? '',
    days_worked: r.days_worked,
    half_days: r.half_days,
    hours_worked: r.hours_worked,
    late_deduction_hours: r.late_deduction_hours,
    gross: r.gross,
    late_deduction_amount: r.late_deduction_amount,
    net_pay: r.net_pay,
    warnings: (r.warnings || []).join('; '),
  }))
}

export function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
```

Run → `shift rule checks passed` and `payroll helper checks passed`.

- [ ] **Step 2: Service** — `src/services/payroll.service.js`:

```js
import api from './api'

export const payrollService = {
  getWages: (branchId) => api.get('/payroll/wages', { params: { branch_id: branchId } }),
  setWage: (employeeId, data) => api.put(`/payroll/wages/${employeeId}`, data),
  getSettings: () => api.get('/payroll/settings'),
  setSettings: (data) => api.put('/payroll/settings', data),
  getReport: (branchId, month) => api.get('/payroll/report', { params: { branch_id: branchId, month } }),
}
```

- [ ] **Step 3: Page** — `src/pages/PayrollPage.jsx`. Requirements (read `src/components/settings/GeofencePanel.jsx` for the house style of Card/Table/Dialog/query/toast usage and copy its patterns):
  - `const { user } = useSelector((s) => s.auth)`; if `user?.role !== 'owner'` render `<Navigate to="/" replace />`.
  - Branch picker (native `<select>` from `branchService.getBranches({ is_active: 'true' })`, `b.branch_id`/`b.name`, default first) and a `<input type="month">` (default `new Date().toISOString().slice(0, 7)`), shared by tabs.
  - `Tabs` (`@/components/ui/tabs`) with three tabs:
    1. **Report** — `useQuery(['payroll-report', branchId, month], () => payrollService.getReport(branchId, month), { enabled: !!branchId && !!month })`; `rows = res?.data?.rows || []`. Table columns: Employee (name + code), Pay type, Wage (`formatMoney`), Days, Half days, Hours, Late deducted (hours), Gross, Late deduction (₹), Net pay; a bold totals row from `payrollTotals(rows)`; warnings shown as small amber text under the employee name; an "Export CSV" button calling `exportToCSV(reportCsvRows(rows), `payroll-${month}.csv`, { columns: [...keys of a csv row], headers: [...] })` (disabled with no rows). Under the title show a one-line caption of how rates are computed: "Daily: wage ÷ shift hours. Monthly: wage ÷ {days in month | N fixed days} ÷ shift hours" using `res.data.settings`.
    2. **Wages** — `useQuery(['payroll-wages', branchId], ...)`; table of employees with a pay-type `<select>` (— / Daily / Monthly) and an amount `<input type="number" min="0" step="0.01">` per row and a Save button per row. Local row state keyed by `employee_id`; saving calls `payrollService.setWage(id, { pay_type, wage_amount })` where clearing sends `{ pay_type: null, wage_amount: null }`; both-or-neither is validated client-side with a toast ("Choose a pay type and an amount, or clear both"); invalidate `['payroll-wages']` and `['payroll-report']` on success.
    3. **Settings** — `useQuery(['payroll-settings'], payrollService.getSettings)`; a card with a select "Monthly rate divisor" (`calendar` = "Days in the month", `fixed` = "Fixed number of days") and, when `fixed`, a number input 1–31; Save → `payrollService.setSettings({ monthly_days_mode, monthly_fixed_days })`, invalidate `['payroll-settings']` and `['payroll-report']`.
  - Errors: `toast.error(err.response?.data?.error?.message || 'Failed')`; loading spinner (`Loader2`) and empty states.
  - No unused imports (there is no linter here; read your file for them).
- [ ] **Step 4: Route, sidebar, changelog.**
  - `src/App.jsx`: `import PayrollPage from './pages/PayrollPage'` and `<Route path="payroll" element={<PayrollPage />} />` next to the other protected routes.
  - `src/components/layout/Sidebar.jsx`: import `IndianRupee` from `lucide-react` and add after the `Staff Performance` item `{ title: 'Payroll', href: '/payroll', icon: IndianRupee, roles: ['owner'] }`.
  - `src/data/versionHistory.js`: read the first entry for the exact shape, add `v2.12.0` ("Shift Rules & Payroll", date `Oct 2026`) above it with factual highlights only (per-shift late fine tiers and half-day rules applied automatically; daily/monthly wages; owner-only Payroll report with CSV; staff without an assigned shift keep the old rule; rule changes apply to new punches, not past days) and set `CURRENT_VERSION = 'v2.12.0'`.
- [ ] **Step 5: Verify** — `node scripts/check-shift-payroll.mjs` (both sections pass) and `npm run build`. State plainly that the pages were not exercised against a backend/database.
- [ ] **Step 6: Commit**

```bash
git add src/services/payroll.service.js src/lib/payroll.js scripts/check-shift-payroll.mjs src/pages/PayrollPage.jsx src/App.jsx src/components/layout/Sidebar.jsx src/data/versionHistory.js
git commit -m "feat(payroll): owner-only payroll page with wages, settings and monthly report"
```

---

## Task 8: Whole-feature verification and handover (controller)

- [ ] **Step 1:** Backend `npx jest --coverage=false` (all suites pass). Frontend `node scripts/check-geofence.mjs && node scripts/check-shift-payroll.mjs && npm run build`.
- [ ] **Step 2:** If (and only if) a database is available (`docker compose up -d postgres`; `.env` `DATABASE_URL` port `5434`), run `npm run db:push` in the backend and smoke-test: owner creates a shift with tiers, assigns an employee, employee punches in late via the PWA/biometric, `GET /attendance/today` shows the deduction, set a wage and read `GET /payroll/report`. Otherwise say clearly that nothing was exercised against a database.
- [ ] **Step 3:** Handover notes for the user: run `npm run db:push`; create shifts + assign staff (staff with no shift keep the old 15-min/2h rule); set wages per employee in Payroll → Wages; choose the monthly divisor; rule changes are not retroactive; absent/leave days earn ₹0; developers cannot edit shift rules or see payroll; the `half_day` status now appears automatically and is already counted as a worked day by reports and incentives.
- [ ] **Step 4:** Do not push or open PRs unless the user asks.
