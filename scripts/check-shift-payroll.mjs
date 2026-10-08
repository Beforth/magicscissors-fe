import assert from 'node:assert/strict'
import { buildRulesPayload } from '../src/lib/shiftRules.js'
import { payrollTotals, reportCsvRows, formatMoney } from '../src/lib/payroll.js'

const ok = (r) => { assert.equal(r.ok, true, r.error); return r.value }
const bad = (r) => { assert.equal(r.ok, false); return r.error }

// valid tiers + half-day
assert.deepEqual(
  ok(buildRulesPayload({ grace: 10, tiers: [{ after_min: '15', deduct_hours: '0.5' }, { after_min: '30', deduct_hours: '1' }], halfDayLateAfterMin: '90', halfDayMinHours: '4' })),
  { late_tiers: [{ after_min: 15, deduct_hours: 0.5 }, { after_min: 30, deduct_hours: 1 }], half_day_late_after_min: 90, half_day_min_hours: 4 }
)
// blank rows ignored, blank half-day → null
assert.deepEqual(
  ok(buildRulesPayload({ grace: 5, tiers: [{ after_min: '', deduct_hours: '' }], halfDayLateAfterMin: '', halfDayMinHours: '' })),
  { late_tiers: [], half_day_late_after_min: null, half_day_min_hours: null }
)
// invalid cases
assert.match(bad(buildRulesPayload({ grace: 10, tiers: [{ after_min: '10', deduct_hours: '1' }], halfDayLateAfterMin: '', halfDayMinHours: '' })), /above the grace/i)
assert.match(bad(buildRulesPayload({ grace: 5, tiers: [{ after_min: '30', deduct_hours: '1' }, { after_min: '15', deduct_hours: '1' }], halfDayLateAfterMin: '', halfDayMinHours: '' })), /increasing/i)
assert.match(bad(buildRulesPayload({ grace: 5, tiers: [{ after_min: '20', deduct_hours: '0' }], halfDayLateAfterMin: '', halfDayMinHours: '' })), /deduct/i)
assert.match(bad(buildRulesPayload({ grace: 5, tiers: [{ after_min: '20', deduct_hours: '' }], halfDayLateAfterMin: '', halfDayMinHours: '' })), /both/i)
// ₹ amount tiers
assert.deepEqual(
  ok(buildRulesPayload({ grace: 5, tiers: [{ after_min: '15', deduct_hours: '', deduct_amount: '100' }, { after_min: '60', deduct_hours: '1', deduct_amount: '250' }], halfDayLateAfterMin: '', halfDayMinHours: '' })).late_tiers,
  [{ after_min: 15, deduct_amount: 100 }, { after_min: 60, deduct_hours: 1, deduct_amount: 250 }]
)
assert.match(bad(buildRulesPayload({ grace: 5, tiers: [{ after_min: '20', deduct_amount: '0' }], halfDayLateAfterMin: '', halfDayMinHours: '' })), /amount/i)
assert.match(bad(buildRulesPayload({ grace: 5, tiers: [], halfDayLateAfterMin: '1500', halfDayMinHours: '' })), /half/i)
assert.match(bad(buildRulesPayload({ grace: 5, tiers: [], halfDayLateAfterMin: '', halfDayMinHours: '30' })), /hours/i)
assert.match(bad(buildRulesPayload({ grace: 5, tiers: [], halfDayLateAfterMin: '1.5', halfDayMinHours: '' })), /whole/i)

console.log('shift rule checks passed')

const rows = [
  { employee_id: 'a', full_name: 'A', employee_code: 'E1', pay_type: 'daily', wage_amount: 500, days_worked: 2, half_days: 1, hours_worked: 12, late_deduction_hours: 1, gross: 600, late_deduction_amount: 50, late_fine_amount: 100, net_pay: 450, warnings: [] },
  { employee_id: 'b', full_name: 'B', employee_code: 'E2', pay_type: null, wage_amount: null, days_worked: 1, half_days: 0, hours_worked: 8, late_deduction_hours: 0, gross: 0, late_deduction_amount: 0, net_pay: 0, warnings: ['No wage set'] },
]
assert.deepEqual(payrollTotals(rows), { days_worked: 3, half_days: 1, hours_worked: 20, late_deduction_hours: 1, gross: 600, late_deduction_amount: 50, late_fine_amount: 100, net_pay: 450 })
assert.deepEqual(payrollTotals([]), { days_worked: 0, half_days: 0, hours_worked: 0, late_deduction_hours: 0, gross: 0, late_deduction_amount: 0, late_fine_amount: 0, net_pay: 0 })
const csv = reportCsvRows(rows)
assert.equal(csv.length, 2)
assert.equal(csv[0].pay_type, 'Daily')
assert.equal(csv[1].pay_type, '—')
assert.equal(csv[1].warnings, 'No wage set')
assert.equal(formatMoney(1234.5), '₹1,234.50')
assert.equal(formatMoney(0), '₹0.00')
assert.equal(formatMoney(null), '—')
console.log('payroll helper checks passed')
