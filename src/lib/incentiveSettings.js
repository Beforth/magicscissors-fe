// Pure helpers for the Incentives settings form (no React, no '@/' alias).
export const MAX_MONTHLY_TIERS = 40
export const MAX_RULES_PER_KIND = 20
export const MAX_RULE_EMPLOYEES = 200

export function defaultSettings() {
  return { monthly_rules: [], before_shift_rules: [], after_shift_rules: [], custom_rules: [] }
}

const isNum = (v) => v !== '' && v !== null && v !== undefined && typeof v !== 'boolean' && Number.isFinite(Number(v))

export const SCOPED_KINDS = {
  monthly: { key: 'monthly_rules', title: 'Monthly earnings' },
  before_shift: { key: 'before_shift_rules', title: 'Before shift' },
  after_shift: { key: 'after_shift_rules', title: 'After shift' },
}

// "Monthly earnings", then "Monthly earnings 2", "Monthly earnings 3" ... (existingCount = rules of that kind already there)
export function defaultRuleName(kind, existingCount) {
  const title = SCOPED_KINDS[kind].title
  return existingCount > 0 ? `${title} ${existingCount + 1}` : title
}

// Before/After shift rules have no name box: the name is the title, numbered by position ("After shift 2").
// A saved custom name (not the default pattern) is kept as it is.
export function scopedRuleName(kind, name, index) {
  const title = SCOPED_KINDS[kind].title
  const saved = typeof name === 'string' ? name.trim() : ''
  const isDefault = saved === title || (saved.startsWith(`${title} `) && /^[0-9]+$/.test(saved.slice(title.length + 1)))
  if (saved && !isDefault) return saved
  return defaultRuleName(kind, index)
}

// A fresh card for the form (numbers as strings so inputs can be blank while typing)
export function newScopedRule(kind, id, name) {
  const base = { id, name, branch_id: null, employee_ids: [] }
  if (kind === 'monthly') return { ...base, pick_highest: false, tiers: [{ salary: '', earned_amount: '', percent: '' }] }
  return { ...base, percent: 0 }
}

export const WHO_OPTIONS = [
  { value: 'normal', label: 'Monthly & daily staff' },
  { value: 'incentive', label: 'Incentive-based staff' },
  { value: 'everyone', label: 'Everyone' },
]
export const MAX_CUSTOM_RULES = 20

export function newCustomRule(kind, id) {
  if (kind === 'target') return { id, kind: 'target', name: '', who: 'normal', earned_amount: '', percent: 0 }
  return { id, kind: 'per_service', name: '', who: 'normal', service_ids: [], category_ids: [], pay_as: 'percent', value: 0 }
}

function checkCustomRules(list, ids = new Set()) {
  if (list == null) return null
  if (!Array.isArray(list)) return 'Custom rules: invalid rules'
  if (list.length > MAX_CUSTOM_RULES) return `Custom rules: at most ${MAX_CUSTOM_RULES} rules`
  for (const [i, r] of list.entries()) {
    const label = `Custom rule ${i + 1}`
    if (!r || !['per_service', 'target'].includes(r.kind)) return `${label}: unknown rule type`
    if (ids.has(r.id)) return 'Two rules have the same id'
    ids.add(r.id)
    const name = typeof r.name === 'string' ? r.name.trim() : ''
    if (name.length < 1 || name.length > 60) return `${label}: name must be 1 to 60 characters`
    const tag = `${label} (${name})`
    if (!WHO_OPTIONS.some((o) => o.value === r.who)) return `${tag}: choose who it is for`
    if (r.kind === 'per_service') {
      for (const [key, what] of [['service_ids', 'services'], ['category_ids', 'categories']]) {
        if (!Array.isArray(r[key])) return `${tag}: invalid ${what}`
        if (r[key].length > 100) return `${tag}: pick at most 100 ${what}`
      }
      if (!['percent', 'fixed'].includes(r.pay_as)) return `${tag}: choose how to pay`
      if (!isNum(r.value)) return `${tag}: enter a value`
      const v = Number(r.value)
      if (r.pay_as === 'percent' && (v < 0 || v > 100)) return `${tag}: percent must be between 0 and 100`
      if (r.pay_as === 'fixed' && (v < 0 || v > 99999)) return `${tag}: amount must be between 0 and 99999`
    } else {
      if (!isNum(r.earned_amount) || Number(r.earned_amount) <= 0 || Number(r.earned_amount) > 99999999) {
        return `${tag}: earned amount must be more than 0 and at most 99999999`
      }
      if (!isNum(r.percent) || Number(r.percent) < 0 || Number(r.percent) > 100) {
        return `${tag}: percent must be between 0 and 100`
      }
    }
  }
  return null
}

const ALLOWED_KEYS = ['monthly_rules', 'before_shift_rules', 'after_shift_rules', 'custom_rules']

function checkTiers(label, tiers) {
  if (!Array.isArray(tiers) || tiers.length < 1) return `${label}: add at least one row`
  if (tiers.length > MAX_MONTHLY_TIERS) return `${label}: at most ${MAX_MONTHLY_TIERS} rows`
  const seen = new Set()
  for (const [i, t] of tiers.entries()) {
    const n = i + 1
    if (!t || typeof t !== 'object') return `${label} row ${n}: invalid row`
    if (!isNum(t.salary) || Number(t.salary) <= 0 || Number(t.salary) > 99999999) {
      return `${label} row ${n}: salary must be more than 0 and at most 99999999`
    }
    if (!isNum(t.earned_amount) || Number(t.earned_amount) <= 0 || Number(t.earned_amount) > 99999999) {
      return `${label} row ${n}: earned amount must be more than 0 and at most 99999999`
    }
    if (!isNum(t.percent) || Number(t.percent) < 0 || Number(t.percent) > 100) {
      return `${label} row ${n}: percent must be between 0 and 100`
    }
    const key = `${Number(t.salary)}|${Number(t.earned_amount)}`
    if (seen.has(key)) return `${label}: two rows have the same salary and earned amount`
    seen.add(key)
  }
  return null
}

// kind: 'monthly' | 'before_shift' | 'after_shift'; ids is shared across every list
function checkScopedRules(kind, list, ids) {
  const { title } = SCOPED_KINDS[kind]
  if (list == null) return null
  if (!Array.isArray(list)) return `${title}: invalid rules`
  if (list.length > MAX_RULES_PER_KIND) return `${title}: at most ${MAX_RULES_PER_KIND} rules`
  const allowed = ['id', 'name', 'branch_id', 'employee_ids', ...(kind === 'monthly' ? ['pick_highest', 'tiers'] : ['percent'])]
  for (const [i, r] of list.entries()) {
    const label = `${title} ${i + 1}`
    if (!r || typeof r !== 'object' || Array.isArray(r)) return `${label}: invalid rule`
    const extra = Object.keys(r).find((k) => !allowed.includes(k))
    if (extra) return `${label}: unknown field "${extra}"`
    if (typeof r.id !== 'string' || !r.id) return `${label}: missing id`
    if (ids.has(r.id)) return 'Two rules have the same id'
    ids.add(r.id)
    const name = typeof r.name === 'string' ? r.name.trim() : ''
    if (name.length < 1 || name.length > 60) return `${label}: name must be 1 to 60 characters`
    if (r.branch_id !== null && typeof r.branch_id !== 'string') return `${label}: choose a branch`
    if (!Array.isArray(r.employee_ids)) return `${label}: invalid staff list`
    if (r.employee_ids.length > MAX_RULE_EMPLOYEES) return `${label}: pick at most ${MAX_RULE_EMPLOYEES} employees`
    if (kind === 'monthly') {
      if (typeof r.pick_highest !== 'boolean') return `${label}: invalid "pay only the highest row" choice`
      const bad = checkTiers(label, r.tiers)
      if (bad) return bad
    } else if (!isNum(r.percent)) {
      return `${label}: enter a percent`
    } else if (Number(r.percent) < 0 || Number(r.percent) > 100) {
      return `${label}: percent must be between 0 and 100`
    }
  }
  return null
}

// Returns an error message, or null when the settings are valid.
export function validateSettings(s) {
  const unknown = Object.keys(s || {}).find((k) => !ALLOWED_KEYS.includes(k))
  if (unknown) return `Unknown setting "${unknown}"`
  const ids = new Set()
  for (const kind of Object.keys(SCOPED_KINDS)) {
    const bad = checkScopedRules(kind, s?.[SCOPED_KINDS[kind].key], ids)
    if (bad) return bad
  }
  return checkCustomRules(s?.custom_rules, ids)
}

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
const cell = (v) => (v == null ? '' : v)

// Results table as an Excel-safe CSV string (UTF-8 BOM, every field quoted).
// customRules: [{ id, name }] in saved order, one column each.
export function reportCsv(rows, customRules = []) {
  const head = [
    'Employee', 'Pay type', 'Salary used', 'Services', 'Earnings', 'Monthly earnings', 'Before shift', 'After shift',
    ...customRules.map((r) => r.name), 'Paid', 'Applied',
  ]
  const lines = [head.map(q).join(',')]
  for (const e of rows || []) {
    const custom = new Map((e.custom_incentives || []).map((c) => [c.id, c.amount]))
    lines.push([
      e.full_name, e.pay_type, e.salary_used ?? e.base_salary, e.services_count ?? 0, e.earnings, e.monthly_incentive,
      e.before_shift_incentive, e.after_shift_incentive,
      ...customRules.map((r) => cell(custom.get(r.id))), e.paid_incentive ?? 0, e.applied_label,
    ].map((v) => q(cell(v))).join(','))
  }
  return `﻿${lines.join('\r\n')}`
}
