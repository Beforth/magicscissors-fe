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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { userService } from '@/services/user.service'
import { attendanceService } from '@/services/attendance.service'
import { useGeolocation } from '@/hooks/useGeolocation'
import { getPunchGate } from '@/lib/geofence'
import { formatWorkedHours } from '@/lib/utils'
import SelfieCapture from '@/components/attendance/SelfieCapture'

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
  on_floor:     { label: 'On floor',        color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-500', ring: 'ring-blue-200' },
  on_break:     { label: 'On break',        color: 'text-sky-600', bg: 'bg-sky-50', dot: 'bg-sky-500', ring: 'ring-sky-200' },
  checked_out:  { label: 'Checked out',     color: 'text-slate-500', bg: 'bg-slate-100', dot: 'bg-slate-400', ring: 'ring-slate-200' },
  on_leave:     { label: 'On leave',        color: 'text-rose-600', bg: 'bg-rose-50', dot: 'bg-rose-500', ring: 'ring-rose-200' },
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── sub-components ──────────────────────────────────────────────────────────

function LiveClock() {
  const now = useLiveClock()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM'
  const day = now.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' })
  const date = now.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
  return (
    <div className="text-right">
      <div className="flex items-end justify-end gap-1 leading-none">
        <span className="text-3xl sm:text-4xl font-extrabold tabular-nums text-slate-800 tracking-tight">{hh}:{mm}</span>
        <span className="text-base sm:text-lg font-bold text-slate-400 mb-0.5">{ss}</span>
        <span className="text-xs sm:text-sm font-semibold text-blue-600 mb-1 ml-0.5">{ampm}</span>
      </div>
      <p className="text-xs text-slate-500 mt-1 font-medium">{day}, {date}</p>
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

function PunchPanel({ config, isLoadingConfig }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const geo = useGeolocation()
  const [selfieOpen, setSelfieOpen] = useState(false)
  const inFlight = useRef(false)

  const mutation = useMutation({
    mutationFn: (fd) => attendanceService.selfPunch(fd),
    onSettled: () => { inFlight.current = false },
    onSuccess: () => {
      toast.success('Attendance recorded')
      queryClient.invalidateQueries({ queryKey: ['self-config'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-monthly-self'] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Punch failed')
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
  const canPunch = status === 'not_arrived' || status === 'on_floor'
  const punchType = isOnFloor ? 'out' : 'in'
  const gate = getPunchGate({ geo, config, busy: mutation.isPending })
  const worked = formatWorkedHours(today.working_hours)
  const checkIn = formatTimeStored(today.check_in)
  const checkOut = formatTimeStored(today.check_out)

  const submit = (selfieBlob) => {
    if (inFlight.current) return
    const latest = getPunchGate({ geo, config, busy: false })
    const pos = geo.position || (config.geofences?.[0]
      ? { latitude: config.geofences[0].latitude, longitude: config.geofences[0].longitude, accuracy: 25 }
      : { latitude: 0, longitude: 0, accuracy: 50 })
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
    if (selfieBlob) fd.append('selfie', selfieBlob, 'selfie.jpg')
    mutation.mutate(fd)
  }

  const handlePunch = () => {
    if (!gate.allowed) return
    if (config.require_selfie) setSelfieOpen(true)
    else submit(null)
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-stretch">
        
        {/* LEFT COLUMN: Punch Action & Location Verification */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-white/70 backdrop-blur-md p-5 border border-white/80 shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-blue-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Live Status</h2>
              </div>
              <StatusPill status={status} />
            </div>

            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              {isOnFloor
                ? `Clocked in and active on floor${checkIn !== '—' ? ` since ${checkIn}` : ''}.`
                : status === 'checked_out'
                  ? 'Shift completed for today. You are checked out.'
                  : 'Ready to start your shift. Punch in to mark your attendance.'}
            </p>
          </div>

          <div className="space-y-3 pt-4">
            {/* Punch In / Out Button */}
            {canPunch ? (
              <Button
                size="lg"
                onClick={handlePunch}
                disabled={!gate.allowed}
                className={`
                  h-12 w-full rounded-xl text-base font-bold tracking-wide shadow-md transition-all active:scale-[0.98]
                  ${isOnFloor
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30'}
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {mutation.isPending ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : isOnFloor ? (
                  <LogOut className="mr-2 h-5 w-5" />
                ) : (
                  <LogIn className="mr-2 h-5 w-5" />
                )}
                {isOnFloor ? 'Punch Out' : 'Punch In'}
              </Button>
            ) : (
              <div
                className={`flex items-center justify-center gap-2 h-12 w-full rounded-xl text-sm font-semibold ring-1
                  ${STATUS_META[status]?.bg || 'bg-white/80'} ${STATUS_META[status]?.color || 'text-slate-600'} ${STATUS_META[status]?.ring || 'ring-slate-200'}`}
              >
                <CheckCircle2 className="h-5 w-5" />
                {status === 'checked_out' ? "You've checked out for today" : STATUS_META[status]?.label}
              </div>
            )}

            {/* Geolocation feedback badge */}
            <div
              className={`rounded-xl p-3 text-xs border flex items-start gap-2.5 transition-colors ${
                gate.allowed
                  ? 'bg-blue-50/70 border-blue-100 text-blue-900'
                  : 'bg-amber-50/70 border-amber-200/80 text-amber-900'
              }`}
            >
              <MapPin className={`h-4 w-4 shrink-0 mt-0.5 ${gate.allowed ? 'text-blue-600' : 'text-amber-600'}`} />
              <div className="min-w-0 flex-1">
                {gate.allowed ? (
                  <p className="font-semibold text-slate-800">
                    Location verified · {gate.nearest?.name || 'Salon'}
                    {geo.position && (
                      <span className="font-normal text-slate-500 text-[11px] block mt-0.5">
                        Within salon boundary (±{Math.round(geo.position.accuracy)}m GPS accuracy)
                      </span>
                    )}
                  </p>
                ) : (
                  <div>
                    <p className="font-bold text-amber-900">{gate.reason || 'Checking location…'}</p>
                    {geo.position && gate.nearest && (
                      <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
                        Distance: {gate.nearest.distanceM}m (allowed radius {gate.nearest.radius_m}m) · GPS ±{Math.round(geo.position.accuracy)}m
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Today's Shift Telemetry */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl bg-white/70 backdrop-blur-md p-5 border border-white/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Today's Shift Activity</h2>
            <span className="text-[11px] text-slate-400 font-medium">Live attendance log</span>
          </div>

          <div className="grid grid-cols-2 gap-3 my-auto">
            {/* Check In */}
            <div className="flex items-center gap-3 rounded-xl bg-white p-3.5 border border-slate-100 shadow-2xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <LogIn className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Check In</span>
                <span className="text-lg sm:text-xl font-bold text-slate-800 tabular-nums leading-tight block truncate">
                  {checkIn}
                </span>
              </div>
            </div>

            {/* Check Out */}
            <div className="flex items-center gap-3 rounded-xl bg-white p-3.5 border border-slate-100 shadow-2xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <LogOut className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Check Out</span>
                <span className="text-lg sm:text-xl font-bold text-slate-800 tabular-nums leading-tight block truncate">
                  {checkOut}
                </span>
              </div>
            </div>

            {/* Worked Hours */}
            <div className="flex items-center gap-3 rounded-xl bg-white p-3.5 border border-slate-100 shadow-2xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <Clock className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Worked Time</span>
                <span className="text-lg sm:text-xl font-bold text-slate-800 tabular-nums leading-tight block truncate">
                  {worked || '—'}
                </span>
              </div>
            </div>

            {/* Break */}
            <div className="flex items-center gap-3 rounded-xl bg-white p-3.5 border border-slate-100 shadow-2xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Coffee className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Break</span>
                <span className="text-lg sm:text-xl font-bold text-slate-800 tabular-nums leading-tight block truncate">
                  {today.total_break_minutes > 0 ? `${today.total_break_minutes}m` : '0m'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100/80 flex items-center justify-between text-xs text-slate-500">
            <span>Shift summary recorded</span>
            <button
              type="button"
              onClick={() => navigate('/my-attendance')}
              className="font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 transition-colors"
            >
              Full Attendance Record <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

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
    <div className="glass-card rounded-3xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <BarChart2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-800">Hours this week</span>
            <p className="text-xs text-slate-400">Mon – Sun</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-base font-extrabold text-slate-800 tabular-nums">{formatWorkedHours(totalHours) || '0h'}</span>
          <p className="text-[10px] text-slate-400 font-semibold uppercase">total</p>
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
                  <span className="text-[9px] text-slate-500 tabular-nums font-semibold">
                    {formatWorkedHours(hours) || ''}
                  </span>
                )}
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={`w-full rounded-t-xl transition-all ${
                      isToday
                        ? 'bg-blue-600 shadow-xs'
                        : hours != null
                          ? 'bg-blue-200 hover:bg-blue-300'
                          : 'bg-slate-100'
                    }`}
                    style={{ height: hours != null ? `${pct}%` : '12%', minHeight: '6px', maxHeight: '100%' }}
                  />
                </div>
                <span className={`text-[11px] font-bold ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
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
    { label: 'Days present', value: presentDays, color: 'text-blue-600', bg: 'bg-blue-50/70 border-blue-100' },
    { label: 'Hours worked', value: formatWorkedHours(totalHours) || '0h', color: 'text-sky-600', bg: 'bg-sky-50/70 border-sky-100' },
    { label: 'On leave', value: leaveDays, color: 'text-amber-600', bg: 'bg-amber-50/70 border-amber-100' },
    { label: 'Absent', value: absentDays, color: 'text-rose-600', bg: 'bg-rose-50/70 border-rose-100' },
  ]

  return (
    <div className="glass-card rounded-3xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-800">{monthName}</span>
            <p className="text-xs text-slate-400">Monthly overview</p>
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
            <div key={label} className={`rounded-2xl p-3 border ${bg} backdrop-blur-sm`}>
              <p className={`text-xl font-extrabold ${color} tabular-nums leading-none`}>{value}</p>
              <p className="text-xs text-slate-500 mt-1 font-semibold">{label}</p>
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
    <div className="glass-card rounded-3xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <IndianRupee className="h-5 w-5" />
        </div>
        <div>
          <span className="text-sm font-bold text-slate-800">Pay & Earnings</span>
          <p className="text-xs text-slate-400">Monthly payroll</p>
        </div>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">
        Your payslip is processed monthly by your salon admin.
      </p>
      <div className="mt-auto pt-2">
        <div className="h-px bg-slate-100 mb-3" />
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
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
      color: 'text-blue-600',
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
        <Zap className="h-4 w-4 text-blue-600" />
        <h2 className="text-sm font-bold text-slate-800">Quick access</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {links.map(({ label, sub, path, icon: Icon, color, bg }) => (
          <button
            key={path}
            type="button"
            onClick={() => navigate(path)}
            className="group flex min-h-[72px] items-center gap-4 rounded-3xl glass-card p-4 text-left transition-all hover:bg-white hover:scale-[1.01] hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.99]"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${bg} transition-transform group-hover:scale-105`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-800">{label}</span>
              <span className="block truncate text-xs text-slate-400 font-medium">{sub}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-600" />
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
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-50 text-pink-600">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Recent Services</h2>
            <p className="text-xs text-slate-400">Completed jobs</p>
          </div>
        </div>
        {displayServices.length > 0 && (
          <Badge variant="secondary" className="text-xs font-bold rounded-xl px-2.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100">
            {displayServices.length}{pagination.has_more ? '+' : ''}
          </Badge>
        )}
      </div>

      {isLoading && offset === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : displayServices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
          <div className="h-14 w-14 rounded-3xl bg-slate-50 flex items-center justify-center">
            <Scissors className="h-6 w-6 opacity-40 text-slate-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-600">No services yet</p>
            <p className="text-xs text-slate-400 mt-0.5">Your completed services will appear here</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {displayServices.map((svc, i) => (
            <div
              key={`${svc.id ?? i}-${i}`}
              className="group flex items-center justify-between rounded-2xl bg-white/70 hover:bg-white border border-white/80 p-3.5 transition-all hover:shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-bold text-blue-600">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">{svc.item_name}</p>
                  <p className="truncate text-xs text-slate-400">{svc.customer_name}</p>
                </div>
              </div>
              <div className="shrink-0 text-right ml-3">
                <p className="text-xs text-slate-400 font-medium whitespace-nowrap">{formatServiceDate(svc.date)}</p>
              </div>
            </div>
          ))}

          {pagination.has_more && (
            <button
              onClick={() => setOffset((p) => p + limit)}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 py-3 text-sm font-semibold text-slate-500 transition-all hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 disabled:opacity-50"
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

      {/* ── Recomposed Hero Banner with Attendance Hub ── */}
      <div id="attendance-punch" className="glass-panel rounded-3xl p-6 sm:p-8 relative overflow-hidden space-y-6">
        
        {/* Top Header: Greeting & Salon on Left, Live Clock on Right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/60">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white font-extrabold text-lg shadow-sm">
              {(firstName || 'E').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {greeting}
                </span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-100">
                  <Sparkles className="h-3 w-3" />
                  {user?.branch?.name || 'Magic Scissor'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 leading-tight tracking-tight">
                Welcome back, <span className="text-blue-700">{user?.fullName || firstName}</span>
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
                Role: <span className="capitalize font-semibold text-slate-700">{user?.role || 'Employee'}</span>
              </p>
            </div>
          </div>

          <div className="sm:self-center">
            <LiveClock />
          </div>
        </div>

        {/* Recomposed 2-Column Attendance Console */}
        <PunchPanel config={config} isLoadingConfig={isLoadingConfig} />

      </div>

      {/* ── Quick Nav ─────────────────────────────────────────────────────── */}
      <QuickNavCard />

      {/* ── Widget Grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HoursThisWeekCard userId={user?.id} />
        <ThisMonthCard />
        <PayCard />
      </div>

      {/* ── Recent Services ───────────────────────────────────────────────── */}
      <div className="glass-card rounded-3xl p-5 sm:p-6">
        <ServicesList />
      </div>
    </div>
  )
}

export default EmployeeDashboard
