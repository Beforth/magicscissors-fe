import { Fragment, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { incentiveService } from '@/services/incentive.service'
import { branchService } from '@/services/branch.service'
import { formatMoney } from '@/lib/payroll'
import { WEEK_DAYS } from '@/lib/incentiveRules'
import RuleFormModal from '@/components/incentives/RuleFormModal'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'

const errMsg = (err, fallback) => err?.response?.data?.error?.message || err?.message || fallback
const lbl = (pairs, v) => pairs[v] || v

const PERIOD = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }
const APPLIES = { both: 'All staff', monthly: 'Monthly-paid', daily: 'Daily-paid' }
const WINDOW = { all: 'Any time', in_shift: 'During shift', after_shift: 'After shift', before_shift: 'Before shift' }
const BASIS = { whole: 'Whole amount', excess: 'Excess' }

function thresholdText(r) {
  if (r.threshold_type === 'fixed') return formatMoney(r.threshold_value)
  if (r.threshold_type === 'salary_multiple') return `${r.threshold_value} × salary`
  return 'None'
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  )
}

function WeekStartCard() {
  const queryClient = useQueryClient()
  const { data: res } = useQuery({ queryKey: ['incentive-settings'], queryFn: incentiveService.getSettings })
  const save = useMutation({
    mutationFn: (week_start) => incentiveService.setSettings({ week_start }),
    onSuccess: () => {
      toast.success('Week start saved')
      queryClient.invalidateQueries({ queryKey: ['incentive-settings'] })
      queryClient.invalidateQueries({ queryKey: ['incentive-report'] })
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to save week start')),
  })
  const value = res?.data?.week_start

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="inc-week" className="text-sm">Week starts on</Label>
      <select
        id="inc-week"
        className="h-9 px-3 border rounded-md bg-white text-sm"
        value={value ?? ''}
        disabled={value === undefined || save.isPending}
        onChange={(e) => save.mutate(Number(e.target.value))}
      >
        {WEEK_DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
      </select>
    </div>
  )
}

function RulesCard() {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState({ open: false, rule: null })
  const { data: res, isLoading, isError, error } = useQuery({
    queryKey: ['incentive-rules'],
    queryFn: incentiveService.listRules,
  })
  const rules = res?.data || []

  const done = (msg) => {
    toast.success(msg)
    queryClient.invalidateQueries({ queryKey: ['incentive-rules'] })
    queryClient.invalidateQueries({ queryKey: ['incentive-report'] })
    queryClient.invalidateQueries({ queryKey: ['payroll-report'] })
  }
  const save = useMutation({
    mutationFn: ({ id, payload }) => (id ? incentiveService.updateRule(id, payload) : incentiveService.createRule(payload)),
    onSuccess: (_r, v) => {
      done(v.id ? 'Rule saved' : 'Rule added')
      setModal({ open: false, rule: null })
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to save rule')),
  })
  const toggle = useMutation({
    mutationFn: (r) => incentiveService.updateRule(r.id, { enabled: !r.enabled }),
    onSuccess: () => done('Rule updated'),
    onError: (err) => toast.error(errMsg(err, 'Failed to update rule')),
  })
  const remove = useMutation({
    mutationFn: (id) => incentiveService.deleteRule(id),
    onSuccess: () => done('Rule deleted'),
    onError: (err) => toast.error(errMsg(err, 'Failed to delete rule')),
  })

  const handleDelete = (r) => {
    if (window.confirm(`Delete the rule "${r.name}"? This cannot be undone.`)) remove.mutate(r.id)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Incentive rules</CardTitle>
            <CardDescription>
              Each rule pays a percentage of matching service revenue. Every setting can be changed at any time; changes
              apply to the whole month shown below (past payroll figures included).
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <WeekStartCard />
            <Button size="sm" onClick={() => setModal({ open: true, rule: null })}>
              <Plus className="h-4 w-4 mr-1" />
              Add rule
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Spinner />
        ) : isError ? (
          <p className="text-center text-red-500 py-8">{errMsg(error, 'Failed to load rules')}</p>
        ) : rules.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No incentive rules yet. Add one to get started.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Applies to</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Basis</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id} className={r.enabled ? '' : 'opacity-60'}>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    {r.exclude_from_other_rules && <div className="text-xs text-gray-500">Excludes from later rules</div>}
                  </TableCell>
                  <TableCell>{lbl(PERIOD, r.period)}</TableCell>
                  <TableCell>{lbl(APPLIES, r.pay_types)}</TableCell>
                  <TableCell>{lbl(WINDOW, r.service_window)}</TableCell>
                  <TableCell>{thresholdText(r)}</TableCell>
                  <TableCell>{lbl(BASIS, r.payout_basis)}</TableCell>
                  <TableCell className="text-right">{r.rate_percent}%</TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Enable ${r.name}`}
                      checked={r.enabled}
                      disabled={toggle.isPending}
                      onChange={() => toggle.mutate(r)}
                    />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" aria-label={`Edit ${r.name}`} onClick={() => setModal({ open: true, rule: r })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Delete ${r.name}`} disabled={remove.isPending} onClick={() => handleDelete(r)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <RuleFormModal
        open={modal.open}
        rule={modal.rule}
        saving={save.isPending}
        onClose={() => setModal({ open: false, rule: null })}
        onSave={(payload) => save.mutate({ id: modal.rule?.id, payload })}
      />
    </Card>
  )
}

function ResultsCard() {
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [open, setOpen] = useState({})

  const { data: branchesData } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
  })
  const branches = branchesData?.data || []
  const branchId = selectedBranchId || branches[0]?.branch_id || ''

  const { data: res, isLoading, isError, error } = useQuery({
    queryKey: ['incentive-report', branchId, month],
    queryFn: () => incentiveService.getReport(branchId, month),
    enabled: !!branchId && !!month,
  })
  const employees = res?.data?.employees || []
  const grand = employees.reduce((t, e) => t + Number(e.total_incentive || 0), 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Incentive results</CardTitle>
            <CardDescription>What each employee earns under the enabled rules. Added to net pay in Payroll.</CardDescription>
          </div>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="inc-branch" className="text-xs font-medium text-gray-700">Branch</Label>
              <select
                id="inc-branch"
                className="h-9 px-3 border rounded-md bg-white text-sm"
                value={branchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
              >
                {branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inc-month" className="text-xs font-medium text-gray-700">Month</Label>
              <Input id="inc-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!branchId || !month ? (
          <p className="text-center text-gray-500 py-8">Select a branch and month.</p>
        ) : isLoading ? (
          <Spinner />
        ) : isError ? (
          <p className="text-center text-red-500 py-8">{errMsg(error, 'Failed to load incentives')}</p>
        ) : employees.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No employees to report for this branch.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Pay type</TableHead>
                <TableHead className="text-right">Salary</TableHead>
                <TableHead className="text-right">Incentive</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => {
                const isOpen = !!open[e.employee_id]
                return (
                  <Fragment key={e.employee_id}>
                    <TableRow className="cursor-pointer" onClick={() => setOpen((p) => ({ ...p, [e.employee_id]: !isOpen }))}>
                      <TableCell>
                        <div className="flex items-center gap-1 font-medium">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {e.full_name}
                        </div>
                        {(e.warnings || []).map((w) => (
                          <div key={w} className="text-xs text-amber-600 pl-5">{w}</div>
                        ))}
                      </TableCell>
                      <TableCell>{e.pay_type ? lbl({ daily: 'Daily', monthly: 'Monthly' }, e.pay_type) : '—'}</TableCell>
                      <TableCell className="text-right">{e.base_salary == null ? '—' : formatMoney(e.base_salary)}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(e.total_incentive)}</TableCell>
                    </TableRow>
                    {isOpen && (e.rules || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="pl-8 text-sm text-gray-500">No rules applied.</TableCell>
                      </TableRow>
                    )}
                    {isOpen && (e.rules || []).map((rule) => (
                      <Fragment key={rule.rule_id}>
                        <TableRow className="bg-gray-50">
                          <TableCell colSpan={3} className="pl-8 text-sm font-medium">{rule.rule_name}</TableCell>
                          <TableCell className="text-right text-sm font-medium">{formatMoney(rule.payout)}</TableCell>
                        </TableRow>
                        {(rule.periods || []).map((p) => (
                          <TableRow key={`${rule.rule_id}-${p.key}`}>
                            <TableCell colSpan={3} className="pl-12 text-xs text-gray-600">
                              {p.key} · {p.matched_count} service(s) · total {formatMoney(p.total)}
                              {p.threshold != null && ` · threshold ${formatMoney(p.threshold)} ${p.met ? 'met' : 'not met'}`}
                            </TableCell>
                            <TableCell className="text-right text-xs">{formatMoney(p.payout)}</TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    ))}
                  </Fragment>
                )
              })}
              <TableRow className="font-bold bg-gray-50">
                <TableCell>Total</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right">{formatMoney(grand)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export default function IncentivesPage() {
  const { user } = useSelector((s) => s.auth)
  if (user?.role !== 'owner') return <Navigate to="/" replace />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Incentives</h1>
        <p className="text-gray-500">Rules for service-revenue incentives and what each employee earns</p>
      </div>
      <RulesCard />
      <ResultsCard />
    </div>
  )
}
