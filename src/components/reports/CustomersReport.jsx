import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { reportsService } from '@/services/reports.service'
import { formatCurrency } from '@/lib/utils'
import { ChartTip, DataTable, Empty, ExportMenu, Kpi, Panel, ReportError, ReportLoading, shortDate, useChartColors } from './ReportKit'

export default function CustomersReport({ from, to, branchId }) {
  const colors = useChartColors()
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hub-customers', from, to, branchId],
    queryFn: () => reportsService.hubCustomers({ start_date: from, end_date: to, branch_id: branchId || undefined }).then((r) => r.data),
  })
  if (isLoading) return <ReportLoading />
  if (error) return <ReportError error={error} retry={refetch} />

  const t = data.totals
  const open = (r) => navigate(`/customers/${r.customer_id}`)
  const cols = (extra) => [
    { key: 'name', label: 'Customer', className: 'font-medium' },
    { key: 'phone', label: 'Phone', render: (r) => <span className="text-muted-foreground">{r.phone || '-'}</span> },
    { key: 'visits', label: 'Visits', align: 'right' },
    { key: 'spent', label: 'Spent', align: 'right', render: (r) => formatCurrency(r.spent) },
    ...extra,
  ]
  const rowsForExport = (rows) => rows.map((r) => ({ name: r.name, phone: r.phone, visits: r.visits, spent: r.spent, days_since_last_visit: r.days_since }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Customers served" value={t.served} />
        <Kpi label="New customers" value={t.new} hint="first ever bill in this period" tone="text-emerald-600" />
        <Kpi label="Returning" value={t.returning} hint={`${t.returning_rate}% of those served`} />
        <Kpi label="Win-back list" value={data.lapsed.length} hint="regulars gone quiet 60+ days" tone={data.lapsed.length ? 'text-amber-600' : ''} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="How often they came" subtitle="Customers by number of visits in this period">
          {t.served === 0 ? <Empty /> : (
            <div className="h-48" role="img" aria-label="Customers by visit count">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.frequency} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid vertical={false} stroke={colors.border} strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip format={(v) => `${v} customers`} />} cursor={{ fill: colors.border, opacity: 0.4 }} />
                  <Bar dataKey="customers" name="Customers" fill={colors.primary} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="New customers per day" subtitle="Day of their first bill">
          {data.new_per_day.length === 0 ? <Empty>No new customers in this period.</Empty> : (
            <div className="h-48" role="img" aria-label="New customers per day">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.new_per_day} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid vertical={false} stroke={colors.border} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip format={(v) => `${v} new`} />} labelFormatter={shortDate} cursor={{ fill: colors.border, opacity: 0.4 }} />
                  <Bar dataKey="customers" name="New" fill={colors.success} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Top customers" subtitle="By spend in this period · click a row to open the customer" action={<ExportMenu rows={rowsForExport(data.top_customers)} filename={`top-customers-${from}-to-${to}`} title="Top customers" />}>
        <DataTable rows={data.top_customers} rowKey={(r) => r.customer_id} onRowClick={open} defaultSort={{ key: 'spent', dir: 'desc' }} empty="No customers billed in this period." columns={cols([{ key: 'last_visit', label: 'Last visit', render: (r) => (r.days_since === 0 ? 'today' : `${r.days_since} days ago`), sortValue: (r) => -r.days_since }])} />
      </Panel>

      <Panel title="Win-back list" subtitle="Customers with 2+ visits who have not been back for 60+ days, biggest spenders first" action={<ExportMenu rows={rowsForExport(data.lapsed)} filename="win-back-customers" title="Win-back customers" />}>
        <DataTable rows={data.lapsed} rowKey={(r) => r.customer_id} onRowClick={open} defaultSort={{ key: 'spent', dir: 'desc' }} empty="Nobody has gone quiet. Nice." columns={cols([{ key: 'days_since', label: 'Away for', align: 'right', render: (r) => `${r.days_since} days` }])} />
      </Panel>
    </div>
  )
}
