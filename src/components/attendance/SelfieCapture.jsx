import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { captureWatermarkedPhoto } from '@/lib/selfie'

export default function SelfieCapture({ open, onCancel, onCapture, position }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraError, setCameraError] = useState(false)
  const [ready, setReady] = useState(false)
  const [photo, setPhoto] = useState(null) // { blob, url }

  // Camera lifecycle: start when opened, always stop tracks on close/unmount.
  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    setCameraError(false)
    setReady(false)

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        setReady(true)
      } catch {
        if (!cancelled) setCameraError(true)
      }
    }
    start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setReady(false)
      setPhoto(null)
    }
  }, [open])

  // Attach the stream once the <video> element exists.
  useEffect(() => {
    if (ready && !photo && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [ready, photo, open])

  // Revoke preview object URL when replaced/cleared/unmounted.
  useEffect(() => {
    const url = photo?.url
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [photo])

  const takePhoto = async () => {
    try {
      const blob = await captureWatermarkedPhoto(videoRef.current, position)
      setPhoto({ blob, url: URL.createObjectURL(blob) })
    } catch (e) {
      toast.error(e.message || 'Could not capture photo')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Take a selfie</DialogTitle>
        </DialogHeader>

        {cameraError ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Camera permission is needed to take the selfie</p>
            <Button className="w-full" variant="outline" onClick={onCancel}>Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
              {photo ? (
                <img src={photo.url} alt="Selfie preview" className="h-full w-full object-cover" />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  {!ready && (
                    <div className="absolute inset-0 flex items-center justify-center text-white">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
              {photo ? (
                <>
                  <Button variant="outline" className="flex-1" onClick={() => setPhoto(null)}>Retake</Button>
                  <Button className="flex-1" onClick={() => onCapture(photo.blob)}>Use photo</Button>
                </>
              ) : (
                <Button className="flex-1" disabled={!ready || !position} onClick={takePhoto}>Take photo</Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
