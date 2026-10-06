# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Frontend for the Salon ERP (multi-branch salon management). React 18 + Vite (JS/JSX, no TypeScript), Tailwind + shadcn/ui (Radix), Redux Toolkit, TanStack Query, React Hook Form + Zod, React Router v6. The backend (Express + Prisma + PostgreSQL) is a separate repo, expected at `./salon-erp-be/` (git-ignored here, never commit it).

## Commands

```bash
npm run dev          # Vite dev server (README says port 5174; scripts/dev.sh assumes 5173)
npm run build        # production build -> dist/
npm run lint         # eslint, --max-warnings 0 (warnings fail)
npm run preview
npm run dev:start    # scripts/dev.sh: docker postgres/redis + backend (salon-erp-be) + frontend; also dev:stop/restart/status/logs
```

There is no test runner configured. Backend API is expected at `http://localhost:5001/api/v1`; set `VITE_API_BASE_URL` in `.env` to override. If unset, `api.js` falls back to `window.location.origin + '/api/v1'` (production same-origin deploy). Deployed on Vercel (`vercel.json` SPA rewrite).

## Architecture

- **Entry/providers** (`src/main.jsx`): Redux `Provider` → `QueryClientProvider` (5‑min staleTime, retry 1) → `BrowserRouter` → `AuthInitializer` → `App`. Path alias `@` → `src`.
- **Routing** (`src/App.jsx`): all routes declared in one file, eagerly imported. Everything except `/login` and `/version-history` renders inside `DashboardLayout` under `ProtectedRoute`. `/` redirects to a role-specific dashboard (`pages/dashboards/{Owner,Manager,Cashier,Employee}Dashboard`; `developer` maps to owner).
- **Roles**: `owner`, `developer`, `manager`, `cashier`, `employee`, `vendor`. Menu visibility is driven by the `roles` arrays in `components/layout/Sidebar.jsx`; page-level access is mostly checked in the pages themselves, so when adding a page update both `App.jsx` and the Sidebar.
- **API layer** (`src/services/`): one `*.service.js` per backend resource, each a plain object of functions wrapping the shared axios instance in `services/api.js`. The response interceptor already unwraps `response.data`, so callers receive the backend body (`{ data, ... }`) directly, not the axios response. Errors keep axios shape (`error.response.data.error.message`).
- **Auth**: tokens (`accessToken`, `refreshToken`) and `user` live in `localStorage`; `store/slices/authSlice.js` is the only Redux slice. `api.js` attaches the bearer token and, on a 401 (non-auth endpoints), does a single shared in‑flight refresh via `/auth/refresh` then retries; failure clears storage and hard-redirects to `/login`.
- **Server state** uses TanStack Query inside pages/components; Redux is used only for auth.
- **UI**: `components/ui/` holds shadcn primitives; feature components are grouped in `components/{billing,invoices,dashboard,charts,settings,modals}`. Domain helpers in `lib/` (`gst.js` tax math, `barcodePrint.js`, `tokenQr.js`, `export-utils.js`). Printing/thermal output uses `ThermalReceipt`, `TokenSlip`, `BarcodeImage` (bwip-js).
- **Version history**: `src/data/versionHistory.js` exports `CURRENT_VERSION` and a changelog rendered by `/version-history`; user-facing releases are expected to add an entry there.
