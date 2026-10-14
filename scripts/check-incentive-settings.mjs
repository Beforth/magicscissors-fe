import assert from 'node:assert/strict'
import { defaultSettings, validateSettings, newCustomRule, topPerformers, reportCsv, WHO_OPTIONS } from '../src/lib/incentiveSettings.js'

const full = () => ({
  pick_highest: true,
  monthly_tiers: [{ earned_amount: 50000, percent: 20 }, { earned_amount: 80000, percent: 25 }],
  before_shift: { type: 'percent', value: 10 },
  after_shift: { type: 'hourly', value: 120 },
  incentive_staff_percent: 30,
  salary_overrides: [],
  custom_rules: [],
})

assert.deepEqual(defaultSettings(), {
  pick_highest: false, monthly_tiers: [],
  before_shift: { type: 'percent', value: 0 }, after_shift: { type: 'percent', value: 0 },
  incentive_staff_percent: 0, salary_overrides: [], custom_rules: [],
})
assert.notEqual(defaultSettings(), defaultSettings())
assert.equal(validateSettings(defaultSettings()), null)
assert.equal(validateSettings(full()), null)

const err = (mut, re) => { const s = full(); mut(s); assert.match(validateSettings(s) || '', re) }
err((s) => { s.monthly_tiers[0].percent = 101 }, /percent/i)
err((s) => { s.monthly_tiers[0].percent = -1 }, /percent/i)
err((s) => { s.monthly_tiers[1].earned_amount = 50000 }, /same/i)
err((s) => { s.monthly_tiers[0].earned_amount = -5 }, /earned/i)
err((s) => { s.monthly_tiers[0].earned_amount = 0 }, /earned/i)
err((s) => { s.monthly_tiers[0].earned_amount = 100000000 }, /earned/i)
err((s) => { s.monthly_tiers = Array.from({ length: 21 }, (_, i) => ({ earned_amount: i + 1, percent: 1 })) }, /20/)
err((s) => { s.before_shift.type = 'fixed' }, /before shift/i)
err((s) => { s.after_shift.type = 'bogus' }, /after shift/i)
err((s) => { s.before_shift.value = 101 }, /before shift/i)
err((s) => { s.after_shift.value = 100000 }, /after shift/i)
err((s) => { s.after_shift.value = -1 }, /after shift/i)
err((s) => { s.incentive_staff_percent = 101 }, /incentive-based/i)
err((s) => { s.incentive_staff_percent = 'abc' }, /incentive-based/i)
// hourly allows values above 100, percent does not
const h = full(); h.before_shift = { type: 'hourly', value: 500 }
assert.equal(validateSettings(h), null)
// blank strings from inputs are not numbers
err((s) => { s.monthly_tiers[0].earned_amount = '' }, /earned/i)

// old saved settings without the new arrays still validate
const old = full(); delete old.salary_overrides; delete old.custom_rules
assert.equal(validateSettings(old), null)

// salary overrides
const E1 = '11111111-1111-4111-8111-111111111111', E2 = '22222222-2222-4222-8222-222222222222'
const so = (arr) => { const s = full(); s.salary_overrides = arr; return validateSettings(s) }
assert.equal(so([{ employee_id: E1, salary: 30000 }, { employee_id: E2, salary: 0 }]), null)
assert.match(so([{ employee_id: E1, salary: 1 }, { employee_id: E1, salary: 2 }]) || '', /same employee/i)
assert.match(so([{ employee_id: '', salary: 1 }]) || '', /employee/i)
assert.match(so([{ employee_id: E1, salary: '' }]) || '', /salary/i)
assert.match(so([{ employee_id: E1, salary: -1 }]) || '', /salary/i)
assert.match(so([{ employee_id: E1, salary: 100000000 }]) || '', /salary/i)
assert.match(so(Array.from({ length: 201 }, (_, i) => ({ employee_id: `e${i}`, salary: 1 }))) || '', /200/)

// custom rules
assert.deepEqual(WHO_OPTIONS.map((o) => o.value), ['normal', 'incentive', 'everyone'])
const ps = newCustomRule('per_service', 'id-1')
assert.deepEqual(ps, { id: 'id-1', kind: 'per_service', name: '', who: 'normal', service_ids: [], category_ids: [], pay_as: 'percent', value: 0 })
const tg = newCustomRule('target', 'id-2')
assert.deepEqual(tg, { id: 'id-2', kind: 'target', name: '', who: 'normal', earned_amount: '', percent: 0 })
const withRules = (...r) => { const s = full(); s.custom_rules = r; return validateSettings(s) }
const okPs = (o = {}) => ({ ...ps, name: 'Colour bonus', value: 5, ...o })
const okTg = (o = {}) => ({ ...tg, name: 'Big month', earned_amount: 100000, percent: 3, ...o })
assert.equal(withRules(okPs(), okTg()), null)
assert.match(withRules(okPs({ name: '' })) || '', /name/i)
assert.match(withRules(okPs({ name: 'x'.repeat(61) })) || '', /name/i)
assert.match(withRules(okPs({ who: 'all' })) || '', /who/i)
assert.match(withRules(okPs({ pay_as: 'hourly' })) || '', /pay/i)
assert.match(withRules(okPs({ pay_as: 'percent', value: 101 })) || '', /percent/i)
assert.match(withRules(okPs({ pay_as: 'fixed', value: 100000 })) || '', /99999/)
assert.equal(withRules(okPs({ pay_as: 'fixed', value: 500 })), null)
assert.match(withRules(okPs({ value: '' })) || '', /value/i)
assert.match(withRules(okPs({ value: -1 })) || '', /percent/i)
assert.match(withRules(okPs({ service_ids: Array.from({ length: 101 }, (_, i) => `s${i}`) })) || '', /100/)
assert.match(withRules(okTg({ earned_amount: 0 })) || '', /earned/i)
assert.match(withRules(okTg({ earned_amount: '' })) || '', /earned/i)
assert.match(withRules(okTg({ percent: 101 })) || '', /percent/i)
assert.match(withRules(okPs({ id: 'a' }), okTg({ id: 'a' })) || '', /same|duplicate/i)
assert.match(withRules(...Array.from({ length: 21 }, (_, i) => okPs({ id: `r${i}` }))) || '', /20/)
assert.match(withRules({ ...okPs(), kind: 'weird' }) || '', /rule/i)

// top performers: top 3 by earnings, only > 0
const rows = [
  { employee_id: 'a', name: 'A', earnings: 100 }, { employee_id: 'b', name: 'B', earnings: 500 },
  { employee_id: 'c', name: 'C', earnings: 0 }, { employee_id: 'd', name: 'D', earnings: 300 },
  { employee_id: 'e', name: 'E', earnings: 200 },
]
assert.deepEqual(topPerformers(rows).map((r) => [r.rank, r.employee_id]), [[1, 'b'], [2, 'd'], [3, 'e']])
assert.deepEqual(topPerformers([{ employee_id: 'z', name: 'Z', earnings: 0 }]), [])
assert.deepEqual(topPerformers(undefined), [])

// csv
const rep = [{
  full_name: 'Asha, "Ace"', pay_type: 'monthly', salary_used: 30000, services_count: 2, earnings: 1234.5,
  monthly_incentive: 10, before_shift_incentive: 20, after_shift_incentive: 0, paid_incentive: 20, applied: 'before_shift',
  applied_label: 'Before shift', custom_incentives: [{ id: 'c1', name: 'Colour bonus', amount: 5 }],
}, { full_name: 'Ben', pay_type: 'incentive', earnings: 0, paid_incentive: 0 }]
const csv = reportCsv(rep, [{ id: 'c1', name: 'Colour bonus' }])
assert.ok(csv.startsWith('﻿'))
const lines = csv.slice(1).split('\r\n')
assert.equal(lines[0], '"Employee","Pay type","Salary used","Services","Earnings","Monthly earnings","Before shift","After shift","Colour bonus","Paid","Applied"')
assert.equal(lines[1], '"Asha, ""Ace""","monthly","30000","2","1234.5","10","20","0","5","20","Before shift"')
assert.equal(lines[2], '"Ben","incentive","","0","0","","","","","0",""')
console.log('incentive settings checks passed')
