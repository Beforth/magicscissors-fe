import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsService } from '@/services/reports.service'
import { DataTable, Empty, ExportMenu, Kpi, Panel, ReportError, ReportLoading } from './ReportKit'
import { KIND_LABEL, KindBadge, hhmm, shiftLabel } from './AttendanceBits'

/** One day, everyone. `to` is the chosen day. */
export default function AttendanceDailyReport({ to: date, branchId }) {
  const [q, setQ] = useState('')
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hub-attendance', 'daily', date, branchId],
    queryFn: () => reportsService.hubAttendanceDaily({ date, branch_id: branchId || undefined }).then((r) => r.data),
  })
  if (isLoading) return <ReportLoading />
  if (error) return <ReportError error={error} retry={refetch} />

  const t = data.totals
  const needle = q.trim().toLowerCase()
  const shown = needle ? data.rows.filter((r) => `${r.name} ${r.employee_code || ''}`.toLowerCase().includes(needle)) : data.rows
  const rank = { unmarked: 0, absent: 1, leave: 2, half_day: 3, present: 4 }
  const exportRows = data.rows.map((r) => ({ name: r.name, employee_code: r.employee_code || '', branch: r.branch || '', shift: shiftLabel(r.shift || r.planned_shift), status: KIND_LABEL[r.kind] + (r.late ? ' (late)' : ''), check_in: hhmm(r.check_in), check_out: hhmm(r.check_out), worked_hours: r.hours, overtime_hours: r.overtime_hours, late_fine: r.late_amount, late_hours_off: r.late_hours, break_minutes: r.break_minutes }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Present" value={t.present} hint={t.late ? `${t.late} of them late` : undefined} />
        <Kpi label="Half day" value={t.half_day} />
        <Kpi label="On leave" value={t.leave} />
        <Kpi label="Absent" value={t.absent} tone={t.absent ? 'text-rose-600' : ''} />
        <Kpi label="Not marked" value={t.unmarked} tone={t.unmarked ? 'text-amber-600' : ''} hint="no record that day" />
        <Kpi label="Staff" value={t.staff} />
      </div>
      <Panel
        title="Daily attendance"
        subtitle="Everyone on the chosen day. 'Not marked' means no punch and no record. If you expected punches here, check Unmatched punches on the Attendance page."
        action={
          <div className="flex items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or code" aria-label="Search" className="h-8 w-44 rounded-md border bg-background px-2 text-xs" />
            <ExportMenu rows={exportRows} filename={`attendance-${date}`} title={`Attendance ${date}`} />
          </div>
        }
      >
        {data.rows.length === 0 ? <Empty>No staff for this branch.</Empty> : shown.length === 0 ? <Empty>No one matches "{q}".</Empty> : (
          <DataTable
            rows={shown}
            rowKey={(r) => `${r.employee_id}-${r.branch_id}`}
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
    </div>
  )
}
