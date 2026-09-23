import { useState, useMemo, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
  Lock,
  RefreshCw,
  Wallet,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatCurrency } from '@/lib/utils'
import { branchService } from '@/services/branch.service'
import { employeeIncentiveService } from '@/services/employeeIncentive.service'

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i).toLocaleString('default', { month: 'long' }),
}))

const YEARS = (() => {
  const now = new Date().getFullYear()
  const out = []
  for (let y = now - 1; y <= now + 1; y += 1) out.push(y)
  return out
})()

export function priorityLabel(p, targetMet) {
  if (p === 1 || targetMet) return { text: 'Target met', tone: 'bg-emerald-100 text-emerald-800' }
  if (p === 2) return { text: 'Star tier', tone: 'bg-blue-100 text-blue-800' }
  if (p === 3) return { text: 'Daily earnings', tone: 'bg-amber-100 text-amber-800' }
  return { text: 'Below target', tone: 'bg-gray-100 text-gray-700' }
}

export function monthYearFromDate(dateStr) {
  if (!dateStr) return null
  const [y, m] = dateStr.split('-').map(Number)
  if (!y || !m) return null
  return { year: y, month: m }
}

export function monthLabel(year, month) {
  return new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

/**
 * Staff monthly incentives (P1/P2/P3 + punctuality).
 * When `embedded`, year/month/branch come from props; otherwise internal selectors are shown.
 */
export default function StaffIncentivesSection({
  year: controlledYear,
  month: controlledMonth,
  branchId: controlledBranchId = '',
  employeeId = '',
  embedded = false,
  showOwnerActions = false,
  showBranchFilter = true,
  id,
  title = 'Staff Incentives',
  description,
  multiMonthNote,
}) {
  const queryClient = useQueryClient()
  const today = new Date()
  const [internalYear, setInternalYear] = useState(today.getFullYear())
  const [internalMonth, setInternalMonth] = useState(today.getMonth() + 1)
  const [internalBranchId, setInternalBranchId] = useState('')
  const [expanded, setExpanded] = useState({})

  const year = embedded ? controlledYear : internalYear
  const month = embedded ? controlledMonth : internalMonth
  const branchId = embedded ? (controlledBranchId || '') : internalBranchId

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: !embedded && showBranchFilter,
  })
  const branches = branchesData?.data || []

  const queryKey = useMemo(
    () => ['employee-incentives', { year, month, branchId: branchId || null }],
    [year, month, branchId]
  )

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      employeeIncentiveService.list({
        year,
        month,
        ...(branchId ? { branchId } : {}),
      }),
    enabled: !!year && !!month,
  })

  const allRows = Array.isArray(data?.data) ? data.data : []
  const rows = useMemo(() => {
    if (!employeeId) return allRows
    return allRows.filter((r) => r.employee_id === employeeId)
  }, [allRows, employeeId])

  const lockMutation = useMutation({
    mutationFn: () =>
      employeeIncentiveService.lock({ year, month, ...(branchId ? { branchId } : {}) }),
    onSuccess: (resp) => {
      toast.success(`Locked ${resp?.data?.results?.length || 0} employee(s) for ${month}/${year}`)
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to lock month'),
  })

  const recomputeMutation = useMutation({
    mutationFn: (employeeIds) =>
      employeeIncentiveService.recompute({ year, month, employeeIds }),
    onSuccess: () => {
      toast.success('Recomputed')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to recompute'),
  })

  const disburseMutation = useMutation({
    mutationFn: (employeeIds) =>
      employeeIncentiveService.disburse({
        year,
        month,
        ...(employeeIds ? { employeeIds } : {}),
      }),
    onSuccess: (resp) => {
      const results = resp?.data?.results || []
      const ok = results.filter((r) => r.status === 'disbursed').length
      const skipped = results.length - ok
      toast.success(
        `Disbursed ${ok} expense row(s)${skipped ? ` (${skipped} skipped)` : ''}`
      )
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to disburse'),
  })

  const totals = useMemo(() => {
    let revenue = 0
    let stars = 0
    let target = 0
    let monthlyStar = 0
    let daily = 0
    let punctuality = 0
    let female = 0
    let total = 0
    for (const r of rows) {
      revenue += Number(r.service_revenue || 0)
      stars += Number(r.total_stars || 0)
      target += Number(r.target_incentive || 0)
      monthlyStar += Number(r.monthly_star_incentive || 0)
      daily += Number(r.daily_incentive || 0) + Number(r.daily_star_incentive || 0)
      punctuality += Number(r.punctuality_amount || 0)
      female += Number(r.female_incentive || 0)
      total += Number(r.total_incentive || 0)
    }
    return { revenue, stars, target, monthlyStar, daily, punctuality, female, total }
  }, [rows])

  const anyLocked = rows.some((r) => r.locked_at)
  const allLocked = rows.length > 0 && rows.every((r) => r.locked_at)

  const defaultDescription = embedded
    ? `Full calendar month ${monthLabel(year, month)} (based on the filter end date). Service stars and earnings in this table are for the entire month, not just the selected date range.`
    : 'Per-employee monthly incentive computed from bills, attendance, and the branch incentive config. Live by default; lock the month to freeze numbers for payroll.'

  return (
    <Card id={id}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {showOwnerActions && (
              <CardDescription>{description ?? defaultDescription}</CardDescription>
            )}
          </div>
          {!embedded && (
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <Label className="text-xs">Year</Label>
                <SearchableSelect
                  options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
                  value={String(year)}
                  onChange={(v) => setInternalYear(Number(v))}
                  triggerClassName="w-[110px]"
                />
              </div>
              <div>
                <Label className="text-xs">Month</Label>
                <SearchableSelect
                  options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
                  value={String(month)}
                  onChange={(v) => setInternalMonth(Number(v))}
                  triggerClassName="w-[140px]"
                />
              </div>
              {showBranchFilter && (
                <div>
                  <Label className="text-xs">Branch</Label>
                  <SearchableSelect
                    options={[
                      { value: 'all', label: 'All branches' },
                      ...branches.map((b) => ({ value: b.branch_id || b.id, label: b.name })),
                    ]}
                    value={branchId || 'all'}
                    onChange={(v) => setInternalBranchId(v === 'all' ? '' : v)}
                    triggerClassName="w-[180px]"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {showOwnerActions && multiMonthNote && (
          <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2 mb-3 flex items-start gap-2">
            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            {multiMonthNote}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-4">
          <div className="p-3 rounded border">
            <div className="text-xs text-gray-500">Earnings</div>
            <div className="text-lg font-semibold">{formatCurrency(totals.revenue)}</div>
          </div>
          <div className="p-3 rounded border">
            <div className="text-xs text-gray-500">Stars</div>
            <div className="text-lg font-semibold">{Math.round(totals.stars)}</div>
          </div>
          <div className="p-3 rounded border">
            <div className="text-xs text-gray-500">Target bonus</div>
            <div className="text-lg font-semibold">{formatCurrency(totals.target)}</div>
          </div>
          <div className="p-3 rounded border">
            <div className="text-xs text-gray-500">Star bonus</div>
            <div className="text-lg font-semibold">{formatCurrency(totals.monthlyStar)}</div>
          </div>
          <div className="p-3 rounded border">
            <div className="text-xs text-gray-500">Daily bonus</div>
            <div className="text-lg font-semibold">{formatCurrency(totals.daily)}</div>
          </div>
          <div className="p-3 rounded border">
            <div className="text-xs text-gray-500">Punctuality</div>
            <div className="text-lg font-semibold">{formatCurrency(totals.punctuality)}</div>
          </div>
          <div className="p-3 rounded border">
            <div className="text-xs text-gray-500">Female add-ons</div>
            <div className="text-lg font-semibold">{formatCurrency(totals.female)}</div>
          </div>
          <div className="p-3 rounded border bg-primary/5 border-primary/20">
            <div className="text-xs text-gray-500">Total payout</div>
            <div className="text-lg font-bold text-primary">{formatCurrency(totals.total)}</div>
          </div>
        </div>

        {showOwnerActions && (
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh live
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (window.confirm(`Lock ${month}/${year} for payroll? Subsequent edits to bills won't change the locked numbers.`)) {
                  lockMutation.mutate()
                }
              }}
              disabled={lockMutation.isPending}
            >
              <Lock className="h-3 w-3 mr-1" />
              {anyLocked ? 'Re-lock month' : 'Lock month for payroll'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (window.confirm(`Recompute all locked snapshots for ${month}/${year}? Disbursed rows are skipped.`)) {
                  recomputeMutation.mutate(undefined)
                }
              }}
              disabled={!anyLocked || recomputeMutation.isPending}
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Recompute snapshot
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (window.confirm(`Create Expense rows for all undisbursed locked employees in ${month}/${year}?`)) {
                  disburseMutation.mutate(undefined)
                }
              }}
              disabled={!allLocked || disburseMutation.isPending}
            >
              <Wallet className="h-3 w-3 mr-1" /> Disburse all
            </Button>
          </div>
        )}

        {!allLocked && rows.length > 0 && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3 flex items-start gap-2">
            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            Numbers below are <strong>projected</strong> (live). Lock the month to freeze
            them before disbursing.
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm">
            {employeeId
              ? 'No staff incentive data for this employee in the selected month (base salary may not be configured).'
              : 'No employees with base salary configured. Set a base salary on the staff form to include an employee in incentive computation.'}
          </div>
        ) : (
          <div className="border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Earnings</TableHead>
                  <TableHead className="text-right">Stars</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Performance</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Payroll</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const open = !!expanded[r.employee_id]
                  const lab = priorityLabel(r.priority_applied, r.target_met)
                  const attendanceBonus = Number(r.punctuality_amount || 0) + Number(r.female_incentive || 0)
                  return (
                    <Fragment key={r.employee_id}>
                      <TableRow
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() =>
                          setExpanded((s) => ({ ...s, [r.employee_id]: !s[r.employee_id] }))
                        }
                      >
                        <TableCell>
                          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </TableCell>
                        <TableCell className="font-medium">
                          {r.full_name}
                          <div className="text-xs text-gray-500">{r.branch_name}</div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(r.base_salary)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.target_amount ?? r.p1_threshold)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.service_revenue)}</TableCell>
                        <TableCell className="text-right">{Math.round(Number(r.total_stars || 0))}</TableCell>
                        <TableCell>
                          <span className={`inline-block px-2 py-0.5 text-xs rounded ${lab.tone}`}>
                            {lab.text}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(r.monthly_amount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(attendanceBonus)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(r.total_incentive)}
                        </TableCell>
                        <TableCell>
                          {r.disbursed_at ? (
                            <Badge variant="default">Disbursed</Badge>
                          ) : r.locked_at ? (
                            <Badge variant="secondary">Locked</Badge>
                          ) : (
                            <Badge variant="outline">Live</Badge>
                          )}
                        </TableCell>
                      </TableRow>

                      {open && (
                        <TableRow>
                          <TableCell colSpan={11} className="bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-3 px-2">
                              <div>
                                <div className="text-sm font-semibold mb-2">Target &amp; stars</div>
                                <ul className="text-xs space-y-1 text-gray-700">
                                  <li>
                                    Stars earned this month:{' '}
                                    <strong>{Math.round(Number(r.total_stars || 0))}</strong>
                                    {' '}({r.service_count || 0} service{(r.service_count || 0) === 1 ? '' : 's'})
                                  </li>
                                  <li>
                                    Monthly target: <strong>{formatCurrency(r.target_amount ?? r.p1_threshold)}</strong>
                                    {' '}({r.target_met ? 'met' : 'not met'})
                                  </li>
                                  <li>Target bonus (10% of target): <strong>{formatCurrency(r.target_incentive || 0)}</strong></li>
                                  <li>
                                    Monthly star bonus:{' '}
                                    {r.monthly_star_tier || r.p2_tier_matched ? (
                                      <span className="text-blue-700">
                                        ≥{(r.monthly_star_tier || r.p2_tier_matched).minStars} stars →{' '}
                                        {((r.monthly_star_tier || r.p2_tier_matched).rate * 100).toFixed(0)}% ={' '}
                                        <strong>{formatCurrency(r.monthly_star_incentive || 0)}</strong>
                                      </span>
                                    ) : Number(r.total_stars || 0) > 0 ? (
                                      <span className="text-gray-500">
                                        No tier yet ({Math.round(Number(r.total_stars))} stars
                                        {!r.target_met ? ' — monthly star % applies only after target is met' : ''}
                                        {' '}· tiers from ≥450 stars/month)
                                      </span>
                                    ) : (
                                      <span className="text-gray-500">No stars recorded this month yet</span>
                                    )}
                                  </li>
                                  <li>Effective salary for daily threshold: {formatCurrency(r.effective_salary ?? 0)}</li>
                                  <li>Daily threshold: {formatCurrency(r.daily_threshold ?? 0)}</li>
                                </ul>
                              </div>
                              <div>
                                <div className="text-sm font-semibold mb-2">Daily incentives</div>
                                <ul className="text-xs space-y-1 text-gray-700">
                                  <li>Daily earnings bonus: <strong>{formatCurrency(r.daily_incentive || 0)}</strong></li>
                                  <li>
                                    Daily star bonus:{' '}
                                    <strong>{formatCurrency(r.daily_star_incentive || 0)}</strong>
                                    {Number(r.daily_star_incentive || 0) === 0 && Number(r.total_stars || 0) > 0 && (
                                      <span className="text-gray-500"> (tiers from ≥15 stars/day)</span>
                                    )}
                                  </li>
                                  <li>Qualifying days: {r.daily_qualifying_days ?? r.p3_days_qualifying ?? 0}</li>
                                </ul>
                                {(r.daily_breakdown || []).length > 0 && (
                                  <ul className="text-xs space-y-1 text-gray-600 mt-2 max-h-32 overflow-y-auto">
                                    {r.daily_breakdown.slice(0, 8).map((d) => (
                                      <li key={d.date}>
                                        {d.date}: {formatCurrency(d.earnings)} / {d.stars}★ → {formatCurrency((d.daily_incentive || 0) + (d.daily_star_incentive || 0))}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-semibold mb-2">Punctuality &amp; female add-ons</div>
                                {r.punctuality_breakdown && r.punctuality_breakdown.length > 0 ? (
                                  <ul className="text-xs space-y-1 text-gray-700 mb-2">
                                    {r.punctuality_breakdown.map((t, i) => (
                                      <li key={i}>
                                        {t.arrival_time ? `By ${t.arrival_time}` : `≥${t.minutes_early} min early`} → ₹{t.amount}{' '}
                                        × {t.days} day(s) = <strong>{formatCurrency(t.total)}</strong>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-gray-500 mb-2">No punctuality bonus</p>
                                )}
                                {r.female_breakdown && r.female_breakdown.length > 0 ? (
                                  <ul className="text-xs space-y-1 text-gray-700">
                                    {r.female_breakdown.map((t, i) => (
                                      <li key={i}>
                                        {t.label}: {t.days} day(s) = <strong>{formatCurrency(t.total)}</strong>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-gray-500">
                                    {r.gender === 'female' ? 'No female add-on days' : 'N/A (not female)'}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
