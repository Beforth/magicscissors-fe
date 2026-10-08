// Pure helpers for the shift roster grid (no React, so node can load them).

const pad = (n) => String(n).padStart(2, '0')
export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fromDateStr = (s) => new Date(`${s}T00:00:00`)

export function addDays(dateStr, n) {
  const d = fromDateStr(dateStr)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

/** Monday of the week containing dateStr. */
export function weekStart(dateStr) {
  const d = fromDateStr(dateStr)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return toDateStr(d)
}

/** Visible dates: 7 days from `anchor` (a Monday) or the whole month of `anchor`. */
export function buildRange(anchor, view) {
  if (view === 'month') {
    const d = fromDateStr(anchor)
    const total = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    return Array.from({ length: total }, (_, i) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(i + 1)}`)
  }
  return Array.from({ length: 7 }, (_, i) => addDays(anchor, i))
}

export const monthsOf = (dates) => [...new Set(dates.map((d) => d.slice(0, 7)))]

/** Normalised selection rectangle from two corner cells. */
export function rect(a, b) {
  return {
    r0: Math.min(a.r, b.r), r1: Math.max(a.r, b.r),
    c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c),
  }
}

export const inRect = (rc, r, c) => r >= rc.r0 && r <= rc.r1 && c >= rc.c0 && c <= rc.c1

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

/** Shift-id matrix (rows × cols) for a rectangle; null = empty cell. */
export function readMatrix(rc, rows, dates, lookup) {
  const out = []
  for (let r = rc.r0; r <= rc.r1; r++) {
    const row = []
    for (let c = rc.c0; c <= rc.c1; c++) row.push(lookup(rows[r], dates[c])?.shift_id ?? null)
    out.push(row)
  }
  return out
}

/** Cells (employeeId/date/shiftId) to write when pasting `matrix` with its top-left at `at`. Clipped to the grid. */
export function pasteCells(matrix, at, rows, dates) {
  const cells = []
  matrix.forEach((row, i) => row.forEach((shiftId, j) => {
    const r = at.r + i
    const c = at.c + j
    if (r < rows.length && c < dates.length) cells.push({ employeeId: rows[r], date: dates[c], shiftId })
  }))
  return cells
}
