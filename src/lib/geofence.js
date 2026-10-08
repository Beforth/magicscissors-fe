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

/** Decides whether the punch button is enabled, and why not. The server re-checks everything. */
export function getPunchGate({ geo, config, busy }) {
  if (busy) return { allowed: false, reason: 'Submitting…', nearest: null }
  if (!config) return { allowed: false, reason: 'Loading…', nearest: null }
  if (!config.geofences?.length) {
    return { allowed: false, reason: 'No geofence is set up for your branch. Ask the owner to add one.', nearest: null }
  }
  if (!geo?.position) {
    const reason = geo?.status === 'denied'
      ? 'Location permission is blocked. Allow location in your browser to punch.'
      : 'Getting your location…'
    return { allowed: false, reason, nearest: null }
  }

  const nearest = nearestFence(geo.position, config.geofences)
  const accuracy = Math.round(geo.position.accuracy)
  if (config.max_accuracy_m && geo.position.accuracy > config.max_accuracy_m) {
    const shown = accuracy >= 1000 ? `${(accuracy / 1000).toFixed(1)} km` : `${accuracy} m`
    return {
      allowed: false,
      reason: `GPS signal too weak (±${shown}, need ≤ ${config.max_accuracy_m} m). Use your phone outdoors.`,
      nearest,
    }
  }
  if (!nearest.within) {
    return { allowed: false, reason: `You are ${nearest.distanceM} m from ${nearest.name} (allowed ${nearest.radius_m} m)`, nearest }
  }
  return { allowed: true, reason: null, nearest }
}
