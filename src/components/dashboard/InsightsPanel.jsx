import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, Banknote, CreditCard, Smartphone, Wallet, Minus } from 'lucide-react'
import { reportsService } from '@/services/reports.service'
import { branchService } from '@/services/branch.service'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

// Theme colours come from the CSS variables so charts follow the design tokens.
function cssColor(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v ? `hsl(${v})` : fallback
  } catch {
    return fallback
  }
}
function useChartColors() {
  return useMemo(
    () => ({
      primary: cssColor('--primary', 'hsl(221 83% 53%)'),
      success: cssColor('--success', 'hsl(152 60% 40%)'),
      warning: cssColor('--warning', 'hsl(38 92% 50%)'),
      info: 'hsl(188 78% 41%)',
      destructive: cssColor('--destructive', 'hsl(0 72% 51%)'),
      muted: cssColor('--muted-foreground', 'hsl(215 16% 47%)'),
      border: cssColor('--border', 'hsl(214 32% 91%)'),
    }),
    []
  )
}

const compact = (n) =>
  new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
const shortDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })
const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`

const MODE_META = {
  cash: { label: 'Cash', icon: Banknote },
  card: { label: 'Card', icon: CreditCard },
  upi: { label: 'UPI', icon: Smartphone },
  online: { label: 'Online', icon: Wallet },
  other: { label: 'Other', icon: Wallet },
}

function Delta({ value }) {
  if (value == null) return <span className="text-xs text-muted-foreground">no earlier data</span>
  const up = value > 0
  const flat = value === 0
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${flat ? 'text-muted-foreground' : up ? 'text-emerald-600' : 'text-rose-600'}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value)}%
      <span className="ml-1 font-normal text-muted-foreground">vs previous</span>
    </span>
  )
}

function Card({ title, subtitle, children, className = '', action }) {
  return (
    <section className={`rounded-3xl glass-card p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Empty({ text = 'Nothing in this period yet' }) {
  return <div className="grid h-40 place-items-center text-sm text-muted-foreground">{text}</div>
}

function Kpi({ label, value, change, spark, color, hint }) {
  return (
    <div className="relative overflow-hidden rounded-3xl glass-card p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums leading-none text-slate-800 sm:text-3xl">{value}</p>
      <div className="mt-2 min-h-[1rem]">{change !== undefined ? <Delta value={change} /> : <span className="text-xs text-muted-foreground">{hint}</span>}</div>
      {spark && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 opacity-70" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#spark-${label})`} dot={false} isAnimationActive />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function LiveChip({ label, value, to, tone = 'text-slate-800' }) {
  const body = (
    <div className="rounded-2xl glass-card px-4 py-3 transition-all hover:bg-white">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-extrabold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
  return to ? (
    <Link to={to} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl">
      {body}
    </Link>
  ) : (
    body
  )
}

function ChartTip({ active, payload, label, money = true, suffix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-0.5 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">{money && p.dataKey === 'revenue' ? formatCurrency(p.value) : `${p.value}${suffix}`}</span>
        </p>
      ))}
    </div>
  )
}

/**
 * The owner/manager "business pulse": live counters, period KPIs with trend, revenue curve,
 * payment mix, top services, busiest hours, top staff and (owner) branch comparison.
 */
export default function InsightsPanel({ allowBranchFilter = false }) {
  const colors = useChartColors()
  const [days, setDays] = useState(30)
  const [branchId, setBranchId] = useState('')

  const { data: branchesData } = useQuery({
    queryKey: ['branches', 'dashboard-filter'],
    queryFn: () => branchService.getBranches(),
    enabled: allowBranchFilter,
  })
  const branches = (branchesData?.data || []).filter((b) => b.is_salon !== false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-insights', days, branchId],
    queryFn: () => reportsService.getDashboardInsights({ days, ...(branchId ? { branch_id: branchId } : {}) }).then((r) => r.data),
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  })

  const donutColors = [colors.primary, colors.success, colors.info, colors.warning, colors.muted]

  const peakHour = useMemo(() => {
    const hrs = data?.busy_hours || []
    return hrs.length ? hrs.reduce((a, b) => (b.bills > a.bills ? b : a)).hour : null
  }, [data])
  const hourData = useMemo(() => {
    const hrs = data?.busy_hours || []
    if (!hrs.length) return []
    const lo = Math.max(0, Math.min(...hrs.map((h) => h.hour)) - 1)
    const hi = Math.min(23, Math.max(...hrs.map((h) => h.hour)) + 1)
    const map = new Map(hrs.map((h) => [h.hour, h.bills]))
    return Array.from({ length: hi - lo + 1 }, (_, i) => ({ hour: lo + i, label: hourLabel(lo + i), bills: map.get(lo + i) || 0 }))
  }, [data])

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    )
  }
  if (isError || !data) return <p className="text-sm text-rose-600">Could not load the business insights.</p>

  const t = data.totals
  const spark = (key) => data.daily.map((d) => ({ v: d[key] }))
  const payTotal = data.payment_mix.reduce((n, p) => n + p.amount, 0)
  const maxService = Math.max(1, ...data.top_services.map((s) => s.revenue))
  const maxStaff = Math.max(1, ...data.top_staff.map((s) => s.revenue))

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Business pulse</h2>
          <p className="text-xs text-slate-400">
            {shortDate(data.range.from)} – {shortDate(data.range.to)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {allowBranchFilter && branches.length > 1 && (
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              aria-label="Branch"
              className="h-8 rounded-full border bg-background px-3 text-xs font-medium"
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.branch_id} value={b.branch_id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <div className="inline-flex rounded-full border bg-background p-0.5" role="tablist" aria-label="Period">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                role="tab"
                aria-selected={days === r.days}
                onClick={() => setDays(r.days)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${days === r.days ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live today */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <LiveChip label="Today's sales" value={formatCurrency(data.today.revenue)} tone="text-emerald-600" />
        <LiveChip label="Bills today" value={data.today.bills} />
        <LiveChip label="New customers" value={data.today.new_customers} />
        <LiveChip label="Pending services" value={data.today.pending_services} to="/bills" tone={data.today.pending_services ? 'text-amber-600' : undefined} />
        <LiveChip label="In progress" value={data.today.in_progress_services} to="/employee-status" tone={data.today.in_progress_services ? 'text-blue-600' : undefined} />
        <LiveChip label="Open tokens" value={data.today.open_tokens} to="/tokens" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Revenue" value={formatCurrency(t.revenue)} change={t.revenue_change} spark={spark('revenue')} color={colors.primary} />
        <Kpi label="Bills" value={t.bills} change={t.bills_change} spark={spark('bills')} color={colors.success} />
        <Kpi label="Average bill" value={formatCurrency(Math.round(t.avg_bill))} change={t.avg_bill_change} color={colors.info} />
        <Kpi label="Customers served" value={t.customers} change={t.customers_change} color={colors.warning} />
      </div>

      {/* Trend + payment mix */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Revenue trend" subtitle="Completed bills, per day" className="lg:col-span-2">
          {t.bills === 0 ? (
            <Empty text="No sales in this period yet" />
          ) : (
            <div className="h-64" role="img" aria-label={`Revenue per day, total ${formatCurrency(t.revenue)}`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={colors.primary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={colors.border} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip content={<ChartTip />} labelFormatter={shortDate} cursor={{ stroke: colors.border }} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke={colors.primary} strokeWidth={2.5} fill="url(#rev-fill)" dot={days <= 7} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="How customers pay" subtitle="Share of collected amount">
          {data.payment_mix.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-40 w-40" role="img" aria-label="Payment mix">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.payment_mix} dataKey="amount" nameKey="mode" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
                      {data.payment_mix.map((p, i) => (
                        <Cell key={p.mode} fill={donutColors[i % donutColors.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Collected</p>
                    <p className="text-sm font-extrabold">{compact(payTotal)}</p>
                  </div>
                </div>
              </div>
              <ul className="w-full space-y-1.5 text-sm">
                {data.payment_mix.map((p, i) => {
                  const meta = MODE_META[p.mode] || MODE_META.other
                  return (
                    <li key={p.mode} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: donutColors[i % donutColors.length] }} />
                      <meta.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1">{meta.label}</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(p.amount)}</span>
                      <span className="w-10 text-right text-xs text-muted-foreground">{payTotal ? Math.round((p.amount / payTotal) * 100) : 0}%</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </Card>
      </div>

      {/* Services, hours, staff */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Top services" subtitle="By revenue">
          {data.top_services.length === 0 ? (
            <Empty />
          ) : (
            <ol className="space-y-3">
              {data.top_services.map((s, i) => (
                <li key={s.name}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">
                      <span className="mr-1.5 text-xs text-muted-foreground">{i + 1}</span>
                      {s.name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {s.count}× · <span className="font-semibold text-foreground">{formatCurrency(s.revenue)}</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(s.revenue / maxService) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Busiest hours" subtitle={peakHour != null ? `Peak around ${hourLabel(peakHour)}` : 'Bills by hour of day'}>
          {hourData.length === 0 ? (
            <Empty />
          ) : (
            <div className="h-52" role="img" aria-label="Bills per hour of the day">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourData} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
                  <CartesianGrid vertical={false} stroke={colors.border} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip money={false} suffix=" bills" />} cursor={{ fill: colors.border, opacity: 0.4 }} />
                  <Bar dataKey="bills" name="Bills" radius={[6, 6, 0, 0]}>
                    {hourData.map((h) => (
                      <Cell key={h.hour} fill={h.hour === peakHour ? colors.warning : colors.primary} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Top staff" subtitle="Services completed and revenue credited">
          {data.top_staff.length === 0 ? (
            <Empty text="No staff credited yet" />
          ) : (
            <ol className="space-y-3">
              {data.top_staff.map((s, i) => (
                <li key={s.employee_id} className="flex items-center gap-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-secondary text-muted-foreground'}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{s.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{s.services} services</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${(s.revenue / maxStaff) * 100}%` }} />
                      </div>
                      <span className="text-xs font-semibold tabular-nums">{formatCurrency(Math.round(s.revenue))}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* Branch comparison */}
      {data.branches.length > 1 && (
        <Card title="Branch comparison" subtitle="Revenue in this period">
          <div className="h-56" role="img" aria-label="Revenue per branch">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.branches} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid horizontal={false} stroke={colors.border} strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: colors.muted }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: colors.border, opacity: 0.4 }} />
                <Bar dataKey="revenue" name="Revenue" fill={colors.primary} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  )
}
