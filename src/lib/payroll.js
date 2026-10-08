const SUM_KEYS = ['days_worked', 'half_days', 'hours_worked', 'late_deduction_hours', 'gross', 'late_deduction_amount', 'late_fine_amount', 'net_pay']
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

export function payrollTotals(rows) {
  const totals = Object.fromEntries(SUM_KEYS.map((k) => [k, 0]))
  for (const r of rows || []) for (const k of SUM_KEYS) totals[k] += Number(r[k] || 0)
  for (const k of SUM_KEYS) totals[k] = round2(totals[k])
  return totals
}

const PAY_TYPE_LABEL = { daily: 'Daily', monthly: 'Monthly' }

export function reportCsvRows(rows) {
  return (rows || []).map((r) => ({
    employee_code: r.employee_code || '',
    full_name: r.full_name,
    pay_type: PAY_TYPE_LABEL[r.pay_type] || '—',
    wage_amount: r.wage_amount ?? '',
    days_worked: r.days_worked,
    half_days: r.half_days,
    hours_worked: r.hours_worked,
    late_deduction_hours: r.late_deduction_hours,
    gross: r.gross,
    late_deduction_amount: r.late_deduction_amount,
    late_fine_amount: r.late_fine_amount ?? 0,
    net_pay: r.net_pay,
    warnings: (r.warnings || []).join('; '),
  }))
}

export function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
