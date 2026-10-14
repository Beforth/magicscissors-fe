import assert from 'node:assert/strict'
import { PAY_TYPES, emptyRule, validateRule, toPayload } from '../src/lib/incentiveRules.js'

const rule = (o) => ({ ...emptyRule(), name: 'R', ...o })

// defaults are valid once named
assert.equal(validateRule(rule({})), null)

// the two seed rules
assert.equal(validateRule(rule({
  name: 'Monthly 5%', period: 'monthly', pay_types: 'monthly', service_window: 'in_shift',
  threshold_type: 'salary_multiple', threshold_value: 1, payout_basis: 'whole', rate_percent: 5,
})), null)
assert.equal(validateRule(rule({
  name: 'After-shift 20%', period: 'daily', pay_types: 'both', service_window: 'after_shift',
  threshold_type: 'none', threshold_value: null, rate_percent: 20, exclude_from_other_rules: true,
})), null)

// incentive-based staff and all staff
assert.equal(validateRule(rule({ pay_types: 'incentive', period: 'monthly', threshold_type: 'none', rate_percent: 40 })), null)
assert.match(validateRule(rule({ pay_types: 'all', period: 'monthly', threshold_type: 'none', rate_percent: 10 })), /applies/i)
assert.equal(validateRule(rule({ pay_types: 'incentive', threshold_type: 'fixed', threshold_value: 1000 })), null)
for (const pay_types of ['incentive'])
  assert.match(validateRule(rule({ period: 'monthly', pay_types, threshold_type: 'salary_multiple', threshold_value: 1 })), /monthly-paid/i)
assert.match(validateRule(rule({ pay_types: 'bogus' })), /applies/i)
assert.match(validateRule(rule({ pay_types: '' })), /applies/i)
assert.deepEqual(PAY_TYPES.map(([v]) => v), ['monthly', 'daily', 'both', 'incentive'])

// rejections
for (const pay_types of ['both', 'daily'])
  assert.match(validateRule(rule({ period: 'monthly', pay_types, threshold_type: 'salary_multiple', threshold_value: 1 })), /monthly-paid/i)
assert.match(validateRule(rule({ period: 'weekly', pay_types: 'monthly', threshold_type: 'salary_multiple', threshold_value: 1 })), /monthly/i)
assert.match(validateRule(rule({ period: 'weekly', threshold_type: 'salary_multiple', threshold_value: 1 })), /monthly/i)
assert.match(validateRule(rule({ rate_percent: 101 })), /rate/i)
assert.match(validateRule(rule({ rate_percent: -1 })), /rate/i)
assert.match(validateRule(rule({ threshold_type: 'fixed', threshold_value: null })), /threshold/i)
assert.match(validateRule(rule({ threshold_type: 'fixed', threshold_value: '' })), /threshold/i)
assert.match(validateRule(rule({ name: '  ' })), /name/i)
assert.equal(validateRule(rule({ threshold_type: 'fixed', threshold_value: 5000 })), null)

// per-service rate rules
const L1 = { kind: 'service', id: 'a1', rate_type: 'percent', value: 40 }
const L2 = { kind: 'category', id: 'b2', rate_type: 'fixed', value: 150 }
const sr = (o) => rule({ rule_type: 'service_rates', pay_types: 'incentive', service_rates: [L1, L2], ...o })
assert.equal(emptyRule().rule_type, 'revenue')
assert.deepEqual(emptyRule().service_rates, [])
assert.equal(emptyRule().fixed_share_mode, 'split')
assert.equal(validateRule(sr({})), null)
assert.match(validateRule(sr({ pay_types: 'monthly' })), /incentive/i)
assert.match(validateRule(sr({ service_rates: [] })), /line/i)
assert.match(validateRule(sr({ service_rates: [{ ...L1, value: 101 }] })), /100/)
assert.match(validateRule(sr({ service_rates: [L1, { ...L1 }] })), /duplicate/i)
assert.match(validateRule(sr({ service_rates: [{ ...L2, value: -5 }] })), /fixed|amount/i)
assert.match(validateRule(sr({ service_rates: [{ ...L2, value: 'abc' }] })), /number|value/i)
assert.match(validateRule(sr({ service_rates: [{ ...L1, id: '' }] })), /service or category/i)
assert.match(validateRule(sr({ fixed_share_mode: 'bogus' })), /shared/i)
const p = toPayload(sr({ name: ' X ', period: 'weekly', rate_percent: 9, threshold_type: 'fixed', threshold_value: 5, payout_basis: 'excess', exclude_from_other_rules: true, service_filter: { service_ids: ['q'], category_ids: [] }, service_rates: [{ ...L1, value: '40' }, L2] }))
assert.equal(p.rule_type, 'service_rates')
assert.equal(p.period, 'daily'); assert.equal(p.threshold_type, 'none'); assert.equal(p.threshold_value, null)
assert.equal(p.payout_basis, 'whole'); assert.equal(p.rate_percent, 0); assert.equal(p.service_filter, null)
assert.equal(p.exclude_from_other_rules, false); assert.equal(p.fixed_share_mode, 'split'); assert.equal(p.name, 'X')
assert.deepEqual(p.service_rates, [L1 && { ...L1, value: 40 }, L2])
const rp = toPayload(rule({ rate_percent: 5 }))
assert.equal(rp.rule_type, 'revenue'); assert.equal(rp.service_rates, null)

console.log('incentive rule checks passed')
