import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { incentiveService } from '@/services/incentive.service'
import { branchService } from '@/services/branch.service'
import { formatMoney, PAY_TYPE_LABEL } from '@/lib/payroll'
import { defaultSettings, validateSettings } from '@/lib/incentiveSettings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Plus, Trash2 } from 'lucide-react'

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

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
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

function ShiftBox({ id, title, text, box, onChange }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor={`${id}-type`} className="text-xs font-medium text-gray-700">Pay as</Label>
            <select
              id={`${id}-type`}
              className="h-10 px-3 border rounded-md bg-white text-sm"
              value={box.type}
              onChange={(e) => onChange({ ...box, type: e.target.value })}
            >
              <option value="percent">% of each service</option>
              <option value="hourly">₹ per hour</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-value`} className="text-xs font-medium text-gray-700">Value</Label>
            <Input
              id={`${id}-value`}
              type="number"
              min="0"
              step="any"
              className="w-32"
              value={box.value}
              onChange={(e) => onChange({ ...box, value: e.target.value })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SettingsSection() {
  const queryClient = useQueryClient()
  const { data: res, isLoading, isError, error } = useQuery({
    queryKey: ['incentive-settings'],
    queryFn: incentiveService.getSettings,
  })
  const [form, setForm] = useState(() => toForm(defaultSettings()))
  const [saved, setSaved] = useState(null) // JSON of the last loaded/saved form

  useEffect(() => {
    if (res?.data) {
      const f = toForm(res.data)
      setForm(f)
      setSaved(JSON.stringify(f))
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
  if (isError) return <p className="text-center text-red-500 py-8">{errMsg(error, 'Failed to load settings')}</p>

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={form.pick_highest}
          onChange={(e) => set({ pick_highest: e.target.checked })}
        />
        Pay only the highest incentive (instead of adding all of them)
      </label>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly earnings</CardTitle>
          <CardDescription>
            If an employee&apos;s earnings for the month reach the amount below (and are above their own salary), they get this percent of all their earnings.
            For monthly-salary staff only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Button
            type="button" size="sm" variant="outline"
            disabled={form.monthly_tiers.length >= 20}
            onClick={() => set({ monthly_tiers: [...form.monthly_tiers, { earned_amount: '', percent: '' }] })}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add row
          </Button>
        </CardContent>
      </Card>

      <ShiftBox
        id="before"
        title="Before shift"
        text="Services that start before the employee's shift starts earn extra. For monthly and daily staff."
        box={form.before_shift}
        onChange={(b) => set({ before_shift: b })}
      />
      <ShiftBox
        id="after"
        title="After shift"
        text="Services that start after the employee's shift ends earn extra. For monthly and daily staff."
        box={form.after_shift}
        onChange={(b) => set({ after_shift: b })}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Incentive-based staff</CardTitle>
          <CardDescription>Staff with no salary get this percent of the price of every service they complete.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <Label htmlFor="inc-staff-percent" className="text-xs font-medium text-gray-700">Percent (%)</Label>
            <Input
              id="inc-staff-percent"
              type="number" min="0" max="100" step="any" className="w-32"
              value={form.incentive_staff_percent}
              onChange={(e) => set({ incentive_staff_percent: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={!dirty || save.isPending}>
        {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save
      </Button>
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

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Results</CardTitle>
            <CardDescription>What each employee earns for the month. Added to net pay in Payroll.</CardDescription>
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
                        <div key={w} className="text-xs text-amber-600">{w}</div>
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
                      {e.applied && <div className="text-xs text-gray-500">{APPLIED_LABEL[e.applied] || e.applied}</div>}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-gray-50">
                  <TableCell>Total</TableCell>
                  <TableCell colSpan={6} />
                  <TableCell className="text-right">{formatMoney(grand)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-gray-500">
              Paid = the highest of the three when the checkbox is on, otherwise their sum.
            </p>
          </>
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
        <p className="text-gray-500">Extra pay for staff, based on the services they complete. Same settings for all branches; change them any time.</p>
      </div>
      <SettingsSection />
      <ResultsCard />
    </div>
  )
}
