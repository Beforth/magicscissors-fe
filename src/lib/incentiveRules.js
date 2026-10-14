// Pure helpers for incentive rules; mirrors magicscissors-be/src/validators/incentiveRule.validator.js.

export const PERIODS = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']]
export const PAY_TYPES = [
  ['monthly', 'Monthly staff'],
  ['daily', 'Daily staff'],
  ['both', 'Monthly + daily staff'],
  ['incentive', 'Incentive-based staff'],
  ['all', 'All staff'],
]
export const WINDOWS = [['all', 'Any time'], ['in_shift', 'During shift'], ['after_shift', 'After shift'], ['before_shift', 'Before shift']]
export const THRESHOLDS = [['none', 'No threshold'], ['fixed', 'Fixed amount'], ['salary_multiple', 'Multiple of salary']]
export const BASES = [['whole', 'Whole amount'], ['excess', 'Excess over threshold']]
export const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function emptyRule() {
  return {
    name: '',
    enabled: true,
    sort_order: 0,
    branch_id: null,
    pay_types: 'both',
    period: 'daily',
    service_window: 'all',
    service_filter: null,
    threshold_type: 'none',
    threshold_value: null,
    payout_basis: 'whole',
    rate_percent: 0,
    exclude_from_other_rules: false,
  }
}

const blank = (v) => v === null || v === undefined || v === ''

export function validateRule(rule) {
  const r = rule || {}
  if (!String(r.name ?? '').trim()) return 'Name is required'
  if (String(r.name).trim().length > 100) return 'Name must be at most 100 characters'
  const rate = Number(r.rate_percent)
  if (blank(r.rate_percent) || !Number.isFinite(rate) || rate < 0 || rate > 100) return 'Rate must be between 0 and 100'
  if (!PAY_TYPES.some(([v]) => v === r.pay_types)) return 'Applies to must be one of the listed staff groups'
  if (r.threshold_type === 'salary_multiple' && r.period !== 'monthly') {
    return 'A salary-multiple threshold is only allowed for monthly rules'
  }
  if (r.threshold_type === 'salary_multiple' && r.pay_types !== 'monthly') {
    return 'A salary-multiple threshold is only allowed for monthly-paid staff (Applies to: Monthly staff)'
  }
  if (r.threshold_type === 'fixed' && blank(r.threshold_value)) return 'Threshold amount is required for a fixed threshold'
  if (r.threshold_type !== 'none' && !blank(r.threshold_value)) {
    const t = Number(r.threshold_value)
    if (!Number.isFinite(t) || t < 0 || t > 99999999) return 'Threshold must be a positive number'
  }
  const so = Number(r.sort_order ?? 0)
  if (!Number.isInteger(so) || so < 0 || so > 9999) return 'Order must be a whole number from 0 to 9999'
  return null
}

/** Form state -> API body (numbers coerced, empty filter -> null). */
export function toPayload(rule) {
  const ids = (a) => (Array.isArray(a) ? a : [])
  const f = rule.service_filter || {}
  const service_ids = ids(f.service_ids)
  const category_ids = ids(f.category_ids)
  return {
    name: String(rule.name).trim(),
    enabled: !!rule.enabled,
    sort_order: Number(rule.sort_order || 0),
    branch_id: rule.branch_id || null,
    pay_types: rule.pay_types,
    period: rule.period,
    service_window: rule.service_window,
    service_filter: service_ids.length || category_ids.length ? { service_ids, category_ids } : null,
    threshold_type: rule.threshold_type,
    threshold_value: rule.threshold_type === 'none' || blank(rule.threshold_value) ? null : Number(rule.threshold_value),
    payout_basis: rule.payout_basis,
    rate_percent: Number(rule.rate_percent),
    exclude_from_other_rules: !!rule.exclude_from_other_rules,
  }
}
