// Pure helpers for showing a day's shift / late / penalty (no React, so node can load it).

/** 1.5 -> "1h 30m", 2 -> "2h", 0.25 -> "15m", 0 -> "0h". */
export function formatHours(hours) {
  const total = Math.round(Number(hours || 0) * 60)
  if (!(total > 0)) return '0h'
  const h = Math.floor(total / 60)
  const m = total % 60
  return [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ')
}

/** 100 -> "₹100", 99.5 -> "₹99.50". */
export function formatRupees(n) {
  const v = Number(n || 0)
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`
}

/** "Deducted" phrase for hours and/or money, e.g. "1h + ₹100". */
export function formatDeduction(hours, amount) {
  const parts = []
  if (Number(hours) > 0) parts.push(formatHours(hours))
  if (Number(amount) > 0) parts.push(formatRupees(amount))
  return parts.join(' + ')
}

/** "75" -> "1h 15m", 20 -> "20 min". */
export function formatLate(minutes) {
  const n = Math.round(Number(minutes || 0))
  if (n < 60) return `${n} min`
  return formatHours(n / 60)
}

/**
 * One plain-language verdict for a day's record.
 * tone: 'ok' | 'warn' | 'bad' | 'muted'
 */
export function describeDay(record) {
  if (!record) return null
  const shift = record.shift
  const penaltyHours = Number(record.late_penalty_hours || 0)
  const penaltyAmount = Number(record.late_penalty_amount || 0)
  const penalty = penaltyHours > 0 || penaltyAmount > 0 ? 1 : 0
  const deducted = formatDeduction(penaltyHours, penaltyAmount)
  const late = record.late_minutes
  if (!shift) {
    return { tone: 'muted', title: 'No shift assigned for this day', detail: 'Late penalty is only calculated for days with an assigned shift.' }
  }
  if (!record.check_in) {
    return { tone: 'muted', title: `${shift.name} · ${shift.start_time}–${shift.end_time}`, detail: 'Not checked in yet.' }
  }
  if (record.status === 'half_day') {
    return { tone: 'bad', title: 'Half day', detail: penalty > 0 ? `Late ${formatLate(late)} · ${deducted} deducted` : `Late ${formatLate(late)}` }
  }
  if (penalty > 0) {
    return { tone: 'warn', title: `Late by ${formatLate(late)}`, detail: `${deducted} deducted from pay (grace ${shift.grace_period} min)` }
  }
  if (late > 0) {
    return { tone: 'ok', title: `${formatLate(late)} late — within grace`, detail: `No deduction (grace ${shift.grace_period} min)` }
  }
  return { tone: 'ok', title: 'On time', detail: 'No deduction' }
}

export function summarizeMonth(records) {
  const rows = records || []
  return {
    penaltyHours: rows.reduce((s, r) => s + Number(r.late_penalty_hours || 0), 0),
    penaltyAmount: rows.reduce((s, r) => s + Number(r.late_penalty_amount || 0), 0),
    lateDays: rows.filter((r) => Number(r.late_penalty_hours || 0) > 0 || Number(r.late_penalty_amount || 0) > 0).length,
    halfDays: rows.filter((r) => r.status === 'half_day').length,
    noShiftDays: rows.filter((r) => r.check_in && !r.shift).length,
  }
}
