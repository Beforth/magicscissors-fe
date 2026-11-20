import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { reportsService } from '@/services/reports.service'
import { Empty, ReportError, ReportLoading } from './ReportKit'

export const KIND_LABEL = { present: 'Present', half_day: 'Half day', leave: 'On leave', absent: 'Absent', unmarked: 'Not marked' }
export const KIND_TONE = {
  present: 'bg-emerald-100 text-emerald-800',
  half_day: 'bg-amber-100 text-amber-800',
  leave: 'bg-sky-100 text-sky-800',
  absent: 'bg-rose-100 text-rose-800',
  unmarked: 'bg-muted text-muted-foreground',
}
export const DRILL_TITLE = {
  present: 'Present days', late: 'Late days', half_day: 'Half days', leave: 'Days on leave', absent: 'Absent days', overtime: 'Overtime days',
}

/** "Morning 09:00-18:00", "09:00-20:00" or "Flexible" for the shift an attendance row belongs to. */
export const shiftLabel = (sh) => (sh ? [sh.name, sh.start && sh.end ? `${sh.start}-${sh.end}` : null].filter(Boolean).join(' ') : '')
/** Stored times are IST wall clock: the digits are the time on the clock. */
export const hhmm = (iso) => (iso ? String(iso).slice(11, 16) : '')
const longDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export function KindBadge({ row }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_TONE[row.kind]}`}>{KIND_LABEL[row.kind] || row.kind}</span>
      {row.late && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">Late</span>}
      {row.overtime && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">Overtime</span>}
    </span>
  )
}

/** Right-hand drawer: the days behind one number of the summary, for one person. Read-only; fix times on the Attendance page. */
export function DaysDrawer({ employeeId, name, kind, from, to, branchId, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hub-attendance', 'days', employeeId, kind, from, to, branchId],
    queryFn: () => reportsService.hubAttendanceDays({ employee_id: employeeId, kind, start_date: from, end_date: to, branch_id: branchId || undefined }).then((r) => r.data),
  })
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${name} days`}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-lg flex-col bg-background shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b p-4">
          <div>
            <h2 className="text-base font-bold">{name}</h2>
            <p className="text-sm text-muted-foreground">{DRILL_TITLE[kind] || 'Days'} · {from} to {to}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? <ReportLoading /> : error ? <ReportError error={error} retry={refetch} /> : data.days.length === 0 ? <Empty>No such days in this period.</Empty> : (
            <ul className="space-y-2">
              {data.days.map((d) => (
                <li key={`${d.date}-${d.branch_id}`} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{longDate(d.date)}</span>
                    <KindBadge row={d} />
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>In: <b className="text-foreground">{hhmm(d.check_in) || '—'}</b></span>
                    <span>Out: <b className="text-foreground">{hhmm(d.check_out) || '—'}</b></span>
                    <span>Worked: <b className="text-foreground">{d.hours ? `${d.hours} h` : '—'}</b></span>
                    <span>Shift: <b className="text-foreground">{shiftLabel(d.shift || d.planned_shift) || '—'}</b></span>
                    {d.late_amount > 0 && <span>Late fine: <b className="text-foreground">₹{d.late_amount}</b></span>}
                    {d.overtime_hours > 0 && <span>Overtime: <b className="text-foreground">{d.overtime_hours} h</b></span>}
                    {d.break_minutes > 0 && <span>Breaks: <b className="text-foreground">{d.break_minutes} min</b></span>}
                    {d.branch && <span>Branch: <b className="text-foreground">{d.branch}</b></span>}
                  </div>
                  {d.notes && <p className="mt-1.5 text-xs text-muted-foreground">{d.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}
