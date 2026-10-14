import assert from 'node:assert/strict'
import { defaultSettings, validateSettings } from '../src/lib/incentiveSettings.js'

const full = () => ({
  pick_highest: true,
  monthly_tiers: [{ earned_amount: 50000, percent: 20 }, { earned_amount: 80000, percent: 25 }],
  before_shift: { type: 'percent', value: 10 },
  after_shift: { type: 'hourly', value: 120 },
  incentive_staff_percent: 30,
})

assert.deepEqual(defaultSettings(), {
  pick_highest: false, monthly_tiers: [],
  before_shift: { type: 'percent', value: 0 }, after_shift: { type: 'percent', value: 0 },
  incentive_staff_percent: 0,
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
console.log('incentive settings checks passed')
