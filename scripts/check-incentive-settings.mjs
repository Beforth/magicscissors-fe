import assert from 'node:assert/strict'
import {
  defaultSettings, validateSettings, newCustomRule, newScopedRule, defaultRuleName, topPerformers, reportCsv, WHO_OPTIONS,
  MAX_RULES_PER_KIND, shiftRuleName,
} from '../src/lib/incentiveSettings.js'

const B1 = '11111111-1111-4111-8111-111111111111'
const E1 = '22222222-2222-4222-8222-222222222222'
const E2 = '33333333-3333-4333-8333-333333333333'
const full = () => ({
  monthly_rules: [{
    id: 'm1', name: 'Monthly earnings', branch_id: null, employee_ids: [], pick_highest: true,
    tiers: [{ salary: 15000, earned_amount: 50000, percent: 20 }, { salary: 15000, earned_amount: 80000, percent: 25 }],
  }],
  before_shift_rules: [{ id: 'b1', name: 'Before shift', branch_id: null, employee_ids: [], percent: 10 }],
  after_shift_rules: [
    { id: 'a1', name: 'After shift', branch_id: B1, employee_ids: [E1], percent: 12 },
    { id: 'a2', name: 'After shift 2', branch_id: null, employee_ids: [E1, E2], percent: 5 },
  ],
  custom_rules: [],
})

assert.deepEqual(defaultSettings(), { monthly_rules: [], before_shift_rules: [], after_shift_rules: [], custom_rules: [] })
assert.notEqual(defaultSettings(), defaultSettings())
assert.equal(validateSettings(defaultSettings()), null)
assert.equal(validateSettings(full()), null)

const err = (mut, re) => { const s = full(); mut(s); assert.match(validateSettings(s) || '', re) }
const tier0 = (s) => s.monthly_rules[0].tiers[0]
err((s) => { tier0(s).percent = 101 }, /percent/i)
err((s) => { tier0(s).percent = -1 }, /percent/i)
err((s) => { s.monthly_rules[0].tiers[1].earned_amount = 50000 }, /same/i)
err((s) => { delete tier0(s).salary }, /salary/i)
err((s) => { tier0(s).salary = '' }, /salary/i)
err((s) => { tier0(s).salary = 0 }, /salary/i)
err((s) => { tier0(s).salary = 100000000 }, /salary/i)
err((s) => { tier0(s).earned_amount = -5 }, /earned/i)
err((s) => { tier0(s).earned_amount = 0 }, /earned/i)
err((s) => { tier0(s).earned_amount = 100000000 }, /earned/i)
err((s) => { tier0(s).earned_amount = '' }, /earned/i)
err((s) => { s.monthly_rules[0].tiers = [] }, /row|tier/i)
err((s) => { s.monthly_rules[0].tiers = Array.from({ length: 41 }, (_, i) => ({ salary: 1, earned_amount: i + 1, percent: 1 })) }, /40/)
err((s) => { s.before_shift_rules[0].percent = 101 }, /before shift/i)
err((s) => { s.after_shift_rules[0].percent = 101 }, /after shift/i)
err((s) => { s.after_shift_rules[1].percent = -1 }, /after shift 2/i)
err((s) => { s.before_shift_rules[0].percent = '' }, /before shift/i)
// names
err((s) => { s.monthly_rules[0].name = '' }, /name/i)
err((s) => { s.monthly_rules[0].name = '   ' }, /name/i)
err((s) => { s.after_shift_rules[0].name = 'x'.repeat(61) }, /name/i)
// ids unique across ALL lists
err((s) => { s.after_shift_rules[1].id = 'a1' }, /same id/i)
err((s) => { s.before_shift_rules[0].id = 'm1' }, /same id/i)
err((s) => { s.custom_rules = [{ ...newCustomRule('target', 'a1'), name: 'T', earned_amount: 5, percent: 1 }] }, /same id/i)
// scope
err((s) => { s.after_shift_rules[0].branch_id = 5 }, /branch/i)
err((s) => { s.after_shift_rules[0].employee_ids = 'x' }, /staff|employee/i)
err((s) => { s.after_shift_rules[0].employee_ids = Array.from({ length: 201 }, (_, i) => `e${i}`) }, /200/)
err((s) => { s.after_shift_rules[0].pick_highest = true }, /unknown|not allowed|pick_highest/i)
err((s) => { s.monthly_rules[0].extra = 1 }, /unknown|not allowed|extra/i)
// legacy / unknown top-level keys
err((s) => { s.pick_highest = true }, /unknown|not allowed|pick_highest/i)
err((s) => { s.monthly_tiers = [] }, /unknown|not allowed|monthly_tiers/i)
err((s) => { s.before_shift = { value: 1 } }, /unknown|not allowed|before_shift/i)
err((s) => { s.after_shift = { value: 1 } }, /unknown|not allowed|after_shift/i)
err((s) => { s.incentive_staff_percent = 30 }, /unknown|not allowed|incentive_staff_percent/i)
// at most 20 of a kind (exactly 20 is fine)
const many = (n, make) => Array.from({ length: n }, (_, i) => make(i))
assert.equal(MAX_RULES_PER_KIND, 20)
err((s) => { s.after_shift_rules = many(21, (i) => ({ id: `x${i}`, name: 'N', branch_id: null, employee_ids: [], percent: 1 })) }, /20/)
err((s) => { s.before_shift_rules = many(21, (i) => ({ id: `x${i}`, name: 'N', branch_id: null, employee_ids: [], percent: 1 })) }, /20/)
err((s) => {
  s.monthly_rules = many(21, (i) => ({ id: `x${i}`, name: 'N', branch_id: null, employee_ids: [], pick_highest: false, tiers: [{ salary: 1, earned_amount: 1, percent: 1 }] }))
}, /20/)
const ok20 = full()
ok20.after_shift_rules = many(20, (i) => ({ id: `x${i}`, name: 'N', branch_id: null, employee_ids: [], percent: 1 }))
assert.equal(validateSettings(ok20), null)
// same earned amount for a different salary is fine; exactly 40 rows is fine
const ok40 = full(); ok40.monthly_rules[0].tiers = many(40, (i) => ({ salary: 1000 + i, earned_amount: 5, percent: 1 }))
assert.equal(validateSettings(ok40), null)
const diffSalary = full(); diffSalary.monthly_rules[0].tiers[1] = { salary: 20000, earned_amount: 50000, percent: 5 }
assert.equal(validateSettings(diffSalary), null)
// same tiers in two different rules are fine
const twoMonthly = full()
twoMonthly.monthly_rules.push({ ...twoMonthly.monthly_rules[0], id: 'm2', name: 'Monthly earnings 2', employee_ids: [E1] })
assert.equal(validateSettings(twoMonthly), null)

// helpers
assert.deepEqual(newScopedRule('monthly', 'i1', 'Monthly earnings'), {
  id: 'i1', name: 'Monthly earnings', branch_id: null, employee_ids: [], pick_highest: false,
  tiers: [{ salary: '', earned_amount: '', percent: '' }],
})
assert.deepEqual(newScopedRule('after_shift', 'i2', 'After shift'), { id: 'i2', name: 'After shift', branch_id: null, employee_ids: [], percent: 0 })
assert.deepEqual(newScopedRule('before_shift', 'i3', 'Before shift'), { id: 'i3', name: 'Before shift', branch_id: null, employee_ids: [], percent: 0 })
assert.equal(defaultRuleName('monthly', 0), 'Monthly earnings')
assert.equal(defaultRuleName('before_shift', 0), 'Before shift')
assert.equal(defaultRuleName('after_shift', 1), 'After shift 2')
assert.equal(defaultRuleName('after_shift', 2), 'After shift 3')
assert.equal(shiftRuleName('after_shift', 'After shift 2', 0), 'After shift')
assert.equal(shiftRuleName('after_shift', 'After shift', 2), 'After shift 3')
assert.equal(shiftRuleName('before_shift', '', 1), 'Before shift 2')
assert.equal(shiftRuleName('after_shift', 'Weekend bonus', 1), 'Weekend bonus')
assert.equal(shiftRuleName('after_shift', 'Before shift', 0), 'Before shift')

// settings without custom_rules still validate
const old = full(); delete old.custom_rules
assert.equal(validateSettings(old), null)
const oldMin = { monthly_rules: [], before_shift_rules: [], after_shift_rules: [] }
assert.equal(validateSettings(oldMin), null)

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
