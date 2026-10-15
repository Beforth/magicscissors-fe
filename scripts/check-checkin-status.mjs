import assert from 'node:assert/strict'
import { describeCheckIn } from '../src/lib/attendanceDay.js'

const shift = { name: 'Morning', start_time: '10:00', end_time: '19:00', grace_period: 10 }
const rec = (o = {}) => ({ check_in: '2026-10-15T10:00:00', shift, penalty_rule: 'shift', late_minutes: 0, early_minutes: 0, late_penalty_hours: 0, late_penalty_amount: 0, ...o })

// no check-in: nothing to say
assert.equal(describeCheckIn(rec({ check_in: null })), null)
// no shift and no profile shift
assert.deepEqual(describeCheckIn(rec({ shift: null, penalty_rule: null, late_minutes: null, early_minutes: null })), { tone: 'muted', label: 'No shift assigned', detail: 'Assign one on the Shifts page.' })
// early
assert.deepEqual(describeCheckIn(rec({ early_minutes: 75 })), { tone: 'success', label: 'Early by 1h 15m', detail: null })
assert.equal(describeCheckIn(rec({ early_minutes: 5 })).label, 'Early by 5m')
// on time (also when early_minutes is missing from an older backend)
assert.equal(describeCheckIn(rec()).label, 'On time')
assert.equal(describeCheckIn(rec({ early_minutes: undefined })).label, 'On time')
// late within grace, no penalty
assert.deepEqual(describeCheckIn(rec({ late_minutes: 7 })), { tone: 'warning', label: 'Late 7m — within grace (10m)', detail: null })
// past grace: fine and/or hours
assert.deepEqual(describeCheckIn(rec({ late_minutes: 25, late_penalty_amount: 100 })), { tone: 'destructive', label: 'Late 25m', detail: '₹100 fine' })
assert.deepEqual(describeCheckIn(rec({ late_minutes: 70, late_penalty_hours: 1 })), { tone: 'destructive', label: 'Late 1h 10m', detail: '1h deducted' })
assert.equal(describeCheckIn(rec({ late_minutes: 70, late_penalty_hours: 1.5, late_penalty_amount: 50 })).detail, '₹50 fine + 1h 30m deducted')
// profile (legacy) shift: 15 minute grace
const legacy = rec({ shift: null, penalty_rule: 'legacy', late_minutes: 9 })
assert.equal(describeCheckIn(legacy).label, 'Late 9m — within grace (15m)')
console.log('check-in status checks passed')
