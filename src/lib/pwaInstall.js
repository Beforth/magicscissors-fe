import { useEffect, useState } from 'react'

// beforeinstallprompt can fire before React mounts, so it is captured at module load.
let deferred = null
const listeners = new Set()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/** { installed, canPrompt, isIOS, install() } — iOS has no prompt API, so it shows manual steps instead. */
export function usePwaInstall() {
  const [, tick] = useState(0)
  useEffect(() => {
    const l = () => tick((n) => n + 1)
    listeners.add(l)
    return () => listeners.delete(l)
  }, [])
  return {
    installed: isStandalone(),
    canPrompt: Boolean(deferred),
    isIOS: isIOS(),
    async install() {
      if (!deferred) return null
      const ev = deferred
      deferred = null
      notify()
      ev.prompt()
      const { outcome } = await ev.userChoice
      return outcome
    },
  }
}
