# PWA + Geofenced Self Check-in/Check-out — Design

Date: 2026-10-05 · Repos: `magicscissors-fe` (this) and `magicscissors-be` (backend, `./magicscissors-be`)

## Goal
Staff install the app as a PWA and punch in/out from their own phone. A punch is allowed only inside a geofence set by the owner. A selfie is required only when a global switch is on.

## Decisions (agreed)
- No new role. Geofence and switch management is **owner only** (not developer).
- Outside every active geofence → the Check in/out button is **disabled** (and the server rejects the punch).
- Several named geofences (circles) per branch: name, latitude, longitude, radius (m), active flag.
- One **global** setting `attendance_require_selfie` (default off). On → selfie required; off → no selfie step at all.
- Manual/biometric punches and manager overrides are unchanged. Breaks stay manager-driven.

## Key constraint
All punches flow through `attendance.service.ingestPunch()` → `resolvePunch` → `recomputeAttendance` → rotation-queue hook. Self-punches reuse it, so shifts, late penalty, breaks, auto-close, incentives and employee-status keep working with no changes.

## Backend (`magicscissors-be`)
1. **Prisma**: new `AttendanceGeofence { id, branchId, name, latitude, longitude, radiusM, isActive, timestamps }`. Add to `AttendancePunch`: `latitude, longitude, accuracyM, distanceM, selfieUrl, withinGeofence`. Add `app` to enum `PunchSource`. Additive only; no existing column changes.
2. **Settings**: add `attendance_require_selfie` (boolean, default `false`) to `DEFAULT_SETTINGS`.
3. **Geofence API** `/attendance/geofences`: GET (any authenticated staff, scoped to their branch unless owner), POST/PUT/DELETE (**owner only**). Zod validation: lat −90..90, lng −180..180, radius 5..5000.
4. **`POST /attendance/self-punch`** (authenticated, roles employee/manager/cashier):
   - Employee and branch come from the JWT, never the body. Server clock only (client time ignored).
   - Body: `punch_type` (in|out), `lat`, `lng`, `accuracy`, optional `selfie` (multipart, multer; image/jpeg|png, size-capped).
   - Reject if: no active geofence for the branch (`GEOFENCE_NOT_CONFIGURED`), outside all (`OUTSIDE_GEOFENCE` with distance), accuracy worse than 50 m, or selfie missing while the setting is on.
   - Haversine distance in a small pure util (unit-tested).
   - On success call `ingestPunch({ source: 'app', machine_no: 'PWA', ... })` and store GPS/selfie fields.
5. **Roster**: `getTodayRoster` additionally returns `selfie_url`, `distance_m`, `punch_source` for managers.
6. **Selfie storage**: write under an uploads directory served read-only (auth-gated or unguessable names), path stored in DB. Needs deploy-config check (volume + nginx).

## Frontend (`magicscissors-fe`)
1. **PWA**: `vite-plugin-pwa`, manifest (name, icons 192/512/maskable, `standalone`, theme colour), app-shell precache, API routes network-only, update-available prompt, install button, iOS meta tags, `vercel.json` headers so `sw.js` is not cached. Icons must be supplied/generated.
2. **`/my-attendance`** (all staff roles, Sidebar entry): `watchPosition`; shows distance to nearest geofence and accuracy; button disabled with a reason when outside range, GPS denied/unavailable, or accuracy too poor. When the setting is on: front-camera capture via `getUserMedia`, watermark coordinates + timestamp on a canvas, upload with the punch. When off: no camera step. Shows today's status from the roster.
3. **Owner settings tab** (owner only, route + UI guard): geofence table matching the reference screenshot, add/edit dialog with "Use my current location", delete, and the global "Require Live Photo & GPS Capture" switch.
4. **`AttendancePage`**: show source `app` badge, selfie thumbnail (lightbox) and distance.
5. **Services**: `geofence.service.js`; `selfPunch` in `attendance.service.js` (FormData).

## Error handling
GPS denied, GPS off, low accuracy, camera denied (when selfie required, punch blocked with explanation), offline (punch is not queued; shows "needs connection"), duplicate/rapid taps (button locks while submitting; server idempotency via existing unique key).

## Security notes
Client checks are UX only; the server is the enforcement. GPS can be spoofed on rooted devices — the selfie and `distanceM` audit fields are the mitigation. Geolocation/camera require HTTPS.

## Testing
- Backend: unit tests for Haversine and geofence evaluation, validator tests, self-punch service tests (inside/outside/no-geofence/selfie required/accuracy), and a smoke script like `scripts/smoke-test-attendance.js`.
- Frontend: no test runner exists; verify manually in the browser pane (mock geolocation) plus `npm run lint` and `npm run build`.

## Rollout order
1. Backend schema + settings + geofence API + self-punch + tests. 2. Owner settings UI. 3. PWA shell. 4. `/my-attendance`. 5. `AttendancePage` additions.

## Open items to confirm before implementation
- How schema changes are applied in this project (no `prisma/migrations` dir found: `db push` vs migrate).
- Where uploaded selfies live in production (volume/nginx).
- Accuracy limit (default 50 m) and default radius (100 m).
