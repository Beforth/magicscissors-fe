// Pure helpers for the Incentives settings form (no React, no '@/' alias).
export const SHIFT_TYPES = ['percent', 'hourly']

export function defaultSettings() {
  return {
    pick_highest: false,
    monthly_tiers: [],
    before_shift: { type: 'percent', value: 0 },
    after_shift: { type: 'percent', value: 0 },
    incentive_staff_percent: 0,
  }
}

const isNum = (v) => v !== '' && v !== null && v !== undefined && typeof v !== 'boolean' && Number.isFinite(Number(v))

function checkShift(label, box) {
  if (!box || !SHIFT_TYPES.includes(box.type)) return `${label}: choose how to pay`
  if (!isNum(box.value)) return `${label}: enter a value`
  const v = Number(box.value)
  if (box.type === 'percent' && (v < 0 || v > 100)) return `${label}: percent must be between 0 and 100`
  if (box.type === 'hourly' && (v < 0 || v > 99999)) return `${label}: amount per hour must be between 0 and 99999`
  return null
}

// Returns an error message, or null when the settings are valid.
export function validateSettings(s) {
  const tiers = s?.monthly_tiers
  if (!Array.isArray(tiers)) return 'Monthly earnings: invalid rows'
  if (tiers.length > 20) return 'Monthly earnings: at most 20 rows'
  const seen = new Set()
  for (const [i, t] of tiers.entries()) {
    const n = i + 1
    if (!isNum(t.earned_amount) || Number(t.earned_amount) <= 0 || Number(t.earned_amount) > 99999999) {
      return `Monthly earnings row ${n}: earned amount must be more than 0 and at most 99999999`
    }
    if (!isNum(t.percent) || Number(t.percent) < 0 || Number(t.percent) > 100) {
      return `Monthly earnings row ${n}: percent must be between 0 and 100`
    }
    const key = Number(t.earned_amount)
    if (seen.has(key)) return 'Monthly earnings: two rows have the same earned amount'
    seen.add(key)
  }
  const before = checkShift('Before shift', s.before_shift)
  if (before) return before
  const after = checkShift('After shift', s.after_shift)
  if (after) return after
  if (!isNum(s.incentive_staff_percent) || Number(s.incentive_staff_percent) < 0 || Number(s.incentive_staff_percent) > 100) {
    return 'Incentive-based staff: percent must be between 0 and 100'
  }
  return null
}
