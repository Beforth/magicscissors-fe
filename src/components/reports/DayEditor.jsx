import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { attendanceService } from '@/services/attendance.service'
import { KIND_LABEL, hhmm } from './AttendanceBits'

const dayLabel = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const inputCls = 'h-9 w-full rounded-md border bg-background px-2 text-sm'

/**
 * Fix one person's one day from a report: set check-in / check-out, mark present, on leave or absent.
 * Uses the same endpoints as the Attendance page, so the same rules apply (edit window, no future times).
 */
export default function DayEditor({ employeeId, name, date, row, onClose, onSaved }) {
  const qc = useQueryClient()
  const [inTime, setInTime] = useState(hhmm(row?.check_in))
  const [outTime, setOutTime] = useState(hhmm(row?.check_out))
  const [reason, setReason] = useState(row?.notes || '')
  const status = row?.kind
  const nonWorking = !status || status === 'unmarked' || status === 'absent' || status === 'leave'

  const done = async (msg) => {
    toast.success(msg)
    await qc.invalidateQueries({ queryKey: ['hub-attendance'] })
    qc.invalidateQueries({ queryKey: ['attendance-today'] })
    qc.invalidateQueries({ queryKey: ['attendance-monthly'] })
    onSaved?.()
    onClose()
  }
  const fail = (e) => toast.error(e?.response?.data?.error?.message || 'Could not save')

  const times = useMutation({
    mutationFn: () => attendanceService.updateTimes({
      employee_id: employeeId,
      attendance_date: date,
      check_in: inTime ? `${date}T${inTime}:00` : undefined,
      check_out: outTime ? `${date}T${outTime}:00` : null,
      mark_present: nonWorking ? true : undefined,
    }),
    onSuccess: () => done('Times saved'),
    onError: fail,
  })
  const mark = useMutation({
    mutationFn: (s) => attendanceService.markLeave({ employee_id: employeeId, shop_date: date, reason: reason || undefined, status: s }),
    onSuccess: (_r, s) => done(s === 'absent' ? 'Marked absent' : 'Marked on leave'),
    onError: fail,
  })
  const busy = times.isPending || mark.isPending
  const canSaveTimes = !!inTime && (!outTime || outTime > inTime)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Edit ${name}`}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md space-y-4 rounded-xl bg-background p-5 shadow-xl">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold">{name}</h3>
            <p className="text-sm text-muted-foreground">{dayLabel(date)} · now: {KIND_LABEL[status] || 'Not marked'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
        </header>

        <section className="space-y-2">
          <h4 className="text-sm font-semibold">{nonWorking ? 'Mark present with times' : 'Punch times'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">Check in
              <input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} className={inputCls} />
            </label>
            <label className="text-xs text-muted-foreground">Check out (optional)
              <input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} className={inputCls} />
            </label>
          </div>
          {outTime && inTime && outTime <= inTime && <p className="text-xs text-rose-600">Check-out must be after check-in.</p>}
          <button type="button" disabled={busy || !canSaveTimes} onClick={() => times.mutate()} className="h-9 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {times.isPending ? 'Saving…' : nonWorking ? 'Mark present' : 'Save times'}
          </button>
        </section>

        <section className="space-y-2 border-t pt-3">
          <h4 className="text-sm font-semibold">Or mark the day</h4>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason / note (optional)" className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={busy} onClick={() => mark.mutate('on_leave')} className="h-9 rounded-md border text-sm font-semibold hover:bg-accent disabled:opacity-50">On leave</button>
            <button type="button" disabled={busy} onClick={() => mark.mutate('absent')} className="h-9 rounded-md border text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Absent</button>
          </div>
          <p className="text-xs text-muted-foreground">A day that already has punches can't be marked absent: change the times instead.</p>
        </section>
      </div>
    </div>
  )
}
