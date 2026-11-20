import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsService } from '@/services/reports.service'
import { DataTable, Empty, ExportMenu, Kpi, Panel, ReportError, ReportLoading } from './ReportKit'
import { DaysDrawer } from './AttendanceBits'

/** A range, one line per person. Every number opens the days behind it. */
export default function AttendanceSummaryReport({ from, to, branchId }) {
  const [drill, setDrill] = useState(null)
  const [q, setQ] = useState('')
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hub-attendance', 'summary', from, to, branchId],
    queryFn: () => reportsService.hubAttendanceSummary({ start_date: from, end_date: to, branch_id: branchId || undefined }).then((r) => r.data),
  })
  if (isLoading) return <ReportLoading />
  if (error) return <ReportError error={error} retry={refetch} />

  const t = data.totals
  const needle = q.trim().toLowerCase()
  const shown = needle ? data.rows.filter((r) => `${r.name} ${r.employee_code || ''}`.toLowerCase().includes(needle)) : data.rows
  const open = (row, kind) => setDrill({ employeeId: row.employee_id, name: row.name, kind })
  const cell = (kind, key, fmt = (v) => v) => (r) => (r[key]
    ? <button type="button" onClick={(e) => { e.stopPropagation(); open(r, kind) }} className="rounded px-1.5 font-semibold text-primary hover:bg-primary/10 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{fmt(r[key])}</button>
    : <span className="text-muted-foreground">—</span>)
  const exportRows = data.rows.map((r) => ({ name: r.name, employee_code: r.employee_code || '', present: r.present, late: r.late, half_day: r.half_day, leave: r.leave, absent: r.absent, avg_check_in: r.avg_check_in || '', worked_hours: r.hours, overtime_hours: r.overtime_hours, late_fine: r.late_amount, late_hours_off: r.late_hours, break_minutes: r.break_minutes }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Staff" value={t.staff} />
        <Kpi label="Present days" value={t.present} />
        <Kpi label="Late days" value={t.late} />
        <Kpi label="Half days" value={t.half_day} />
        <Kpi label="Absent days" value={t.absent} tone={t.absent ? 'text-rose-600' : ''} />
        <Kpi label="Hours worked" value={t.hours} />
      </div>
      <Panel
        title="Attendance summary"
        subtitle="Click any number to see the days behind it. Days the system closed because nobody punched count as absent."
        action={
          <div className="flex items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or code" aria-label="Search" className="h-8 w-44 rounded-md border bg-background px-2 text-xs" />
            <ExportMenu rows={exportRows} filename={`attendance-summary-${from}-to-${to}`} title={`Attendance summary ${from} to ${to}`} />
          </div>
        }
      >
        {data.rows.length === 0 ? <Empty>No staff for this branch.</Empty> : shown.length === 0 ? <Empty>No one matches "{q}".</Empty> : (
          <DataTable
            rows={shown}
            rowKey={(r) => r.employee_id}
            defaultSort={{ key: 'name', dir: 'asc' }}
            maxHeight="32rem"
            columns={[
              { key: 'name', label: 'Employee', className: 'font-medium' },
              { key: 'present', label: 'Present', align: 'right', render: cell('present', 'present') },
              { key: 'late', label: 'Late', align: 'right', render: cell('late', 'late') },
              { key: 'half_day', label: 'Half day', align: 'right', render: cell('half_day', 'half_day') },
              { key: 'leave', label: 'Leave', align: 'right', render: cell('leave', 'leave') },
              { key: 'absent', label: 'Absent', align: 'right', render: cell('absent', 'absent') },
              { key: 'avg_check_in', label: 'Avg in', align: 'right', render: (r) => r.avg_check_in || '—' },
              { key: 'hours', label: 'Worked h', align: 'right' },
              { key: 'overtime_hours', label: 'Overtime h', align: 'right', render: cell('overtime', 'overtime_hours') },
              { key: 'late_amount', label: 'Late fine', align: 'right', render: cell('late', 'late_amount', (v) => `₹${v}`) },
            ]}
          />
        )}
      </Panel>
      {drill && <DaysDrawer {...drill} from={from} to={to} branchId={branchId} onClose={() => setDrill(null)} />}
    </div>
  )
}
