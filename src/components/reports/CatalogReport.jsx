import { useQuery } from '@tanstack/react-query'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { reportsService } from '@/services/reports.service'
import { DataTable, Delta, Empty, ExportMenu, Kpi, Panel, ReportError, ReportLoading, ShareBar, useChartColors, ExportAllMenu } from './ReportKit'

export default function CatalogReport({ from, to, branchId }) {
  const colors = useChartColors()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hub-catalog', from, to, branchId],
    queryFn: () => reportsService.hubCatalog({ start_date: from, end_date: to, branch_id: branchId || undefined }).then((r) => r.data),
  })
  if (isLoading) return <ReportLoading />
  if (error) return <ReportError error={error} retry={refetch} />

  const t = data.totals
  const palette = [colors.primary, colors.success, colors.info, colors.warning, colors.destructive, colors.muted]
  const max = Math.max(1, ...data.services.map((s) => s.revenue))

  return (
    <div className="space-y-4">
      <ExportAllMenu title="Catalog" sets={[
        { label: 'Services', rows: data.services, filename: `catalog-services-${from}-to-${to}` },
        { label: 'Categories', rows: data.by_category, filename: `catalog-categories-${from}-to-${to}` },
        { label: 'Products', rows: data.products, filename: `catalog-products-${from}-to-${to}` },
      ]} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Services sold" value={t.services_sold} />
        <Kpi label="Service revenue" value={formatCurrency(t.revenue)} />
        <Kpi label="Different services" value={t.distinct} />
        <Kpi label="Product revenue" value={formatCurrency(t.products_revenue)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="By category" subtitle="Share of service revenue">
          {data.by_category.length === 0 ? <Empty /> : (
            <div className="flex flex-col items-center gap-3">
              <div className="h-36 w-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.by_category} dataKey="revenue" nameKey="category" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="none">
                      {data.by_category.map((c, i) => <Cell key={c.category} fill={palette[i % palette.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-1.5 text-sm">
                {data.by_category.map((c, i) => (
                  <li key={c.category} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: palette[i % palette.length] }} />
                    <span className="flex-1 truncate">{c.category}</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(c.revenue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel
          title="Services"
          subtitle="Every service sold in this period, with its change against the previous period"
          className="lg:col-span-2"
          action={<ExportMenu rows={data.services.map((s) => ({ service: s.name, category: s.category, quantity: s.qty, revenue: s.revenue, avg_price: Math.round(s.avg_price), share_percent: s.share, discount: s.discount }))} filename={`services-${from}-to-${to}`} title="Services" />}
        >
          <DataTable
            rows={data.services}
            rowKey={(r) => r.name}
            defaultSort={{ key: 'revenue', dir: 'desc' }}
            empty="No services sold in this period."
            maxHeight="24rem"
            columns={[
              { key: 'name', label: 'Service', className: 'font-medium' },
              { key: 'category', label: 'Category', render: (r) => <span className="text-muted-foreground">{r.category}</span> },
              { key: 'qty', label: 'Sold', align: 'right' },
              { key: 'revenue', label: 'Revenue', align: 'right', render: (r) => formatCurrency(r.revenue) },
              { key: 'share', label: 'Share', render: (r) => <div className="flex w-28 items-center gap-2"><ShareBar value={r.revenue} max={max} /><span className="w-9 text-right text-xs text-muted-foreground">{r.share}%</span></div> },
              { key: 'qty_change', label: 'Trend', align: 'right', sortValue: (r) => r.qty_change ?? -999, render: (r) => <Delta value={r.qty_change} label="" /> },
            ]}
          />
        </Panel>
      </div>

      <Panel title="Products sold" subtitle="Retail products billed in this period" action={<ExportMenu rows={data.products} filename={`products-${from}-to-${to}`} title="Products sold" />}>
        <DataTable
          rows={data.products}
          rowKey={(r) => `${r.name}-${r.brand}`}
          defaultSort={{ key: 'revenue', dir: 'desc' }}
          empty="No products sold in this period."
          maxHeight="20rem"
          columns={[
            { key: 'name', label: 'Product', className: 'font-medium' },
            { key: 'brand', label: 'Brand', render: (r) => <span className="text-muted-foreground">{r.brand || '-'}</span> },
            { key: 'qty', label: 'Units', align: 'right' },
            { key: 'revenue', label: 'Revenue', align: 'right', render: (r) => formatCurrency(r.revenue) },
          ]}
        />
      </Panel>
    </div>
  )
}
