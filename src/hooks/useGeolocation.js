import { useEffect, useState } from 'react'

export function useGeolocation() {
  const [state, setState] = useState({ status: 'pending', position: null })

  useEffect(() => {
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
