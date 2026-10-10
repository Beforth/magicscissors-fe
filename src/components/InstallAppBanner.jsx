import { useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePwaInstall } from '@/lib/pwaInstall'

const DISMISS_KEY = 'pwa-install-dismissed'
const wasDismissed = () => {
  try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
}

/** Mobile-only strip offering to install the app (Android/Chrome prompt, or Add-to-Home-Screen steps on iOS). */
export default function InstallAppBanner() {
  const pwa = usePwaInstall()
  const [hidden, setHidden] = useState(wasDismissed)
  if (hidden || pwa.installed || (!pwa.canPrompt && !pwa.isIOS)) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode */ }
    setHidden(true)
  }

  return (
    <div className="md:hidden flex items-center gap-3 border-b bg-primary/5 px-4 py-2.5 text-sm">
      <Download className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Install Salon ERP</p>
        {pwa.canPrompt ? (
          <p className="text-xs text-muted-foreground">Open it like an app from your home screen.</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Tap <Share className="inline h-3 w-3" /> Share, then “Add to Home Screen”.
          </p>
        )}
      </div>
      {pwa.canPrompt && (
        <Button size="sm" onClick={() => pwa.install().then((o) => o === 'accepted' && dismiss())}>
          Install
        </Button>
      )}
      <button type="button" aria-label="Dismiss" onClick={dismiss} className="p-1 text-muted-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
