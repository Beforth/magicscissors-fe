import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { incentiveService } from '@/services/incentive.service'
import { branchService } from '@/services/branch.service'
import { formatMoney, PAY_TYPE_LABEL } from '@/lib/payroll'
import { defaultSettings, validateSettings } from '@/lib/incentiveSettings'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Award, CalendarDays, Loader2, Plus, Sunrise, Sunset, Trash2, TrendingUp, UserCheck, Users, Wallet,
} from 'lucide-react'

const errMsg = (err, fallback) => {
  const fields = err?.response?.data?.error?.details?.fields
  if (Array.isArray(fields) && fields.length > 0) return fields.map((f) => f.message).join('; ')
  return err?.response?.data?.error?.message || err?.message || fallback
}

const APPLIED_LABEL = {
  monthly: 'Highest: Monthly earnings',
  before_shift: 'Highest: Before shift',
  after_shift: 'Highest: After shift',
  all: 'All added together',
  service_percent: 'Percent of services',
}

const money = (v) => (v == null ? '—' : formatMoney(v))

const SELECT_CLASS = 'w-full h-10 px-3 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring'

const RULES = {
  monthly: {
    title: 'Monthly earnings',
    icon: CalendarDays,
    tint: 'bg-primary/10 text-primary',
    pick: 'Extra percent when an employee earns a set amount in a month.',
    help: "If an employee's earnings for the month reach the amount below (and are above their own salary), they get this percent of all their earnings. For monthly-salary staff only.",
  },
  before_shift: {
    title: 'Before shift',
    icon: Sunrise,
    tint: 'bg-warning/10 text-warning',
    pick: 'Extra pay for services that start before the shift starts.',
    help: "Services that start before the employee's shift starts earn extra. For monthly and daily staff.",
  },
  after_shift: {
    title: 'After shift',
    icon: Sunset,
    tint: 'bg-info/10 text-info',
    pick: 'Extra pay for services that start after the shift ends.',
    help: "Services that start after the employee's shift ends earn extra. For monthly and daily staff.",
  },
  incentive_staff: {
    title: 'Incentive-based staff',
    icon: Users,
    tint: 'bg-success/10 text-success',
    pick: 'A percent of every service for staff who have no salary.',
    help: 'Staff with no salary get this percent of the price of every service they complete.',
  },
}
const RULE_KEYS = Object.keys(RULES)

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

// Server settings -> editable form state (numbers as strings so inputs can be blank while typing)
const toForm = (s) => ({
  pick_highest: !!s.pick_highest,
  monthly_tiers: (s.monthly_tiers || []).map((t) => ({ earned_amount: String(t.earned_amount), percent: String(t.percent) })),
  before_shift: { type: s.before_shift?.type || 'percent', value: String(s.before_shift?.value ?? 0) },
  after_shift: { type: s.after_shift?.type || 'percent', value: String(s.after_shift?.value ?? 0) },
  incentive_staff_percent: String(s.incentive_staff_percent ?? 0),
})

const toPayload = (f) => ({
  pick_highest: f.pick_highest,
  monthly_tiers: f.monthly_tiers.map((t) => ({
    earned_amount: t.earned_amount === '' ? NaN : Number(t.earned_amount),
    percent: t.percent === '' ? NaN : Number(t.percent),
  })),
  before_shift: { type: f.before_shift.type, value: f.before_shift.value === '' ? NaN : Number(f.before_shift.value) },
  after_shift: { type: f.after_shift.type, value: f.after_shift.value === '' ? NaN : Number(f.after_shift.value) },
  incentive_staff_percent: f.incentive_staff_percent === '' ? NaN : Number(f.incentive_staff_percent),
})

// Which rule cards the saved settings contain something for
const hasRule = (s) => ({
  monthly: (s.monthly_tiers || []).length > 0,
  before_shift: Number(s.before_shift?.value) > 0,
  after_shift: Number(s.after_shift?.value) > 0,
  incentive_staff: Number(s.incentive_staff_percent) > 0,
})

function RuleCard({ kind, onRemove, children }) {
  const rule = RULES[kind]
  const Icon = rule.icon
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', rule.tint)}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-lg">{rule.title}</CardTitle>
              <CardDescription className="mt-1">{rule.help}</CardDescription>
            </div>
          </div>
          <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${rule.title}`} onClick={onRemove}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function ShiftFields({ id, box, onChange }) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1.5 w-full sm:w-56">
        <Label htmlFor={`${id}-type`} className="text-xs font-medium text-foreground">Pay as</Label>
        <select
          id={`${id}-type`}
          className={SELECT_CLASS}
          value={box.type}
          onChange={(e) => onChange({ ...box, type: e.target.value })}
        >
          <option value="percent">% of each service</option>
          <option value="hourly">₹ per hour</option>
        </select>
      </div>
      <div className="space-y-1.5 w-full sm:w-40">
        <Label htmlFor={`${id}-value`} className="text-xs font-medium text-foreground">
          {box.type === 'hourly' ? 'Amount per hour (₹)' : 'Percent (%)'}
        </Label>
        <Input
          id={`${id}-value`}
          type="number" min="0" step="any"
          value={box.value}
          onChange={(e) => onChange({ ...box, value: e.target.value })}
        />
      </div>
    </div>
  )
}

function AddRuleDialog({ open, onOpenChange, shown, onPick }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>What kind of rule?</DialogTitle>
          <DialogDescription>Pick one. You can have one rule of each kind.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {RULE_KEYS.map((k) => {
            const rule = RULES[k]
            const Icon = rule.icon
            const added = shown.includes(k)
            return (
              <button
                key={k}
                type="button"
                disabled={added}
                onClick={() => onPick(k)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors',
                  added ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring',
                )}
              >
                <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', rule.tint)}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{rule.title}</span>
                  <span className="block text-xs text-muted-foreground">{rule.pick}</span>
                </span>
                {added && <Badge variant="secondary">Already added</Badge>}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SettingsSection({ addOpen, setAddOpen }) {
  const queryClient = useQueryClient()
  const { data: res, isLoading, isError, error } = useQuery({
    queryKey: ['incentive-settings'],
    queryFn: incentiveService.getSettings,
  })
  const [form, setForm] = useState(() => toForm(defaultSettings()))
  const [shown, setShown] = useState([])
  const [saved, setSaved] = useState(null) // JSON of the last loaded/saved form

  useEffect(() => {
    if (res?.data) {
      const f = toForm(res.data)
      setForm(f)
      setSaved(JSON.stringify(f))
      const has = hasRule(res.data)
      setShown(RULE_KEYS.filter((k) => has[k]))
    }
  }, [res])

  const save = useMutation({
    mutationFn: (payload) => incentiveService.saveSettings(payload),
    onSuccess: () => {
      toast.success('Incentive settings saved')
      setSaved(JSON.stringify(form))
      queryClient.invalidateQueries({ queryKey: ['incentive-settings'] })
      queryClient.invalidateQueries({ queryKey: ['incentive-report'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-report'] })
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to save settings')),
  })

  const dirty = saved !== null && JSON.stringify(form) !== saved
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setTier = (i, patch) => set({ monthly_tiers: form.monthly_tiers.map((t, k) => (k === i ? { ...t, ...patch } : t)) })

  // A card that is off the page always has its default (off) values, so the form matches what is shown.
  const addRule = (k) => {
    setShown((s) => (s.includes(k) ? s : [...s, k]))
    if (k === 'monthly' && form.monthly_tiers.length === 0) set({ monthly_tiers: [{ earned_amount: '', percent: '' }] })
    setAddOpen(false)
  }
  const removeRule = (k) => {
    setShown((s) => s.filter((x) => x !== k))
    const d = toForm(defaultSettings())
    if (k === 'monthly') set({ monthly_tiers: d.monthly_tiers })
    if (k === 'before_shift') set({ before_shift: d.before_shift })
    if (k === 'after_shift') set({ after_shift: d.after_shift })
    if (k === 'incentive_staff') set({ incentive_staff_percent: d.incentive_staff_percent })
  }

  const handleSave = () => {
    const payload = toPayload(form)
    const problem = validateSettings(payload)
    if (problem) {
      toast.error(problem)
      return
    }
    save.mutate(payload)
  }

  if (isLoading) return <Spinner />
  if (isError) return <p className="text-center text-destructive py-8">{errMsg(error, 'Failed to load settings')}</p>

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-primary"
              checked={form.pick_highest}
              onChange={(e) => set({ pick_highest: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-medium text-foreground">Pay only the highest incentive</span>
              <span className="block text-xs text-muted-foreground">Instead of adding all of them together.</span>
            </span>
          </label>
        </CardContent>
      </Card>

      {shown.length === 0 && (
        <Card>
          <CardContent className="text-center py-10 text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-foreground">No incentive rules yet</p>
            <p className="text-sm">Click Add rule to create one.</p>
            <Button className="mt-4" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add rule
            </Button>
          </CardContent>
        </Card>
      )}

      {shown.includes('monthly') && (
        <RuleCard kind="monthly" onRemove={() => removeRule('monthly')}>
          <div className="space-y-3">
            {form.monthly_tiers.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Earned amount (₹)</TableHead>
                    <TableHead>Percent (%)</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.monthly_tiers.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input
                          aria-label={`Earned amount, row ${i + 1}`}
                          type="number" min="0" step="any" className="w-40"
                          value={t.earned_amount}
                          onChange={(e) => setTier(i, { earned_amount: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-label={`Percent, row ${i + 1}`}
                          type="number" min="0" max="100" step="any" className="w-28"
                          value={t.percent}
                          onChange={(e) => setTier(i, { percent: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button" size="sm" variant="ghost" aria-label={`Remove row ${i + 1}`}
                          onClick={() => set({ monthly_tiers: form.monthly_tiers.filter((_, k) => k !== i) })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button" size="sm" variant="outline"
                disabled={form.monthly_tiers.length >= 20}
                onClick={() => set({ monthly_tiers: [...form.monthly_tiers, { earned_amount: '', percent: '' }] })}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add row
              </Button>
              <span className="text-xs text-muted-foreground">Up to 20 rows.</span>
            </div>
          </div>
        </RuleCard>
      )}

      {shown.includes('before_shift') && (
        <RuleCard kind="before_shift" onRemove={() => removeRule('before_shift')}>
          <ShiftFields id="before" box={form.before_shift} onChange={(b) => set({ before_shift: b })} />
        </RuleCard>
      )}

      {shown.includes('after_shift') && (
        <RuleCard kind="after_shift" onRemove={() => removeRule('after_shift')}>
          <ShiftFields id="after" box={form.after_shift} onChange={(b) => set({ after_shift: b })} />
        </RuleCard>
      )}

      {shown.includes('incentive_staff') && (
        <RuleCard kind="incentive_staff" onRemove={() => removeRule('incentive_staff')}>
          <div className="space-y-1.5 w-full sm:w-40">
            <Label htmlFor="inc-staff-percent" className="text-xs font-medium text-foreground">Percent (%)</Label>
            <Input
              id="inc-staff-percent"
              type="number" min="0" max="100" step="any"
              value={form.incentive_staff_percent}
              onChange={(e) => set({ incentive_staff_percent: e.target.value })}
            />
          </div>
        </RuleCard>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!dirty || save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
        {dirty && <span className="text-xs text-muted-foreground">You have unsaved changes.</span>}
      </div>

      <AddRuleDialog open={addOpen} onOpenChange={setAddOpen} shown={shown} onPick={addRule} />
    </div>
  )
}

function SummaryTile({ icon: Icon, tint, label, value, sub }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', tint)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="block truncate text-base font-bold tabular-nums leading-tight text-foreground sm:text-xl">{value}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </div>
    </div>
  )
}

function ResultsCard() {
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

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
  const grand = employees.reduce((t, e) => t + Number(e.paid_incentive || 0), 0)
  const paidCount = employees.filter((e) => Number(e.paid_incentive || 0) > 0).length
  const top = employees.reduce((best, e) => (Number(e.paid_incentive || 0) > Number(best?.paid_incentive || 0) ? e : best), null)
  const hasTop = !!top && Number(top.paid_incentive) > 0

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 w-full sm:w-64">
              <Label htmlFor="inc-branch" className="text-xs font-medium text-foreground">Branch</Label>
              <select
                id="inc-branch"
                className={SELECT_CLASS}
                value={branchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
              >
                {branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 w-full sm:w-48">
              <Label htmlFor="inc-month" className="text-xs font-medium text-foreground">Month</Label>
              <Input id="inc-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {employees.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile icon={Wallet} tint="bg-primary/10 text-primary" label="Total paid this month" value={formatMoney(grand)} />
          <SummaryTile icon={UserCheck} tint="bg-success/10 text-success" label="Employees paid" value={`${paidCount} of ${employees.length}`} />
          <SummaryTile
            icon={TrendingUp}
            tint="bg-info/10 text-info"
            label="Highest earner"
            value={hasTop ? top.full_name : '—'}
            sub={hasTop ? formatMoney(top.paid_incentive) : undefined}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            Results
          </CardTitle>
          <CardDescription>What each employee earns for the month. Added to net pay in Payroll.</CardDescription>
        </CardHeader>
        <CardContent>
          {!branchId || !month ? (
            <p className="text-center text-muted-foreground py-8">Select a branch and month.</p>
          ) : isLoading ? (
            <Spinner />
          ) : isError ? (
            <p className="text-center text-destructive py-8">{errMsg(error, 'Failed to load incentives')}</p>
          ) : employees.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No employees to report for this branch.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Pay type</TableHead>
                    <TableHead className="text-right">Salary</TableHead>
                    <TableHead className="text-right">Earnings</TableHead>
                    <TableHead className="text-right">Monthly earnings</TableHead>
                    <TableHead className="text-right">Before shift</TableHead>
                    <TableHead className="text-right">After shift</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => (
                    <TableRow key={e.employee_id}>
                      <TableCell>
                        <div className="font-medium">{e.full_name}</div>
                        {(e.warnings || []).map((w) => (
                          <div key={w} className="text-xs text-warning">{w}</div>
                        ))}
                      </TableCell>
                      <TableCell>{e.pay_type ? PAY_TYPE_LABEL[e.pay_type] || e.pay_type : '—'}</TableCell>
                      <TableCell className="text-right">{money(e.base_salary)}</TableCell>
                      <TableCell className="text-right">{money(e.earnings)}</TableCell>
                      <TableCell className="text-right">{money(e.monthly_incentive)}</TableCell>
                      <TableCell className="text-right">{money(e.before_shift_incentive)}</TableCell>
                      <TableCell className="text-right">{money(e.after_shift_incentive)}</TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{money(e.paid_incentive)}</div>
                        {e.applied && (
                          <Badge variant={e.applied.startsWith('Highest') || ['monthly', 'before_shift', 'after_shift'].includes(e.applied) ? 'info' : 'secondary'} className="mt-1">
                            {APPLIED_LABEL[e.applied] || e.applied}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>Total</TableCell>
                    <TableCell colSpan={6} />
                    <TableCell className="text-right">{formatMoney(grand)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">
                Paid = the highest of the three when the checkbox is on, otherwise their sum.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function IncentivesPage() {
  const { user } = useSelector((s) => s.auth)
  const [addOpen, setAddOpen] = useState(false)
  if (user?.role !== 'owner') return <Navigate to="/" replace />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Incentives</h1>
          <p className="text-muted-foreground">Extra pay for staff, based on the services they complete. Same rules for all branches.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add rule
        </Button>
      </div>

      <SettingsSection addOpen={addOpen} setAddOpen={setAddOpen} />
      <ResultsCard />
    </div>
  )
}
