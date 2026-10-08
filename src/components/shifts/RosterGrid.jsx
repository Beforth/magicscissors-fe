import { useCallback, useMemo, useRef, useState } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { shiftService } from '@/services/shift.service'
import { userService } from '@/services/user.service'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import {
  addDays, buildRange, clamp, fromDateStr, inRect, monthsOf, pasteCells, readMatrix, rect, toDateStr, weekStart,
} from '@/lib/roster'

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const employeeId = (u) => u.user_id || u.id

const HINTS = [
  [['←', '↑', '↓', '→'], 'move'],
  [['Shift', '+arrows'], 'select range'],
  [['1', '–', '9'], 'set shift'],
  [['Del'], 'clear'],
  [['f'], 'fill right'],
  [['d'], 'fill down'],
  [['Ctrl', 'C'], 'copy'],
  [['Ctrl', 'V'], 'paste'],
  [['PgUp', 'PgDn'], 'prev / next'],
  [['t'], 'today'],
]

/** Keyboard-first roster: employees as rows, days as columns, press a number to set a shift. */
export default function RosterGrid({ branchId }) {
  const queryClient = useQueryClient()
  const gridRef = useRef(null)
  const clipboard = useRef(null)
  const today = toDateStr(new Date())
  const [view, setView] = useState('week')
  const [anchor, setAnchor] = useState(weekStart(today))
  const [cursor, setCursor] = useState({ r: 0, c: 0 })
  const [sel, setSel] = useState({ r: 0, c: 0 }) // other corner of the selection
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const dates = useMemo(() => buildRange(anchor, view), [anchor, view])
  const months = useMemo(() => monthsOf(dates), [dates])

  const { data: shiftsData } = useQuery({ queryKey: ['shifts'], queryFn: () => shiftService.getShifts() })
  const shifts = useMemo(
    () => (shiftsData?.data || []).filter((s) => s.is_active).sort((a, b) => a.start_time.localeCompare(b.start_time)).slice(0, 9),
    [shiftsData]
  )
  const shiftById = useMemo(() => new Map((shiftsData?.data || []).map((s) => [s.id, s])), [shiftsData])

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', { role: 'employee,manager,cashier', branch_id: branchId || undefined }],
    queryFn: () => userService.getUsers({ role: 'employee,manager,cashier', branch_id: branchId || undefined, limit: 500 }),
  })
  // Only staff with an employee profile can be scheduled (the API rejects managers/cashiers without one).
  const allEmployees = useMemo(() => (usersData?.data || []).filter((u) => u.employee_details), [usersData])
  const employees = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? allEmployees.filter((e) => e.full_name?.toLowerCase().includes(q)) : allEmployees
  }, [allEmployees, search])
  const rowIds = useMemo(() => employees.map(employeeId), [employees])

  const assignmentQueries = useQueries({
    queries: months.map((m) => ({
      queryKey: ['shift-assignments', m],
      queryFn: () => shiftService.getAssignments({ month: m }),
    })),
  })
  const assignments = useMemo(
    () => assignmentQueries.flatMap((q) => q.data?.data || []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assignmentQueries.map((q) => q.dataUpdatedAt).join(',')]
  )
  const lookupMap = useMemo(() => new Map(assignments.map((a) => [`${a.employee_id}|${a.shift_date}`, a])), [assignments])
  const lookup = useCallback((emp, date) => lookupMap.get(`${emp}|${date}`), [lookupMap])

  const selection = rect(cursor, sel)
  const rows = rowIds.length
  const cols = dates.length

  const move = (dr, dc, extend) => {
    const next = { r: clamp(cursor.r + dr, 0, Math.max(rows - 1, 0)), c: clamp(cursor.c + dc, 0, cols - 1) }
    setCursor(next)
    if (!extend) setSel(next)
  }

  const shiftPeriod = useCallback((dir) => {
    if (view === 'month') {
      const d = fromDateStr(anchor)
      setAnchor(toDateStr(new Date(d.getFullYear(), d.getMonth() + dir, 1)))
    } else {
      setAnchor((a) => addDays(a, dir * 7))
    }
    setCursor((c) => ({ ...c, c: 0 }))
    setSel((c) => ({ ...c, c: 0 }))
  }, [view, anchor])

  const switchView = (next) => {
    setView(next)
    setAnchor(next === 'month' ? `${today.slice(0, 7)}-01` : weekStart(today))
    setCursor({ r: 0, c: 0 }); setSel({ r: 0, c: 0 })
  }

  // Write a list of { employeeId, date, shiftId|null } and refresh once.
  const apply = async (cells) => {
    const ops = cells.filter((cell) => (lookup(cell.employeeId, cell.date)?.shift_id ?? null) !== cell.shiftId)
    if (!ops.length) return
    setSaving(true)
    const results = await Promise.allSettled(
      ops.map((cell) => {
        const existing = lookup(cell.employeeId, cell.date)
        if (cell.shiftId) return shiftService.assignShift(cell.employeeId, cell.shiftId, cell.date)
        return existing ? shiftService.removeAssignment(existing.id) : Promise.resolve()
      })
    )
    await queryClient.invalidateQueries({ queryKey: ['shift-assignments'] })
    queryClient.invalidateQueries({ queryKey: ['attendance-monthly-self'] })
    setSaving(false)
    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length) {
      toast.error(failed[0].reason?.response?.data?.error?.message || `${failed.length} change(s) failed`)
    } else {
      toast.success(`${ops.length} day${ops.length > 1 ? 's' : ''} updated`)
    }
  }

  const selectedCells = (shiftId) => {
    const cells = []
    for (let r = selection.r0; r <= selection.r1; r++) {
      for (let c = selection.c0; c <= selection.c1; c++) cells.push({ employeeId: rowIds[r], date: dates[c], shiftId })
    }
    return cells
  }

  const onKeyDown = (e) => {
    if (!rows) return
    const k = e.key
    const mod = e.ctrlKey || e.metaKey
    let handled = true

    if (mod && k.toLowerCase() === 'c') {
      clipboard.current = readMatrix(selection, rowIds, dates, lookup)
      toast.message('Copied')
    } else if (mod && k.toLowerCase() === 'v') {
      if (clipboard.current) apply(pasteCells(clipboard.current, { r: selection.r0, c: selection.c0 }, rowIds, dates))
    } else if (mod || e.altKey) {
      handled = false
    } else if (k === 'ArrowLeft' || k === 'h') move(0, -1, e.shiftKey)
    else if (k === 'ArrowRight' || k === 'l') move(0, 1, e.shiftKey)
    else if (k === 'ArrowUp' || k === 'k') move(-1, 0, e.shiftKey)
    else if (k === 'ArrowDown' || k === 'j') move(1, 0, e.shiftKey)
    else if (k === 'Home') { const n = { r: cursor.r, c: 0 }; setCursor(n); if (!e.shiftKey) setSel(n) }
    else if (k === 'End') { const n = { r: cursor.r, c: cols - 1 }; setCursor(n); if (!e.shiftKey) setSel(n) }
    else if (k === 'PageDown') shiftPeriod(1)
    else if (k === 'PageUp') shiftPeriod(-1)
    else if (k === 't') {
      const idx = dates.indexOf(today)
      if (idx >= 0) { const n = { r: cursor.r, c: idx }; setCursor(n); setSel(n) } else { setAnchor(view === 'month' ? `${today.slice(0, 7)}-01` : weekStart(today)) }
    } else if (k === 'Escape') setSel(cursor)
    else if (/^[1-9]$/.test(k)) {
      const shift = shifts[Number(k) - 1]
      if (shift) apply(selectedCells(shift.id)); else toast.error(`No shift #${k}`)
    } else if (k === 'Delete' || k === 'Backspace' || k === '0') apply(selectedCells(null))
    else if (k === 'f') {
      const v = lookup(rowIds[cursor.r], dates[cursor.c])?.shift_id ?? null
      apply(dates.slice(cursor.c).map((date) => ({ employeeId: rowIds[cursor.r], date, shiftId: v })))
    } else if (k === 'd') {
      const v = lookup(rowIds[cursor.r], dates[cursor.c])?.shift_id ?? null
      apply(rowIds.map((id) => ({ employeeId: id, date: dates[cursor.c], shiftId: v })))
    } else handled = false

    if (handled) e.preventDefault()
  }

  const coverage = useMemo(
    () => dates.map((d) => rowIds.filter((id) => lookup(id, d)).length),
    [dates, rowIds, lookup]
  )
  const emptyCount = useMemo(
    () => rowIds.reduce((n, id) => n + dates.filter((d) => d >= today && !lookup(id, d)).length, 0),
    [rowIds, dates, lookup, today]
  )

  const title = view === 'month'
    ? fromDateStr(anchor).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : `${fromDateStr(dates[0]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${fromDateStr(dates[6]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-md border bg-background">
          <Button variant="ghost" size="icon" aria-label="Previous" onClick={() => shiftPeriod(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[170px] px-2 text-center text-sm font-semibold">{title}</span>
          <Button variant="ghost" size="icon" aria-label="Next" onClick={() => shiftPeriod(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex rounded-md border bg-secondary p-0.5">
          {['week', 'month'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { switchView(v); gridRef.current?.focus() }}
              className={cn('rounded px-3 py-1 text-[13px] font-medium capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                view === v ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {v}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCursor({ r: 0, c: cursor.c }); setSel({ r: 0, c: cursor.c }) }}
          onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); gridRef.current?.focus() } }}
          placeholder="Find employee…  (/)"
          aria-label="Find employee"
          className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/15"
        />
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {saving && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>}
        </div>
      </div>

      {/* Legend = the number keys */}
      <div className="flex flex-wrap items-center gap-2" aria-label="Shift keys">
        {shifts.length === 0 && <p className="text-sm text-muted-foreground">Create a shift in the “Shifts” tab first.</p>}
        {shifts.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => { apply(selectedCells(s.id)); gridRef.current?.focus() }}
            className="inline-flex items-center gap-2 rounded-md border bg-card px-2.5 py-1 text-[13px] outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Kbd>{i + 1}</Kbd>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color_code }} />
            <span className="font-medium">{s.name}</span>
            <span className="text-xs text-muted-foreground">{s.start_time}–{s.end_time}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => { apply(selectedCells(null)); gridRef.current?.focus() }}
          className="inline-flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1 text-[13px] text-muted-foreground outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Kbd>Del</Kbd> Clear
        </button>
      </div>

      {emptyCount > 0 && (
        <p className="rounded-md border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-foreground">
          {emptyCount} upcoming day{emptyCount > 1 ? 's have' : ' has'} no shift in this view. Without a shift, no late penalty is calculated for that day.
        </p>
      )}

      {/* Grid */}
      <div className="overflow-auto rounded-xl border bg-card">
        {usersLoading ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !rows ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No employees to schedule.</p>
        ) : (
          <div
            ref={gridRef}
            role="grid"
            tabIndex={0}
            aria-label="Shift roster. Arrow keys move, number keys set a shift, Delete clears."
            onKeyDown={onKeyDown}
            className="min-w-max outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <div role="row" className="sticky top-0 z-10 flex border-b bg-secondary/80 backdrop-blur">
              <div className="sticky left-0 z-20 w-44 shrink-0 bg-secondary px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Employee</div>
              {dates.map((d, c) => {
                const dt = fromDateStr(d)
                const weekend = dt.getDay() === 0
                return (
                  <div key={d} role="columnheader" className={cn('w-24 shrink-0 px-2 py-2 text-center text-xs', d === today && 'text-primary font-semibold', weekend && 'text-destructive', c === cursor.c && 'bg-accent')}>
                    <div className="font-medium">{DAY[dt.getDay()]}</div>
                    <div className="text-[11px] opacity-80">{dt.getDate()} {dt.toLocaleDateString('en-IN', { month: 'short' })}</div>
                  </div>
                )
              })}
            </div>

            {employees.map((emp, r) => {
              const id = employeeId(emp)
              return (
                <div key={id} role="row" className="flex border-b last:border-b-0">
                  <div className={cn('sticky left-0 z-10 w-44 shrink-0 truncate bg-card px-3 py-2 text-sm', r === cursor.r && 'bg-accent font-medium')}>
                    {emp.full_name}
                    <span className="block text-[11px] text-muted-foreground">{emp.employee_details?.employee_code || emp.role}</span>
                  </div>
                  {dates.map((d, c) => {
                    const a = lookup(id, d)
                    const shift = a ? shiftById.get(a.shift_id) : null
                    const selected = inRect(selection, r, c)
                    const isCursor = r === cursor.r && c === cursor.c
                    return (
                      <div
                        key={d}
                        role="gridcell"
                        aria-selected={selected}
                        onMouseDown={(e) => {
                          const n = { r, c }
                          setCursor(n)
                          if (!e.shiftKey) setSel(n)
                          gridRef.current?.focus()
                        }}
                        className={cn(
                          'grid h-14 w-24 shrink-0 cursor-pointer place-items-center border-l px-1 text-center',
                          selected && 'bg-primary/10',
                          isCursor && 'outline outline-2 -outline-offset-2 outline-primary'
                        )}
                      >
                        {shift ? (
                          <div className="w-full truncate rounded px-1.5 py-1 text-[11px] font-medium leading-tight text-white" style={{ backgroundColor: shift.color_code }}>
                            {shift.name}
                            <span className="block text-[10px] font-normal opacity-90">{shift.start_time}–{shift.end_time}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">{d >= today ? '—' : ''}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            <div role="row" className="flex border-t bg-secondary/50 text-[11px] text-muted-foreground">
              <div className="sticky left-0 z-10 w-44 shrink-0 bg-secondary px-3 py-1.5">Scheduled</div>
              {coverage.map((n, c) => (
                <div key={dates[c]} className={cn('w-24 shrink-0 py-1.5 text-center', n < rows && dates[c] >= today && 'text-warning font-medium')}>
                  {n}/{rows}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Key hints */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {HINTS.map(([keys, label]) => (
          <span key={label} className="inline-flex items-center gap-1">
            {keys.map((k) => <Kbd key={k}>{k}</Kbd>)} {label}
          </span>
        ))}
      </div>
    </div>
  )
}
