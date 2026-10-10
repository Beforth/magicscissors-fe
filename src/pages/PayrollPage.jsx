import { useState } from 'react'
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
                <TableCell className="text-right">{formatMoney(totals.net_pay)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
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
  }
  const setField = (e, key, value) =>
    setEdits((prev) => ({ ...prev, [e.employee_id]: { ...current(e), [key]: value } }))

  const handleSave = (e) => {
    const { pay_type, amount } = current(e)
    const hasAmount = amount !== ''
    if (!pay_type && !hasAmount) {
      saveMutation.mutate({ id: e.employee_id, payload: { pay_type: null, wage_amount: null } })
      return
    }
    const wage = Number(amount)
    if (!pay_type || !hasAmount || !Number.isFinite(wage) || wage < 0) {
      toast.error('Choose a pay type and an amount, or clear both')
      return
    }
    saveMutation.mutate({ id: e.employee_id, payload: { pay_type, wage_amount: wage } })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Employee wages</CardTitle>
        <CardDescription>
          Set a daily or monthly wage per employee. Clear both fields to remove a wage.
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
          <TabsTrigger value="wages">Wages</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="report">
          <ReportTab branchId={branchId} month={month} />
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
