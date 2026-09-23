# Architecture

Diagram-first reference for how Salon ERP pieces connect. Exhaustive API/schema detail lives in the [Developer Guide](./DEVELOPER_GUIDE.md).

## System landscape

```mermaid
flowchart TB
  subgraph clients [Clients]
    SPA[React SPA]
    Device[Attendance device / punch app]
  end
  subgraph api [salon-erp-be]
    Express[Express app.js]
    Routes["/api/v1/* routes"]
    Services[Domain services]
    Sched[node-cron scheduler]
  end
  subgraph data [Data]
    PG[(PostgreSQL)]
    Redis[(Redis - unused on request path)]
  end
  SPA -->|Axios Bearer JWT| Express
  Device -->|API key or webhook Bearer| Express
  Express --> Routes --> Services --> PG
  Express -.-> Redis
  Sched --> Services
```

**Why this shape:** The UI is a static SPA; all business rules and persistence sit in one Express service behind `/api/v1`. There is no separate BFF or auth microservice.

## Request / auth flow

Auth exists — sequence below.

```mermaid
sequenceDiagram
  participant U as User
  participant SPA as React SPA
  participant API as Express /api/v1
  participant DB as PostgreSQL
  U->>SPA: Submit username/password
  SPA->>API: POST /auth/login
  API->>DB: Lookup user, bcrypt verify
  API-->>SPA: access_token + refresh_token + user
  SPA->>SPA: Store tokens in localStorage
  SPA->>API: API calls with Authorization Bearer
  API->>API: authenticate middleware
  alt access expired
    SPA->>API: POST /auth/refresh
    API-->>SPA: new access_token
  end
  API->>API: authorize roles when required
  API->>DB: Scoped queries by role/branch
  API-->>SPA: JSON envelope
```

**Notes from code:**

- Access JWT payload: `userId`, `username`, `role`, `branchId`.
- Refresh JWT payload: `userId` only.
- `UserSession` table exists in Prisma but current auth service does **not** persist/check sessions.
- Frontend `ProtectedRoute` only checks “logged in”; **role gates are API + sidebar**, not route components.
- Attendance punches can authenticate with JWT **or** hashed attendance API keys (`sal_att_…`); webhook ingest uses webhook-type keys.

## Data layer (grouped)

### Core identity & branches

```mermaid
erDiagram
  Branch ||--o{ User : employs
  User ||--o| EmployeeDetail : has
  User ||--o{ EmployeeBranch : maps
  Branch ||--o{ EmployeeBranch : includes
```

### Billing

```mermaid
erDiagram
  Customer ||--o{ Bill : has
  Branch ||--o{ Bill : at
  Bill ||--o{ BillItem : contains
  Bill ||--o{ Payment : paid_by
  BillItem ||--o{ BillItemEmployee : assigned
```

### Catalog & inventory

```mermaid
erDiagram
  ProductCategory ||--o{ Sku : groups
  Sku ||--o{ Product : variants
  Product ||--o{ Inventory : stocked_as
  InventoryLocation ||--o{ Inventory : holds
  Service ||--o{ ServiceRecipe : consumes
  Product ||--o{ ServiceRecipe : ingredient
```

### Attendance

```mermaid
erDiagram
  Branch ||--o{ Machine : has
  User ||--o{ AttendancePunch : punches
  User ||--o{ Attendance : daily
  AttendanceApiKey }o--o| Branch : scoped_to
```

Full model list (~73 Prisma models): see [Developer Guide — Data model](./DEVELOPER_GUIDE.md#data--content-model).

## External integrations

| Integration | Class | Notes |
| --- | --- | --- |
| PostgreSQL | Required | Prisma datasource |
| Redis | Wired-but-inactive | Compose service + ioredis config; no business path requires it |
| Socket.IO | Wired-but-inactive | Dependency only; not used under `src/` |
| node-cron | Optional | Disabled when `DISABLE_SCHEDULER=true` (compose sets this) |
| Cloudinary | Optional ops | Backup script only; db-backup compose service commented out |
| Multer / xlsx / csv-parser | Wired-but-inactive | Present in package.json; little/no active `src` usage |
| Payment gateways / OAuth / SMS / email / analytics | None | Payments are recorded modes (cash/card/upi/…), not a PSP SDK |
| Attendance hardware | Optional | First-party punch APIs + API keys |

## Deployment / infra

```mermaid
flowchart LR
  Dev["Local: Vite + API"] --> APIDev[localhost:5000 or 5001]
  FEBuild["vite build → dist/"] --> Vercel["Vercel SPA rewrites"]
  BEGit["salon-erp-be main push"] --> GHA["GitHub Actions SSH deploy"]
  GHA --> Server["Server: docker compose + optional nginx"]
  Server --> PGProd[(Postgres)]
```

- Frontend: `vercel.json` SPA rewrite to `index.html`; set `VITE_API_BASE_URL` at build time.
- Backend: `deploy.sh` and workflows `deploy-ssh-password.yml` / `deploy-staging-ssh-password.yml` (SSH → `git pull` → `docker compose up` → `prisma db push` in the password workflow).
- ⚠️ **NEEDS CONFIRMATION:** Production hostnames, exact staging URLs, and whether frontend is always on Vercel.

## Frontend routing (SPA)

React Router v6 in `src/App.jsx`. Authenticated shell: `DashboardLayout` + sidebar. Catch-all `*` → `/` → role dashboard.

Default dashboards: owner/developer → `/dashboard/owner`; manager → `/dashboard/manager`; cashier → `/dashboard/cashier`; employee → `/dashboard/employee`.

## Integration reference

| From | To | How |
| --- | --- | --- |
| Browser | Express | `VITE_API_BASE_URL` (else origin `/api/v1`, else `http://localhost:5001/api/v1`) |
| Express | Postgres | `DATABASE_URL` via Prisma |
| Express | Redis | Config only today |
| Devices | Express | Bearer attendance/webhook API key on attendance routes |
| CI | Server | SSH + Docker Compose (backend repo workflows) |

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 18, Vite 5, Tailwind, Radix/shadcn |
| Client state | Redux (auth) + React Query (server state) |
| API | Express 4, Zod validation, Helmet, CORS, Morgan/Winston |
| Data | Prisma 5, PostgreSQL 16 |
| Auth | JWT access + refresh, bcrypt passwords |
| Jobs | node-cron (optional) |

## Glossary

| Term | Meaning |
| --- | --- |
| Branch | Salon or warehouse location (`isSalon` / `isWarehouse`) |
| Token | Daily customer queue ticket before/alongside billing |
| Salon Floor | Chair board UI (`/chairs`) |
| Rotation queue | Per-branch daily employee assignment order for services |
| Shop day | Business day window derived from branch open/close times |
| Owner / developer | Cross-branch admin roles |
| Manager / cashier | Branch-scoped operations roles |
| Employee | Minimal UI; own performance-oriented surfaces |
| Attendance API key | Machine-facing key (`attendance_api` or `webhook` type) |

## Further reading

- [README](./README.md) — overview and quick start
- [Developer Guide](./DEVELOPER_GUIDE.md) — endpoints, env, deploy checklist
- [User Guide](./USER_GUIDE.md) — screens and workflows

## What changed in this update

- Replaced TODO diagrams with landscape, auth sequence, grouped ER sketches, and deploy flow from the real monorepo.
- Documented inactive Redis/Socket.IO/multer/xlsx and unused `UserSession` persistence.
- Added integration table and glossary; flagged production URLs as needing confirmation.
