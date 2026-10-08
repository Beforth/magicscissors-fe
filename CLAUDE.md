# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Frontend for the Salon ERP (multi-branch salon management). React 18 + Vite (JS/JSX, no TypeScript), Tailwind + shadcn/ui (Radix), Redux Toolkit, TanStack Query, React Hook Form + Zod, React Router v6. It is also a PWA (`vite-plugin-pwa`).

The backend (Express + Prisma + PostgreSQL) is a **separate git repo** checked out at `./magicscissors-be/` (GitHub: `Beforth/magicscissors-be`). It appears as untracked in this repo — never `git add -A` / `git add .` here; add files by name, and make backend commits from inside `magicscissors-be/`.

## Commands

```bash
npm run dev            # Vite dev server, default port 5173 (pass a port: npm run dev -- --port 5180 --strictPort)
npm run build          # production build -> dist/ (also generates the service worker)
npm run preview        # serve the build; the service worker only runs here, not under `dev`
node scripts/check-geofence.mjs        # assertions for src/lib/geofence.js
node scripts/check-shift-payroll.mjs   # assertions for src/lib/shiftRules.js and src/lib/payroll.js
npm run generate-pwa-icons             # regenerate PWA icons from public/icon.svg (a placeholder logo)
```

- There is **no test runner and no ESLint config**; `npm run lint` is defined but cannot run. The gates are `npm run build` and the node check scripts above (pure helpers in `src/lib/` must stay free of React and the `@/` alias so node can load them).
- `scripts/dev.sh` (`npm run dev:*`) still points at the old `salon-erp-be` folder name and is stale.
- The API base URL comes from `VITE_API_BASE_URL` in a git-ignored `.env` (e.g. `http://localhost:5001/api/v1`). If unset, `services/api.js` falls back to `window.location.origin + '/api/v1'`, which is wrong for local dev (it points at the Vite port). `baseURL` is exported from `api.js` and is also used to build selfie image URLs.
- Geolocation, camera and PWA install need HTTPS (they work on `localhost`; on a phone use a tunnel or a deployed build).
- Deployed on Vercel (`vercel.json`: SPA rewrite; `sw.js` and the manifest are served `no-cache`). The PWA build tools need Node >= 20.19.

### Backend (inside `magicscissors-be/`)

```bash
docker compose up -d postgres redis   # Postgres on host port 5434 (5432 is often another project's DB)
docker compose exec backend npm run db:push    # apply Prisma schema (no migrations folder; db push is used)
docker compose exec backend npm run db:seed    # seed users: owner / manager1 / cashier1 / employee1, password Password123!
npm test                              # Jest (unit tests with mocked Prisma; supertest route tests in src/routes/*.test.js)
npx jest src/utils/shiftRules.test.js --coverage=false   # run one test file
```

The API is at `http://localhost:5001/api/v1`. Backend `.env` `DATABASE_URL` must use the Salon ERP Postgres port (5434 on the host).

## Architecture

- **Entry/providers** (`src/main.jsx`): Redux `Provider` → `QueryClientProvider` (5-min staleTime, retry 1) → `BrowserRouter` → `AuthInitializer` → `App`, plus `<Toaster />` and `<PwaUpdatePrompt />` (update-available toast). Path alias `@` → `src`.
- **Routing** (`src/App.jsx`): all routes in one file, eagerly imported. Everything except `/login` and `/version-history` renders inside `DashboardLayout` under `ProtectedRoute`. `/` redirects to a role dashboard (`developer` maps to owner).
- **Roles**: `owner`, `developer`, `manager`, `cashier`, `employee`, `vendor`. Sidebar visibility comes from the `roles` arrays in `components/layout/Sidebar.jsx`; page-level access is mostly checked inside pages, so a new page needs both a route in `App.jsx` and a Sidebar item. **Owner-only features check `user.role === 'owner'` (developer is excluded)** — the older `isOwner` in `SettingsPage` includes developer, so don't reuse it for those.
- **API layer** (`src/services/*.service.js`): plain objects wrapping the shared axios instance. The response interceptor already unwraps `response.data`, so callers get the backend body `{ success, data, meta }` and read `res.data`. Errors keep axios shape (`err.response.data.error.message`); the backend's Zod validation errors put field messages in `error.details.fields`, which most toasts don't show.
- **Auth**: tokens and `user` live in `localStorage`; `store/slices/authSlice.js` is the only Redux slice. `api.js` adds the bearer token and does a single shared refresh on 401.
- **Server state**: TanStack Query in pages/components; Redux is only for auth.
- **UI**: shadcn primitives in `components/ui/` (no checkbox component — use native inputs); feature components under `components/{attendance,billing,settings,...}`; domain helpers in `lib/`.
- **Design system**: tokens and primitives follow befui (https://befui.vercel.app/llms-full.txt) but are ported to JSX + Tailwind 3 (befui itself targets TSX/Tailwind 4/React 19, so don't run its CLI here). Colors are HSL-triple CSS variables in `styles/globals.css`; use semantic classes (`bg-primary`, `text-muted-foreground`, `success`/`warning`/`info`) rather than `gray-*`/`blue-*`. `components/ui/command.jsx` and `kbd.jsx` come from befui.
- **Keyboard layer** (`components/layout/CommandCenter.jsx`, mounted in `DashboardLayout`): Ctrl/Cmd+K palette built from `getNavItemsByRole`, `/` focuses the page search, `g`+letter go-to, `n` new item, `[` sidebar, `?` help, Ctrl+Enter submits the focused form. New pages added to the Sidebar appear in the palette automatically; add `GO_KEYS`/`NEW_ROUTES` entries there for shortcuts.
- **Version history**: `src/data/versionHistory.js` (`CURRENT_VERSION` + changelog). New user-facing releases add an entry; `VersionHistoryPage` requires each entry to have `details`.

## Attendance, shifts and payroll (cross-cutting)

- **All punches** (biometric machine, manual, PWA) go through the backend's `attendance.service.ingestPunch` → `recomputeAttendance`, which derives check-in/out, working hours, late deduction hours, `half_day` status and a `shiftHours` snapshot per attendance row. Pay features read those stored values.
- **Self check-in** (`pages/MyAttendancePage.jsx`, `hooks/useGeolocation.js`, `lib/geofence.js`, `components/attendance/SelfieCapture.jsx`): the button is enabled only when inside ANY active geofence of the employee's branch with GPS accuracy ≤ the server's `max_accuracy_m`; the server re-checks everything. Selfie is required only when the owner's global switch is on (then the photo is watermarked client-side). One check-in and one check-out per day.
- **Geofences and the selfie switch** are managed in Settings → Geofence (`components/settings/GeofencePanel.jsx`), owner only. The selfie switch is writable only through `PUT /attendance/geofence-settings`; the generic `/settings` routes ignore/refuse it (same for the `payroll_*` settings).
- **Shifts** (`pages/ShiftPage.jsx`, `lib/shiftRules.js`): shifts are global, assigned to employees per date. Each shift has grace minutes, tiered late deductions (hours) and a half-day rule; only the owner edits them. Employees with no assignment for a day keep the legacy rule (15-minute grace, 2-hour floor). `buildRulesPayload` validates the rule fields and mirrors the backend validators.
- **Payroll** (`pages/PayrollPage.jsx`, `lib/payroll.js`, `services/payroll.service.js`): owner-only `/payroll`. Pay is computed on the backend per attendance day: `hourly × hours worked − hourly × late deduction hours`; daily wage ÷ shift hours, or monthly wage ÷ (days in month | fixed days) ÷ shift hours. The page only displays and totals what the backend returns.
