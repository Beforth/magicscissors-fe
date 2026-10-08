import { useEffect, useState } from 'react'

// Dev only: VITE_DEV_MOCK_LOCATION="lat,lng" in .env fakes a good GPS fix so punching can be
// tested from a laptop. `import.meta.env.DEV` is false in production builds, so this is dead code there.
function getDevMockPosition() {
  if (!import.meta.env.DEV) return null
  const [latitude, longitude] = String(import.meta.env.VITE_DEV_MOCK_LOCATION || '').split(',').map(Number)
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude, accuracy: 10 } : null
}

export function useGeolocation() {
  const [state, setState] = useState(() => {
    const mock = getDevMockPosition()
    return mock ? { status: 'ready', position: mock } : { status: 'pending', position: null }
  })

  useEffect(() => {
    if (getDevMockPosition()) return undefined
    if (!('geolocation' in navigator)) {
      setState({ status: 'unsupported', position: null })
      return undefined
    }
    const id = navigator.geolocation.watchPosition(
      (p) =>
        setState({
          status: 'ready',
          position: { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy },
        }),
      (e) => setState({ status: e.code === 1 ? 'denied' : 'unavailable', position: null }),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  return state
}
