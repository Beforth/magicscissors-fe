import { Fragment, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { payrollService } from '@/services/payroll.service'
import { branchService } from '@/services/branch.service'
import { payrollTotals, reportCsvRows, formatMoney } from '@/lib/payroll'
import { exportToCSV } from '@/lib/export-utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Download, Loader2 } from 'lucide-react'

const CSV_COLUMNS = [
  'employee_code', 'full_name', 'pay_type', 'wage_amount', 'days_worked', 'half_days',
  'hours_worked', 'late_deduction_hours', 'gross', 'late_deduction_amount', 'late_fine_amount', 'net_pay', 'warnings',
]
const CSV_HEADERS = [
  'Code', 'Employee', 'Pay type', 'Wage', 'Days worked', 'Half days',
  'Hours worked', 'Late deducted (hours)', 'Gross', 'Late deduction', 'Late fine (₹)', 'Net pay', 'Warnings',
]
const PAY_TYPE_LABEL = { daily: 'Daily', monthly: 'Monthly' }
const errMsg = (err, fallback) => err?.response?.data?.error?.message || err?.message || fallback

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  )
}

function ReportTab({ branchId, month }) {
  const { data: res, isLoading, isError, error } = useQuery({
    queryKey: ['payroll-report', branchId, month],
    queryFn: () => payrollService.getReport(branchId, month),
    enabled: !!branchId && !!month,
  })
  const rows = res?.data?.rows || []
  const settings = res?.data?.settings
  const totals = payrollTotals(rows)
  const hasServiceTime = rows.some((r) => r.service_time)

  const divisor = settings?.monthly_days_mode === 'fixed'
    ? `${settings.monthly_fixed_days} fixed days`
    : 'days in month'

  const handleExport = () =>
    exportToCSV(reportCsvRows(rows), `payroll-${month}`, {
      columns: CSV_COLUMNS,
      headers: CSV_HEADERS,
    })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Payroll report</CardTitle>
            {settings && (
              <CardDescription>
                Daily: wage ÷ shift hours. Monthly: wage ÷ {divisor} ÷ shift hours.
              </CardDescription>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!branchId || !month ? (
          <p className="text-center text-gray-500 py-8">Select a branch and month.</p>
        ) : isLoading ? (
          <Spinner />
        ) : isError ? (
          <p className="text-center text-red-500 py-8">{errMsg(error, 'Failed to load report')}</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No employees to report for this branch.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Pay type</TableHead>
                <TableHead className="text-right">Wage</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Half days</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Late deducted (hrs)</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Late deduction</TableHead>
                <TableHead className="text-right">Late fine (₹)</TableHead>
                {hasServiceTime && <TableHead className="text-right">Overtime</TableHead>}
                <TableHead className="text-right">Net pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employee_id}>
                  <TableCell>
                    <div className="font-medium">{r.full_name}</div>
                    {r.employee_code && <div className="text-xs text-gray-500">{r.employee_code}</div>}
                    {(r.warnings || []).map((w) => (
                      <div key={w} className="text-xs text-amber-600">{w}</div>
                    ))}
                  </TableCell>
                  <TableCell>{PAY_TYPE_LABEL[r.pay_type] || '—'}</TableCell>
                  <TableCell className="text-right">{formatMoney(r.wage_amount)}</TableCell>
                  <TableCell className="text-right">{r.days_worked}</TableCell>
                  <TableCell className="text-right">{r.half_days}</TableCell>
                  <TableCell className="text-right">{r.hours_worked}</TableCell>
                  <TableCell className="text-right">{r.late_deduction_hours}</TableCell>
                  <TableCell className="text-right">{formatMoney(r.gross)}</TableCell>
                  <TableCell className="text-right">{formatMoney(r.late_deduction_amount)}</TableCell>
                  <TableCell className="text-right">{formatMoney(r.late_fine_amount ?? 0)}</TableCell>
                  {hasServiceTime && (
                    <TableCell className="text-right">
                      {formatMoney(r.service_time_pay ?? 0)}
                      <div className="text-xs text-gray-500">{r.service_time?.overtime_minutes || 0} min</div>
                    </TableCell>
                  )}
                  <TableCell className="text-right font-medium">{formatMoney(r.net_pay)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-gray-50">
                <TableCell>Total</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right">{totals.days_worked}</TableCell>
                <TableCell className="text-right">{totals.half_days}</TableCell>
                <TableCell className="text-right">{totals.hours_worked}</TableCell>
                <TableCell className="text-right">{totals.late_deduction_hours}</TableCell>
                <TableCell className="text-right">{formatMoney(totals.gross)}</TableCell>
                <TableCell className="text-right">{formatMoney(totals.late_deduction_amount)}</TableCell>
                <TableCell className="text-right">{formatMoney(totals.late_fine_amount)}</TableCell>
                {hasServiceTime && (
                  <TableCell className="text-right">
                    {formatMoney(rows.reduce((t, r) => t + (r.service_time_pay || 0), 0))}
                  </TableCell>
                )}
                <TableCell className="text-right">{formatMoney(totals.net_pay)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function ServiceTimeTab({ branchId, month }) {
  const { data: res, isLoading, isError, error } = useQuery({
    queryKey: ['payroll-service-time', branchId, month],
    queryFn: () => payrollService.getServiceTimeReport(branchId, month),
    enabled: !!branchId && !!month,
  })
  const employees = res?.data?.employees || []
  const rules = res?.data?.rules
  const hm = (m) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Service time &amp; overtime</CardTitle>
        <CardDescription>
          Time spent on completed services, split into inside the shift (valued at the normal hourly rate) and
          outside it (overtime, prorated to the minute).
          {rules && !rules.enabled && ' Overtime pay is switched off, so none of this is added to payroll — turn on “Service time pay” in the rules above.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Spinner />
        ) : isError ? (
          <p className="text-center text-red-500 py-8">{errMsg(error, 'Failed to load service time')}</p>
        ) : employees.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No completed services with a recorded start and end time this month.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee / day</TableHead>
                <TableHead className="text-right">Service time</TableHead>
                <TableHead className="text-right">In shift</TableHead>
                <TableHead className="text-right">Overtime</TableHead>
                <TableHead className="text-right">Overtime rate</TableHead>
                <TableHead className="text-right">Overtime pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => (
                <Fragment key={e.user_id}>
                  <TableRow className="bg-gray-50 font-semibold">
                    <TableCell>{e.full_name}</TableCell>
                    <TableCell className="text-right">{hm(e.service_minutes)}</TableCell>
                    <TableCell className="text-right">{hm(e.in_shift_minutes)}</TableCell>
                    <TableCell className="text-right">{hm(e.overtime_minutes)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right">{formatMoney(e.overtime_amount)}</TableCell>
                  </TableRow>
                  {e.days.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="pl-8 text-sm text-gray-600">
                        {d.date}
                        <span className="ml-2 text-xs text-gray-400">
                          {d.has_shift ? `shift ${d.shift_start}–${d.shift_end}` : 'no shift'} · {d.services} service(s)
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm">{hm(d.service_minutes)}</TableCell>
                      <TableCell className="text-right text-sm">{hm(d.in_shift_minutes)}</TableCell>
                      <TableCell className="text-right text-sm">{hm(d.overtime_minutes)}</TableCell>
                      <TableCell className="text-right text-sm">
                        {d.overtime_rate == null ? '—' : `${formatMoney(d.overtime_rate)}/h`}
                      </TableCell>
                      <TableCell className="text-right text-sm">{formatMoney(d.overtime_amount)}</TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function ServiceTimeRulesCard() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(null)
  const { data: res, isLoading } = useQuery({
    queryKey: ['payroll-service-time-rules'],
    queryFn: payrollService.getServiceTimeRules,
  })
  const server = res?.data
  const f = draft || (server && {
    enabled: server.enabled,
    add_in_shift: server.in_shift?.add_to_pay,
    ot_enabled: server.overtime.enabled,
    rate_mode: server.overtime.rate_mode,
    hourly_rate: String(server.overtime.hourly_rate),
    multiplier: String(server.overtime.multiplier),
    before_shift: server.overtime.before_shift,
    min_minutes: String(server.overtime.min_minutes),
    rounding_minutes: String(server.overtime.rounding_minutes),
  })
  const set = (k, v) => setDraft({ ...f, [k]: v })

  const save = useMutation({
    mutationFn: (payload) => payrollService.setServiceTimeRules(payload),
    onSuccess: () => {
      toast.success('Service time pay rules saved')
      setDraft(null)
      queryClient.invalidateQueries({ queryKey: ['payroll-service-time-rules'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-service-time'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-report'] })
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to save rules')),
  })

  const handleSave = () => {
    const n = (v) => Number(v)
    if ([f.hourly_rate, f.multiplier, f.min_minutes, f.rounding_minutes].some((v) => !Number.isFinite(n(v)) || n(v) < 0)
      || n(f.rounding_minutes) < 1) {
      toast.error('Rates and minutes must be positive numbers (rounding at least 1)')
      return
    }
    save.mutate({
      enabled: f.enabled,
      in_shift: { add_to_pay: f.add_in_shift },
      overtime: {
        enabled: f.ot_enabled,
        rate_mode: f.rate_mode,
        hourly_rate: n(f.hourly_rate),
        multiplier: n(f.multiplier),
        before_shift: f.before_shift,
        min_minutes: Math.floor(n(f.min_minutes)),
        rounding_minutes: Math.floor(n(f.rounding_minutes)),
      },
    })
  }

  const Check = ({ id, label, hint, k }) => (
    <label htmlFor={id} className="flex items-start gap-2 text-sm">
      <input id={id} type="checkbox" className="mt-1" checked={!!f[k]} onChange={(e) => set(k, e.target.checked)} />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
    </label>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Service time pay rules (overtime)</CardTitle>
        <CardDescription>
          Pays staff for the time they spend on services outside their shift. Work inside the shift is valued at
          wage ÷ shift hours (e.g. ₹600 ÷ 10 h = ₹60/h). Work after the shift is paid at the overtime rate,
          prorated to the minute (50 min at ₹100/h = ₹83.33). Uses the real Started → Completed time of each service.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !f ? (
          <Spinner />
        ) : (
          <>
            <Check id="stp-enabled" k="enabled" label="Turn on service time pay" hint="Adds the amounts below to net pay in the payroll report." />
            <Check id="stp-inshift" k="add_in_shift" label="Also add in-shift service time to pay" hint="Leave off if the daily/monthly wage already covers the shift." />
            <Check id="stp-ot" k="ot_enabled" label="Pay overtime for service time outside the shift" />
            <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
              <div className="space-y-2">
                <Label htmlFor="stp-mode">Overtime rate</Label>
                <select
                  id="stp-mode"
                  className="w-full h-10 px-3 border rounded-md bg-white text-sm"
                  value={f.rate_mode}
                  onChange={(e) => set('rate_mode', e.target.value)}
                >
                  <option value="fixed">Fixed ₹ per hour</option>
                  <option value="multiplier">Multiple of the normal hourly rate</option>
                </select>
              </div>
              {f.rate_mode === 'fixed' ? (
                <div className="space-y-2">
                  <Label htmlFor="stp-rate">Overtime ₹ per hour</Label>
                  <Input id="stp-rate" type="number" min="0" step="0.01" value={f.hourly_rate} onChange={(e) => set('hourly_rate', e.target.value)} />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="stp-mult">Multiplier (×)</Label>
                  <Input id="stp-mult" type="number" min="0" step="0.05" value={f.multiplier} onChange={(e) => set('multiplier', e.target.value)} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="stp-min">Ignore overtime shorter than (min/day)</Label>
                <Input id="stp-min" type="number" min="0" value={f.min_minutes} onChange={(e) => set('min_minutes', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stp-round">Round overtime down to (minutes)</Label>
                <Input id="stp-round" type="number" min="1" value={f.rounding_minutes} onChange={(e) => set('rounding_minutes', e.target.value)} />
              </div>
            </div>
            <Check id="stp-before" k="before_shift" label="Count work before the shift starts as overtime too" />
            <p className="text-xs text-gray-500">Each employee can have their own overtime ₹/hour in the Wages tab.</p>
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save service time rules
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function WagesTab({ branchId }) {
  const queryClient = useQueryClient()
  // Unsaved edits keyed by employee_id: { pay_type: '' | 'daily' | 'monthly', amount: string }
  const [edits, setEdits] = useState({})

  const { data: res, isLoading, isError, error } = useQuery({
    queryKey: ['payroll-wages', branchId],
    queryFn: () => payrollService.getWages(branchId),
    enabled: !!branchId,
  })
  const employees = res?.data || []

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }) => payrollService.setWage(id, payload),
    onSuccess: (_res, vars) => {
      toast.success('Wage saved')
      setEdits((prev) => {
        const next = { ...prev }
        delete next[vars.id]
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['payroll-wages'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-report'] })
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to save wage')),
  })

  const current = (e) => edits[e.employee_id] || {
    pay_type: e.pay_type || '',
    amount: e.wage_amount == null ? '' : String(e.wage_amount),
    overtime: e.overtime_rate == null ? '' : String(e.overtime_rate),
  }
  const setField = (e, key, value) =>
    setEdits((prev) => ({ ...prev, [e.employee_id]: { ...current(e), [key]: value } }))

  const handleSave = (e) => {
    const { pay_type, amount, overtime } = current(e)
    const hasAmount = amount !== ''
    const overtime_rate = overtime === '' ? null : Number(overtime)
    if (overtime_rate != null && (!Number.isFinite(overtime_rate) || overtime_rate < 0)) {
      toast.error('Overtime rate must be a positive amount, or empty to use the default')
      return
    }
    if (!pay_type && !hasAmount) {
      saveMutation.mutate({ id: e.employee_id, payload: { pay_type: null, wage_amount: null, overtime_rate } })
      return
    }
    const wage = Number(amount)
    if (!pay_type || !hasAmount || !Number.isFinite(wage) || wage < 0) {
      toast.error('Choose a pay type and an amount, or clear both')
      return
    }
    saveMutation.mutate({ id: e.employee_id, payload: { pay_type, wage_amount: wage, overtime_rate } })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Employee wages</CardTitle>
        <CardDescription>
          Set a daily or monthly wage per employee. Clear both fields to remove a wage. Overtime ₹/hour overrides the
          default overtime rate for that person; leave it empty to use the default.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!branchId ? (
          <p className="text-center text-gray-500 py-8">No branches available.</p>
        ) : isLoading ? (
          <Spinner />
        ) : isError ? (
          <p className="text-center text-red-500 py-8">{errMsg(error, 'Failed to load wages')}</p>
        ) : employees.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No employees in this branch.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Pay type</TableHead>
                <TableHead>Amount (₹)</TableHead>
                <TableHead>Overtime ₹/hour</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => {
                const row = current(e)
                const saving =
                  saveMutation.isPending && saveMutation.variables?.id === e.employee_id
                return (
                  <TableRow key={e.employee_id}>
                    <TableCell>
                      <div className="font-medium">{e.full_name}</div>
                      {e.employee_code && <div className="text-xs text-gray-500">{e.employee_code}</div>}
                    </TableCell>
                    <TableCell className="capitalize">{e.role}</TableCell>
                    <TableCell>
                      <select
                        aria-label={`Pay type for ${e.full_name}`}
                        className="h-10 px-3 border rounded-md bg-white text-sm"
                        value={row.pay_type}
                        onChange={(ev) => setField(e, 'pay_type', ev.target.value)}
                      >
                        <option value="">—</option>
                        <option value="daily">Daily</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Amount for ${e.full_name}`}
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-32"
                        value={row.amount}
                        onChange={(ev) => setField(e, 'amount', ev.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Overtime rate for ${e.full_name}`}
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-32"
                        placeholder="Default"
                        value={row.overtime}
                        onChange={(ev) => setField(e, 'overtime', ev.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handleSave(e)} disabled={saving}>
                        {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                        Save
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function SettingsTab() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(null)

  const { data: res, isLoading, isError, error } = useQuery({
    queryKey: ['payroll-settings'],
    queryFn: payrollService.getSettings,
  })
  const server = res?.data
  const form = draft || {
    monthly_days_mode: server?.monthly_days_mode || 'calendar',
    monthly_fixed_days: String(server?.monthly_fixed_days ?? 30),
  }
  const setField = (key, value) => setDraft({ ...form, [key]: value })

  const saveMutation = useMutation({
    mutationFn: (payload) => payrollService.setSettings(payload),
    onSuccess: () => {
      toast.success('Payroll settings saved')
      setDraft(null)
      queryClient.invalidateQueries({ queryKey: ['payroll-settings'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-report'] })
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to save settings')),
  })

  const handleSave = () => {
    const days = Number(form.monthly_fixed_days)
    if (form.monthly_days_mode === 'fixed' && (!Number.isInteger(days) || days < 1 || days > 31)) {
      toast.error('Fixed days must be a whole number between 1 and 31')
      return
    }
    saveMutation.mutate({
      monthly_days_mode: form.monthly_days_mode,
      monthly_fixed_days: Number.isInteger(days) && days >= 1 && days <= 31
        ? days
        : (server?.monthly_fixed_days ?? 30),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Payroll settings</CardTitle>
        <CardDescription>How monthly wages are converted into an hourly rate.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Spinner />
        ) : isError ? (
          <p className="text-center text-red-500 py-8">{errMsg(error, 'Failed to load settings')}</p>
        ) : (
          <>
            <div className="space-y-2 max-w-sm">
              <Label htmlFor="payroll-divisor">Monthly rate divisor</Label>
              <select
                id="payroll-divisor"
                className="w-full h-10 px-3 border rounded-md bg-white text-sm"
                value={form.monthly_days_mode}
                onChange={(e) => setField('monthly_days_mode', e.target.value)}
              >
                <option value="calendar">Days in the month</option>
                <option value="fixed">Fixed number of days</option>
              </select>
            </div>
            {form.monthly_days_mode === 'fixed' && (
              <div className="space-y-2 max-w-sm">
                <Label htmlFor="payroll-fixed-days">Fixed days (1–31)</Label>
                <Input
                  id="payroll-fixed-days"
                  type="number"
                  min="1"
                  max="31"
                  value={form.monthly_fixed_days}
                  onChange={(e) => setField('monthly_fixed_days', e.target.value)}
                />
              </div>
            )}
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save settings
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function PayrollPage() {
  const { user } = useSelector((s) => s.auth)
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const { data: branchesData } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: user?.role === 'owner',
  })

  if (user?.role !== 'owner') return <Navigate to="/" replace />

  const branches = branchesData?.data || []
  const branchId = selectedBranchId || branches[0]?.branch_id || ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-gray-500">Wages, late deductions and monthly pay per employee</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 w-full sm:w-64">
              <Label htmlFor="payroll-branch" className="text-xs font-medium text-gray-700">Branch</Label>
              <select
                id="payroll-branch"
                className="w-full h-10 px-3 border border-input rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={branchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 w-full sm:w-48">
              <Label htmlFor="payroll-month" className="text-xs font-medium text-gray-700">Month</Label>
              <Input
                id="payroll-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="report">
        <TabsList>
          <TabsTrigger value="report">Report</TabsTrigger>
          <TabsTrigger value="service-time">Service time</TabsTrigger>
          <TabsTrigger value="wages">Wages</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="report">
          <ReportTab branchId={branchId} month={month} />
        </TabsContent>
        <TabsContent value="service-time">
          <ServiceTimeRulesCard />
          <div className="mt-6">
            <ServiceTimeTab branchId={branchId} month={month} />
          </div>
        </TabsContent>
        <TabsContent value="wages">
          <WagesTab branchId={branchId} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
