import assert from 'node:assert/strict'
import { emptyRule, validateRule } from '../src/lib/incentiveRules.js'

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

// rejections
assert.match(validateRule(rule({ period: 'weekly', threshold_type: 'salary_multiple', threshold_value: 1 })), /monthly/i)
assert.match(validateRule(rule({ rate_percent: 101 })), /rate/i)
assert.match(validateRule(rule({ rate_percent: -1 })), /rate/i)
assert.match(validateRule(rule({ threshold_type: 'fixed', threshold_value: null })), /threshold/i)
assert.match(validateRule(rule({ threshold_type: 'fixed', threshold_value: '' })), /threshold/i)
assert.match(validateRule(rule({ name: '  ' })), /name/i)
assert.equal(validateRule(rule({ threshold_type: 'fixed', threshold_value: 5000 })), null)

console.log('incentive rule checks passed')
