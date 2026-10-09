import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Scissors,
  Loader2,
  ChevronDown,
  Clock,
  Calendar,
  TrendingUp,
  CheckCircle2,
  LogIn,
  LogOut,
  User,
  Zap,
  IndianRupee,
  BarChart2,
  ArrowRight,
  Sparkles,
  MapPin,
  Coffee,
  Leaf,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { userService } from '@/services/user.service'
import { attendanceService } from '@/services/attendance.service'
import { useGeolocation } from '@/hooks/useGeolocation'
import { getPunchGate } from '@/lib/geofence'
import { formatWorkedHours } from '@/lib/utils'
import SelfieCapture from '@/components/attendance/SelfieCapture'
import DayVerdict from '@/components/attendance/DayVerdict'
import PresenceCodeField from '@/components/attendance/PresenceCodeField'

// ─── helpers ────────────────────────────────────────────────────────────────

function formatTimeStored(iso) {
  if (!iso) return '—'
  const m = String(iso).match(/(\d{2}):(\d{2})/)
  if (m) return `${m[1]}:${m[2]}`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatServiceDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function useLiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function getCurrentWeekDates() {
  const today = new Date()
  const ist = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const dow = ist.getDay()
  const mon = new Date(ist)
  mon.setDate(ist.getDate() - ((dow + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  })
}

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STATUS_META = {
  not_arrived:  { label: 'Not checked in', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-400', ring: 'ring-amber-200' },
  on_floor:     { label: 'On floor',        color: 'text-primary', bg: 'bg-blue-50', dot: 'bg-blue-500', ring: 'ring-blue-200' },
  on_break:     { label: 'On break',        color: 'text-sky-600', bg: 'bg-sky-50', dot: 'bg-sky-500', ring: 'ring-sky-200' },
  checked_out:  { label: 'Checked out',     color: 'text-muted-foreground', bg: 'bg-slate-100', dot: 'bg-slate-400', ring: 'ring-slate-200' },
  on_leave:     { label: 'On leave',        color: 'text-rose-600', bg: 'bg-rose-50', dot: 'bg-rose-500', ring: 'ring-rose-200' },
}

const QUOTES = [
  'A calm start makes for a steady day.',
  'Small steps today, big results tomorrow.',
  'Every client leaves happier because of you.',
  'Precision and patience make the best work.',
  'Great service is a habit, not an act.',
  'Take pride in the little details.',
  'Finish strong, rest well.',
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── sub-components ──────────────────────────────────────────────────────────

function LiveClock() {
  const now = useLiveClock()
  const h12 = now.getHours() % 12 || 12
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM'
  const day = now.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' })
  const date = now.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-primary">
        <Clock className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-foreground">{h12}:{mm}</span>
          <span className="text-sm font-semibold text-primary">{ampm}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{day}, {date}</p>
      </div>
    </div>
  )
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.not_arrived
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 shadow-2xs ${meta.bg} ${meta.color} ${meta.ring}`}>
      <span className={`h-2 w-2 rounded-full ${meta.dot} ${status === 'on_floor' ? 'animate-pulse' : ''}`} />
      {meta.label}
    </span>
  )
}

// ─── PunchPanel (Recomposed Attendance Console) ──────────────────────────────

const formatMeters = (m) => {
  const n = Math.round(m)
  return n >= 1000 ? `${(n / 1000).toFixed(1)} km` : `${n} m`
}

function PunchPanel({ config, isLoadingConfig }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const geo = useGeolocation()
  const [selfieOpen, setSelfieOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [presenceCode, setPresenceCode] = useState('')
  const inFlight = useRef(false)

  const mutation = useMutation({
    mutationFn: (fd) => attendanceService.selfPunch(fd),
    onSettled: () => { inFlight.current = false },
    onSuccess: () => {
      toast.success('Attendance recorded')
      setPresenceCode('')
      queryClient.invalidateQueries({ queryKey: ['self-config'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-monthly-self'] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Punch failed')
      if (String(err.response?.data?.error?.code || '').startsWith('PRESENCE_CODE')) setPresenceCode('')
      queryClient.invalidateQueries({ queryKey: ['self-config'] })
    },
  })

  if (isLoadingConfig || !config) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    )
  }

  const today = config.today || {}
  const status = today.current_status || 'not_arrived'
  const isOnFloor = status === 'on_floor'
  // After checking out an employee may come back (split shift); the time away is an unpaid break.
  const canPunch = status === 'not_arrived' || status === 'on_floor' || status === 'checked_out'
  const needsCode = Boolean(config.require_presence_code)
  const codeReady = !needsCode || presenceCode.length === 6
  const punchType = isOnFloor ? 'out' : 'in'
  const gate = getPunchGate({ geo, config, busy: mutation.isPending })
  const worked = formatWorkedHours(today.working_hours)
  const checkIn = formatTimeStored(today.check_in)
  const checkOut = formatTimeStored(today.check_out)

  const submit = (selfieBlob) => {
    if (inFlight.current) return
    const latest = getPunchGate({ geo, config, busy: false })
    const pos = geo.position
    if (!latest.allowed || !pos) {
      toast.error(latest.reason || 'Cannot get your location')
      return
    }
    inFlight.current = true
    const fd = new FormData()
    fd.append('punch_type', punchType)
    fd.append('latitude', String(pos.latitude))
    fd.append('longitude', String(pos.longitude))
    fd.append('accuracy', String(pos.accuracy))
    if (needsCode) fd.append('presence_code', presenceCode)
    if (selfieBlob) fd.append('selfie', selfieBlob, 'selfie.jpg')
    mutation.mutate(fd)
  }

  const handlePunch = () => {
    if (!gate.allowed || !codeReady) return
    if (config.require_selfie) setSelfieOpen(true)
    else submit(null)
  }

  const statusLabel = isOnFloor ? 'You are checked in' : status === 'checked_out' ? "You've checked out" : (STATUS_META[status]?.label || 'Not checked in')
  const statusHint = isOnFloor
    ? `Clocked in and active on floor${checkIn !== '—' ? ` since ${checkIn}` : ''}.`
    : status === 'checked_out'
      ? 'Back for another part of the day? Check back in; the time away is not paid.'
      : status === 'not_arrived'
        ? 'Ready to start your shift. Punch in to mark your attendance.'
        : STATUS_META[status]?.label
  const tone = isOnFloor || status === 'checked_out'
    ? { box: 'bg-success/10 border-success/20', icon: 'bg-success text-white' }
    : { box: 'bg-secondary/60', icon: 'bg-background text-muted-foreground border' }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-stretch">
        {/* Time, status and punch */}
        <section className="lg:col-span-5 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <LiveClock />
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              Live
            </span>
          </div>

          <div className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center ${tone.box}`}>
            <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tone.icon}`}>
              {isOnFloor || status === 'checked_out' ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{statusLabel}</p>
              <p className="text-xs text-muted-foreground leading-snug">{statusHint}</p>
            </div>
            </div>
            {canPunch && (
              <Button
                onClick={handlePunch}
                disabled={!gate.allowed || !codeReady}
                loading={mutation.isPending}
                variant={isOnFloor ? 'default' : 'success'}
                className="h-12 w-full shrink-0 px-5 text-base font-semibold sm:h-11 sm:w-auto sm:text-sm"
              >
                {!mutation.isPending && (isOnFloor ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />)}
                {isOnFloor ? 'Punch Out' : status === 'checked_out' ? 'Check back in' : 'Punch In'}
              </Button>
            )}
          </div>

          {canPunch && <PresenceCodeField required={needsCode} value={presenceCode} onChange={setPresenceCode} disabled={mutation.isPending} />}

          <button
            type="button"
            onClick={() => setLocationOpen((o) => !o)}
            aria-expanded={locationOpen}
            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 ${
              gate.allowed ? 'bg-accent/60 hover:bg-accent' : 'bg-warning/10 border-warning/25'
            }`}
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${gate.allowed ? 'bg-accent text-primary' : 'bg-warning/20 text-warning'}`}>
              <MapPin className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                {gate.allowed ? `Location verified · ${gate.nearest?.name || 'Salon'}` : (gate.reason || 'Checking location…')}
              </span>
              {geo.position && (
                <span className="block text-xs text-muted-foreground">
                  {gate.allowed ? 'Within salon boundary' : 'Outside salon boundary'} (±{formatMeters(geo.position.accuracy)} GPS accuracy)
                </span>
              )}
              {locationOpen && gate.nearest && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  Distance {gate.nearest.distanceM} m · allowed radius {gate.nearest.radius_m} m
                </span>
              )}
            </span>
            <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${locationOpen ? 'rotate-90' : ''}`} />
          </button>
        </section>

        {/* Today's shift activity */}
        <section className="lg:col-span-7 flex flex-col justify-between rounded-xl border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Today's Shift Activity</h2>
            <span className="text-[11px] text-muted-foreground">Live attendance log</span>
          </div>

          <div className="my-auto grid grid-cols-2 gap-3">
            {[
              { label: 'Check In', value: checkIn, icon: LogIn, tint: 'bg-primary/10 text-primary' },
              { label: 'Check Out', value: checkOut, icon: LogOut, tint: 'bg-destructive/10 text-destructive' },
              { label: 'Worked Time', value: worked || '—', icon: Clock, tint: 'bg-info/10 text-info' },
              { label: 'Total Break', value: today.total_break_minutes > 0 ? `${today.total_break_minutes}m` : '0m', icon: Coffee, tint: 'bg-warning/10 text-warning' },
            ].map(({ label, value, icon: Icon, tint }) => (
              <div key={label} className="flex items-center gap-3 rounded-lg border bg-background p-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tint}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                  <span className="block truncate text-base font-bold tabular-nums leading-tight text-foreground sm:text-xl">{value}</span>
                </div>
              </div>
            ))}
          </div>

          <DayVerdict
            className="mt-3"
            record={{ ...today, check_in: today.check_in, status: today.day_status }}
          />

          <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span>Shift summary recorded</span>
            <button
              type="button"
              onClick={() => navigate('/my-attendance')}
              className="inline-flex items-center gap-1 rounded font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Full Attendance Record <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </section>
      </div>

      <SelfieCapture
        open={selfieOpen}
        position={geo.position}
        onCancel={() => setSelfieOpen(false)}
        onCapture={(blob) => { setSelfieOpen(false); submit(blob) }}
      />
    </>
  )
}

// ─── Hours This Week Card ─────────────────────────────────────────────────────

function HoursThisWeekCard({ userId }) {
  const weekDates = getCurrentWeekDates()
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const month = weekDates[0].slice(0, 7)
  const month2 = weekDates[6].slice(0, 7)
  const months = month === month2 ? [month] : [month, month2]

  const { data: m1Data, isLoading: l1 } = useQuery({
    queryKey: ['attendance-monthly-self', months[0]],
    queryFn: () => attendanceService.getMonthlyAttendance({ month: months[0] }),
    staleTime: 5 * 60_000,
  })
  const { data: m2Data, isLoading: l2 } = useQuery({
    queryKey: ['attendance-monthly-self', months[1]],
    queryFn: () => attendanceService.getMonthlyAttendance({ month: months[1] }),
    enabled: months.length > 1,
    staleTime: 5 * 60_000,
  })

  const isLoading = l1 || (months.length > 1 && l2)
  const allAttendance = [
    ...(m1Data?.data?.attendance || []),
    ...(m2Data?.data?.attendance || []),
  ]

  const dayData = weekDates.map((dateStr, i) => {
    const rec = allAttendance.find((a) => a.date === dateStr)
    const hours = rec?.working_hours != null ? parseFloat(rec.working_hours) : null
    return { day: WEEK_LABELS[i], dateStr, hours, isToday: dateStr === todayStr }
  })

  const totalHours = dayData.reduce((s, d) => s + (d.hours || 0), 0)
  const maxHours = Math.max(...dayData.map((d) => d.hours || 0), 8)

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-primary">
            <BarChart2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-bold text-foreground">Hours this week</span>
            <p className="text-xs text-muted-foreground">Mon – Sun</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-base font-extrabold text-foreground tabular-nums">{formatWorkedHours(totalHours) || '0h'}</span>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase">total</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="flex items-end justify-between gap-2 h-24 pt-2">
          {dayData.map(({ day, hours, isToday }) => {
            const pct = hours != null ? Math.max((hours / maxHours) * 100, 8) : 0
            return (
              <div key={day} className="flex flex-col items-center gap-1.5 flex-1">
                {hours != null && (
                  <span className="text-[9px] text-muted-foreground tabular-nums font-semibold">
                    {formatWorkedHours(hours) || ''}
                  </span>
                )}
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={`w-full rounded-t-xl transition-all ${
                      isToday
                        ? 'bg-primary shadow-xs'
                        : hours != null
                          ? 'bg-blue-200 hover:bg-blue-300'
                          : 'bg-slate-100'
                    }`}
                    style={{ height: hours != null ? `${pct}%` : '12%', minHeight: '6px', maxHeight: '100%' }}
                  />
                </div>
                <span className={`text-[11px] font-bold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {day}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── This Month Stats Card ────────────────────────────────────────────────────

function ThisMonthCard() {
  const month = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7)

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-monthly-self', month],
    queryFn: () => attendanceService.getMonthlyAttendance({ month }),
    staleTime: 5 * 60_000,
  })

  const attendance = data?.data?.attendance || []
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const past = attendance.filter((a) => a.date <= today)
  const presentDays = past.filter((a) => ['present', 'late'].includes(a.status)).length
  const leaveDays = past.filter((a) => a.status === 'on_leave').length
  const absentDays = past.filter((a) => a.status === 'absent').length
  const totalHours = past.reduce((s, a) => s + (a.working_hours ? parseFloat(a.working_hours) : 0), 0)
  const monthName = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', timeZone: 'Asia/Kolkata' })

  const statItems = [
    { label: 'Days present', value: presentDays, color: 'text-primary', bg: 'bg-blue-50/70 border-blue-100' },
    { label: 'Hours worked', value: formatWorkedHours(totalHours) || '0h', color: 'text-sky-600', bg: 'bg-sky-50/70 border-sky-100' },
    { label: 'On leave', value: leaveDays, color: 'text-amber-600', bg: 'bg-amber-50/70 border-amber-100' },
    { label: 'Absent', value: absentDays, color: 'text-rose-600', bg: 'bg-rose-50/70 border-rose-100' },
  ]

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-bold text-foreground">{monthName}</span>
            <p className="text-xs text-muted-foreground">Monthly overview</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {statItems.map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-lg p-3 border ${bg} backdrop-blur-sm`}>
              <p className={`text-xl font-extrabold ${color} tabular-nums leading-none`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1 font-semibold">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Pay Card ─────────────────────────────────────────────────────────────────

function PayCard() {
  return (
    <div className="glass-card rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <IndianRupee className="h-5 w-5" />
        </div>
        <div>
          <span className="text-sm font-bold text-foreground">Pay & Earnings</span>
          <p className="text-xs text-muted-foreground">Monthly payroll</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Your payslip is processed monthly by your salon admin.
      </p>
      <div className="mt-auto pt-2">
        <div className="h-px bg-slate-100 mb-3" />
        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
          <TrendingUp className="h-4 w-4" />
          <span>Payroll processed monthly</span>
        </div>
      </div>
    </div>
  )
}

// ─── Quick Navigation Card ────────────────────────────────────────────────────

function QuickNavCard() {
  const navigate = useNavigate()
  const links = [
    {
      label: 'My Attendance',
      sub: 'Full history & records',
      path: '/my-attendance',
      icon: Calendar,
      color: 'text-primary',
      bg: 'bg-blue-50',
    },
    {
      label: 'Live Status',
      sub: 'Floor activity now',
      path: '/employee-status',
      icon: TrendingUp,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
    },
    {
      label: 'My Profile',
      sub: 'Account & security',
      path: '/profile',
      icon: User,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
  ]
  return (
    <section aria-label="Quick access" className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Quick access</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {links.map(({ label, sub, path, icon: Icon, color, bg }) => (
          <button
            key={path}
            type="button"
            onClick={() => navigate(path)}
            className="group flex min-h-[72px] items-center gap-4 rounded-xl glass-card p-4 text-left transition-all hover:bg-white hover:scale-[1.01] hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.99]"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${bg} transition-transform group-hover:scale-105`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-foreground">{label}</span>
              <span className="block truncate text-xs text-muted-foreground font-medium">{sub}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </button>
        ))}
      </div>
    </section>
  )
}

// ─── Services list ────────────────────────────────────────────────────────────

function ServicesList() {
  const [offset, setOffset] = useState(0)
  const [allServices, setAllServices] = useState([])
  const limit = 10

  const { data, isLoading } = useQuery({
    queryKey: ['my-services', offset],
    queryFn: () => userService.getMyServices({ limit, offset }),
  })

  useEffect(() => {
    if (!data?.data) return
    if (offset === 0) {
      setAllServices(data.data)
    } else {
      setAllServices((prev) => [...prev, ...data.data])
    }
  }, [data, offset])

  const pagination = data?.pagination || {}
  const displayServices = allServices.length > 0 ? allServices : (data?.data || [])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-50 text-pink-600">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Recent Services</h2>
            <p className="text-xs text-muted-foreground">Completed jobs</p>
          </div>
        </div>
        {displayServices.length > 0 && (
          <Badge variant="secondary" className="text-xs font-bold rounded-xl px-2.5 py-0.5 bg-blue-50 text-primary border border-blue-100">
            {displayServices.length}{pagination.has_more ? '+' : ''}
          </Badge>
        )}
      </div>

      {isLoading && offset === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : displayServices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
          <div className="h-14 w-14 rounded-xl bg-slate-50 flex items-center justify-center">
            <Scissors className="h-6 w-6 opacity-40 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-muted-foreground">No services yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">Your completed services will appear here</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {displayServices.map((svc, i) => (
            <div
              key={`${svc.id ?? i}-${i}`}
              className="group flex items-center justify-between rounded-lg bg-white/70 hover:bg-white border border-white/80 p-3.5 transition-all hover:shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{svc.item_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{svc.customer_name}</p>
                </div>
              </div>
              <div className="shrink-0 text-right ml-3">
                <p className="text-xs text-muted-foreground font-medium whitespace-nowrap">{formatServiceDate(svc.date)}</p>
              </div>
            </div>
          ))}

          {pagination.has_more && (
            <button
              onClick={() => setOffset((p) => p + limit)}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 py-3 text-sm font-semibold text-muted-foreground transition-all hover:border-blue-300 hover:text-primary hover:bg-blue-50/50 disabled:opacity-50"
            >
              {isLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ChevronDown className="h-4 w-4" />}
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function EmployeeDashboard() {
  const { user } = useSelector((state) => state.auth)
  const location = useLocation()

  const { data: configData, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['self-config'],
    queryFn: attendanceService.getSelfConfig,
    staleTime: 0,
    refetchInterval: 60_000,
  })
  const config = configData?.data
  const today = config?.today || {}
  const greeting = getGreeting()
  const dailyQuote = QUOTES[new Date().getDay()]
  const firstName = user?.fullName?.split(' ')[0] || 'Employee'

  const navigate = useNavigate()

  useEffect(() => {
    if (user && user.role !== 'employee') {
      if (['owner', 'developer'].includes(user.role)) navigate('/dashboard/owner', { replace: true })
      else if (user.role === 'manager') navigate('/dashboard/manager', { replace: true })
      else if (user.role === 'cashier') navigate('/dashboard/cashier', { replace: true })
    }
  }, [user, navigate])

  useEffect(() => {
    if (location.hash !== '#attendance-punch') return undefined
    const frame = requestAnimationFrame(() => {
      document.getElementById('attendance-punch')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.hash])

  return (
    <div className="w-full space-y-5 sm:space-y-6">

      {/* ── Greeting banner ── */}
      <section
        id="attendance-punch"
        className="relative flex items-center justify-between gap-4 overflow-hidden rounded-xl border bg-gradient-to-br from-accent via-background to-accent/40 p-4 sm:p-6"
      >
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary text-lg font-bold text-primary-foreground sm:h-14 sm:w-14 sm:text-xl">
            {(firstName || 'E').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground sm:text-sm">{greeting}</p>
            <h1 className="text-xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
              Welcome back,{' '}
              <span className="block text-primary sm:inline">{user?.fullName || firstName}</span>
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              Role: <span className="font-semibold capitalize text-foreground">{user?.role || 'Employee'}</span>
            </p>
          </div>
        </div>
        <div className="hidden shrink-0 border-l pl-4 text-sm text-muted-foreground min-[380px]:block sm:max-w-[200px]">
          <Leaf className="mb-1 h-4 w-4 text-primary" />
          <p className="max-w-[130px] leading-snug sm:max-w-none">{dailyQuote}</p>
          <span className="mt-2 block h-0.5 w-10 rounded-full bg-primary" />
        </div>
      </section>

      <PunchPanel config={config} isLoadingConfig={isLoadingConfig} />

      {/* ── Quick Nav ─────────────────────────────────────────────────────── */}
      <QuickNavCard />

      {/* ── Widget Grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HoursThisWeekCard userId={user?.id} />
        <ThisMonthCard />
        <PayCard />
      </div>

      {/* ── Recent Services ───────────────────────────────────────────────── */}
      <div className="glass-card rounded-xl p-4 sm:p-6">
        <ServicesList />
      </div>
    </div>
  )
}

export default EmployeeDashboard
