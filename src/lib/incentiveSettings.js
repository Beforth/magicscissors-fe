// Pure helpers for the Incentives settings form (no React, no '@/' alias).
export const SHIFT_TYPES = ['percent', 'hourly']

export function defaultSettings() {
  return {
    pick_highest: false,
    monthly_tiers: [],
    before_shift: { type: 'percent', value: 0 },
    after_shift: { type: 'percent', value: 0 },
    incentive_staff_percent: 0,
    salary_overrides: [],
    custom_rules: [],
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

function checkSalaryOverrides(list) {
  if (list == null) return null
  if (!Array.isArray(list)) return 'Salary used for the check: invalid rows'
  if (list.length > 200) return 'Salary used for the check: at most 200 rows'
  const seen = new Set()
  for (const [i, o] of list.entries()) {
    if (!o || !o.employee_id) return `Salary used for the check row ${i + 1}: choose an employee`
    if (!isNum(o.salary) || Number(o.salary) < 0 || Number(o.salary) > 99999999) {
      return `Salary used for the check row ${i + 1}: salary must be between 0 and 99999999`
    }
    if (seen.has(o.employee_id)) return 'Salary used for the check: the same employee is listed twice'
    seen.add(o.employee_id)
  }
  return null
}

function checkCustomRules(list) {
  if (list == null) return null
  if (!Array.isArray(list)) return 'Custom rules: invalid rules'
  if (list.length > MAX_CUSTOM_RULES) return `Custom rules: at most ${MAX_CUSTOM_RULES} rules`
  const ids = new Set()
  for (const [i, r] of list.entries()) {
    const label = `Custom rule ${i + 1}`
    if (!r || !['per_service', 'target'].includes(r.kind)) return `${label}: unknown rule type`
    if (ids.has(r.id)) return 'Custom rules: two rules have the same id'
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
  return checkSalaryOverrides(s.salary_overrides) || checkCustomRules(s.custom_rules)
}

// Top 3 employees by earnings (only those above 0). Rows are report employees.
export function topPerformers(rows, count = 3) {
  return [...(rows || [])]
    .filter((e) => Number(e.earnings) > 0)
    .sort((a, b) => Number(b.earnings) - Number(a.earnings))
    .slice(0, count)
    .map((e, i) => ({ ...e, rank: i + 1 }))
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
      e.full_name, e.pay_type, e.salary_used !== undefined ? e.salary_used : e.base_salary, e.services_count ?? 0, e.earnings, e.monthly_incentive,
      e.before_shift_incentive, e.after_shift_incentive,
      ...customRules.map((r) => cell(custom.get(r.id))), e.paid_incentive ?? 0, e.applied_label,
    ].map((v) => q(cell(v))).join(','))
  }
  return `﻿${lines.join('\r\n')}`
}
