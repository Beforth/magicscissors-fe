import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, MapPin, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { attendanceService } from '@/services/attendance.service'
import { useGeolocation } from '@/hooks/useGeolocation'
import { getPunchGate } from '@/lib/geofence'
import SelfieCapture from '@/components/attendance/SelfieCapture'

const STATUS_LABELS = {
  not_arrived: 'Not checked in',
  on_floor: 'Checked in',
  on_break: 'On break',
  checked_out: 'Checked out',
  on_leave: 'On leave',
}

function formatTimeStored(iso) {
  if (!iso) return '—'
  // Prefer wall-clock digits (IST-as-UTC naive ISO) over browser-local parsing
  const m = String(iso).match(/(\d{2}):(\d{2})/)
  if (m) return `${m[1]}:${m[2]}`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

export default function MyAttendancePage() {
  const queryClient = useQueryClient()
  const geo = useGeolocation()
  const [selfieOpen, setSelfieOpen] = useState(false)
  const [installEvent, setInstallEvent] = useState(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['self-config'],
    queryFn: attendanceService.getSelfConfig,
    staleTime: 0,
    refetchInterval: 60000,
  })
  const config = data?.data

  const mutation = useMutation({
    mutationFn: (formData) => attendanceService.selfPunch(formData),
    onSuccess: () => {
      toast.success('Attendance recorded')
      queryClient.invalidateQueries({ queryKey: ['self-config'] })
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Punch failed'),
  })

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setInstallEvent(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const gate = getPunchGate({ geo, config, busy: mutation.isPending })
  const status = config?.today?.current_status || 'not_arrived'
  const isOut = status === 'on_floor'
  const canPunchState = status === 'not_arrived' || status === 'checked_out' || status === 'on_floor'
  const punchType = isOut ? 'out' : 'in'

  const submit = (selfieBlob) => {
    const pos = geo.position
    if (!pos) return
    const fd = new FormData()
    fd.append('punch_type', punchType)
    fd.append('latitude', String(pos.latitude))
    fd.append('longitude', String(pos.longitude))
    fd.append('accuracy', String(pos.accuracy))
    if (selfieBlob) fd.append('selfie', selfieBlob, 'selfie.jpg')
    mutation.mutate(fd)
  }

  const handlePunch = () => {
    if (!gate.allowed) return
    if (config.require_selfie) setSelfieOpen(true)
    else submit(null)
  }

  const handleInstall = async () => {
    if (!installEvent) return
    installEvent.prompt()
    await installEvent.userChoice?.catch(() => {})
    setInstallEvent(null)
  }

  const isIos = typeof navigator !== 'undefined' && /iphone|ipad/i.test(navigator.userAgent)
  const showInstall = !isStandalone() && (installEvent || isIos)

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (isError || !config) {
    return <p className="p-4 text-sm text-destructive">Could not load attendance settings. Please try again.</p>
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">My Attendance</h1>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="text-sm text-muted-foreground">Today</div>
          <div className="text-xl font-semibold">{STATUS_LABELS[status] || status}</div>
          <div className="flex gap-6 text-sm">
            <div>
              <div className="text-muted-foreground">Check in</div>
              <div className="font-mono">{formatTimeStored(config.today?.check_in)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Check out</div>
              <div className="font-mono">{formatTimeStored(config.today?.check_out)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Button
          size="lg"
          className="h-16 w-full text-lg"
          disabled={!gate.allowed || !canPunchState}
          onClick={handlePunch}
        >
          {mutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <MapPin className="mr-2 h-5 w-5" />}
          {isOut ? 'Check out' : 'Check in'}
        </Button>
        {gate.reason && <p className="text-center text-sm text-muted-foreground">{gate.reason}</p>}
        {!canPunchState && (
          <p className="text-center text-sm text-muted-foreground">
            {status === 'on_break' ? 'Finish your break before checking out' : 'You are on leave today'}
          </p>
        )}
        {geo.position && (
          <p className="text-center text-xs text-muted-foreground">
            {gate.nearest ? `${gate.nearest.distanceM} m from ${gate.nearest.name} · ` : ''}
            GPS accuracy {Math.round(geo.position.accuracy)} m
          </p>
        )}
      </div>

      {showInstall && (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            {installEvent ? (
              <Button variant="outline" className="w-full" onClick={handleInstall}>
                <Download className="mr-2 h-4 w-4" /> Install app
              </Button>
            ) : (
              <p className="text-muted-foreground">To install: tap Share → Add to Home Screen</p>
            )}
          </CardContent>
        </Card>
      )}

      <SelfieCapture
        open={selfieOpen}
        position={geo.position}
        onCancel={() => setSelfieOpen(false)}
        onCapture={(blob) => {
          setSelfieOpen(false)
          submit(blob)
        }}
      />
    </div>
  )
}
