const R = 6371000
const rad = (d) => (d * Math.PI) / 180

export function distanceMeters(a, b) {
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function nearestFence(position, geofences) {
  // If inside any fence, prefer the containing fence; otherwise the nearest by centre.
  let best = null
  for (const g of geofences) {
    const d = Math.round(distanceMeters(position, g))
    const within = d <= g.radius_m
    const cand = { ...g, distanceM: d, within }
    if (!best || (within && !best.within) || (within === best.within && d < best.distanceM)) best = cand
  }
  return best
}

/** Decides whether the punch button is enabled, and why not. */
export function getPunchGate({ geo, config, busy }) {
  if (busy) return { allowed: false, reason: 'Submitting…', nearest: null }
  if (!config) return { allowed: false, reason: 'Loading…', nearest: null }
  if (geo.status === 'unsupported') return { allowed: false, reason: 'This device has no location support', nearest: null }
  if (geo.status === 'denied') return { allowed: false, reason: 'Location permission denied — allow it in browser settings', nearest: null }
  if (geo.status === 'unavailable') return { allowed: false, reason: 'Cannot get your location — turn on GPS', nearest: null }
  if (geo.status !== 'ready' || !geo.position) return { allowed: false, reason: 'Getting your location…', nearest: null }
  if (config.geofences.length === 0) return { allowed: false, reason: 'Attendance location is not set up for your branch yet', nearest: null }
  if (geo.position.accuracy > config.max_accuracy_m) {
    return { allowed: false, reason: `GPS accuracy is low (${Math.round(geo.position.accuracy)} m). Move to an open area.`, nearest: null }
  }
  const nearest = nearestFence(geo.position, config.geofences)
  if (!nearest.within) {
    return { allowed: false, reason: `You are ${nearest.distanceM} m from ${nearest.name} (allowed ${nearest.radius_m} m)`, nearest }
  }
  return { allowed: true, reason: null, nearest }
}
