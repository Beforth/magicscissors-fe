import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsService } from '@/services/reports.service'
import { DataTable, Empty, ExportMenu, Kpi, Panel, PrintButton, ReportError, ReportLoading } from './ReportKit'
import { KIND_LABEL, KindBadge, hhmm, shiftLabel } from './AttendanceBits'
import DayEditor from './DayEditor'

/** One day, everyone. `to` is the chosen day. */
export default function AttendanceDailyReport({ to: date, branchId, branchName }) {
  const [q, setQ] = useState('')
  const [only, setOnly] = useState(null)
  const [edit, setEdit] = useState(null)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hub-attendance', 'daily', date, branchId],
    queryFn: () => reportsService.hubAttendanceDaily({ date, branch_id: branchId || undefined }).then((r) => r.data),
  })
  if (isLoading) return <ReportLoading />
  if (error) return <ReportError error={error} retry={refetch} />

  const t = data.totals
  const needle = q.trim().toLowerCase()
  const byKind = only ? data.rows.filter((r) => r.kind === only) : data.rows
  const shown = needle ? byKind.filter((r) => `${r.name} ${r.employee_code || ''}`.toLowerCase().includes(needle)) : byKind
  const tile = (kind, node) => (
    <button type="button" onClick={() => setOnly(only === kind ? null : kind)} aria-pressed={only === kind} title="Click to show only these" className={`rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${only === kind ? 'ring-2 ring-primary' : ''}`}>{node}</button>
  )
  const rank = { unmarked: 0, absent: 1, leave: 2, half_day: 3, present: 4 }
  const exportRows = data.rows.map((r) => ({ name: r.name, employee_code: r.employee_code || '', branch: r.branch || '', shift: shiftLabel(r.shift || r.planned_shift), status: KIND_LABEL[r.kind] + (r.late ? ' (late)' : ''), check_in: hhmm(r.check_in), check_out: hhmm(r.check_out), worked_hours: r.hours, overtime_hours: r.overtime_hours, late_fine: r.late_amount, late_hours_off: r.late_hours, break_minutes: r.break_minutes }))

  // What is printed is what is on screen (search / tile filter included), in plain words.
  const printRows = shown.map((r) => ({
    employee: r.name, code: r.employee_code || '', branch: r.branch || '', shift: shiftLabel(r.shift || r.planned_shift) || '',
    status: KIND_LABEL[r.kind] + (r.late ? ' (late)' : ''), in: hhmm(r.check_in) || '', out: hhmm(r.check_out) || '',
    worked_h: r.hours || '', overtime_h: r.overtime_hours || '', late_fine: r.late_amount ? `Rs ${r.late_amount}` : '',
  }))
  const printHeaders = ['Employee', 'Code', 'Branch', 'Shift', 'Status', 'In', 'Out', 'Worked h', 'Overtime h', 'Late fine']
  const printSummary = [['Present', t.present], ['Late', t.late], ['Half day', t.half_day], ['On leave', t.leave], ['Absent', t.absent], ['Not marked', t.unmarked], ['Staff', t.staff]].map(([label, value]) => ({ label, value: String(value) }))
  const longDate = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Present" value={t.present} hint={t.late ? `${t.late} of them late` : undefined} />
        <Kpi label="Half day" value={t.half_day} />
        <Kpi label="On leave" value={t.leave} />
        {tile('absent', <Kpi label="Absent" value={t.absent} tone={t.absent ? 'text-rose-600' : ''} />)}
        {tile('unmarked', <Kpi label="Not marked" value={t.unmarked} tone={t.unmarked ? 'text-amber-600' : ''} hint="click to list, then fix" />)}
        <Kpi label="Staff" value={t.staff} />
      </div>
      <Panel
        title="Daily attendance"
        subtitle={`Click a row to fix that person's day. 'Not marked' means no punch and no record. If you expected punches here, check Unmatched punches on the Attendance page.${only ? ` Showing only: ${KIND_LABEL[only]}.` : ''}`}
        action={
          <div className="flex items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or code" aria-label="Search" className="h-8 w-44 rounded-md border bg-background px-2 text-xs" />
            <PrintButton rows={printRows} headers={printHeaders} title="Daily attendance" subtitle={`${longDate} · ${branchName || 'All branches'}${only ? ` · ${KIND_LABEL[only]} only` : ''}`} summary={printSummary} />
            <ExportMenu rows={exportRows} filename={`attendance-${date}`} title={`Attendance ${date}`} />
          </div>
        }
      >
        {data.rows.length === 0 ? <Empty>No staff for this branch.</Empty> : shown.length === 0 ? <Empty>No one matches "{q}".</Empty> : (
          <DataTable
            rows={shown}
            rowKey={(r) => `${r.employee_id}-${r.branch_id}`}
            onRowClick={setEdit}
            defaultSort={{ key: 'kind', dir: 'asc' }}
            maxHeight="32rem"
            columns={[
              { key: 'name', label: 'Employee', className: 'font-medium' },
              { key: 'branch', label: 'Branch', render: (r) => r.branch || '—' },
              { key: 'shift', label: 'Shift', sortValue: (r) => shiftLabel(r.shift || r.planned_shift), render: (r) => shiftLabel(r.shift || r.planned_shift) || '—' },
              { key: 'kind', label: 'Status', sortValue: (r) => rank[r.kind], render: (r) => <KindBadge row={r} /> },
              { key: 'check_in', label: 'In', sortValue: (r) => r.check_in || '', render: (r) => hhmm(r.check_in) || '—' },
              { key: 'check_out', label: 'Out', sortValue: (r) => r.check_out || '', render: (r) => hhmm(r.check_out) || '—' },
              { key: 'hours', label: 'Worked h', align: 'right', render: (r) => (r.hours ? r.hours : '—') },
              { key: 'overtime_hours', label: 'Overtime', align: 'right', render: (r) => (r.overtime_hours ? `${r.overtime_hours} h` : '—') },
              { key: 'late_amount', label: 'Late fine', align: 'right', render: (r) => (r.late_amount ? `₹${r.late_amount}` : r.late_hours ? `${r.late_hours} h` : '—') },
            ]}
          />
        )}
      </Panel>
      {edit && <DayEditor employeeId={edit.employee_id} name={edit.name} date={date} row={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}
