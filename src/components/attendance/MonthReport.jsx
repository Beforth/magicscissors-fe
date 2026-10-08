import { useMemo, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import { formatHours, formatDeduction, formatRupees } from '@/lib/attendanceDay'
import { clamp } from '@/lib/roster'

const CHIP = {
  present: { text: 'P', cls: 'bg-success/15 text-success' },
  late: { text: 'L', cls: 'bg-warning/15 text-warning' },
  half_day: { text: '½', cls: 'bg-info/15 text-info' },
  absent: { text: 'A', cls: 'bg-destructive/15 text-destructive' },
  on_leave: { text: 'LV', cls: 'bg-secondary text-muted-foreground' },
}

const hhmm = (iso) => {
  const m = String(iso || '').match(/(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : '—'
}

export function summarizeEmployee(records) {
  const count = (fn) => records.filter(fn).length
  return {
    present: count((r) => ['present', 'late'].includes(r.status)),
    half: count((r) => r.status === 'half_day'),
    leave: count((r) => r.status === 'on_leave'),
    absent: count((r) => r.status === 'absent'),
    hours: records.reduce((s, r) => s + (Number(r.working_hours) || 0), 0),
    lateDays: count((r) => Number(r.late_penalty_hours) > 0 || Number(r.late_penalty_amount) > 0),
    penalty: records.reduce((s, r) => s + (Number(r.late_penalty_hours) || 0), 0),
    fine: records.reduce((s, r) => s + (Number(r.late_penalty_amount) || 0), 0),
  }
}

/** All employees × days for a month, with per-employee totals. Arrow keys move, Enter opens the day. */
export default function MonthReport({ month, employees, attendance, search, onOpenDay }) {
  const ref = useRef(null)
  const [cursor, setCursor] = useState({ r: 0, c: 0 })
  const [y, m] = month.split('-').map(Number)
  const days = useMemo(() => Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => i + 1), [y, m])
  const dateOf = (d) => `${month}-${String(d).padStart(2, '0')}`
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  const byEmp = useMemo(() => {
    const map = new Map()
    attendance.forEach((a) => {
      if (!map.has(a.employee_id)) map.set(a.employee_id, new Map())
      map.get(a.employee_id).set(a.date, a)
    })
    return map
  }, [attendance])

  const rows = useMemo(() => {
    const q = (search || '').trim().toLowerCase()
    return employees.filter((e) => !q || e.full_name?.toLowerCase().includes(q) || e.employee_code?.toLowerCase().includes(q))
  }, [employees, search])

  const onKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !rows.length) return
    const k = e.key
    let { r, c } = cursor
    if (k === 'ArrowLeft' || k === 'h') c -= 1
    else if (k === 'ArrowRight' || k === 'l') c += 1
    else if (k === 'ArrowUp' || k === 'k') r -= 1
    else if (k === 'ArrowDown' || k === 'j') r += 1
    else if (k === 'Home') c = 0
    else if (k === 'End') c = days.length - 1
    else if (k === 't') { const i = days.indexOf(Number(today.slice(8))); if (today.startsWith(month) && i >= 0) c = i }
    else if (k === 'Enter') {
      e.preventDefault()
      onOpenDay(dateOf(days[cursor.c]), rows[cursor.r].employee_details_id)
      return
    } else return
    e.preventDefault()
    setCursor({ r: clamp(r, 0, rows.length - 1), c: clamp(c, 0, days.length - 1) })
  }

  const exportCsv = () => {
    const head = ['Employee', 'Code', ...days.map(String), 'Present', 'Half days', 'Leave', 'Absent', 'Hours', 'Late days', 'Penalty hours', 'Fine (₹)']
    const lines = rows.map((emp) => {
      const recs = byEmp.get(emp.employee_details_id) || new Map()
      const list = [...recs.values()]
      const s = summarizeEmployee(list)
      const cells = days.map((d) => recs.get(dateOf(d))?.status || '')
      return [emp.full_name, emp.employee_code, ...cells, s.present, s.half, s.leave, s.absent, s.hours.toFixed(2), s.lateDays, s.penalty.toFixed(2), s.fine.toFixed(2)]
    })
    const csv = [head, ...lines].map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `attendance-${month}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (!rows.length) return <p className="py-12 text-center text-sm text-muted-foreground">No employees found.</p>

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1"><Kbd>←</Kbd><Kbd>→</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
          <span className="inline-flex items-center gap-1"><Kbd>Enter</Kbd> open day</span>
          <span className="inline-flex items-center gap-1"><Kbd>t</Kbd> today</span>
          <span><b className="text-success">P</b> present · <b className="text-info">½</b> half day · <b className="text-destructive">A</b> absent · <b>LV</b> leave · <b className="text-warning">−1h</b> late deduction</span>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</Button>
      </div>

      <div className="overflow-auto rounded-xl border bg-card">
        <div ref={ref} role="grid" tabIndex={0} onKeyDown={onKeyDown} aria-label="Monthly attendance report" className="min-w-max outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
          <div role="row" className="sticky top-0 z-10 flex border-b bg-secondary/80 text-[11px] font-medium text-muted-foreground backdrop-blur">
            <div className="sticky left-0 z-20 w-44 shrink-0 bg-secondary px-3 py-2 uppercase tracking-wider">Employee</div>
            {days.map((d, c) => (
              <div key={d} className={cn('w-11 shrink-0 py-2 text-center', dateOf(d) === today && 'text-primary font-semibold', c === cursor.c && 'bg-accent')}>
                {d}
                <div className="text-[9px] opacity-70">{['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(y, m - 1, d).getDay()]}</div>
              </div>
            ))}
            {['Pres', '½', 'Leave', 'Abs', 'Hours', 'Late', 'Penalty'].map((h) => (
              <div key={h} className="w-16 shrink-0 border-l bg-secondary py-2 text-center uppercase tracking-wider">{h}</div>
            ))}
          </div>

          {rows.map((emp, r) => {
            const recs = byEmp.get(emp.employee_details_id) || new Map()
            const s = summarizeEmployee([...recs.values()])
            return (
              <div key={emp.employee_details_id} role="row" className="flex border-b last:border-b-0">
                <div className={cn('sticky left-0 z-10 w-44 shrink-0 truncate bg-card px-3 py-1.5 text-sm', r === cursor.r && 'bg-accent font-medium')}>
                  {emp.full_name}
                  <span className="block text-[11px] text-muted-foreground">{emp.employee_code}</span>
                </div>
                {days.map((d, c) => {
                  const rec = recs.get(dateOf(d))
                  const chip = rec && CHIP[rec.status]
                  const pen = Number(rec?.late_penalty_hours) || 0
                  const fine = Number(rec?.late_penalty_amount) || 0
                  const isCursor = r === cursor.r && c === cursor.c
                  return (
                    <div
                      key={d}
                      role="gridcell"
                      title={rec ? `${rec.status.replace('_', ' ')} · in ${hhmm(rec.check_in)} out ${hhmm(rec.check_out)}${pen || fine ? ` · −${formatDeduction(pen, fine)} late` : ''}` : 'No record'}
                      onMouseDown={() => { setCursor({ r, c }); ref.current?.focus() }}
                      onDoubleClick={() => onOpenDay(dateOf(d), emp.employee_details_id)}
                      className={cn('grid h-11 w-11 shrink-0 cursor-pointer place-items-center border-l', isCursor && 'outline outline-2 -outline-offset-2 outline-primary')}
                    >
                      {chip ? (
                        <span className={cn('rounded px-1 text-center text-[11px] font-bold leading-4', chip.cls)}>
                          {chip.text}
                          {(pen > 0 || fine > 0) && <span className="block text-[9px] font-semibold text-warning">−{fine > 0 ? formatRupees(fine) : formatHours(pen).replace(' ', '')}</span>}
                        </span>
                      ) : <span className="text-xs text-muted-foreground/40">·</span>}
                    </div>
                  )
                })}
                <div className="grid w-16 shrink-0 place-items-center border-l text-sm font-semibold">{s.present}</div>
                <div className="grid w-16 shrink-0 place-items-center border-l text-sm">{s.half}</div>
                <div className="grid w-16 shrink-0 place-items-center border-l text-sm">{s.leave}</div>
                <div className="grid w-16 shrink-0 place-items-center border-l text-sm">{s.absent}</div>
                <div className="grid w-16 shrink-0 place-items-center border-l text-sm tabular-nums">{formatHours(s.hours)}</div>
                <div className="grid w-16 shrink-0 place-items-center border-l text-sm">{s.lateDays}</div>
                <div className={cn('grid w-16 shrink-0 place-items-center border-l px-1 text-center text-xs font-semibold leading-tight', (s.penalty > 0 || s.fine > 0) && 'text-warning')}>{s.penalty > 0 || s.fine > 0 ? `−${formatDeduction(s.penalty, s.fine)}` : '0'}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
