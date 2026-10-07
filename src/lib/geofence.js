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

  const fallbackFence = config.geofences?.[0] || null

  // If geolocation position is available
  if (geo?.position) {
    const nearest = config.geofences?.length ? nearestFence(geo.position, config.geofences) : fallbackFence
    const isLowAccuracy = config.max_accuracy_m && geo.position.accuracy > config.max_accuracy_m
    const isOutside = nearest && !nearest.within

    let reason = null
    if (isLowAccuracy) {
      reason = `GPS accuracy ±${Math.round(geo.position.accuracy)}m`
    } else if (isOutside && nearest) {
      reason = `Near ${nearest.name} (±${Math.round(geo.position.accuracy)}m)`
    }

    return { allowed: true, reason, nearest }
  }

  // Fallback if browser GPS is unavailable/denied or loading: allow punch with branch location
  return {
    allowed: true,
    reason: geo.status === 'denied' ? 'Using branch location (GPS denied)' : null,
    nearest: fallbackFence,
  }
}
