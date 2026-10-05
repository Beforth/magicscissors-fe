import assert from 'node:assert/strict'
import { distanceMeters, getPunchGate } from '../src/lib/geofence.js'

const fence = { id: 'g', name: 'Main', latitude: 19.884765, longitude: 73.978462, radius_m: 100 }
const config = { geofences: [fence], max_accuracy_m: 50 }
const ready = (lat, lng, accuracy = 10) => ({ status: 'ready', position: { latitude: lat, longitude: lng, accuracy } })

assert.equal(Math.round(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }) / 1000), 111)
assert.equal(getPunchGate({ geo: ready(19.884765, 73.978462), config, busy: false }).allowed, true)
assert.equal(getPunchGate({ geo: ready(19.894765, 73.978462), config, busy: false }).allowed, false)
assert.match(getPunchGate({ geo: ready(19.894765, 73.978462), config, busy: false }).reason, /m from Main/)
assert.equal(getPunchGate({ geo: ready(19.884765, 73.978462, 80), config, busy: false }).allowed, false)
assert.equal(getPunchGate({ geo: { status: 'denied', position: null }, config, busy: false }).allowed, false)
assert.equal(getPunchGate({ geo: ready(19.884765, 73.978462), config: { ...config, geofences: [] }, busy: false }).allowed, false)
assert.equal(getPunchGate({ geo: ready(19.884765, 73.978462), config, busy: true }).allowed, false)
assert.equal(getPunchGate({ geo: ready(19.884765, 73.978462), config: null, busy: false }).allowed, false)
console.log('geofence checks passed')
