import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { formatCurrency } from '@/lib/utils'
import { reportsService } from '@/services/reports.service'
import { DataTable, Empty, ExportMenu, Kpi, Panel, ReportError, ReportLoading, ShareBar, ExportAllMenu } from './ReportKit'

export default function StaffReport({ from, to, branchId }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hub-staff', from, to, branchId],
    queryFn: () => reportsService.hubStaff({ start_date: from, end_date: to, branch_id: branchId || undefined }).then((r) => r.data),
  })
  if (isLoading) return <ReportLoading />
  if (error) return <ReportError error={error} retry={refetch} />

  const t = data.totals
  const max = Math.max(1, ...data.staff.map((s) => s.revenue))
  const exportRows = data.staff.map((s) => ({ name: s.name, services: s.services, customers: s.customers, revenue: Math.round(s.revenue), avg_per_service: Math.round(s.avg_per_service), star_points: s.stars, product_sales: Math.round(s.product_sales), product_incentive: Math.round(s.product_incentive) }))

  return (
    <div className="space-y-4">
      <ExportAllMenu title="Staff" sets={[
        { label: 'Staff', rows: data.staff, filename: `staff-${from}-to-${to}` },
      ]} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Staff credited" value={t.staff} />
        <Kpi label="Services done" value={t.services} />
        <Kpi label="Revenue credited" value={formatCurrency(Math.round(t.revenue))} hint="shared when two people did one service" />
        <Kpi label="Avg per service" value={formatCurrency(Math.round(t.avg_per_service))} />
      </div>
      <Panel
        title="Team leaderboard"
        subtitle="Completed services credited to each employee. Late fines, attendance and salary live in Staff Performance and Payroll."
        action={
          <div className="flex items-center gap-2">
            <Link to="/staff-performance" className="text-xs font-medium text-primary hover:underline">Open Staff Performance</Link>
            <ExportMenu rows={exportRows} filename={`staff-${from}-to-${to}`} title="Staff performance" />
          </div>
        }
      >
        {data.staff.length === 0 ? (
          <Empty>No services were credited to staff in this period. Services billed without an employee are not counted.</Empty>
        ) : (
          <DataTable
            rows={data.staff}
            rowKey={(r) => r.employee_id}
            defaultSort={{ key: 'revenue', dir: 'desc' }}
            columns={[
              { key: 'name', label: 'Employee', className: 'font-medium' },
              { key: 'services', label: 'Services', align: 'right' },
              { key: 'customers', label: 'Customers', align: 'right' },
              { key: 'revenue', label: 'Revenue', align: 'right', render: (r) => <b>{formatCurrency(Math.round(r.revenue))}</b> },
              { key: 'bar', label: '', sortValue: (r) => r.revenue, render: (r) => <div className="w-28"><ShareBar value={r.revenue} max={max} className="bg-emerald-500" /></div> },
              { key: 'avg_per_service', label: 'Avg / service', align: 'right', render: (r) => formatCurrency(Math.round(r.avg_per_service)) },
              { key: 'stars', label: 'Stars', align: 'right' },
              { key: 'product_incentive', label: 'Product incentive', align: 'right', render: (r) => (r.product_incentive ? formatCurrency(Math.round(r.product_incentive)) : '-') },
            ]}
            footer={{ name: 'Total', services: t.services, revenue: formatCurrency(Math.round(t.revenue)), product_incentive: formatCurrency(Math.round(t.incentive)) }}
          />
        )}
      </Panel>
    </div>
  )
}
