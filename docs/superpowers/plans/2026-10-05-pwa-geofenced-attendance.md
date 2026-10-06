# PWA + Geofenced Self Check-in/Check-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff install the app as a PWA and punch in/out from their phone, allowed only inside an owner-defined geofence, with a selfie required only when a global switch is on.

**Architecture:** Self-punches go through a new `POST /attendance/self/punch` endpoint that validates GPS against the branch's active geofences on the server, then calls the existing `attendanceService.ingestPunch()` (so shifts, late penalty, breaks, auto-close and incentives are untouched). The frontend adds a PWA shell, an owner-only geofence settings tab, a `/my-attendance` page, and review columns on the existing Attendance page.

**Tech Stack:** Backend: Node/Express, Prisma (`db push`), Zod, Jest, multer. Frontend: React 18, Vite, `vite-plugin-pwa`, TanStack Query, shadcn/ui, Tailwind. No frontend test runner exists; the frontend is verified with `npm run lint`, `npm run build`, a node assertion script for pure logic, and the browser pane.

**Spec:** `docs/superpowers/specs/2026-10-05-pwa-geofenced-attendance-design.md`

## Repos and paths

- Frontend repo: `/Users/ady/Documents/magicscissors-fe` (git root, branch `main`).
- Backend repo: `/Users/ady/Documents/magicscissors-fe/magicscissors-be` — it has **its own `.git`** (the frontend repo lists it as untracked). Backend commits are made inside `magicscissors-be/`. Frontend commits are made in the frontend repo root and must not `git add` `magicscissors-be/`.
- Commit steps below are part of the plan, but only commit when the user has OK'd committing in this session.

## Global Constraints

- Geofence CRUD and the selfie switch are **owner only**: backend `authorize('owner')` (not `developer`), frontend `user.role === 'owner'`. Do NOT add a new role.
- Outside every active geofence → the Check in / Check out button is disabled in the UI **and** the server rejects the punch.
- Several named geofences per branch: name, latitude, longitude, radius (m), active flag. Radius range 5–5000, default 100.
- GPS accuracy limit: 50 m (`MAX_ACCURACY_M = 50`).
- Selfie: one **global** setting `attendance_require_selfie` (default `false`). On → selfie required and camera step shown. Off → no selfie step at all.
- Server clock only for self-punch time; client-supplied time is ignored.
- Employee and branch come from the JWT, never the request body.
- Manual/biometric punches, manager overrides and breaks are unchanged.
- Schema changes are additive and applied with `prisma db push` (`npm run db:push`); there is no migrations folder.
- Selfies are stored on disk with unguessable UUID names and served at `/api/v1/uploads/...`. Selfie files must be image/jpeg, image/png or image/webp, max 3 MB.

## Review Focus

- Branch with **no active geofences**: self-punch must be rejected (`GEOFENCE_NOT_CONFIGURED`), never allowed. → Task 5 test.
- **Non-numeric / out-of-range coordinates** (NaN, lat 91): rejected, not treated as "inside". → Task 1 and Task 5 tests.
- **Double submit / wrong state**: "check out" when not checked in, "check in" when already on floor or on leave. → Task 5 `checkTransition` tests.
- **Selfie required but missing**, and selfie file of the wrong type or too large. → Task 5 tests.
- **Inactive geofence** must not count; **point exactly on the radius** counts as inside. → Task 1 tests.

---

## File Structure

Backend (`magicscissors-be/`):
- Create `src/utils/geofence.js` — pure haversine + geofence evaluation.
- Create `src/utils/geofence.test.js`.
- Create `src/utils/selfieStorage.js` — saves a selfie buffer to disk, returns the public path.
- Create `src/middleware/uploadSelfie.js` — multer wrapper that maps upload errors to `AppError`.
- Create `src/services/geofence.service.js` — geofence CRUD + selfie switch.
- Create `src/services/selfPunch.service.js` — config for the staff page + `punch()`.
- Create `src/services/selfPunch.service.test.js`.
- Create `src/validators/geofence.validator.js`.
- Modify `prisma/schema.prisma`, `src/services/settings.service.js`, `src/services/attendance.service.js`, `src/validators/attendance.validator.js`, `src/controllers/attendance.controller.js`, `src/routes/attendance.routes.js`, `src/app.js`, `docker-compose.yml`.

Frontend (`/`):
- Create `src/services/geofence.service.js`; modify `src/services/attendance.service.js`, `src/services/api.js`.
- Create `src/lib/geofence.js` (+ `scripts/check-geofence.mjs`), `src/lib/selfie.js`.
- Create `src/hooks/useGeolocation.js`.
- Create `src/components/settings/GeofencePanel.jsx`; modify `src/pages/SettingsPage.jsx`.
- Create `src/components/attendance/SelfieCapture.jsx`, `src/components/attendance/PunchMeta.jsx`.
- Create `src/pages/MyAttendancePage.jsx`; modify `src/App.jsx`, `src/components/layout/Sidebar.jsx`.
- Create `src/components/PwaUpdatePrompt.jsx`; modify `src/main.jsx`, `vite.config.js`, `index.html`, `vercel.json`, `package.json`; create `public/icon.svg` and generated icons.
- Modify `src/pages/AttendancePage.jsx`, `src/data/versionHistory.js`.

---

## Task 1: Geofence math utility (backend)

**Files:**
- Create: `magicscissors-be/src/utils/geofence.js`
- Test: `magicscissors-be/src/utils/geofence.test.js`

**Interfaces:**
- Produces: `haversineMeters(lat1, lng1, lat2, lng2): number` and `evaluateGeofences(point: {latitude:number, longitude:number}, geofences: Array<{id, name, latitude, longitude, radiusM, isActive}>): { within: boolean, nearest: { id, name, distanceM, radiusM } | null }`. Inactive fences are ignored. Non-finite coordinates return `{ within:false, nearest:null }`.

- [ ] **Step 1: Write the failing test** — `src/utils/geofence.test.js`

```js
const { haversineMeters, evaluateGeofences } = require('./geofence');

const fence = (over = {}) => ({
  id: 'g1', name: 'Main', latitude: 19.884765, longitude: 73.978462, radiusM: 100, isActive: true, ...over,
});

describe('haversineMeters', () => {
  test('same point is 0', () => {
    expect(haversineMeters(19.88, 73.97, 19.88, 73.97)).toBe(0);
  });
  test('1 degree of latitude is about 111.2 km', () => {
    const d = haversineMeters(0, 0, 1, 0);
    expect(d).toBeGreaterThan(111000);
    expect(d).toBeLessThan(111400);
  });
});

describe('evaluateGeofences', () => {
  test('inside the radius', () => {
    const r = evaluateGeofences({ latitude: 19.884765, longitude: 73.978462 }, [fence()]);
    expect(r.within).toBe(true);
    expect(r.nearest.distanceM).toBe(0);
  });

  test('outside the radius reports nearest fence and distance', () => {
    // ~0.002 deg lat ≈ 222 m north
    const r = evaluateGeofences({ latitude: 19.886765, longitude: 73.978462 }, [fence()]);
    expect(r.within).toBe(false);
    expect(r.nearest.name).toBe('Main');
    expect(r.nearest.distanceM).toBeGreaterThan(200);
  });

  test('a point exactly on the radius counts as inside', () => {
    const d = Math.round(haversineMeters(19.884765, 73.978462, 19.885765, 73.978462));
    const r = evaluateGeofences({ latitude: 19.885765, longitude: 73.978462 }, [fence({ radiusM: d })]);
    expect(r.within).toBe(true);
    expect(r.nearest.distanceM).toBe(d);
  });

  test('inactive fences are ignored', () => {
    const r = evaluateGeofences({ latitude: 19.884765, longitude: 73.978462 }, [fence({ isActive: false })]);
    expect(r.within).toBe(false);
    expect(r.nearest).toBeNull();
  });

  test('empty list is never within', () => {
    expect(evaluateGeofences({ latitude: 1, longitude: 1 }, [])).toEqual({ within: false, nearest: null });
  });

  test('inside any one of several fences is enough', () => {
    const far = fence({ id: 'g2', name: 'Far', latitude: 10, longitude: 10 });
    const r = evaluateGeofences({ latitude: 19.884765, longitude: 73.978462 }, [far, fence()]);
    expect(r.within).toBe(true);
    expect(r.nearest.name).toBe('Main');
  });

  test('NaN or out-of-range coordinates are never within', () => {
    expect(evaluateGeofences({ latitude: NaN, longitude: 73.97 }, [fence()]).within).toBe(false);
    expect(evaluateGeofences({ latitude: 91, longitude: 73.97 }, [fence()]).within).toBe(false);
    expect(evaluateGeofences({ latitude: 19.88, longitude: 181 }, [fence()]).within).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (in `magicscissors-be/`): `npx jest src/utils/geofence.test.js --coverage=false`
Expected: FAIL — `Cannot find module './geofence'`.

- [ ] **Step 3: Implement** — `src/utils/geofence.js`

```js
const EARTH_RADIUS_M = 6371000;

const toRad = (deg) => (deg * Math.PI) / 180;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

function isValidPoint(p) {
  return (
    p &&
    Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 &&
    Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180
  );
}

/**
 * @returns {{ within: boolean, nearest: {id,name,distanceM,radiusM}|null }}
 * `within` is true when the point is inside ANY active geofence (distance <= radius).
 */
function evaluateGeofences(point, geofences) {
  if (!isValidPoint(point)) return { within: false, nearest: null };

  let nearest = null;
  let within = false;
  for (const g of geofences) {
    if (!g.isActive) continue;
    const distanceM = Math.round(
      haversineMeters(point.latitude, point.longitude, Number(g.latitude), Number(g.longitude))
    );
    if (distanceM <= g.radiusM) within = true;
    if (!nearest || distanceM < nearest.distanceM) {
      nearest = { id: g.id, name: g.name, distanceM, radiusM: g.radiusM };
    }
  }
  return { within, nearest };
}

module.exports = { haversineMeters, evaluateGeofences, isValidPoint };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/utils/geofence.test.js --coverage=false`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit** (inside `magicscissors-be/`)

```bash
git add src/utils/geofence.js src/utils/geofence.test.js
git commit -m "feat(attendance): add geofence distance utility"
```

---

## Task 2: Schema, settings default, upload serving (backend)

**Files:**
- Modify: `magicscissors-be/prisma/schema.prisma` (enum `PunchSource` ~line 208, model `Branch` ~line 224–271, model `AttendancePunch` ~line 1241)
- Modify: `magicscissors-be/src/services/settings.service.js` (`DEFAULT_SETTINGS`, Employee Settings block)
- Modify: `magicscissors-be/src/app.js` (before `app.use('/api/...')`)
- Modify: `magicscissors-be/docker-compose.yml` (backend service volumes, ~line 69)

**Interfaces:**
- Produces: Prisma model `attendanceGeofence` with fields `id, branchId, name, latitude (Float), longitude (Float), radiusM (Int), isActive (Boolean), createdById, createdAt, updatedAt`; new `AttendancePunch` fields `latitude, longitude, accuracyM, distanceM (Float?), selfieUrl (String?), withinGeofence (Boolean?)`; `PunchSource.app`; setting key `attendance_require_selfie`; files served at `GET /api/v1/uploads/<path>` from `process.env.UPLOAD_DIR || <cwd>/uploads`.

- [ ] **Step 1: Edit the Prisma schema**

```prisma
enum PunchSource {
  machine
  manual
  app
}
```

Add inside `model Branch { ... }` next to `attendanceApiKeys AttendanceApiKey[]`:

```prisma
  attendanceGeofences AttendanceGeofence[]
```

Add to `model AttendancePunch` (before `createdAt`):

```prisma
  latitude             Float?
  longitude            Float?
  accuracyM            Float?      @map("accuracy_m")
  distanceM            Float?      @map("distance_m")
  selfieUrl            String?     @map("selfie_url") @db.VarChar(255)
  withinGeofence       Boolean?    @map("within_geofence")
```

Add a new model after `AttendanceApiKey`:

```prisma
model AttendanceGeofence {
  id          String   @id @default(uuid()) @db.Uuid
  branchId    String   @map("branch_id") @db.Uuid
  name        String   @db.VarChar(100)
  latitude    Float
  longitude   Float
  radiusM     Int      @default(100) @map("radius_m")
  isActive    Boolean  @default(true) @map("is_active")
  createdById String?  @map("created_by") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  branch Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@index([branchId])
  @@map("attendance_geofences")
}
```

- [ ] **Step 2: Validate and generate**

Run: `npx prisma validate && npx prisma generate`
Expected: `The schema ... is valid` and a generated client.

- [ ] **Step 3: Dry-run, then apply the schema**

Run: `npm run db:migrate-deploy -- --dry-run` and read the diff. It must only add things (new table, new nullable columns, enum value). If it proposes dropping or altering anything else, STOP and ask the user.
Then apply: `npm run db:push` (local dev DB only; production is applied by the user via `scripts/migrate.sh --backup`).

- [ ] **Step 4: Add the setting default** in `settings.service.js` under `// Employee Settings`:

```js
  attendance_require_selfie: { value: 'false', type: 'boolean', public: false },
```

- [ ] **Step 5: Serve uploads** in `src/app.js`, directly above the `// API Routes` comment (add `const path = require('path');` at the top if absent):

```js
// Uploaded attendance selfies — unguessable UUID file names, no directory listing.
// CORP is relaxed so the frontend (different origin) can render <img> from here.
const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
app.use(
  `/api/${process.env.API_VERSION || 'v1'}/uploads`,
  express.static(uploadDir, {
    index: false,
    dotfiles: 'deny',
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  })
);
```

(Confirm `express` is already imported in `app.js`; it is used for `express.json`.)

- [ ] **Step 6: Persist uploads in Docker** — add to the backend service `volumes:` in `docker-compose.yml`:

```yaml
      - ./uploads:/app/uploads
```

and append `uploads/` to `magicscissors-be/.gitignore`.

- [ ] **Step 7: Verify the server still boots**

Run: `node -e "require('./src/app')"`
Expected: exits cleanly with no error (no output).

- [ ] **Step 8: Commit** (in `magicscissors-be/`)

```bash
git add prisma/schema.prisma src/services/settings.service.js src/app.js docker-compose.yml .gitignore
git commit -m "feat(attendance): geofence schema, selfie setting and uploads serving"
```

---

## Task 3: `ingestPunch` accepts employee/branch override and geo fields (backend)

**Files:**
- Modify: `magicscissors-be/src/services/attendance.service.js` (`resolvePunch` ~line 264, `ingestPunch` ~line 327, `module.exports` ~line 677)
- Test: `magicscissors-be/src/services/attendance.service.test.js` (append)

**Interfaces:**
- Consumes: existing `resolveShopDay` (from `../utils/shopDay`, already imported in this file).
- Produces: `ingestPunch(input)` additionally accepts `input.employee_id`, `input.branch_id` (both skip the machine/code lookup) and `input.geo = { latitude, longitude, accuracyM, distanceM, selfieUrl, withinGeofence }`. `resolvePunch` is exported for tests. New orphan reason `unknown_branch`.

- [ ] **Step 1: Write the failing test** — append to `attendance.service.test.js`

```js
const { resolvePunch } = require('./attendance.service');

describe('resolvePunch with employee/branch override (self punch)', () => {
  const branch = { id: 'b1', openTime: '09:00', closeTime: '21:00', isActive: true };
  const employee = { id: 'e1', isActive: true, user: { id: 'e1', branchId: 'b1', isActive: true } };

  function fakeTx(over = {}) {
    return {
      branch: { findUnique: jest.fn().mockResolvedValue(branch) },
      machine: { findUnique: jest.fn() },
      employeeDetail: { findUnique: jest.fn().mockResolvedValue(employee) },
      attendance: { upsert: jest.fn().mockResolvedValue({ id: 'a1' }) },
      ...over,
    };
  }

  test('uses branchId/employeeId directly and never touches machine lookup', async () => {
    const tx = fakeTx();
    const r = await resolvePunch(
      { employeeCode: 'X', machineNo: 'PWA', employeeId: 'e1', branchId: 'b1', punchTime: ist(2026, 4, 18, 10, 0) },
      tx
    );
    expect(tx.machine.findUnique).not.toHaveBeenCalled();
    expect(tx.employeeDetail.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'e1' } }));
    expect(r).toMatchObject({ employeeId: 'e1', branchId: 'b1', attendanceId: 'a1' });
  });

  test('inactive or missing branch → orphan unknown_branch', async () => {
    const tx = fakeTx({ branch: { findUnique: jest.fn().mockResolvedValue({ ...branch, isActive: false }) } });
    const r = await resolvePunch(
      { employeeCode: 'X', machineNo: 'PWA', employeeId: 'e1', branchId: 'b1', punchTime: ist(2026, 4, 18, 10, 0) },
      tx
    );
    expect(r).toEqual({ orphan: 'unknown_branch' });
  });

  test('employee from another branch → orphan wrong_branch', async () => {
    const tx = fakeTx({
      employeeDetail: {
        findUnique: jest.fn().mockResolvedValue({ ...employee, user: { ...employee.user, branchId: 'other' } }),
      },
    });
    const r = await resolvePunch(
      { employeeCode: 'X', machineNo: 'PWA', employeeId: 'e1', branchId: 'b1', punchTime: ist(2026, 4, 18, 10, 0) },
      tx
    );
    expect(r).toEqual({ orphan: 'wrong_branch' });
  });
});
```

(`ist(...)` is already defined at the top of this test file.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/services/attendance.service.test.js --coverage=false -t "override"`
Expected: FAIL — `resolvePunch is not a function`.

- [ ] **Step 3: Implement.** Replace `resolvePunch` lines from `// 1. Machine → Branch` through the `wrong_branch` check with:

```js
  // 1. Branch: explicit (self punch) or via machine (biometric / manual)
  let branch;
  if (punch.branchId) {
    branch = await tx.branch.findUnique({
      where: { id: punch.branchId },
      select: { id: true, openTime: true, closeTime: true, isActive: true },
    });
    if (!branch || !branch.isActive) return { orphan: 'unknown_branch' };
  } else {
    const machine = await tx.machine.findUnique({
      where: { machineNo: punch.machineNo },
      include: { branch: { select: { id: true, openTime: true, closeTime: true, isActive: true } } },
    });
    if (!machine || !machine.isActive || !machine.branch?.isActive) {
      return { orphan: 'unknown_machine' };
    }
    branch = machine.branch;
  }

  // 2. Employee: explicit id (self punch) or employeeCode/biometricId → User → EmployeeDetail
  const userSelect = { user: { select: { id: true, branchId: true, isActive: true } } };
  let employee;
  if (punch.employeeId) {
    employee = await tx.employeeDetail.findUnique({
      where: { id: punch.employeeId },
      include: userSelect,
    });
  } else {
    employee = await tx.employeeDetail.findUnique({
      where: { employeeCode: punch.employeeCode },
      include: userSelect,
    });
    if (!employee || !employee.isActive || !employee.user?.isActive) {
      employee = await tx.employeeDetail.findUnique({
        where: { biometricId: punch.employeeCode },
        include: userSelect,
      });
    }
  }
  if (!employee || !employee.isActive || !employee.user?.isActive) {
    return { orphan: 'unknown_employee' };
  }

  // 3. Employee must belong to the resolved branch
  if (employee.user.branchId !== branch.id) {
    return { orphan: 'wrong_branch' };
  }
```

In `ingestPunch`, add to the `tx.attendancePunch.create` `data`:

```js
        latitude: input.geo?.latitude ?? null,
        longitude: input.geo?.longitude ?? null,
        accuracyM: input.geo?.accuracyM ?? null,
        distanceM: input.geo?.distanceM ?? null,
        selfieUrl: input.geo?.selfieUrl ?? null,
        withinGeofence: input.geo?.withinGeofence ?? null,
```

and change the resolve call to:

```js
    const resolution = await resolvePunch(
      { employeeCode, punchTime, machineNo, employeeId: input.employee_id, branchId: input.branch_id },
      tx
    );
```

Add `resolvePunch,` to `module.exports`.

- [ ] **Step 4: Run all attendance tests**

Run: `npx jest src/services/attendance.service.test.js src/utils --coverage=false`
Expected: PASS, including every pre-existing test (no regression in biometric/manual resolution).

- [ ] **Step 5: Commit**

```bash
git add src/services/attendance.service.js src/services/attendance.service.test.js
git commit -m "feat(attendance): allow ingestPunch to resolve by employee/branch id and store geo data"
```

---

## Task 4: Geofence CRUD + selfie switch API (backend, owner only)

**Files:**
- Create: `magicscissors-be/src/validators/geofence.validator.js`
- Create: `magicscissors-be/src/services/geofence.service.js`
- Modify: `magicscissors-be/src/controllers/attendance.controller.js`, `magicscissors-be/src/routes/attendance.routes.js`
- Test: `magicscissors-be/src/validators/geofence.validator.test.js`

**Interfaces:**
- Consumes: `settingsService.getSetting(key)`, `settingsService.updateSettings(obj, userId)`.
- Produces (all `authenticate` + `authorize('owner')`):
  - `GET /attendance/geofences?branch_id=<uuid>` → `{ geofences: [{id,branch_id,name,latitude,longitude,radius_m,is_active}], require_selfie: boolean }`
  - `POST /attendance/geofences` body `{branch_id,name,latitude,longitude,radius_m?,is_active?}` → geofence
  - `PUT /attendance/geofences/:id` body any subset → geofence
  - `DELETE /attendance/geofences/:id` → `{ id }`
  - `PUT /attendance/geofence-settings` body `{ require_selfie: boolean }` → `{ require_selfie }`
  - Exported schemas: `listGeofencesSchema, createGeofenceSchema, updateGeofenceSchema, deleteGeofenceSchema, geofenceSettingsSchema`.

- [ ] **Step 1: Write the failing validator test** — `src/validators/geofence.validator.test.js`

```js
const { createGeofenceSchema, geofenceSettingsSchema } = require('./geofence.validator');

const base = {
  branch_id: '3f2b6d2e-5b53-4b8a-9d57-0d1f6f8f0a11',
  name: 'Main entrance',
  latitude: 19.884765,
  longitude: 73.978462,
};
const parse = (body) => createGeofenceSchema.safeParse({ body, query: {}, params: {} });

describe('createGeofenceSchema', () => {
  test('accepts a valid body and defaults radius to 100', () => {
    const r = parse(base);
    expect(r.success).toBe(true);
    expect(r.data.body.radius_m).toBe(100);
  });
  test.each([
    ['latitude 91', { latitude: 91 }],
    ['longitude -181', { longitude: -181 }],
    ['radius 4', { radius_m: 4 }],
    ['radius 5001', { radius_m: 5001 }],
    ['empty name', { name: '  ' }],
    ['bad branch id', { branch_id: 'nope' }],
  ])('rejects %s', (_label, over) => {
    expect(parse({ ...base, ...over }).success).toBe(false);
  });
});

describe('geofenceSettingsSchema', () => {
  test('requires a boolean', () => {
    expect(geofenceSettingsSchema.safeParse({ body: { require_selfie: true }, query: {}, params: {} }).success).toBe(true);
    expect(geofenceSettingsSchema.safeParse({ body: { require_selfie: 'yes' }, query: {}, params: {} }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/validators/geofence.validator.test.js --coverage=false`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the validator** — `src/validators/geofence.validator.js`

```js
const { z } = require('zod');

const empty = z.object({}).optional();
const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const radius = z.number().int().min(5).max(5000);
const name = z.string().trim().min(1, 'Name is required').max(100);

const listGeofencesSchema = z.object({
  body: empty,
  query: z.object({ branch_id: z.string().uuid('Invalid branch ID') }),
  params: empty,
});

const createGeofenceSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid('Invalid branch ID'),
    name,
    latitude: lat,
    longitude: lng,
    radius_m: radius.default(100),
    is_active: z.boolean().optional(),
  }),
  query: empty,
  params: empty,
});

const updateGeofenceSchema = z.object({
  body: z.object({
    name: name.optional(),
    latitude: lat.optional(),
    longitude: lng.optional(),
    radius_m: radius.optional(),
    is_active: z.boolean().optional(),
  }),
  query: empty,
  params: z.object({ id: z.string().uuid() }),
});

const deleteGeofenceSchema = z.object({
  body: empty,
  query: empty,
  params: z.object({ id: z.string().uuid() }),
});

const geofenceSettingsSchema = z.object({
  body: z.object({ require_selfie: z.boolean() }),
  query: empty,
  params: empty,
});

module.exports = {
  listGeofencesSchema,
  createGeofenceSchema,
  updateGeofenceSchema,
  deleteGeofenceSchema,
  geofenceSettingsSchema,
};
```

- [ ] **Step 4: Implement the service** — `src/services/geofence.service.js`

```js
const prisma = require('../config/database');
const AppError = require('../utils/AppError');
const settingsService = require('./settings.service');

const SELFIE_KEY = 'attendance_require_selfie';

const toDto = (g) => ({
  id: g.id,
  branch_id: g.branchId,
  name: g.name,
  latitude: g.latitude,
  longitude: g.longitude,
  radius_m: g.radiusM,
  is_active: g.isActive,
});

async function getRequireSelfie() {
  const s = await settingsService.getSetting(SELFIE_KEY);
  return s?.value === true;
}

async function list(branchId) {
  const rows = await prisma.attendanceGeofence.findMany({
    where: { branchId },
    orderBy: { createdAt: 'asc' },
  });
  return { geofences: rows.map(toDto), require_selfie: await getRequireSelfie() };
}

async function create(data, userId) {
  const branch = await prisma.branch.findUnique({ where: { id: data.branch_id }, select: { id: true } });
  if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');
  const row = await prisma.attendanceGeofence.create({
    data: {
      branchId: data.branch_id,
      name: data.name,
      latitude: data.latitude,
      longitude: data.longitude,
      radiusM: data.radius_m,
      isActive: data.is_active ?? true,
      createdById: userId || null,
    },
  });
  return toDto(row);
}

async function update(id, data) {
  const existing = await prisma.attendanceGeofence.findUnique({ where: { id } });
  if (!existing) throw new AppError('Geofence not found', 404, 'NOT_FOUND');
  const row = await prisma.attendanceGeofence.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.latitude !== undefined && { latitude: data.latitude }),
      ...(data.longitude !== undefined && { longitude: data.longitude }),
      ...(data.radius_m !== undefined && { radiusM: data.radius_m }),
      ...(data.is_active !== undefined && { isActive: data.is_active }),
    },
  });
  return toDto(row);
}

async function remove(id) {
  const existing = await prisma.attendanceGeofence.findUnique({ where: { id } });
  if (!existing) throw new AppError('Geofence not found', 404, 'NOT_FOUND');
  await prisma.attendanceGeofence.delete({ where: { id } });
  return { id };
}

async function setRequireSelfie(value, userId) {
  await settingsService.updateSettings({ [SELFIE_KEY]: value }, userId);
  return { require_selfie: value };
}

module.exports = { list, create, update, remove, setRequireSelfie, getRequireSelfie };
```

- [ ] **Step 5: Controller + routes.** Append to `attendance.controller.js`:

```js
const geofenceService = require('../services/geofence.service');

exports.listGeofences = catchAsync(async (req, res) => {
  sendResponse(res, 200, await geofenceService.list(req.query.branch_id));
});
exports.createGeofence = catchAsync(async (req, res) => {
  sendResponse(res, 201, await geofenceService.create(req.body, req.user.id));
});
exports.updateGeofence = catchAsync(async (req, res) => {
  sendResponse(res, 200, await geofenceService.update(req.params.id, req.body));
});
exports.deleteGeofence = catchAsync(async (req, res) => {
  sendResponse(res, 200, await geofenceService.remove(req.params.id));
});
exports.updateGeofenceSettings = catchAsync(async (req, res) => {
  sendResponse(res, 200, await geofenceService.setRequireSelfie(req.body.require_selfie, req.user.id));
});
```

In `attendance.routes.js` import the five schemas from `../validators/geofence.validator` and add before `module.exports`:

```js
router.get('/geofences', authenticate, authorize('owner'), validate(listGeofencesSchema), attendanceController.listGeofences);
router.post('/geofences', authenticate, authorize('owner'), validate(createGeofenceSchema), attendanceController.createGeofence);
router.put('/geofences/:id', authenticate, authorize('owner'), validate(updateGeofenceSchema), attendanceController.updateGeofence);
router.delete('/geofences/:id', authenticate, authorize('owner'), validate(deleteGeofenceSchema), attendanceController.deleteGeofence);
router.put('/geofence-settings', authenticate, authorize('owner'), validate(geofenceSettingsSchema), attendanceController.updateGeofenceSettings);
```

- [ ] **Step 6: Run tests and smoke the routes**

Run: `npx jest src/validators/geofence.validator.test.js --coverage=false` → PASS.
Then start the backend (`npm run dev`) and, with an owner token, `curl` `POST /api/v1/attendance/geofences` → 201; with a manager token → 403. Report what you saw.

- [ ] **Step 7: Commit**

```bash
git add src/validators/geofence.validator.js src/validators/geofence.validator.test.js src/services/geofence.service.js src/controllers/attendance.controller.js src/routes/attendance.routes.js
git commit -m "feat(attendance): owner-only geofence CRUD and selfie switch"
```

---

## Task 5: Self-punch endpoint (backend)

**Files:**
- Create: `magicscissors-be/src/utils/selfieStorage.js`, `src/middleware/uploadSelfie.js`, `src/services/selfPunch.service.js`
- Modify: `src/validators/attendance.validator.js`, `src/controllers/attendance.controller.js`, `src/routes/attendance.routes.js`
- Test: `src/services/selfPunch.service.test.js`

**Interfaces:**
- Consumes: `evaluateGeofences` (Task 1), `attendanceService.ingestPunch/getTodayRoster` (Task 3), `settingsService.getSetting`, `prisma.attendanceGeofence`.
- Produces:
  - `selfPunchService.checkTransition(status, punchType): null | {code,message}`
  - `selfPunchService.getConfig(user): { require_selfie, max_accuracy_m, geofences: [{id,name,latitude,longitude,radius_m}], today: { current_status, check_in, check_out } | null }`
  - `selfPunchService.punch(user, { punchType, latitude, longitude, accuracy }, selfieFile?): AttendancePunch`
  - Routes (roles `employee, manager, cashier`): `GET /attendance/self/config`, `POST /attendance/self/punch` (multipart: `punch_type, latitude, longitude, accuracy, selfie?`).
  - Error codes: `LOW_ACCURACY` 422, `GEOFENCE_NOT_CONFIGURED` 409, `OUTSIDE_GEOFENCE` 403, `SELFIE_REQUIRED` 422, `INVALID_TRANSITION` 409, `PUNCH_ORPHAN` 409, `NO_BRANCH` 400.
  - `saveSelfie(buffer, mimetype): Promise<string>` returns `/uploads/selfies/YYYY/MM/<uuid>.<ext>`.

- [ ] **Step 1: Write the failing test** — `src/services/selfPunch.service.test.js`

```js
jest.mock('../config/database', () => ({
  attendanceGeofence: { findMany: jest.fn() },
  employeeDetail: { findUnique: jest.fn() },
}));
jest.mock('./settings.service', () => ({ getSetting: jest.fn() }));
jest.mock('./attendance.service', () => ({ ingestPunch: jest.fn(), getTodayRoster: jest.fn() }));
jest.mock('../utils/selfieStorage', () => ({ saveSelfie: jest.fn().mockResolvedValue('/uploads/selfies/x.jpg') }));

const prisma = require('../config/database');
const settings = require('./settings.service');
const attendance = require('./attendance.service');
const { saveSelfie } = require('../utils/selfieStorage');
const { punch, checkTransition, getConfig } = require('./selfPunch.service');

const user = { id: 'u1', branchId: 'b1', role: 'employee' };
const fence = { id: 'g1', name: 'Main', latitude: 19.884765, longitude: 73.978462, radiusM: 100, isActive: true };
const inside = { punchType: 'in', latitude: 19.884765, longitude: 73.978462, accuracy: 10 };
const selfie = { buffer: Buffer.from('x'), mimetype: 'image/jpeg' };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.attendanceGeofence.findMany.mockResolvedValue([fence]);
  settings.getSetting.mockResolvedValue({ value: false });
  attendance.getTodayRoster.mockResolvedValue({ employees: [{ id: 'u1', current_status: 'not_arrived' }] });
  prisma.employeeDetail.findUnique.mockResolvedValue({ id: 'u1', employeeCode: 'E1', biometricId: null, isActive: true });
  attendance.ingestPunch.mockResolvedValue({ id: 'p1', isOrphan: false });
});

const rejects = (promise, code) => expect(promise).rejects.toMatchObject({ code });

describe('checkTransition', () => {
  test.each([
    ['not_arrived', 'in', null],
    ['checked_out', 'in', null],
    ['on_floor', 'in', 'INVALID_TRANSITION'],
    ['on_break', 'in', 'INVALID_TRANSITION'],
    ['on_leave', 'in', 'INVALID_TRANSITION'],
    ['on_floor', 'out', null],
    ['on_break', 'out', 'INVALID_TRANSITION'],
    ['not_arrived', 'out', 'INVALID_TRANSITION'],
    ['checked_out', 'out', 'INVALID_TRANSITION'],
  ])('%s + %s', (status, type, code) => {
    const r = checkTransition(status, type);
    if (code === null) expect(r).toBeNull();
    else expect(r.code).toBe(code);
  });
});

describe('punch', () => {
  test('happy path calls ingestPunch with server time, ids and geo', async () => {
    await punch(user, inside);
    const arg = attendance.ingestPunch.mock.calls[0][0];
    expect(arg).toMatchObject({
      employee_id: 'u1', branch_id: 'b1', machine_no: 'PWA', punch_type: 'in', source: 'app', marked_by: 'u1',
      geo: expect.objectContaining({ withinGeofence: true, distanceM: 0 }),
    });
    expect(typeof arg.punch_time).toBe('string');
  });

  test('no geofences configured → rejected', async () => {
    prisma.attendanceGeofence.findMany.mockResolvedValue([]);
    await rejects(punch(user, inside), 'GEOFENCE_NOT_CONFIGURED');
    expect(attendance.ingestPunch).not.toHaveBeenCalled();
  });

  test('outside every geofence → rejected with distance in message', async () => {
    await expect(punch(user, { ...inside, latitude: 19.894765 })).rejects.toMatchObject({ code: 'OUTSIDE_GEOFENCE' });
    expect(attendance.ingestPunch).not.toHaveBeenCalled();
  });

  test('inactive-only geofences count as not configured', async () => {
    prisma.attendanceGeofence.findMany.mockResolvedValue([]); // service queries isActive:true
    await rejects(punch(user, inside), 'GEOFENCE_NOT_CONFIGURED');
    expect(prisma.attendanceGeofence.findMany).toHaveBeenCalledWith({ where: { branchId: 'b1', isActive: true } });
  });

  test.each([[NaN], [undefined], [51], [-1]])('bad accuracy %p → LOW_ACCURACY', async (accuracy) => {
    await rejects(punch(user, { ...inside, accuracy }), 'LOW_ACCURACY');
  });

  test.each([[NaN, 73.9], [91, 73.9], [19.8, 181]])('bad coords %p,%p → rejected', async (latitude, longitude) => {
    await expect(punch(user, { ...inside, latitude, longitude })).rejects.toBeDefined();
    expect(attendance.ingestPunch).not.toHaveBeenCalled();
  });

  test('selfie required but missing → SELFIE_REQUIRED', async () => {
    settings.getSetting.mockResolvedValue({ value: true });
    await rejects(punch(user, inside), 'SELFIE_REQUIRED');
    expect(attendance.ingestPunch).not.toHaveBeenCalled();
  });

  test('selfie required and present → saved and stored on the punch', async () => {
    settings.getSetting.mockResolvedValue({ value: true });
    await punch(user, inside, selfie);
    expect(saveSelfie).toHaveBeenCalledWith(selfie.buffer, 'image/jpeg');
    expect(attendance.ingestPunch.mock.calls[0][0].geo.selfieUrl).toBe('/uploads/selfies/x.jpg');
  });

  test('selfie switch off → no selfie needed', async () => {
    await punch(user, inside);
    expect(saveSelfie).not.toHaveBeenCalled();
  });

  test('check out when not checked in → INVALID_TRANSITION', async () => {
    await rejects(punch(user, { ...inside, punchType: 'out' }), 'INVALID_TRANSITION');
  });

  test('user without a branch → NO_BRANCH', async () => {
    await rejects(punch({ ...user, branchId: null }, inside), 'NO_BRANCH');
  });

  test('orphaned punch is surfaced as an error', async () => {
    attendance.ingestPunch.mockResolvedValue({ id: 'p1', isOrphan: true, orphanReason: 'wrong_branch' });
    await rejects(punch(user, inside), 'PUNCH_ORPHAN');
  });
});

describe('getConfig', () => {
  test('returns active geofences, selfie flag and own status', async () => {
    attendance.getTodayRoster.mockResolvedValue({
      employees: [{ id: 'u1', current_status: 'on_floor', check_in: 'T1', check_out: null }],
    });
    const cfg = await getConfig(user);
    expect(cfg.max_accuracy_m).toBe(50);
    expect(cfg.require_selfie).toBe(false);
    expect(cfg.geofences).toEqual([{ id: 'g1', name: 'Main', latitude: 19.884765, longitude: 73.978462, radius_m: 100 }]);
    expect(cfg.today).toEqual({ current_status: 'on_floor', check_in: 'T1', check_out: null });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/services/selfPunch.service.test.js --coverage=false`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/utils/selfieStorage.js`**

```js
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const uploadRoot = () => process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

/** Writes the buffer under <uploads>/selfies/YYYY/MM/<uuid>.<ext>; returns the public path. */
async function saveSelfie(buffer, mimetype) {
  const ext = EXT[mimetype];
  if (!ext) throw new Error(`Unsupported selfie type: ${mimetype}`);
  const now = new Date();
  const rel = path.posix.join(
    'selfies',
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    `${crypto.randomUUID()}.${ext}`
  );
  const abs = path.join(uploadRoot(), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  return `/uploads/${rel}`;
}

module.exports = { saveSelfie, EXT };
```

- [ ] **Step 4: Implement `src/middleware/uploadSelfie.js`**

```js
const multer = require('multer');
const AppError = require('../utils/AppError');
const { EXT } = require('../utils/selfieStorage');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (EXT[file.mimetype]) return cb(null, true);
    cb(new AppError('Selfie must be a JPEG, PNG or WebP image', 400, 'INVALID_SELFIE'));
  },
}).single('selfie');

module.exports = (req, res, next) =>
  upload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Selfie is larger than 3 MB' : 'Invalid selfie upload';
      return next(new AppError(msg, 400, 'INVALID_SELFIE'));
    }
    next(err);
  });
```

- [ ] **Step 5: Implement `src/services/selfPunch.service.js`**

```js
const prisma = require('../config/database');
const AppError = require('../utils/AppError');
const settingsService = require('./settings.service');
const attendanceService = require('./attendance.service');
const { evaluateGeofences, isValidPoint } = require('../utils/geofence');
const { saveSelfie } = require('../utils/selfieStorage');

const MAX_ACCURACY_M = 50;

function checkTransition(status, punchType) {
  const bad = (message) => ({ code: 'INVALID_TRANSITION', message });
  if (punchType === 'in') {
    if (status === 'not_arrived' || status === 'checked_out') return null;
    if (status === 'on_leave') return bad('You are marked on leave today');
    return bad('You are already checked in');
  }
  if (status === 'on_floor') return null;
  if (status === 'on_break') return bad('End your break before checking out');
  return bad('You are not checked in');
}

function requireBranch(user) {
  if (!user.branchId) throw new AppError('No branch is assigned to your account', 400, 'NO_BRANCH');
  return user.branchId;
}

async function requireSelfieSetting() {
  const s = await settingsService.getSetting('attendance_require_selfie');
  return s?.value === true;
}

async function myStatus(user, branchId) {
  const roster = await attendanceService.getTodayRoster(branchId);
  return roster.employees.find((e) => e.id === user.id) || null;
}

async function getConfig(user) {
  const branchId = requireBranch(user);
  const [geofences, requireSelfie, me] = await Promise.all([
    prisma.attendanceGeofence.findMany({ where: { branchId, isActive: true }, orderBy: { name: 'asc' } }),
    requireSelfieSetting(),
    myStatus(user, branchId),
  ]);
  return {
    require_selfie: requireSelfie,
    max_accuracy_m: MAX_ACCURACY_M,
    geofences: geofences.map((g) => ({
      id: g.id, name: g.name, latitude: g.latitude, longitude: g.longitude, radius_m: g.radiusM,
    })),
    today: me ? { current_status: me.current_status, check_in: me.check_in, check_out: me.check_out } : null,
  };
}

async function punch(user, input, selfieFile) {
  const branchId = requireBranch(user);
  const { punchType, latitude, longitude, accuracy } = input;

  if (!['in', 'out'].includes(punchType)) {
    throw new AppError('punch_type must be "in" or "out"', 400, 'VALIDATION_ERROR');
  }
  if (!isValidPoint({ latitude, longitude })) {
    throw new AppError('Invalid location', 400, 'VALIDATION_ERROR');
  }
  if (!(Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= MAX_ACCURACY_M)) {
    throw new AppError(
      'GPS signal is too weak to verify your location. Move to an open area and try again.',
      422,
      'LOW_ACCURACY'
    );
  }

  const geofences = await prisma.attendanceGeofence.findMany({ where: { branchId, isActive: true } });
  if (geofences.length === 0) {
    throw new AppError('Attendance location is not set up for your branch yet', 409, 'GEOFENCE_NOT_CONFIGURED');
  }
  const { within, nearest } = evaluateGeofences({ latitude, longitude }, geofences);
  if (!within) {
    throw new AppError(
      `You are ${nearest.distanceM} m from ${nearest.name} (allowed ${nearest.radiusM} m)`,
      403,
      'OUTSIDE_GEOFENCE'
    );
  }

  if ((await requireSelfieSetting()) && !selfieFile) {
    throw new AppError('A selfie is required to check in or out', 422, 'SELFIE_REQUIRED');
  }

  const me = await myStatus(user, branchId);
  const blocked = checkTransition(me?.current_status || 'not_arrived', punchType);
  if (blocked) throw new AppError(blocked.message, 409, blocked.code);

  const detail = await prisma.employeeDetail.findUnique({
    where: { id: user.id },
    select: { id: true, employeeCode: true, biometricId: true, isActive: true },
  });
  if (!detail || !detail.isActive) throw new AppError('Employee profile not found', 404, 'NOT_FOUND');

  const selfieUrl = selfieFile ? await saveSelfie(selfieFile.buffer, selfieFile.mimetype) : null;

  const saved = await attendanceService.ingestPunch({
    employee_code: detail.employeeCode || detail.biometricId || detail.id,
    employee_id: detail.id,
    branch_id: branchId,
    punch_time: new Date().toISOString(),
    machine_no: 'PWA',
    punch_type: punchType,
    source: 'app',
    marked_by: user.id,
    geo: { latitude, longitude, accuracyM: accuracy, distanceM: nearest.distanceM, selfieUrl, withinGeofence: true },
  });
  if (saved.isOrphan) {
    throw new AppError(`Punch could not be recorded (${saved.orphanReason})`, 409, 'PUNCH_ORPHAN');
  }
  return saved;
}

module.exports = { checkTransition, getConfig, punch, MAX_ACCURACY_M };
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx jest src/services/selfPunch.service.test.js --coverage=false`
Expected: PASS (all cases).

- [ ] **Step 7: Validator, controller, routes.** Append to `attendance.validator.js` (and export `selfPunchSchema`):

```js
const selfPunchSchema = z.object({
  body: z.object({
    punch_type: z.enum(['in', 'out']),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    accuracy: z.coerce.number().min(0).max(100000),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
```

Append to `attendance.controller.js`:

```js
const selfPunchService = require('../services/selfPunch.service');

exports.getSelfConfig = catchAsync(async (req, res) => {
  sendResponse(res, 200, await selfPunchService.getConfig(req.user));
});

exports.selfPunch = catchAsync(async (req, res) => {
  const punch = await selfPunchService.punch(
    req.user,
    {
      punchType: req.body.punch_type,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      accuracy: req.body.accuracy,
    },
    req.file
  );
  sendResponse(res, 201, { id: punch.id, punch_type: punch.punchType, punch_time: punch.punchTime });
});
```

In `attendance.routes.js` add `const uploadSelfie = require('../middleware/uploadSelfie');`, import `selfPunchSchema`, and add:

```js
const SELF_ROLES = ['employee', 'manager', 'cashier'];
router.get('/self/config', authenticate, authorize(...SELF_ROLES), attendanceController.getSelfConfig);
router.post('/self/punch', authenticate, authorize(...SELF_ROLES), uploadSelfie, validate(selfPunchSchema), attendanceController.selfPunch);
```

(`uploadSelfie` must run before `validate` so multipart fields are in `req.body`.)

- [ ] **Step 8: End-to-end smoke** with the dev server and a seeded employee (`employee1 / Password123!`): create a geofence at a test point as owner, then `curl -F punch_type=in -F latitude=... -F longitude=... -F accuracy=10 .../attendance/self/punch` with the employee's bearer token. Expect 201 inside, 403 `OUTSIDE_GEOFENCE` ~1 km away. Confirm the row in `GET /attendance/today` shows `on_floor`. Report results.

- [ ] **Step 9: Commit**

```bash
git add src/utils/selfieStorage.js src/middleware/uploadSelfie.js src/services/selfPunch.service.js src/services/selfPunch.service.test.js src/validators/attendance.validator.js src/controllers/attendance.controller.js src/routes/attendance.routes.js
git commit -m "feat(attendance): geofenced self check-in/out endpoint with optional selfie"
```

---

## Task 6: Roster returns punch source, distance and selfie (backend)

**Files:**
- Modify: `magicscissors-be/src/services/attendance.service.js` (`getTodayRoster`, ~lines 414–460)

**Interfaces:**
- Produces: each roster employee gets `check_in_meta` and `check_out_meta`, each `null` or `{ source: 'machine'|'manual'|'app', distance_m: number|null, selfie_url: string|null }`.

- [ ] **Step 1: Write the failing test** — append to `attendance.service.test.js`

```js
const { punchMeta } = require('./attendance.service');

describe('punchMeta', () => {
  test('null for no punch', () => expect(punchMeta(null)).toBeNull());
  test('maps fields', () => {
    expect(punchMeta({ source: 'app', distanceM: 12.4, selfieUrl: '/uploads/selfies/a.jpg' }))
      .toEqual({ source: 'app', distance_m: 12.4, selfie_url: '/uploads/selfies/a.jpg' });
  });
  test('missing geo fields become null', () => {
    expect(punchMeta({ source: 'machine' })).toEqual({ source: 'machine', distance_m: null, selfie_url: null });
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx jest src/services/attendance.service.test.js --coverage=false -t punchMeta` → FAIL.

- [ ] **Step 3: Implement.** Add above `getTodayRoster`:

```js
function punchMeta(p) {
  if (!p) return null;
  return { source: p.source, distance_m: p.distanceM ?? null, selfie_url: p.selfieUrl ?? null };
}
```

Change the roster `include` to:

```js
    include: {
      firstPunch: { select: { source: true, distanceM: true, selfieUrl: true } },
      lastPunch: { select: { id: true, punchType: true, punchTime: true, source: true, distanceM: true, selfieUrl: true } },
    },
```

and in the returned object add:

```js
          check_in_meta: punchMeta(a?.firstPunch),
          check_out_meta: a?.checkOut && a?.lastPunch?.punchType === 'out' ? punchMeta(a.lastPunch) : null,
```

Add `punchMeta,` to `module.exports`.

- [ ] **Step 4: Run all backend tests** — `npm test -- --coverage=false` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(attendance): expose punch source, distance and selfie on roster"`

---

## Task 7: Frontend services and owner Geofence settings tab

**Files:**
- Create: `src/services/geofence.service.js`, `src/components/settings/GeofencePanel.jsx`
- Modify: `src/services/attendance.service.js`, `src/services/api.js` (export `baseURL`), `src/pages/SettingsPage.jsx`

**Interfaces:**
- Consumes: backend routes from Task 4.
- Produces: `geofenceService.{list(branchId), create(data), update(id,data), remove(id), updateSettings(data)}`; `attendanceService.getSelfConfig()` and `attendanceService.selfPunch(formData)`; named export `baseURL` from `api.js`; `<GeofencePanel />` (owner only).

- [ ] **Step 1: Services.** `src/services/geofence.service.js`:

```js
import api from './api'

export const geofenceService = {
  list: (branchId) => api.get('/attendance/geofences', { params: { branch_id: branchId } }),
  create: (data) => api.post('/attendance/geofences', data),
  update: (id, data) => api.put(`/attendance/geofences/${id}`, data),
  remove: (id) => api.delete(`/attendance/geofences/${id}`),
  updateSettings: (data) => api.put('/attendance/geofence-settings', data),
}
```

Add to `attendanceService` in `attendance.service.js`:

```js
  getSelfConfig: () => api.get('/attendance/self/config'),
  selfPunch: (formData) =>
    api.post('/attendance/self/punch', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
```

In `api.js` change the last export line to `export { baseURL, clearAuthStorage, getStoredToken, refreshAccessToken, redirectToLogin }`.

- [ ] **Step 2: Build `GeofencePanel.jsx`.** Follow `AttendanceApiKeysPanel.jsx` for imports/styling (Card, Button, Input, Label, Table, Badge, `useQuery`/`useMutation`, `toast`). Required behavior:
  - Branch picker (native `<select>` fed by `branchService.getBranches()`); defaults to the first branch.
  - Top card: a checkbox "Require Live Photo & GPS Capture" with the description from the reference ("When enabled, employees must take a live photo/selfie to check in or out. Their location coordinates and timestamp will be captured and watermarked on the photo."), an ON/OFF label, bound to `data.require_selfie`; toggling calls `geofenceService.updateSettings({ require_selfie })` then invalidates `['geofences']`.
  - Table columns: Location name, Latitude, Longitude, Radius (`{n} m`), Status (`Badge`: Active/Inactive), Actions (edit pencil, delete trash with `window.confirm`).
  - "Add location" button opens a `Dialog` (from `@/components/ui/dialog`) with fields name, latitude, longitude, radius (default 100), active checkbox, and a **"Use my current location"** button that calls `navigator.geolocation.getCurrentPosition` and fills lat/lng (6 decimals). Client-side validation mirrors the backend ranges; show `err.response?.data?.error?.message` in a toast on failure.
  - Show a short note: "Staff can punch only within the radius of an active location."
  - Query key `['geofences', branchId]`; invalidate on every mutation.

- [ ] **Step 3: Wire into `SettingsPage.jsx`.** Import `GeofencePanel` and `MapPin` (from `lucide-react`). Define `const isStrictOwner = user?.role === 'owner'` next to `isOwner` (line ~246; do not change `isOwner`). Add the trigger after the `attendance-api` trigger and widen the grid class if needed (`lg:grid-cols-9` → `lg:grid-cols-10`):

```jsx
          {isStrictOwner && (
            <TabsTrigger value="geofence" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Geofence</span>
            </TabsTrigger>
          )}
```

and the content after the `attendance-api` content:

```jsx
        {isStrictOwner && (
          <TabsContent value="geofence">
            <GeofencePanel />
          </TabsContent>
        )}
```

- [ ] **Step 4: Verify.** Run `npm run lint` (must pass with 0 warnings) and `npm run build`. Then, with backend + `npm run dev` running, log in as `owner / Password123!`: add a location with "Use my current location", edit it, toggle it inactive, toggle the selfie switch, delete it; confirm the Geofence tab is absent for `manager1`. Report what you saw (screenshots via the browser pane if available).

- [ ] **Step 5: Commit** (frontend repo root; never `git add magicscissors-be`)

```bash
git add src/services src/components/settings/GeofencePanel.jsx src/pages/SettingsPage.jsx
git commit -m "feat(settings): owner-only geofence management tab"
```

---

## Task 8: PWA shell

**Files:**
- Modify: `package.json`, `vite.config.js`, `index.html`, `vercel.json`, `src/main.jsx`
- Create: `public/icon.svg`, generated `public/pwa-*.png`, `src/components/PwaUpdatePrompt.jsx`

**Interfaces:**
- Produces: installable PWA (manifest + service worker), `<PwaUpdatePrompt />` mounted once, `window` `beforeinstallprompt` is handled in Task 9.

- [ ] **Step 1: Install**

Run: `npm install -D vite-plugin-pwa @vite-pwa/assets-generator`

- [ ] **Step 2: Icon source.** Create `public/icon.svg` as a simple 512×512 placeholder (solid brand-colour rounded square with a white scissors glyph). Tell the user it is a placeholder and ask for the real logo to replace it. Add a script `"generate-pwa-icons": "pwa-assets-generator --preset minimal-2023 public/icon.svg"` to `package.json`, then run `npm run generate-pwa-icons`. Expected files in `public/`: `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`.

- [ ] **Step 3: `vite.config.js`** — add the plugin (keep the existing `@` alias):

```js
import { VitePWA } from 'vite-plugin-pwa'

// inside plugins: [react(), ...]
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Magic Scissors Salon ERP',
        short_name: 'Salon ERP',
        description: 'Salon ERP — billing, staff and attendance',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#7c3aed',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          { urlPattern: ({ url }) => url.pathname.startsWith('/api/'), handler: 'NetworkOnly' },
        ],
      },
    }),
```

Read `src/styles/globals.css` for the primary colour and set `theme_color` to match it instead of `#7c3aed` if they differ.

- [ ] **Step 4: `index.html`** — inside `<head>`, change the viewport to `width=device-width, initial-scale=1.0, viewport-fit=cover` and add:

```html
    <meta name="theme-color" content="#7c3aed" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Salon ERP" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
```

- [ ] **Step 5: `vercel.json`** — add headers so the service worker is never cached by the CDN:

```json
{
  "headers": [
    { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
    { "source": "/manifest.webmanifest", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
  ],
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 6: Update prompt.** `src/components/PwaUpdatePrompt.jsx`:

```jsx
import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { toast } from 'sonner'

export default function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!needRefresh) return
    toast('A new version is available', {
      duration: Infinity,
      action: { label: 'Update', onClick: () => updateServiceWorker(true) },
    })
  }, [needRefresh, updateServiceWorker])

  return null
}
```

Mount it in `src/main.jsx` next to `<Toaster />`: `<PwaUpdatePrompt />`.

- [ ] **Step 7: Verify.** Run `npm run lint`, `npm run build`, then `npm run preview` and open it in the browser pane. Check: `/manifest.webmanifest` loads; DevTools → Application shows the service worker registered and the app installable (use `javascript_tool`: `navigator.serviceWorker.getRegistrations()` returns one registration). Confirm API calls still hit the network (no cached API responses) and that logging in still works. Dev mode does not register the SW; only the preview/build does — say so in the report.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html vercel.json src/main.jsx src/components/PwaUpdatePrompt.jsx public
git commit -m "feat(pwa): installable app shell with update prompt"
```

---

## Task 9: Staff self check-in page (`/my-attendance`)

**Files:**
- Create: `src/lib/geofence.js`, `scripts/check-geofence.mjs`, `src/lib/selfie.js`, `src/hooks/useGeolocation.js`, `src/components/attendance/SelfieCapture.jsx`, `src/pages/MyAttendancePage.jsx`
- Modify: `src/App.jsx`, `src/components/layout/Sidebar.jsx`

**Interfaces:**
- Consumes: `attendanceService.getSelfConfig()`, `attendanceService.selfPunch(formData)`.
- Produces:
  - `distanceMeters(a, b)`, `nearestFence(position, geofences)`, `getPunchGate({ geo, config, busy }): { allowed: boolean, reason: string|null, nearest }` in `src/lib/geofence.js`.
  - `useGeolocation(): { status: 'pending'|'ready'|'denied'|'unavailable'|'unsupported', position: {latitude,longitude,accuracy}|null }`.
  - `captureWatermarkedPhoto(videoEl, { latitude, longitude, accuracy }): Promise<Blob>` (JPEG, max 640 px wide).
  - `<SelfieCapture open onCancel onCapture(blob) position />`.

- [ ] **Step 1: Write `src/lib/geofence.js`** (pure, no React):

```js
const R = 6371000
const rad = (d) => (d * Math.PI) / 180

export function distanceMeters(a, b) {
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function nearestFence(position, geofences) {
  let best = null
  for (const g of geofences) {
    const d = Math.round(distanceMeters(position, g))
    if (!best || d < best.distanceM) best = { ...g, distanceM: d, within: d <= g.radius_m }
  }
  return best
}

/** Decides whether the punch button is enabled, and why not. */
export function getPunchGate({ geo, config, busy }) {
  if (busy) return { allowed: false, reason: 'Submitting…', nearest: null }
  if (!config) return { allowed: false, reason: 'Loading…', nearest: null }
  if (geo.status === 'unsupported') return { allowed: false, reason: 'This device has no location support', nearest: null }
  if (geo.status === 'denied') return { allowed: false, reason: 'Location permission denied — allow it in browser settings', nearest: null }
  if (geo.status === 'unavailable') return { allowed: false, reason: 'Cannot get your location — turn on GPS', nearest: null }
  if (geo.status !== 'ready' || !geo.position) return { allowed: false, reason: 'Getting your location…', nearest: null }
  if (config.geofences.length === 0) return { allowed: false, reason: 'Attendance location is not set up for your branch yet', nearest: null }
  if (geo.position.accuracy > config.max_accuracy_m) {
    return { allowed: false, reason: `GPS accuracy is low (${Math.round(geo.position.accuracy)} m). Move to an open area.`, nearest: null }
  }
  const nearest = nearestFence(geo.position, config.geofences)
  if (!nearest.within) {
    return { allowed: false, reason: `You are ${nearest.distanceM} m from ${nearest.name} (allowed ${nearest.radius_m} m)`, nearest }
  }
  return { allowed: true, reason: null, nearest }
}
```

- [ ] **Step 2: Pure-logic check script** — `scripts/check-geofence.mjs`:

```js
import assert from 'node:assert/strict'
import { distanceMeters, getPunchGate } from '../src/lib/geofence.js'

const fence = { id: 'g', name: 'Main', latitude: 19.884765, longitude: 73.978462, radius_m: 100 }
const config = { geofences: [fence], max_accuracy_m: 50 }
const ready = (lat, lng, accuracy = 10) => ({ status: 'ready', position: { latitude: lat, longitude: lng, accuracy } })

assert.equal(Math.round(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }) / 1000), 111)
assert.equal(getPunchGate({ geo: ready(19.884765, 73.978462), config, busy: false }).allowed, true)
assert.equal(getPunchGate({ geo: ready(19.894765, 73.978462), config, busy: false }).allowed, false)
assert.match(getPunchGate({ geo: ready(19.894765, 73.978462), config, busy: false }).reason, /m from Main/)
assert.equal(getPunchGate({ geo: ready(19.884765, 73.978462, 80), config, busy: false }).allowed, false)
assert.equal(getPunchGate({ geo: { status: 'denied', position: null }, config, busy: false }).allowed, false)
assert.equal(getPunchGate({ geo: ready(19.884765, 73.978462), config: { ...config, geofences: [] }, busy: false }).allowed, false)
assert.equal(getPunchGate({ geo: ready(19.884765, 73.978462), config, busy: true }).allowed, false)
assert.equal(getPunchGate({ geo: ready(19.884765, 73.978462), config: null, busy: false }).allowed, false)
console.log('geofence checks passed')
```

Run: `node scripts/check-geofence.mjs` → expected `geofence checks passed`. (Write the script first and run it before `src/lib/geofence.js` exists to see it fail, then add the lib.)

- [ ] **Step 3: `src/hooks/useGeolocation.js`**

```js
import { useEffect, useState } from 'react'

export function useGeolocation() {
  const [state, setState] = useState({ status: 'pending', position: null })

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'unsupported', position: null })
      return undefined
    }
    const id = navigator.geolocation.watchPosition(
      (p) =>
        setState({
          status: 'ready',
          position: { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy },
        }),
      (e) => setState({ status: e.code === 1 ? 'denied' : 'unavailable', position: null }),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  return state
}
```

- [ ] **Step 4: `src/lib/selfie.js`** (watermark burned into the image):

```js
export function captureWatermarkedPhoto(video, { latitude, longitude, accuracy }) {
  const maxW = 640
  const scale = Math.min(1, maxW / (video.videoWidth || maxW))
  const w = Math.round((video.videoWidth || maxW) * scale)
  const h = Math.round((video.videoHeight || 480) * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0, w, h)

  const stamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })
  const lines = [
    stamp + ' IST',
    `${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${Math.round(accuracy)} m)`,
  ]
  ctx.font = '14px sans-serif'
  const barH = lines.length * 20 + 10
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, h - barH, w, barH)
  ctx.fillStyle = '#fff'
  lines.forEach((t, i) => ctx.fillText(t, 8, h - barH + 22 + i * 20))

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not capture photo'))), 'image/jpeg', 0.7)
  )
}
```

- [ ] **Step 5: `SelfieCapture.jsx`** — a `Dialog` that, when `open`, calls `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })`, shows a mirrored `<video autoPlay playsInline muted>`, a "Take photo" button (calls `captureWatermarkedPhoto`, stores the blob and shows a preview `<img>` from `URL.createObjectURL`), then "Retake" / "Use photo" (calls `onCapture(blob)`) and "Cancel" (`onCancel`). It must stop all tracks (`stream.getTracks().forEach(t => t.stop())`) on unmount/close and revoke object URLs. If `getUserMedia` fails, show "Camera permission is needed to take the selfie" with a Close button (the punch is not made).

- [ ] **Step 6: `MyAttendancePage.jsx`.** Behaviour:
  - `useQuery(['self-config'], attendanceService.getSelfConfig, { staleTime: 0, refetchInterval: 60000 })`; `config = data?.data`.
  - `geo = useGeolocation()`, `gate = getPunchGate({ geo, config, busy: mutation.isPending })`.
  - Status card from `config.today.current_status` (labels: not_arrived → "Not checked in", on_floor → "Checked in", on_break → "On break", checked_out → "Checked out", on_leave → "On leave") with check-in/out times shown via the same `formatTimeStored` approach used in `AttendancePage.jsx` (read it there and reuse/copy rather than guessing).
  - A single large primary button: label "Check in" when `current_status` is `not_arrived` or `checked_out`, "Check out" when `on_floor`; disabled when `!gate.allowed` or the status is `on_break`/`on_leave`; the disabled reason (`gate.reason`) is always shown under the button, plus current distance/accuracy when known.
  - On click: if `config.require_selfie` is true, open `<SelfieCapture>`; its `onCapture(blob)` submits. If false, submit immediately (no camera step).
  - Submit builds `FormData` with `punch_type` (`in`/`out`), `latitude`, `longitude`, `accuracy` from the **latest** `geo.position`, and `selfie` (blob, filename `selfie.jpg`) only when captured. On success: `toast.success`, invalidate `['self-config']`. On error: `toast.error(err.response?.data?.error?.message || 'Punch failed')`.
  - Install hint block: listen for `beforeinstallprompt` (store the event, show an "Install app" button calling `prompt()`); on iOS Safari (`/iphone|ipad/i.test(navigator.userAgent)` and not standalone) show "Tap Share → Add to Home Screen". Hide the block when `matchMedia('(display-mode: standalone)').matches`.

- [ ] **Step 7: Route + sidebar.** In `App.jsx` add `import MyAttendancePage from './pages/MyAttendancePage'` and `<Route path="my-attendance" element={<MyAttendancePage />} />` next to the `attendance` route. In `Sidebar.jsx` import `MapPin` and add after the `Attendance` item:

```js
    {
      title: 'My Attendance',
      href: '/my-attendance',
      icon: MapPin,
      roles: ['employee', 'manager', 'cashier'],
    },
```

- [ ] **Step 8: Verify.** `npm run lint`, `npm run build`, `node scripts/check-geofence.mjs`. Then in the browser pane as `employee1` (use the `javascript_tool` to override `navigator.geolocation.watchPosition` with a mocked position — one inside a test geofence created in Task 7, one 1 km away): confirm (a) button disabled with "You are N m from …" outside, (b) enabled inside, (c) with the selfie switch OFF clicking punches with no camera dialog, (d) with it ON the camera dialog appears first (camera access may be unavailable in the pane — then confirm the "Camera permission is needed" fallback), (e) after a successful check in the status card flips and the button becomes "Check out". Also confirm the page works at the `mobile` viewport preset. Report what you saw honestly, including anything you could not test (real GPS, real camera).

- [ ] **Step 9: Commit**

```bash
git add src/lib src/hooks src/components/attendance/SelfieCapture.jsx src/pages/MyAttendancePage.jsx src/App.jsx src/components/layout/Sidebar.jsx scripts/check-geofence.mjs
git commit -m "feat(attendance): staff self check-in page with geofence gating and optional selfie"
```

---

## Task 10: Manager review on the Attendance page + changelog

**Files:**
- Create: `src/components/attendance/PunchMeta.jsx`
- Modify: `src/pages/AttendancePage.jsx` (check-in cell ~line 648, check-out cell ~line 649), `src/data/versionHistory.js`

**Interfaces:**
- Consumes: roster fields `check_in_meta` / `check_out_meta` (Task 6) and `baseURL` (Task 7).
- Produces: `<PunchMeta meta={...} />` — renders nothing when `meta` is null or `meta.source` is `machine`/`manual` with no selfie; otherwise an "App" badge, `{distance_m} m` when present, and a 24 px selfie thumbnail that opens the full image in a new tab.

- [ ] **Step 1: `PunchMeta.jsx`**

```jsx
import { baseURL } from '@/services/api'
import { Badge } from '@/components/ui/badge'

export default function PunchMeta({ meta }) {
  if (!meta) return null
  const isApp = meta.source === 'app'
  if (!isApp && !meta.selfie_url) return null
  const src = meta.selfie_url ? `${baseURL}${meta.selfie_url}` : null
  return (
    <div className="mt-1 flex items-center gap-1.5 font-sans">
      {isApp && <Badge variant="secondary">App</Badge>}
      {meta.distance_m != null && <span className="text-muted-foreground">{Math.round(meta.distance_m)} m</span>}
      {src && (
        <a href={src} target="_blank" rel="noreferrer" title="View selfie">
          <img src={src} alt="Selfie" className="h-6 w-6 rounded object-cover border" loading="lazy" />
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Use it in `AttendancePage.jsx`.** Import `PunchMeta` and change the two time cells to:

```jsx
<TableCell className="font-mono text-xs">
  {formatTimeStored(emp.check_in)}
  <PunchMeta meta={emp.check_in_meta} />
</TableCell>
<TableCell className="font-mono text-xs">
  {formatTimeStored(emp.check_out)}
  <PunchMeta meta={emp.check_out_meta} />
</TableCell>
```

- [ ] **Step 3: Changelog.** Read the first entry of `src/data/versionHistory.js` to copy its shape, then add a `v2.11.0` entry (title "Mobile App & Geofenced Attendance", date "Oct 2026") above it, summarising: installable PWA, geofenced self check-in/out, optional selfie, owner geofence management. Set `CURRENT_VERSION = 'v2.11.0'`.

- [ ] **Step 4: Verify.** `npm run lint`, `npm run build`. In the browser pane as `manager1`, after an `employee1` app punch from Task 9, open `/attendance` and confirm the "App" badge, distance, and (if a selfie was sent) a working thumbnail appear on that row, while biometric/manual rows are visually unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/attendance/PunchMeta.jsx src/pages/AttendancePage.jsx src/data/versionHistory.js
git commit -m "feat(attendance): show app punch source, distance and selfie to managers"
```

---

## Task 11: Final verification and handover

**Files:** none (verification and notes).

- [ ] **Step 1:** Backend: `npm test -- --coverage=false` (all pass). Frontend: `npm run lint`, `npm run build`, `node scripts/check-geofence.mjs`.
- [ ] **Step 2:** Walk the full flow once end to end and report each result: owner adds a geofence → employee outside sees the disabled button and the reason → employee inside checks in → manager sees the App badge → employee checks out → working hours and late label on `/attendance` look right. Repeat with the selfie switch ON.
- [ ] **Step 3:** Confirm biometric ingestion is not broken: `node magicscissors-be/scripts/smoke-test-attendance.js` (read the script header first for required env), or `POST /attendance/punches` with a machine punch.
- [ ] **Step 4:** Write the handover note for the user: what shipped, what could not be tested (real device GPS/camera, iOS install, production HTTPS), the production steps (run `scripts/migrate.sh --backup`, mount the `uploads` volume, make sure `UPLOAD_DIR` is persistent, replace the placeholder icon with the real logo), and the known limits (GPS can be spoofed on rooted devices; selfies are served by unguessable URL, not by login).
- [ ] **Step 5:** Do not push or open a PR unless the user asks.
