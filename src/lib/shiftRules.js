const toNum = (v) => (v == null || String(v).trim() === '' ? null : Number(v))

/** Validates the shift-rule fields of the Shift form and builds the API payload. */
export function buildRulesPayload({ grace, tiers, halfDayLateAfterMin, halfDayMinHours }) {
  const rows = []
  let prev = Number(grace) || 0

  for (const t of tiers || []) {
    const a = toNum(t.after_min)
    const h = toNum(t.deduct_hours)
    const m = toNum(t.deduct_amount)
    if (a == null && h == null && m == null) continue
    if (a == null || (h == null && m == null)) return { ok: false, error: 'Fill both the minutes and a fine (hours or ₹) for each late tier' }
    if (!Number.isInteger(a) || a < 1 || a > 1440) return { ok: false, error: 'Late tier minutes must be a whole number (1-1440)' }
    if (!(a > prev)) return { ok: false, error: 'Late tiers must be in increasing order and above the grace period' }
    if (h != null && (!(h > 0) || h > 24)) return { ok: false, error: 'Late tier must deduct more than 0 and at most 24 hours' }
    if (m != null && (!(m > 0) || m > 1000000)) return { ok: false, error: 'Late fine amount must be more than ₹0 and at most ₹10,00,000' }
    const row = { after_min: a }
    if (h != null) row.deduct_hours = h
    if (m != null) row.deduct_amount = m
    rows.push(row)
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
