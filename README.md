# Salon ERP — Frontend

Web app and installable PWA for running a multi-branch salon: billing, customers, inventory, staff attendance, shifts, incentives, payroll and reporting — with role-based dashboards for owners, managers, cashiers and employees.

> **Backend:** [`Beforth/magicscissors-be`](https://github.com/Beforth/magicscissors-be) (Express + Prisma + PostgreSQL). It lives in its own repo; clone it next to or inside this one as `magicscissors-be/`.

---

## Highlights

| Area | What you get |
|---|---|
| **Billing & customers** | Fast bill creation, packages, pending services, multi-method payments (cash, UPI), thermal receipts, barcode/QR printing, GST handling |
| **Floor operations** | Chair management, token queue, employee rotation and allocation, live employee status |
| **Attendance** | Biometric + manual punches, **geofenced self check-in/out from the phone**, optional selfie with GPS + timestamp watermark, live roster with source, distance and selfie |
| **Shifts** | Shifts assigned per employee per day, grace period, **tiered late fines**, **half-day rules** |
| **Payroll** *(owner only)* | **Daily or monthly wages**, hourly rate from shift hours, late deductions, monthly report with CSV export |
| **Incentives** | Configurable per-branch incentive engine with monthly payouts |
| **Finance** | Cash drawer, expenses, savings pots, bank deposits, counter withdrawals, UPI accounts |
| **Inventory** | Products, SKUs, warehouses, suppliers, purchase batches, stock transfers |
| **Reports** | Branch and staff performance, revenue and attendance reports |
| **PWA** | Install to the home screen, update-available prompt, API calls are never cached |

## Tech stack

React 18 · Vite 5 · Tailwind CSS · shadcn/ui (Radix) · Redux Toolkit (auth only) · TanStack Query · React Hook Form + Zod · React Router v6 · Recharts · `vite-plugin-pwa`

## Quick start

### Prerequisites

- **Node.js ≥ 20.19** (the PWA build tooling requires it)
- The backend running on `http://localhost:5001` — see the backend README

### Run it

```bash
npm install
echo "VITE_API_BASE_URL=http://localhost:5001/api/v1" > .env
npm run dev          # http://localhost:5173
```

Use another port if 5173 is taken (Vite otherwise silently moves to the next free one):

```bash
npm run dev -- --port 5180 --strictPort
```

> **Important:** without `VITE_API_BASE_URL` the app calls `/api/v1` on its *own* origin, which only works when the API is served from the same domain (production). For local development always set it, then restart Vite — it reads `.env` only at startup.

### Sign in (seeded development accounts)

After the backend is seeded (`npm run db:seed` in the backend repo):

| Username | Password | Role |
|---|---|---|
| `owner` | `Password123!` | Owner — all branches, payroll, geofences |
| `developer` | `Password123!` | Developer — technical admin (no payroll / shift-rule editing) |
| `manager1` | `Password123!` | Manager (Branch 1) |
| `cashier1` | `Password123!` | Cashier (Branch 1) |
| `employee1` | `Password123!` | Employee (Branch 1) |

These are development defaults. **Change them before any real deployment.**

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server (service worker is **not** active in dev) |
| `npm run build` | Production build into `dist/`, including the service worker and manifest |
| `npm run preview` | Serve the production build — use this to test the PWA install |
| `npm run generate-pwa-icons` | Regenerate PWA icons from `public/icon.svg` |
| `node scripts/check-geofence.mjs` | Assertions for the geofence gating logic (`src/lib/geofence.js`) |
| `node scripts/check-shift-payroll.mjs` | Assertions for shift-rule and payroll helpers (`src/lib/shiftRules.js`, `src/lib/payroll.js`) |

There is no test runner or ESLint configuration yet; the build and the two check scripts are the quality gates. Keep helpers in `src/lib/` free of React and the `@/` alias so Node can run them.

## Who can do what

| Role | Access |
|---|---|
| **Owner** | Everything, all branches. **Only role** that edits shift rules, sets wages, opens Payroll, and manages geofences and the selfie switch |
| **Developer** | All branches and technical settings; read-only on shifts rules; no payroll |
| **Manager** | One branch: staff, attendance, shift assignments, operations |
| **Cashier** | One branch: billing, customers, manual attendance |
| **Employee** | Own dashboard, performance and **My Attendance** (self check-in/out) |
| **Vendor** | Products and inventory view |

Menu visibility is driven by the `roles` arrays in `src/components/layout/Sidebar.jsx`. The server enforces every permission — the UI gating is a convenience, not security.

## Attendance with geofencing

1. The **owner** adds one or more named locations (latitude, longitude, radius) in **Settings → Geofence** and chooses whether a selfie is required.
2. The employee opens **My Attendance** on their phone (installed PWA recommended).
3. The **Check in / Check out** button is enabled only when the phone is **inside any active geofence** of their branch and GPS accuracy is good enough. Otherwise it is disabled and says why ("You are 240 m from Main").
4. If the owner switched selfies on, the camera opens first; the photo is stamped with coordinates and time.
5. The server re-validates distance, accuracy, selfie and the day's state, then records the punch. One check-in and one check-out per day.

Geolocation and the camera need **HTTPS** (they also work on `localhost`). To test on a phone use a deployed build or an HTTPS tunnel.

## Shifts and payroll

- **Shift rules** (owner): per shift, a grace period, late-fine tiers ("late by ≥ 30 min → deduct 1 h") and a half-day rule (late by more than X minutes, or worked fewer than Y hours).
- Employees **without** an assigned shift keep the legacy rule (15-minute grace, 2-hour floor).
- **Wages** (owner): per employee, *daily* (e.g. ₹500/day) or *monthly*.
- **Pay for a day** = `hourly rate × hours worked − hourly rate × late-deduction hours`
  - daily: `hourly = daily wage ÷ shift hours`
  - monthly: `hourly = monthly wage ÷ (days in month or a fixed number of days) ÷ shift hours`
- Absent and leave days earn ₹0. Rule changes are not retroactive. The **Payroll** page shows days, hours, late deductions and net pay per employee for a month and branch, with warnings (missing wage, missing hours) and CSV export.

## Project structure

```
src/
├── components/
│   ├── ui/            shadcn primitives
│   ├── layout/        Sidebar, Header, DashboardLayout
│   ├── attendance/    SelfieCapture, PunchMeta
│   ├── settings/      GeofencePanel, API-key panels, incentive config
│   └── …              billing, invoices, charts, dashboard, modals
├── pages/             one file per route (+ dashboards/ per role)
├── services/          one *.service.js per backend resource (axios)
├── store/             Redux store — auth slice only
├── hooks/             useGeolocation, useFilterParams
├── lib/               pure helpers: geofence, shiftRules, payroll, gst, export-utils
├── data/              versionHistory.js (in-app changelog)
└── styles/
scripts/               node check scripts
public/                icons and static assets
```

## How it fits together

- **Routing** is declared in `src/App.jsx`; everything except `/login` and `/version-history` sits behind `ProtectedRoute` inside `DashboardLayout`.
- **API calls** go through one axios instance (`src/services/api.js`) that attaches the JWT, refreshes it once on a 401, and **unwraps the response body** — so callers read `res.data`. Errors keep the axios shape (`err.response.data.error.message`).
- **Server state** lives in TanStack Query; Redux only holds authentication.
- **Releases:** user-facing changes add an entry to `src/data/versionHistory.js`, shown at `/version-history`.

## Build and deploy

```bash
VITE_API_BASE_URL=https://your-api-domain/api/v1 npm run build
```

`dist/` is a static site. `vercel.json` provides the SPA rewrite and `no-cache` headers for `sw.js` and the manifest so updates reach installed apps. Check that the host's Node version is **≥ 20.19**.

### PWA notes

- Installable on Android/desktop Chrome (install icon in the address bar) and iOS (Share → Add to Home Screen).
- The service worker precaches the app shell only. API requests are network-only, so billing and attendance data are never stale.
- A "new version available" toast appears when a deploy is detected; tapping **Update** reloads into it.
- `public/icon.svg` is a placeholder logo — replace it and run `npm run generate-pwa-icons`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Login fails or requests go to the wrong place | `VITE_API_BASE_URL` missing in `.env`; set it and **restart** Vite |
| Another site opens on `localhost:5173` | A different project owns the port; run with `--port 5180 --strictPort` |
| Backend says "authentication failed against database" | `.env` in the backend points at a different Postgres (often port 5432); the Salon ERP database defaults to host port **5434** |
| Check-in button disabled | Outside every geofence, GPS accuracy > 50 m, location permission denied, or no geofence configured for the branch |
| Camera/GPS unavailable on a phone | Needs HTTPS (or `localhost`) |
| PWA doesn't update | Hard-refresh once; make sure `sw.js` is served with `no-cache` |
| `npm run lint` errors | There is no ESLint config in the repo yet |

## Contributing

- Branch from `main`, keep PRs focused, and describe how you verified the change.
- Run `npm run build` and the two `node scripts/check-*.mjs` scripts before opening a PR.
- This repo does not contain the backend. Backend changes go to `magicscissors-be` (a separate repo); never commit that folder here.

## License

Proprietary — all rights reserved.
