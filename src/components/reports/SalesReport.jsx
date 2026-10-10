import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { reportsService } from '@/services/reports.service'
import { formatCurrency } from '@/lib/utils'
import { ChartTip, DataTable, Empty, ExportMenu, Kpi, Panel, ReportError, ReportLoading, ShareBar, WEEKDAYS, compact, shortDate, useChartColors, ExportAllMenu } from './ReportKit'

const MODE = { cash: 'Cash', card: 'Card', upi: 'UPI', online: 'Online', other: 'Other' }

export default function SalesReport({ from, to, branchId }) {
  const colors = useChartColors()
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hub-sales', from, to, branchId],
    queryFn: () => reportsService.hubSales({ start_date: from, end_date: to, branch_id: branchId || undefined }).then((r) => r.data),
  })
  if (isLoading) return <ReportLoading />
  if (error) return <ReportError error={error} retry={refetch} />

  const t = data.totals
  const donut = [colors.primary, colors.success, colors.info, colors.warning, colors.muted]
  const payTotal = data.payment_mix.reduce((n, p) => n + p.amount, 0)
  const maxSvc = Math.max(1, ...data.top_services.map((s) => s.revenue))
  const maxProd = Math.max(1, ...data.top_products.map((s) => s.revenue))
  const exportRows = data.bills.map((b) => ({
    bill_number: b.bill_number, date: new Date(b.bill_date).toISOString().slice(0, 16).replace('T', ' '), customer: b.customer,
    branch: b.branch, items: b.items, payment: b.payment, discount: b.discount, total: b.total,
  }))

  if (t.bills === 0) return <Panel title="Sales"><Empty>No completed bills between {shortDate(data.range.from)} and {shortDate(data.range.to)}. Try a wider range.</Empty></Panel>

  return (
    <div className="space-y-4">
      <ExportAllMenu title="Sales" sets={[
        { label: 'Bills', rows: exportRows, filename: `sales-bills-${data.range.from}-to-${data.range.to}` },
        { label: 'Revenue by day', rows: data.daily, filename: `sales-by-day-${data.range.from}-to-${data.range.to}` },
        { label: 'Payment modes', rows: data.payment_mix, filename: `sales-payment-modes-${data.range.from}-to-${data.range.to}` },
        { label: 'Weekdays', rows: data.by_weekday, filename: `sales-weekdays-${data.range.from}-to-${data.range.to}` },
        { label: 'Top services', rows: data.top_services, filename: `sales-top-services-${data.range.from}-to-${data.range.to}` },
        { label: 'Top products', rows: data.top_products, filename: `sales-top-products-${data.range.from}-to-${data.range.to}` },
        { label: 'Branches', rows: data.branches, filename: `sales-branches-${data.range.from}-to-${data.range.to}` },
      ]} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Revenue" value={formatCurrency(t.revenue)} change={t.revenue_change} />
        <Kpi label="Bills" value={t.bills} change={t.bills_change} />
        <Kpi label="Average bill" value={formatCurrency(Math.round(t.avg_bill))} change={t.avg_bill_change} />
        <Kpi label="Discounts given" value={formatCurrency(t.discount)} hint={t.revenue + t.discount > 0 ? `${Math.round((t.discount / (t.revenue + t.discount)) * 100)}% of gross` : undefined} tone={t.discount ? 'text-amber-600' : ''} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Per day" value={formatCurrency(Math.round(t.avg_per_day))} hint={`over ${data.range.days} days`} />
        <Kpi label="Best day" value={t.best_day ? formatCurrency(t.best_day.revenue) : '-'} hint={t.best_day ? `${shortDate(t.best_day.date)} · ${t.best_day.bills} bills` : undefined} />
        <Kpi label="Customers served" value={t.customers} />
        <Kpi label="GST collected" value={formatCurrency(t.tax)} hint="included in revenue" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Revenue by day" subtitle="Completed bills" className="lg:col-span-2">
          <div className="h-64" role="img" aria-label="Revenue per day">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="sr-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.primary} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={colors.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={colors.border} strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} minTickGap={28} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} width={48} />
                <Tooltip content={<ChartTip format={(v, k) => (k === 'revenue' ? formatCurrency(v) : v)} />} labelFormatter={shortDate} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke={colors.primary} strokeWidth={2.5} fill="url(#sr-fill)" dot={data.range.days <= 14} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="By payment mode" subtitle="Collected amount">
          {data.payment_mix.length === 0 ? <Empty /> : (
            <div className="flex flex-col items-center gap-3">
              <div className="h-36 w-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.payment_mix} dataKey="amount" nameKey="mode" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="none">
                      {data.payment_mix.map((p, i) => <Cell key={p.mode} fill={donut[i % donut.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-1.5 text-sm">
                {data.payment_mix.map((p, i) => (
                  <li key={p.mode} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: donut[i % donut.length] }} />
                    <span className="flex-1">{MODE[p.mode] || p.mode}</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(p.amount)}</span>
                    <span className="w-10 text-right text-xs text-muted-foreground">{payTotal ? Math.round((p.amount / payTotal) * 100) : 0}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Which weekdays sell most" subtitle="Revenue by day of week">
          <div className="h-48" role="img" aria-label="Revenue by weekday">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_weekday.map((d) => ({ ...d, label: WEEKDAYS[d.dow] }))} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke={colors.border} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip format={(v) => formatCurrency(v)} />} cursor={{ fill: colors.border, opacity: 0.4 }} />
                <Bar dataKey="revenue" name="Revenue" fill={colors.primary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Top services" subtitle="By revenue">
          {data.top_services.length === 0 ? <Empty /> : (
            <ol className="space-y-2.5">
              {data.top_services.slice(0, 6).map((s) => (
                <li key={s.name}>
                  <div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate">{s.name}</span><span className="shrink-0 text-xs text-muted-foreground">{s.count}× · <b className="text-foreground">{formatCurrency(s.revenue)}</b></span></div>
                  <ShareBar value={s.revenue} max={maxSvc} />
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel title="Top products" subtitle="Retail sales by revenue">
          {data.top_products.length === 0 ? <Empty>No products sold in this period.</Empty> : (
            <ol className="space-y-2.5">
              {data.top_products.slice(0, 6).map((s) => (
                <li key={s.name}>
                  <div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate">{s.name}</span><span className="shrink-0 text-xs text-muted-foreground">{s.count}× · <b className="text-foreground">{formatCurrency(s.revenue)}</b></span></div>
                  <ShareBar value={s.revenue} max={maxProd} className="bg-emerald-500" />
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {data.branches.length > 1 && (
        <Panel title="Branches" subtitle="Revenue in this period">
          <DataTable
            rows={data.branches}
            rowKey={(r) => r.id}
            defaultSort={{ key: 'revenue', dir: 'desc' }}
            columns={[
              { key: 'name', label: 'Branch' },
              { key: 'bills', label: 'Bills', align: 'right' },
              { key: 'revenue', label: 'Revenue', align: 'right', render: (r) => formatCurrency(r.revenue) },
              { key: 'share', label: 'Share', sortValue: (r) => r.revenue, render: (r) => <div className="w-32"><ShareBar value={r.revenue} max={t.revenue} /></div> },
            ]}
          />
        </Panel>
      )}

      <Panel
        title="Bills"
        subtitle={data.bills.length >= 500 ? 'Latest 500 bills in this period - export for the full list is limited to these' : `${data.bills.length} bills · click a row to open it`}
        action={<ExportMenu rows={exportRows} filename={`sales-${data.range.from}-to-${data.range.to}`} title="Sales" summary={[{ label: 'Revenue', value: formatCurrency(t.revenue) }, { label: 'Bills', value: t.bills }]} />}
      >
        <DataTable
          rows={data.bills}
          rowKey={(r) => r.bill_id}
          onRowClick={(r) => navigate(`/bills/${r.bill_id}`)}
          defaultSort={{ key: 'bill_date', dir: 'desc' }}
          columns={[
            { key: 'bill_number', label: 'Bill', className: 'font-medium' },
            { key: 'bill_date', label: 'Date', render: (r) => new Date(r.bill_date).toLocaleString('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) },
            { key: 'customer', label: 'Customer' },
            ...(data.branches.length > 1 ? [{ key: 'branch', label: 'Branch' }] : []),
            { key: 'items', label: 'Items', align: 'right' },
            { key: 'payment', label: 'Paid by', render: (r) => <span className="capitalize">{r.payment || '-'}</span> },
            { key: 'discount', label: 'Discount', align: 'right', render: (r) => (r.discount ? formatCurrency(r.discount) : '-') },
            { key: 'total', label: 'Total', align: 'right', render: (r) => <b>{formatCurrency(r.total)}</b> },
          ]}
          footer={{ bill_number: 'Total', items: data.bills.reduce((n, b) => n + b.items, 0), discount: formatCurrency(data.bills.reduce((n, b) => n + b.discount, 0)), total: formatCurrency(data.bills.reduce((n, b) => n + b.total, 0)) }}
        />
      </Panel>
    </div>
  )
}
