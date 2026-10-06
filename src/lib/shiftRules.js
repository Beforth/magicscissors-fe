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
