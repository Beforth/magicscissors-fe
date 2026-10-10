import { useQuery } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/utils'
import { reportsService } from '@/services/reports.service'
import { DataTable, Empty, ExportMenu, Kpi, Panel, ReportError, ReportLoading, ShareBar } from './ReportKit'

export default function ProfitLossReport({ from, to, branchId }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hub-pl', from, to, branchId],
    queryFn: () => reportsService.hubProfitLoss({ start_date: from, end_date: to, branch_id: branchId || undefined }).then((r) => r.data),
  })
  if (isLoading) return <ReportLoading />
  if (error) return <ReportError error={error} retry={refetch} />

  const t = data.totals
  const maxExp = Math.max(1, ...data.expenses_by_category.map((e) => e.amount))
  const money = (v) => <span className={v < 0 ? 'font-semibold text-rose-600' : 'font-semibold'}>{formatCurrency(v)}</span>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Revenue" value={formatCurrency(t.revenue)} />
        <Kpi label="Expenses" value={formatCurrency(t.expenses)} tone={t.expenses ? 'text-amber-600' : ''} />
        <Kpi label="Profit" value={formatCurrency(t.profit)} tone={t.profit < 0 ? 'text-rose-600' : 'text-emerald-600'} />
        <Kpi label="Margin" value={t.margin == null ? '-' : `${t.margin}%`} hint="profit as a share of revenue" />
      </div>
      <Panel title="By branch" subtitle="Revenue from bills minus recorded expenses" action={<ExportMenu rows={data.branches.map((b) => ({ branch: b.name, bills: b.bills, revenue: b.revenue, expenses: b.expenses, profit: b.profit, margin_percent: b.margin }))} filename={`profit-loss-${from}-to-${to}`} title="Profit and loss" />}>
        <DataTable
          rows={data.branches}
          rowKey={(r) => r.branch_id}
          defaultSort={{ key: 'revenue', dir: 'desc' }}
          empty="No branches to report on."
          columns={[
            { key: 'name', label: 'Branch', className: 'font-medium' },
            { key: 'bills', label: 'Bills', align: 'right' },
            { key: 'revenue', label: 'Revenue', align: 'right', render: (r) => formatCurrency(r.revenue) },
            { key: 'expenses', label: 'Expenses', align: 'right', render: (r) => formatCurrency(r.expenses) },
            { key: 'profit', label: 'Profit', align: 'right', render: (r) => money(r.profit) },
            { key: 'margin', label: 'Margin', align: 'right', render: (r) => (r.margin == null ? '-' : `${r.margin}%`) },
          ]}
          footer={data.branches.length > 1 ? { name: 'Total', revenue: formatCurrency(t.revenue), expenses: formatCurrency(t.expenses), profit: formatCurrency(t.profit), margin: t.margin == null ? '' : `${t.margin}%` } : undefined}
        />
      </Panel>
      <Panel title="Where the money went" subtitle="Expenses by category">
        {data.expenses_by_category.length === 0 ? (
          <Empty>No expenses recorded in this period. Add them under Finance → Expenses so profit is accurate.</Empty>
        ) : (
          <ol className="space-y-3">
            {data.expenses_by_category.map((e) => (
              <li key={e.name}>
                <div className="mb-1 flex justify-between text-sm"><span>{e.name}</span><b>{formatCurrency(e.amount)}</b></div>
                <ShareBar value={e.amount} max={maxExp} className="bg-amber-500" />
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  )
}
