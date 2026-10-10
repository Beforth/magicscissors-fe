import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRightLeft, BadgeIndianRupee, BarChart3, BoxesIcon, Droplets, Landmark, Package, Scissors, Star, TrendingDown, Users, Warehouse, Wallet,
} from 'lucide-react'
import { branchService } from '@/services/branch.service'
import { Empty, Panel } from '@/components/reports/ReportKit'
import { PRESETS, istTodayStr, presetOf, rangeFor, rangeLabel } from '@/components/reports/reportRange'
import SalesReport from '@/components/reports/SalesReport'
import CustomersReport from '@/components/reports/CustomersReport'
import StaffReport from '@/components/reports/StaffReport'
import CatalogReport from '@/components/reports/CatalogReport'
import ProfitLossReport from '@/components/reports/ProfitLossReport'
import LegacyReports from '@/components/reports/LegacyReports'

const ALL = ['owner', 'developer', 'manager', 'cashier']
const MGR = ['owner', 'developer', 'manager']
const OWNER = ['owner', 'developer']

// branch: 'optional' = "All branches" allowed, 'warehouse' = needs a warehouse branch, 'none' = not branch based
const REPORTS = [
  { id: 'sales', group: 'Sales', label: 'Sales', hint: 'Revenue, bills, payments, trends', icon: BarChart3, roles: ALL, range: true, branch: 'optional', Comp: SalesReport },
  { id: 'pl', group: 'Sales', label: 'Profit & loss', hint: 'Revenue against expenses', icon: Landmark, roles: OWNER, range: true, branch: 'optional', Comp: ProfitLossReport },
  { id: 'customers', group: 'People', label: 'Customers', hint: 'New, returning, win-back list', icon: Users, roles: MGR, range: true, branch: 'optional', Comp: CustomersReport },
  { id: 'staff', group: 'People', label: 'Staff', hint: 'Services and revenue per employee', icon: Star, roles: MGR, range: true, branch: 'optional', Comp: StaffReport },
  { id: 'catalog', group: 'Catalog', label: 'Services & products', hint: 'What sells, what is slowing', icon: Scissors, roles: MGR, range: true, branch: 'optional', Comp: CatalogReport },
  { id: 'inventory', group: 'Stock', label: 'Stock levels', hint: 'Low stock and expiring items', icon: Package, roles: MGR, range: false, branch: 'none', legacy: true },
  { id: 'stock-snapshot', group: 'Stock', label: 'Stock value', hint: 'Value of stock at every location', icon: BoxesIcon, roles: OWNER, range: false, branch: 'none', legacy: true },
  { id: 'wh-stock', group: 'Stock', label: 'Warehouse stock', hint: 'On hand in a warehouse', icon: Warehouse, roles: OWNER, range: false, branch: 'warehouse', legacy: true },
  { id: 'wh-purchases', group: 'Stock', label: 'Warehouse purchases', hint: 'Bought from suppliers', icon: BadgeIndianRupee, roles: OWNER, range: true, branch: 'warehouse', legacy: true },
  { id: 'wh-transfers', group: 'Stock', label: 'Transfers out', hint: 'Sent from a warehouse to branches', icon: ArrowRightLeft, roles: OWNER, range: true, branch: 'warehouse', legacy: true },
  { id: 'service-liability', group: 'Money', label: 'Pending services', hint: 'Paid for, not yet delivered', icon: TrendingDown, roles: MGR, range: true, branch: 'optional', legacy: true },
  { id: 'supplier-credit', group: 'Money', label: 'Supplier credit', hint: 'What you owe suppliers', icon: Wallet, roles: MGR, range: false, branch: 'optional', legacy: true },
  { id: 'backbar-consumption', group: 'Backbar', label: 'Backbar usage', hint: 'Bottles, usage and wastage', icon: Droplets, roles: ALL, range: true, branch: 'optional', legacy: true },
]

export default function ReportsPage() {
  const { user } = useSelector((s) => s.auth)
  const [params, setParams] = useSearchParams()
  const role = user?.role
  const ownBranch = user?.branchId || null

  const available = useMemo(() => REPORTS.filter((r) => r.roles.includes(role)), [role])
  const active = available.find((r) => r.id === params.get('r')) || available[0]

  const today = istTodayStr()
  const fallback = rangeFor('30d', today)
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.get('from') || '') ? params.get('from') : fallback.from
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.get('to') || '') ? params.get('to') : fallback.to
  const preset = presetOf(from, to, today)

  const { data: branchesData } = useQuery({
    queryKey: ['branches', 'reports'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: !ownBranch,
  })
  const allBranches = branchesData?.data || []
  const salonBranches = allBranches.filter((b) => b.is_salon !== false)
  const warehouseBranches = allBranches.filter((b) => b.is_warehouse)
  const pickList = active?.branch === 'warehouse' ? warehouseBranches : salonBranches

  const set = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true })
  }

  // Warehouse reports always need a warehouse branch: default to the first one.
  const branchParam = params.get('branch') || ''
  const validBranch = pickList.some((b) => b.branch_id === branchParam) ? branchParam : ''
  useEffect(() => {
    if (active?.branch === 'warehouse' && !validBranch && warehouseBranches.length) set({ branch: warehouseBranches[0].branch_id })
  }, [active?.id, validBranch, warehouseBranches.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const branchId = ownBranch || (active?.branch === 'none' ? '' : validBranch)

  const groups = [...new Set(available.map((r) => r.group))]
  const showBranchPicker = !ownBranch && active?.branch !== 'none' && pickList.length > (active?.branch === 'warehouse' ? 0 : 1)

  if (!active) return <Empty>You do not have access to any reports.</Empty>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500">Pick a report, choose the dates, and export what you need.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Report picker */}
        <nav aria-label="Reports" className="lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <label className="block lg:hidden">
            <span className="sr-only">Report</span>
            <select value={active.id} onChange={(e) => set({ r: e.target.value, branch: '' })} className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium">
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {available.filter((r) => r.group === g).map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="hidden space-y-4 lg:block">
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{g}</p>
                <ul className="space-y-0.5">
                  {available.filter((r) => r.group === g).map((r) => {
                    const on = r.id === active.id
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => set({ r: r.id, branch: '' })}
                          aria-current={on ? 'page' : undefined}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:bg-accent'}`}
                        >
                          <r.icon className="h-4 w-4 shrink-0" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{r.label}</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-4">
          {/* Title + filters */}
          <div className="rounded-2xl border bg-card p-4">
            <div className="mb-3">
              <h2 className="text-lg font-bold">{active.label}</h2>
              <p className="text-sm text-muted-foreground">{active.hint}{active.range ? ` · ${rangeLabel(from, to)}` : ''}</p>
            </div>
            {(active.range || showBranchPicker) && (
              <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                {active.range && (
                  <>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date range">
                      {PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { const r = rangeFor(p.id, today); set({ from: r.from, to: r.to }) }}
                          aria-pressed={preset === p.id}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${preset === p.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent'}`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <input type="date" aria-label="From" value={from} max={to} onChange={(e) => e.target.value && set({ from: e.target.value, to })} className="h-8 rounded-md border bg-background px-2 text-xs" />
                      <span className="text-muted-foreground">to</span>
                      <input type="date" aria-label="To" value={to} min={from} max={today} onChange={(e) => e.target.value && set({ from, to: e.target.value })} className="h-8 rounded-md border bg-background px-2 text-xs" />
                    </div>
                  </>
                )}
                {showBranchPicker && (
                  <select value={validBranch} onChange={(e) => set({ branch: e.target.value })} aria-label="Branch" className="h-8 rounded-md border bg-background px-2 text-xs font-medium">
                    {active.branch !== 'warehouse' && <option value="">All branches</option>}
                    {pickList.map((b) => (
                      <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {active.branch === 'warehouse' && !branchId ? (
            <Panel title={active.label}><Empty>No warehouse branch exists yet. Create a branch marked as a warehouse under Branches.</Empty></Panel>
          ) : active.legacy ? (
            <LegacyReports activeReport={active.id} selectedBranch={branchId} startDate={from} endDate={to} />
          ) : (
            <active.Comp key={`${active.id}-${from}-${to}-${branchId}`} from={from} to={to} branchId={branchId} />
          )}
        </div>
      </div>
    </div>
  )
}
