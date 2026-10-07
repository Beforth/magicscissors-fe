import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, ChevronRight, Download, Calendar, Clock, BarChart2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { attendanceService } from '@/services/attendance.service'
import { useGeolocation } from '@/hooks/useGeolocation'
import { getPunchGate } from '@/lib/geofence'
import SelfieCapture from '@/components/attendance/SelfieCapture'
import { formatWorkedHours } from '@/lib/utils'

const STATUS_LABELS = {
  not_arrived: 'Not checked in',
  on_floor: 'Checked in',
  on_break: 'On break',
  checked_out: 'Checked out',
  on_leave: 'On leave',
}

const STATUS_PILL_STYLES = {
  not_arrived: { label: 'Not checked in', text: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500', ring: 'ring-amber-200' },
  on_floor: { label: 'On Floor', text: 'text-blue-700', bg: 'bg-blue-50', dot: 'bg-blue-500', ring: 'ring-blue-200' },
  on_break: { label: 'On Break', text: 'text-sky-700', bg: 'bg-sky-50', dot: 'bg-sky-500', ring: 'ring-sky-200' },
  checked_out: { label: 'Checked Out', text: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400', ring: 'ring-slate-200' },
  on_leave: { label: 'On Leave', text: 'text-rose-700', bg: 'bg-rose-50', dot: 'bg-rose-500', ring: 'ring-rose-200' },
}

function formatTimeStored(iso) {
  if (!iso) return '—'
  const m = String(iso).match(/(\d{2}):(\d{2})/)
  if (m) return `${m[1]}:${m[2]}`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

const getShopDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

const statusColors = {
  present: 'bg-emerald-600',
  late: 'bg-amber-500',
  half_day: 'bg-sky-500',
  absent: 'bg-rose-500',
  on_leave: 'bg-indigo-500',
}

function monthLabel(month) {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

function shiftMonth(month, offset) {
  const [year, monthNumber] = month.split('-').map(Number)
  const next = new Date(year, monthNumber - 1 + offset, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

export default function MyAttendancePage() {
  const queryClient = useQueryClient()
  const geo = useGeolocation()
  const [selfieOpen, setSelfieOpen] = useState(false)
  const [installEvent, setInstallEvent] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(() => getShopDate().slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(getShopDate)
  const inFlight = useRef(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['self-config'],
    queryFn: attendanceService.getSelfConfig,
    staleTime: 0,
    refetchInterval: 60000,
  })
  const config = data?.data

  const { data: monthlyData, isLoading: isLoadingMonth } = useQuery({
    queryKey: ['attendance-monthly-self', selectedMonth],
    queryFn: () => attendanceService.getMonthlyAttendance({ month: selectedMonth }),
    staleTime: 5 * 60_000,
  })
  const monthAttendance = monthlyData?.data?.attendance || []
  const selectedRecord = monthAttendance.find((record) => record.date === selectedDate)

  // Compute monthly stats
  const presentDays = monthAttendance.filter((a) => ['present', 'late'].includes(a.status)).length
  const totalHours = monthAttendance.reduce((s, a) => s + (a.working_hours ? parseFloat(a.working_hours) : 0), 0)
  const onLeaveDays = monthAttendance.filter((a) => a.status === 'on_leave').length
  const absentDays = monthAttendance.filter((a) => a.status === 'absent').length

  const [year, monthNumber] = selectedMonth.split('-').map(Number)
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay()
  const calendarCells = [
    ...Array.from({ length: firstWeekday }, (_, i) => ({ key: `blank-${i}` })),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      return { key: `${selectedMonth}-${String(day).padStart(2, '0')}`, day, date: `${selectedMonth}-${String(day).padStart(2, '0')}` }
    }),
  ]
  while (calendarCells.length % 7 !== 0) calendarCells.push({ key: `tail-${calendarCells.length}` })

  const mutation = useMutation({
    mutationFn: (formData) => attendanceService.selfPunch(formData),
    onSettled: () => {
      inFlight.current = false
    },
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
  const canPunchState = status === 'not_arrived' || status === 'on_floor'
  const punchType = isOut ? 'out' : 'in'

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
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  if ((isError && !data) || !config) {
    return <p className="p-6 text-sm text-destructive">Could not load attendance settings. Please try again.</p>
  }

  const todayStr = getShopDate()
  const todayFormatted = new Date(`${todayStr}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const currentStatusMeta = STATUS_PILL_STYLES[status] || STATUS_PILL_STYLES.not_arrived

  return (
    <div className="w-full space-y-6">
      {/* Top Banner */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Attendance & Shifts
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
              My Attendance
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Daily check-in, shift hours, and monthly attendance tracking
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 shadow-2xs ${currentStatusMeta.bg} ${currentStatusMeta.text} ${currentStatusMeta.ring}`}>
              <span className={`h-2 w-2 rounded-full ${currentStatusMeta.dot} ${status === 'on_floor' ? 'animate-pulse' : ''}`} />
              {currentStatusMeta.label}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left = Today's Punch Card, Right = Monthly Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Today's Shift & Punch Actions */}
        <div className="lg:col-span-5 space-y-5">
          {/* Today Card */}
          <div className="glass-card rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/70">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Today's Shift</span>
                <p className="text-base font-bold text-slate-800">{todayFormatted}</p>
              </div>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                {STATUS_LABELS[status] || status}
              </span>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-white/70 border border-white/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Check In</span>
                <span className="text-lg font-bold text-slate-800 tabular-nums">{formatTimeStored(config.today?.check_in)}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/70 border border-white/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Check Out</span>
                <span className="text-lg font-bold text-slate-800 tabular-nums">{formatTimeStored(config.today?.check_out)}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/70 border border-white/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Worked</span>
                <span className="text-lg font-bold text-blue-700 tabular-nums">{formatWorkedHours(config.today?.working_hours) || '—'}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/70 border border-white/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Break</span>
                <span className="text-lg font-bold text-amber-600 tabular-nums">{config.today?.total_break_minutes > 0 ? `${config.today.total_break_minutes}m` : '0m'}</span>
              </div>
            </div>

            {/* Punch Action Button */}
            <div className="pt-1 space-y-2.5">
              <Button
                size="lg"
                disabled={!gate.allowed || !canPunchState}
                onClick={handlePunch}
                className={`h-13 w-full rounded-2xl text-base font-bold tracking-wide shadow-md transition-all active:scale-[0.98] ${
                  isOut
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {mutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : null}
                {isOut ? 'Punch Out' : 'Punch In'}
              </Button>

              {gate.reason && (
                <p className="text-center text-xs font-semibold text-slate-500">{gate.reason}</p>
              )}

              {!canPunchState && (
                <p className="text-center text-xs font-medium text-slate-500">
                  {status === 'on_break'
                    ? 'Finish your break before checking out'
                    : status === 'checked_out'
                      ? 'You have checked out for today'
                      : 'You are on leave today'}
                </p>
              )}

              {geo.position && (
                <p className="text-center text-[11px] text-slate-400">
                  {gate.nearest ? `${gate.nearest.distanceM} m from ${gate.nearest.name} · ` : ''}
                  GPS accuracy ±{Math.round(geo.position.accuracy)} m
                </p>
              )}
            </div>
          </div>

          {/* Month Overview Mini-Card */}
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/60">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {monthLabel(selectedMonth)} Summary
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-400 bg-white/70 px-2.5 py-0.5 rounded-full border border-white/80">
                Monthly Log
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Days Present</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-emerald-700 leading-none">{presentDays}</span>
                  <span className="text-xs font-semibold text-slate-400">days</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-100 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hours Worked</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-blue-700 leading-none">{formatWorkedHours(totalHours) || '0h'}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-100 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">On Leave</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-amber-700 leading-none">{onLeaveDays}</span>
                  <span className="text-xs font-semibold text-slate-400">days</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-100 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Absent</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-rose-700 leading-none">{absentDays}</span>
                  <span className="text-xs font-semibold text-slate-400">days</span>
                </div>
              </div>
            </div>

            {/* Attendance Rate Pill Bar */}
            <div className="p-3 rounded-2xl bg-white/70 border border-white/80 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Recorded Log Entries</span>
              <span className="font-bold text-slate-700">
                {monthAttendance.length} records in {monthLabel(selectedMonth).split(' ')[0]}
              </span>
            </div>
          </div>

          {/* Install prompt if available */}
          {showInstall && (
            <div className="glass-card rounded-3xl p-4 text-sm flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-600">Install salon app on your device</span>
              {installEvent ? (
                <Button size="sm" variant="outline" onClick={handleInstall} className="rounded-xl text-xs font-bold">
                  <Download className="h-3.5 w-3.5 mr-1" /> Install
                </Button>
              ) : (
                <span className="text-xs text-slate-400">Share → Add to Home Screen</span>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Interactive Monthly Attendance Calendar */}
        <div className="lg:col-span-7 space-y-5">
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-3.5">
            {/* Header & Month Navigator */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/70">
              <div>
                <h2 className="text-base font-bold text-slate-800">Attendance Calendar</h2>
                <p className="text-xs text-slate-400 font-medium">Click any date to view shift records</p>
              </div>

              {/* Month Switcher Controls */}
              <div className="flex items-center gap-1 bg-white/75 border border-white/80 rounded-2xl p-1 shadow-2xs self-start sm:self-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  onClick={() => {
                    const next = shiftMonth(selectedMonth, -1)
                    setSelectedMonth(next)
                    setSelectedDate(`${next}-01`)
                  }}
                >
                  <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
                </Button>
                <span className="px-2 text-xs font-bold text-slate-800 min-w-[110px] text-center">
                  {monthLabel(selectedMonth)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  onClick={() => {
                    const next = shiftMonth(selectedMonth, 1)
                    setSelectedMonth(next)
                    setSelectedDate(`${next}-01`)
                  }}
                >
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                </Button>
              </div>
            </div>

            {/* Calendar Grid (Reduced height and compact cell spacing) */}
            <div className="w-full max-w-sm sm:max-w-md mx-auto space-y-1">
              <div className="grid grid-cols-7 gap-1 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <span key={d} className="py-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {d}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {calendarCells.map((cell) => {
                  if (!cell.day) return <span key={cell.key} aria-hidden="true" className="h-7 sm:h-8 w-7 sm:w-8 mx-auto" />
                  const record = monthAttendance.find((item) => item.date === cell.date)
                  const isToday = cell.date === getShopDate()
                  const isSelected = cell.date === selectedDate
                  const dotColor = statusColors[record?.status]

                  return (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => setSelectedDate(cell.date)}
                      className={`relative flex h-7 sm:h-8 w-7 sm:w-8 mx-auto flex-col items-center justify-center rounded-lg text-xs font-semibold transition-all duration-150 ${
                        isSelected
                          ? 'bg-blue-600 font-extrabold text-white shadow-xs shadow-blue-500/25 scale-105 z-10'
                          : isToday
                            ? 'border border-blue-500 font-extrabold text-blue-700 bg-blue-50/70'
                            : 'text-slate-700 bg-white/60 hover:bg-white hover:text-slate-900 border border-white/60'
                      }`}
                    >
                      <span className="leading-none text-[11px] sm:text-xs">{cell.day}</span>
                      {dotColor && (
                        <span className={`absolute bottom-0.5 h-1 w-1 rounded-full ${isSelected ? 'bg-white' : dotColor}`} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Status Legend */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-white/70 text-[11px] font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600" /> Present
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Late
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-500" /> Leave
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Absent
              </span>
            </div>

            {/* Selected Day Details Card (Optimized full-width layout without empty vertical space) */}
            <div className="w-full rounded-2xl bg-white/80 border border-white/90 p-3.5 sm:p-4 shadow-2xs">
              {isLoadingMonth ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                </div>
              ) : selectedRecord ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <p className="text-sm font-bold text-slate-800">
                        {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-IN', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize text-white ${statusColors[selectedRecord.status] || 'bg-slate-500'}`}>
                      {selectedRecord.status?.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="rounded-xl bg-slate-50/80 p-2.5 border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Check In</span>
                      <span className="text-sm font-bold text-slate-800 tabular-nums mt-0.5 block">
                        {formatTimeStored(selectedRecord.check_in)}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50/80 p-2.5 border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Check Out</span>
                      <span className="text-sm font-bold text-slate-800 tabular-nums mt-0.5 block">
                        {formatTimeStored(selectedRecord.check_out)}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50/80 p-2.5 border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Hours</span>
                      <span className="text-sm font-bold text-blue-700 tabular-nums mt-0.5 block">
                        {formatWorkedHours(selectedRecord.working_hours) || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 py-1 px-1">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-700 truncate">
                        No attendance record for this day
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-IN', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-slate-400 bg-slate-100/80 px-2.5 py-1 rounded-full">
                    No punch
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
