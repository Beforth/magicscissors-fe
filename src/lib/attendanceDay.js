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
 *
 * Three situations decide the wording:
 *   - an assigned shift ('shift' rule: its own grace and fine tiers)
 *   - no shift but a profile shift time ('legacy' rule: 15 min grace, then at least 2 h of pay deducted)
 *   - neither: no late penalty at all
 */
export function describeDay(record) {
  if (!record) return null
  const shift = record.shift
  const rule = record.penalty_rule || (shift ? 'shift' : null)
  const penaltyHours = Number(record.late_penalty_hours || 0)
  const penaltyAmount = Number(record.late_penalty_amount || 0)
  const penalty = penaltyHours > 0 || penaltyAmount > 0 ? 1 : 0
  const deducted = formatDeduction(penaltyHours, penaltyAmount)
  const late = record.late_minutes
  const grace = rule === 'legacy' ? 15 : shift?.grace_period
  const where = rule === 'legacy' ? 'standard rule, no shift assigned' : `grace ${grace} min`

  const notes = []
  if (record.auto_checkout) notes.push('The check-out was added automatically; ask your manager if it is wrong.')
  if (record.edited) notes.push('A manager corrected the times on this day.')
  const note = notes.join(' ') || null

  if (record.status === 'absent' || record.day_status === 'absent') {
    return { tone: 'bad', title: 'Absent', detail: 'A shift was assigned but no check-in was recorded.', note }
  }
  if (!rule) {
    return { tone: 'muted', title: 'No shift assigned for this day', detail: 'No late penalty is calculated.', note }
  }
  if (!record.check_in) {
    return { tone: 'muted', title: shift ? `${shift.name} · ${shift.start_time}–${shift.end_time}` : 'Not checked in yet', detail: 'Not checked in yet.', note }
  }
  if (record.status === 'half_day') {
    return { tone: 'bad', title: 'Half day', detail: penalty > 0 ? `Late ${formatLate(late)} · ${deducted} deducted` : `Late ${formatLate(late)}`, note }
  }
  if (penalty > 0) {
    return { tone: 'warn', title: `Late by ${formatLate(late)}`, detail: `${deducted} deducted from pay (${where})`, note }
  }
  if (late > 0) {
    return { tone: 'ok', title: `${formatLate(late)} late — within grace`, detail: `No deduction (${where})`, note }
  }
  return { tone: 'ok', title: 'On time', detail: 'No deduction', note }
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
