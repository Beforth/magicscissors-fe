// Pure helpers for incentive rules; mirrors magicscissors-be/src/validators/incentiveRule.validator.js.

export const PERIODS = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']]
export const PAY_TYPES = [
  ['monthly', 'Monthly staff'],
  ['daily', 'Daily staff'],
  ['both', 'Monthly + daily staff'],
  ['incentive', 'Incentive-based staff'],
]
export const RULE_TYPES = [['revenue', 'Percentage of revenue (threshold rules)'], ['service_rates', 'Per-service rates (incentive-based staff)']]
export const SHARE_MODES = [['split', 'Split equally between staff'], ['full', 'Full amount to each person']]
export const RATE_TYPES = [['percent', '%'], ['fixed', '₹']]
export const WINDOWS = [['all', 'Any time'], ['in_shift', 'During shift'], ['after_shift', 'After shift'], ['before_shift', 'Before shift']]
export const THRESHOLDS = [['none', 'No threshold'], ['fixed', 'Fixed amount'], ['salary_multiple', 'Multiple of salary']]
export const BASES = [['whole', 'Whole amount'], ['excess', 'Excess over threshold']]
export const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function emptyRule() {
  return {
    name: '',
    rule_type: 'revenue',
    service_rates: [],
    fixed_share_mode: 'split',
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
  const so = Number(r.sort_order ?? 0)
  if (!Number.isInteger(so) || so < 0 || so > 9999) return 'Order must be a whole number from 0 to 9999'
  if (r.rule_type === 'service_rates') return validateServiceRates(r)
  if (r.rule_type !== undefined && r.rule_type !== 'revenue') return 'Rule type must be one of the listed types'
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
  return null
}

function validateServiceRates(r) {
  if (r.pay_types !== 'incentive') return 'Per-service rate rules apply only to Incentive-based staff'
  if (!SHARE_MODES.some(([v]) => v === (r.fixed_share_mode ?? 'split'))) return 'Shared services must be split or full'
  const lines = Array.isArray(r.service_rates) ? r.service_rates : []
  if (lines.length === 0) return 'Add at least one service or category line'
  if (lines.length > 200) return 'At most 200 lines are allowed'
  const seen = new Set()
  for (const [i, l] of lines.entries()) {
    const n = i + 1
    if (!l || (l.kind !== 'service' && l.kind !== 'category') || blank(l.id)) return `Line ${n}: pick a service or category`
    const key = `${l.kind}:${l.id}`
    if (seen.has(key)) return `Line ${n}: duplicate service or category`
    seen.add(key)
    if (l.rate_type !== 'percent' && l.rate_type !== 'fixed') return `Line ${n}: type must be % or ₹`
    const v = Number(l.value)
    if (blank(l.value) || !Number.isFinite(v)) return `Line ${n}: value must be a number`
    if (l.rate_type === 'percent' && (v < 0 || v > 100)) return `Line ${n}: percent must be between 0 and 100`
    if (l.rate_type === 'fixed' && (v < 0 || v > 99999999)) return `Line ${n}: fixed amount must be between 0 and 99999999`
  }
  return null
}

/** Form state -> API body (numbers coerced, empty filter -> null). */
export function toPayload(rule) {
  if (rule.rule_type === 'service_rates') {
    return {
      name: String(rule.name).trim(),
      rule_type: 'service_rates',
      enabled: !!rule.enabled,
      sort_order: Number(rule.sort_order || 0),
      branch_id: rule.branch_id || null,
      pay_types: 'incentive',
      period: 'daily',
      service_window: rule.service_window,
      service_filter: null,
      threshold_type: 'none',
      threshold_value: null,
      payout_basis: 'whole',
      rate_percent: 0,
      exclude_from_other_rules: false,
      fixed_share_mode: rule.fixed_share_mode || 'split',
      service_rates: (rule.service_rates || []).map((l) => ({ kind: l.kind, id: l.id, rate_type: l.rate_type, value: Number(l.value) })),
    }
  }
  const ids = (a) => (Array.isArray(a) ? a : [])
  const f = rule.service_filter || {}
  const service_ids = ids(f.service_ids)
  const category_ids = ids(f.category_ids)
  return {
    name: String(rule.name).trim(),
    rule_type: 'revenue',
    service_rates: null,
    fixed_share_mode: 'split',
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
