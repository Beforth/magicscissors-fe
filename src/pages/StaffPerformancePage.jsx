import React, { useState, useMemo, useEffect } from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportsService } from '@/services/reports.service'
import { useFilterParams, buildReturnTo } from '@/hooks/useFilterParams'
import { branchService } from '@/services/branch.service'
import { userService } from '@/services/user.service'
import { incentiveService } from '@/services/incentive.service'
import { employeeIncentiveService } from '@/services/employeeIncentive.service'
import StaffIncentivesSection, { monthYearFromDate, monthLabel } from '@/components/StaffIncentivesSection'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, Calendar, Loader2, Star, Pencil, Check, X, Users, IndianRupee, Target, Clock, ChevronLeft, ChevronRight, ChevronDown, Download, ShoppingBag } from 'lucide-react'
import { MultiBarChart } from '@/components/charts'
import { BranchColorDot } from '@/components/ui/branch-color-dot'
import { toast } from 'sonner'

function getDefaultDateRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    start_date: start.toISOString().split('T')[0],
    end_date: now.toISOString().split('T')[0],
  }
}

function StaffPerformancePage() {
  const { user } = useSelector((state) => state.auth)
  const isOwner = user?.role === 'owner' || user?.role === 'developer'
  const canAccessPage = isOwner || user?.role === 'manager' || user?.role === 'cashier'
  const canSeeFinancials = user?.role !== 'employee'
  const showServiceEarningsCard = user?.role !== 'manager' && user?.role !== 'cashier'
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()

  const defaultRange = useMemo(getDefaultDateRange, [])
  const [filters, setFilters] = useFilterParams({
    mode: 'range',
    startDate: defaultRange.start_date,
    endDate: defaultRange.end_date,
    singleDate: defaultRange.end_date,
    branch: '',
    employee: '',
  })
  const filterMode = filters.mode
  const startDate = filters.startDate
  const endDate = filters.endDate
  const singleDate = filters.singleDate
  const selectedBranch = filters.branch
  const selectedEmployee = filters.employee
  const setFilterMode = (v) => setFilters({ mode: v })
  const setStartDate = (v) => setFilters({ startDate: v })
  const setEndDate = (v) => setFilters({ endDate: v })
  const setSingleDate = (v) => setFilters({ singleDate: v })
  const setSelectedBranch = (v) => setFilters({ branch: v })
  const setSelectedEmployee = (v) => setFilters({ employee: v })
  const [activeEmployeeId, setActiveEmployeeId] = useState(null)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalValue, setGoalValue] = useState('')
  const [matrixPage, setMatrixPage] = useState(1)
  const [matrixPageSize, setMatrixPageSize] = useState(10)
  const [expandedIncentiveEmp, setExpandedIncentiveEmp] = useState(null)
  const [expandedBills, setExpandedBills] = useState(new Set())

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: isOwner,
  })

  const branches = branchesData?.data || []

  // For non-owners, lock branch to their own
  const effectiveBranch = isOwner ? selectedBranch : (user?.branchId || '')

  const { data: branchEmployeesData } = useQuery({
    queryKey: ['branch-employees', effectiveBranch],
    queryFn: () => branchService.getBranchEmployees(effectiveBranch),
    enabled: canAccessPage && !!effectiveBranch,
  })

  const branchEmployees = branchEmployeesData?.data || []

  const effectiveStart = filterMode === 'single' ? singleDate : startDate
  const effectiveEnd = filterMode === 'single' ? singleDate : endDate

  const staffIncentivePeriod = useMemo(() => monthYearFromDate(effectiveEnd), [effectiveEnd])
  const spansMultipleMonths = useMemo(() => {
    const start = monthYearFromDate(effectiveStart)
    const end = monthYearFromDate(effectiveEnd)
    if (!start || !end) return false
    return start.year !== end.year || start.month !== end.month
  }, [effectiveStart, effectiveEnd])

  const { data: performanceData, isLoading } = useQuery({
    queryKey: ['staff-performance', effectiveStart, effectiveEnd, effectiveBranch, selectedEmployee, matrixPage, matrixPageSize],
    queryFn: () =>
      reportsService.getEmployeePerformance({
        start_date: effectiveStart,
        end_date: effectiveEnd,
        branch_id: effectiveBranch || undefined,
        employee_id: selectedEmployee || undefined,
        page: matrixPage,
        page_size: matrixPageSize,
      }),
    enabled: canAccessPage && !!effectiveStart && !!effectiveEnd,
  })

  const starGoalMutation = useMutation({
    mutationFn: ({ id, goal }) => userService.updateStarGoal(id, goal),
    onSuccess: () => {
      toast.success('Star goal updated')
      queryClient.invalidateQueries({ queryKey: ['staff-performance'] })
      setEditingGoal(false)
    },
    onError: () => {
      toast.error('Failed to update star goal')
    },
  })

  // Incentive report query — reuses the same date range & branch filters
  const { data: incentiveReportData, isLoading: incentiveLoading } = useQuery({
    queryKey: ['incentive-report', { start: effectiveStart, end: effectiveEnd, employee: selectedEmployee, branch: effectiveBranch }],
    queryFn: () => incentiveService.getReport({
      start_date: effectiveStart || undefined,
      end_date: effectiveEnd || undefined,
      employee_id: selectedEmployee || undefined,
      branch_id: effectiveBranch || undefined,
    }),
    enabled: canSeeFinancials && !!effectiveStart && !!effectiveEnd,
  })

  const { data: staffIncentiveData } = useQuery({
    queryKey: ['employee-incentives', {
      year: staffIncentivePeriod?.year,
      month: staffIncentivePeriod?.month,
      branchId: effectiveBranch || null,
    }],
    queryFn: () =>
      employeeIncentiveService.list({
        year: staffIncentivePeriod.year,
        month: staffIncentivePeriod.month,
        ...(effectiveBranch ? { branchId: effectiveBranch } : {}),
      }),
    enabled: canSeeFinancials && !!staffIncentivePeriod,
  })
  const staffIncentiveRows = Array.isArray(staffIncentiveData?.data) ? staffIncentiveData.data : []
  const staffIncentiveByEmployee = useMemo(() => {
    const map = new Map()
    for (const row of staffIncentiveRows) {
      map.set(row.employee_id, row)
    }
    return map
  }, [staffIncentiveRows])
  const staffIncentiveTotal = useMemo(
    () => staffIncentiveRows.reduce((s, r) => s + Number(r.total_incentive || 0), 0),
    [staffIncentiveRows]
  )
  const incentiveReport = incentiveReportData?.data || incentiveReportData || {}
  const incentiveByEmployeeAll = incentiveReport.by_employee || []

  const handleBranchChange = (branchId) => {
    setFilters({ branch: branchId, employee: '' })
    setActiveEmployeeId(null)
  }

  const employees = performanceData?.data?.employees || []
  const globalGoal = performanceData?.data?.global_monthly_star_goal || 100
  const isSingleDay = performanceData?.data?.is_single_day === true
  const dailyTimeline = performanceData?.data?.daily_timeline || []
  const dailyTimelineTotal = performanceData?.data?.daily_timeline_total ?? 0

  const activeEmployee = useMemo(() => {
    if (!activeEmployeeId) return null
    return employees.find((e) => e.employee_id === activeEmployeeId) || null
  }, [activeEmployeeId, employees])

  // Filter incentive data by selected employee pill
  const incentiveByEmployee = useMemo(() => {
    if (!activeEmployeeId) return incentiveByEmployeeAll
    return incentiveByEmployeeAll.filter((e) => e.employee_id === activeEmployeeId)
  }, [activeEmployeeId, incentiveByEmployeeAll])

  const incentiveSummary = useMemo(() => {
    if (!activeEmployeeId) return incentiveReport.summary || {}
    return {
      total_sales: incentiveByEmployee.reduce((s, e) => s + (e.total_sales || 0), 0),
      total_incentive: incentiveByEmployee.reduce((s, e) => s + (e.total_incentive || 0), 0),
      record_count: incentiveByEmployee.reduce((s, e) => s + (e.records?.length || 0), 0),
    }
  }, [activeEmployeeId, incentiveByEmployee, incentiveReport])

  // Compute totals for overview
  const totals = useMemo(() => {
    if (!employees.length) return null
    return {
      services: employees.reduce((s, e) => s + e.services_completed, 0),
      stars: employees.reduce((s, e) => s + e.star_points, 0),
      earnings: employees.reduce((s, e) => s + (e.revenue_generated - (e.product_incentives || 0)), 0),
      productSales: employees.reduce((s, e) => s + (e.product_sales || 0), 0),
      productIncentives: employees.reduce((s, e) => s + (e.product_incentives || 0), 0),
      staffIncentives: staffIncentiveRows.reduce((s, r) => s + Number(r.total_incentive || 0), 0),
    }
  }, [employees, staffIncentiveRows])

  // For single day + selected employee: that day's services sorted by time
  const singleDayServicesByTime = useMemo(() => {
    if (!isSingleDay || !activeEmployee?.daily_breakdown?.length) return []
    const dayData = activeEmployee.daily_breakdown.find((d) => d.date === effectiveStart)
    if (!dayData?.services?.length) return []
    return [...dayData.services].sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  }, [isSingleDay, activeEmployee, effectiveStart])

  // Single-day matrix: backend returns paginated rows (already grouped by bill_item_id)
  const singleDayMatrix = isSingleDay ? dailyTimeline : []
  const matrixTotal = dailyTimelineTotal
  const matrixTotalPages = Math.max(1, Math.ceil(matrixTotal / matrixPageSize))
  const matrixPageSafe = Math.min(matrixPage, matrixTotalPages)

  const toggleBill = (billNumber) => {
    setExpandedBills((prev) => {
      const next = new Set(prev)
      if (next.has(billNumber)) next.delete(billNumber)
      else next.add(billNumber)
      return next
    })
  }

  // Group matrix rows by bill_number for collapsed display
  const groupedMatrix = useMemo(() => {
    if (!singleDayMatrix.length) return []
    const groups = []
    const groupMap = new Map()
    for (const row of singleDayMatrix) {
      const key = row.bill_number || row.book_number || `_single_${groups.length}`
      if (!groupMap.has(key)) {
        const group = { billNumber: key, rows: [], time: row.time, bill_id: row.bill_id }
        groupMap.set(key, group)
        groups.push(group)
      }
      groupMap.get(key).rows.push(row)
    }
    // Compute summed amounts per employee per group
    for (const group of groups) {
      const summedAmounts = {}
      for (const row of group.rows) {
        if (row.amounts) {
          for (const [empId, amt] of Object.entries(row.amounts)) {
            if (amt != null) summedAmounts[empId] = (summedAmounts[empId] || 0) + amt
          }
        }
      }
      group.summedAmounts = summedAmounts
    }
    return groups
  }, [singleDayMatrix])

  // Compute column totals for the current page
  const matrixColumnTotals = useMemo(() => {
    const totals = {}
    for (const row of singleDayMatrix) {
      if (row.amounts) {
        for (const [empId, amt] of Object.entries(row.amounts)) {
          if (amt != null) totals[empId] = (totals[empId] || 0) + amt
        }
      }
    }
    return totals
  }, [singleDayMatrix])

  useEffect(() => {
    setMatrixPage(1)
    setExpandedBills(new Set())
  }, [effectiveStart, matrixPageSize])

  const handleDownloadServicesByTimeCsv = async () => {
    try {
      const { data } = await reportsService.getEmployeePerformance({
        start_date: effectiveStart,
        end_date: effectiveEnd,
        branch_id: selectedBranch || undefined,
        employee_id: selectedEmployee || undefined,
        page: 1,
        page_size: 10000,
      })
      const empList = data?.employees || []
      const rows = data?.daily_timeline || []
      const escapeCsv = (v) => {
        const s = v == null ? '' : String(v)
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
        return s
      }
      const header = ['Service', 'Type', 'Time', 'Bill #', ...empList.map((e) => e.employee_name)]
      const csvRows = [header.map(escapeCsv).join(',')]
      for (const row of rows) {
        const amounts = row.amounts || {}
        csvRows.push([
          escapeCsv(row.service_name),
          escapeCsv(row.item_type || 'service'),
          escapeCsv(row.time),
          escapeCsv(row.bill_number || row.book_number || ''),
          ...empList.map((emp) => escapeCsv(amounts[emp.employee_id] ?? '')),
        ].join(','))
      }
      const csv = csvRows.join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `services-by-time-${effectiveStart}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV downloaded')
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to download CSV')
    }
  }

  if (!canAccessPage) {
    return <Navigate to="/" replace />
  }

  const handleStartGoalEdit = (emp) => {
    setGoalValue(String(emp.monthly_star_goal || globalGoal))
    setEditingGoal(true)
  }

  const handleSaveGoal = () => {
    if (!activeEmployeeId) return
    const parsed = parseInt(goalValue)
    if (isNaN(parsed) || parsed < 0) {
      toast.error('Please enter a valid number')
      return
    }
    starGoalMutation.mutate({ id: activeEmployeeId, goal: parsed })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff Performance</h1>
        <p className="text-gray-500">
          {filterMode === 'single'
            ? `Single-day performance with time — hover service for bill number, click to open bill`
            : 'Employee-wise performance for the selected time range'}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Period</Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="filterMode"
                    checked={filterMode === 'range'}
                    onChange={() => setFilterMode('range')}
                    className="rounded border-gray-300"
                  />
                  Date range
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="filterMode"
                    checked={filterMode === 'single'}
                    onChange={() => setFilterMode('single')}
                    className="rounded border-gray-300"
                  />
                  Single date
                </label>
              </div>
            </div>
            {filterMode === 'range' && (
              <>
                <div>
                  <Label className="mb-2 block text-xs">From</Label>
                  <input
                    type="date"
                    className="h-9 px-3 border rounded-md border-gray-300 text-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-2 block text-xs">To</Label>
                  <input
                    type="date"
                    className="h-9 px-3 border rounded-md border-gray-300 text-sm"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
            {filterMode === 'single' && (
              <div>
                <Label className="mb-2 block text-xs">Date</Label>
                <input
                  type="date"
                  className="h-9 px-3 border rounded-md border-gray-300 text-sm"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                />
              </div>
            )}
            {isOwner && (
              <div>
                <Label className="mb-2 block text-xs">Branch</Label>
                <select
                  className="h-9 px-3 border rounded-md border-gray-300 min-w-[180px] text-sm"
                  value={selectedBranch}
                  onChange={(e) => handleBranchChange(e.target.value)}
                >
                  <option value="">All Branches</option>
                  {branches.map((branch) => (
                    <option key={branch.branch_id} value={branch.branch_id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label className="mb-2 block text-xs">Employee</Label>
              <select
                className="h-9 px-3 border rounded-md border-gray-300 min-w-[200px] text-sm"
                value={selectedEmployee}
                onChange={(e) => {
                  setSelectedEmployee(e.target.value)
                  setActiveEmployeeId(e.target.value || null)
                }}
                disabled={isOwner && !selectedBranch}
              >
                <option value="">All Employees</option>
                {branchEmployees.map((emp) => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.full_name}
                    {emp.employee_code || emp.biometric_id
                      ? ` (${[emp.employee_code, emp.biometric_id].filter(Boolean).join(' / ')})`
                      : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Employee Pills */}
          {employees.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  !activeEmployeeId
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setActiveEmployeeId(null)}
              >
                All Employees
              </button>
              {employees.map((emp) => (
                <button
                  key={emp.employee_id}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    activeEmployeeId === emp.employee_id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setActiveEmployeeId(emp.employee_id)}
                >
                  {emp.employee_name}
                  <span className="flex items-center gap-0.5 text-xs opacity-80">
                    <Star className="h-3 w-3 fill-current" />
                    {emp.star_points}
                  </span>
                  {canSeeFinancials && (
                    <span className="text-xs opacity-80">
                      {formatCurrency(emp.revenue_generated - (emp.product_incentives || 0))}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Single-day matrix: Service | Time | Emp1 (total) | Emp2 (total) | ... — below employee chips */}
          {isSingleDay && singleDayMatrix.length > 0 && !activeEmployeeId && (
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="h-4 w-4" />
                      Services by time — {effectiveStart}
                    </CardTitle>
                    <CardDescription>
                      Employee columns show day total. Each row is a service; cells show amount earned. Click row to open bill.
                    </CardDescription>
                  </div>
                  {canSeeFinancials && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadServicesByTimeCsv}
                      className="shrink-0"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download full CSV
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto min-w-0 w-full" style={{ maxWidth: '100%' }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[160px] w-[160px] sticky left-0 z-10 bg-white border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                          Service
                        </TableHead>
                        <TableHead className="w-24 min-w-[6rem] font-mono whitespace-nowrap sticky left-[160px] z-10 bg-white border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                          Time
                        </TableHead>
                        <TableHead className="min-w-[80px] whitespace-nowrap">
                          Bill #
                        </TableHead>
                      {employees.map((emp) => (
                        <TableHead
                          key={emp.employee_id}
                          className="text-right min-w-[110px] cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setActiveEmployeeId(emp.employee_id)}
                          title="Click to see this employee's services by time"
                        >
                          <div className="font-medium flex items-center justify-end gap-1">
                            {emp.branches?.map((b) => (
                              <BranchColorDot key={b.id} color={b.color_code} />
                            )) || <BranchColorDot color={emp.branch?.color_code} />}
                            {emp.employee_name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-end gap-0.5">
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" /> {emp.star_points}
                          </div>
                          {canSeeFinancials && (
                            <div className="text-xs font-semibold text-green-600 mt-0.5">
                              {formatCurrency(emp.revenue_generated - (emp.product_incentives || 0))}
                            </div>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedMatrix.map((group) => {
                      const isSingleRow = group.rows.length === 1
                      const isExpanded = expandedBills.has(group.billNumber)

                      if (isSingleRow) {
                        const row = group.rows[0]
                        const isProductRow = row.item_type === 'product'
                        return (
                          <TableRow
                            key={group.billNumber}
                            className={`cursor-pointer hover:bg-primary/5 ${isProductRow ? 'bg-green-50/50' : ''}`}
                            onClick={() => row.bill_id && navigate(`/bills/${row.bill_id}?returnTo=${encodeURIComponent(buildReturnTo(location))}`)}
                            title={[row.bill_number && `Bill: ${row.bill_number}`, row.book_number && `Book: ${row.book_number}`].filter(Boolean).join(' · ') || undefined}
                          >
                            <TableCell className={`font-medium sticky left-0 z-[1] border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] w-[160px] min-w-[160px] ${isProductRow ? 'bg-green-50/50' : 'bg-white'}`}>
                              <div className="flex items-center gap-1.5">
                                {isProductRow && <ShoppingBag className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                                <span>{row.service_name}</span>
                              </div>
                              {isProductRow && row.sale_amount != null && (
                                <div className="text-xs text-green-600 mt-0.5">Sale: {formatCurrency(row.sale_amount)}</div>
                              )}
                            </TableCell>
                            <TableCell className={`font-mono text-sm sticky left-[160px] z-[1] border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] w-24 min-w-[6rem] ${isProductRow ? 'bg-green-50/50' : 'bg-white'}`}>
                              {row.time}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {row.bill_number || row.book_number || '—'}
                            </TableCell>
                            {employees.map((emp) => (
                              <TableCell key={emp.employee_id} className="text-right">
                                {canSeeFinancials
                                  ? (row.amounts && row.amounts[emp.employee_id] != null
                                    ? formatCurrency(row.amounts[emp.employee_id])
                                    : '—')
                                  : (row.amounts && row.amounts[emp.employee_id] != null ? '✓' : '—')}
                              </TableCell>
                            ))}
                          </TableRow>
                        )
                      }

                      // Multi-service group: parent + collapsible children
                      return (
                        <React.Fragment key={group.billNumber}>
                          <TableRow
                            className="cursor-pointer hover:bg-primary/5 bg-gray-50/50"
                            onClick={(e) => { e.stopPropagation(); toggleBill(group.billNumber) }}
                          >
                            <TableCell className="font-medium sticky left-0 z-[1] border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] w-[160px] min-w-[160px] bg-gray-50/50">
                              <div className="flex items-center gap-1.5">
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-500 shrink-0" />}
                                <span>{group.rows.length} services</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm sticky left-[160px] z-[1] border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] w-24 min-w-[6rem] bg-gray-50/50">
                              {group.time}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {group.billNumber}
                            </TableCell>
                            {employees.map((emp) => (
                              <TableCell key={emp.employee_id} className="text-right font-medium">
                                {canSeeFinancials
                                  ? (group.summedAmounts[emp.employee_id] != null
                                    ? formatCurrency(group.summedAmounts[emp.employee_id])
                                    : '—')
                                  : (group.summedAmounts[emp.employee_id] != null ? '✓' : '—')}
                              </TableCell>
                            ))}
                          </TableRow>
                          {isExpanded && group.rows.map((row, idx) => {
                            const isProductRow = row.item_type === 'product'
                            return (
                              <TableRow
                                key={`${group.billNumber}-${idx}`}
                                className={`cursor-pointer hover:bg-primary/5 ${isProductRow ? 'bg-green-50/50' : ''}`}
                                onClick={() => row.bill_id && navigate(`/bills/${row.bill_id}?returnTo=${encodeURIComponent(buildReturnTo(location))}`)}
                              >
                                <TableCell className={`font-medium sticky left-0 z-[1] border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] w-[160px] min-w-[160px] pl-10 ${isProductRow ? 'bg-green-50/50' : 'bg-white'}`}>
                                  <div className="flex items-center gap-1.5">
                                    {isProductRow && <ShoppingBag className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                                    <span>{row.service_name}</span>
                                  </div>
                                  {isProductRow && row.sale_amount != null && (
                                    <div className="text-xs text-green-600 mt-0.5">Sale: {formatCurrency(row.sale_amount)}</div>
                                  )}
                                </TableCell>
                                <TableCell className={`font-mono text-sm sticky left-[160px] z-[1] border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] w-24 min-w-[6rem] ${isProductRow ? 'bg-green-50/50' : 'bg-white'}`}>
                                  {row.time}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                  {row.bill_number || row.book_number || '—'}
                                </TableCell>
                                {employees.map((emp) => (
                                  <TableCell key={emp.employee_id} className="text-right">
                                    {canSeeFinancials
                                      ? (row.amounts && row.amounts[emp.employee_id] != null
                                        ? formatCurrency(row.amounts[emp.employee_id])
                                        : '—')
                                      : (row.amounts && row.amounts[emp.employee_id] != null ? '✓' : '—')}
                                  </TableCell>
                                ))}
                              </TableRow>
                            )
                          })}
                        </React.Fragment>
                      )
                    })}
                  </TableBody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="p-2 sticky left-0 z-[1] border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] bg-white">
                        Page Total
                      </td>
                      <td className="sticky left-[160px] z-[1] border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] bg-white" />
                      <td />
                      {employees.map((emp) => (
                        <td key={emp.employee_id} className="p-2 text-right">
                          {canSeeFinancials
                            ? (matrixColumnTotals[emp.employee_id] != null
                              ? formatCurrency(matrixColumnTotals[emp.employee_id])
                              : '—')
                            : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </Table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {matrixTotal === 0
                        ? 'No rows'
                        : `Showing ${(matrixPageSafe - 1) * matrixPageSize + 1}–${Math.min(matrixPageSafe * matrixPageSize, matrixTotal)} of ${matrixTotal}`}
                    </span>
                    <select
                      className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm"
                      value={matrixPageSize}
                      onChange={(e) => setMatrixPageSize(Number(e.target.value))}
                    >
                      {[10, 25, 50, 100].map((n) => (
                        <option key={n} value={n}>{n} per page</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={matrixPageSafe <= 1}
                      onClick={() => setMatrixPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[100px] text-center text-sm">
                      Page {matrixPageSafe} of {matrixTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={matrixPageSafe >= matrixTotalPages}
                      onClick={() => setMatrixPage((p) => Math.min(matrixTotalPages, p + 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Employee Detail View */}
          {activeEmployee && (
            <>
              {/* Summary Cards */}
              <div
                className={`grid grid-cols-2 md:grid-cols-3 gap-4 ${
                  !canSeeFinancials ? 'lg:grid-cols-3' : showServiceEarningsCard ? 'lg:grid-cols-4 xl:grid-cols-7' : 'lg:grid-cols-3 xl:grid-cols-6'
                }`}
              >
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Users className="h-4 w-4" />
                      <span className="text-xs font-medium">Services</span>
                    </div>
                    <div className="text-2xl font-bold">{activeEmployee.services_completed}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-medium">Stars</span>
                    </div>
                    <div className="text-2xl font-bold">{activeEmployee.star_points}</div>
                    <div className="flex items-center gap-1 mt-1">
                      {!editingGoal ? (
                        <>
                          <span className="text-xs text-muted-foreground">
                            Goal: {activeEmployee.monthly_star_goal}
                            {' '}({activeEmployee.monthly_star_goal > 0
                              ? Math.round((activeEmployee.star_points / activeEmployee.monthly_star_goal) * 100)
                              : 0}%)
                          </span>
                          <button
                            onClick={() => handleStartGoalEdit(activeEmployee)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            value={goalValue}
                            onChange={(e) => setGoalValue(e.target.value)}
                            className="h-6 w-20 text-xs px-2"
                          />
                          <button onClick={handleSaveGoal} className="text-green-600 hover:text-green-700">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setEditingGoal(false)} className="text-red-500 hover:text-red-600">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, activeEmployee.monthly_star_goal > 0
                            ? (activeEmployee.star_points / activeEmployee.monthly_star_goal) * 100
                            : 0)}%`,
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Target className="h-4 w-4" />
                      <span className="text-xs font-medium">Daily Avg Stars</span>
                    </div>
                    <div className="text-2xl font-bold">{activeEmployee.daily_avg_stars}</div>
                    <span className="text-xs text-muted-foreground">stars/day</span>
                  </CardContent>
                </Card>
                {canSeeFinancials && showServiceEarningsCard && (
                  <Card>
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <IndianRupee className="h-4 w-4" />
                        <span className="text-xs font-medium">Service Earnings</span>
                      </div>
                      <div className="text-2xl font-bold">{formatCurrency(activeEmployee.revenue_generated - (activeEmployee.product_incentives || 0))}</div>
                    </CardContent>
                  </Card>
                )}
                {canSeeFinancials && (
                  <>
                    <Card>
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <ShoppingBag className="h-4 w-4 text-emerald-600" />
                          <span className="text-xs font-medium">Product Sales</span>
                        </div>
                        <div className="text-2xl font-bold">{formatCurrency(activeEmployee.product_sales || 0)}</div>
                      </CardContent>
                    </Card>
                    <Card
                      className="cursor-pointer hover:ring-2 hover:ring-green-200 transition-all"
                      onClick={() => document.getElementById('product-incentives')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-xs font-medium">Product Incentives</span>
                        </div>
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(activeEmployee.product_incentives || (incentiveByEmployee.find(e => e.employee_id === activeEmployee.employee_id))?.total_incentive || 0)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card
                      className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                      onClick={() => document.getElementById('staff-incentives')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <IndianRupee className="h-4 w-4 text-primary" />
                          <span className="text-xs font-medium">Staff Incentive</span>
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          {formatCurrency(staffIncentiveByEmployee.get(activeEmployee.employee_id)?.total_incentive || 0)}
                        </div>
                        {staffIncentivePeriod && (
                          <span className="text-xs text-muted-foreground">{monthLabel(staffIncentivePeriod.year, staffIncentivePeriod.month)}</span>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              {/* Daily Breakdown: time-ordered when single day, else by date */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {isSingleDay ? 'Services by time' : 'Daily Breakdown'}
                  </CardTitle>
                  <CardDescription>
                    {activeEmployee.employee_name} &bull; {effectiveStart}{effectiveStart !== effectiveEnd ? ` to ${effectiveEnd}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isSingleDay && singleDayServicesByTime.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[35%]">Item</TableHead>
                          <TableHead className="w-20">Time</TableHead>
                          <TableHead>Split</TableHead>
                          {canSeeFinancials && <TableHead className="text-right">Amount</TableHead>}
                          <TableHead className="text-right">Stars</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {singleDayServicesByTime.map((s, i) => {
                          const isProduct = s.item_type === 'product'
                          return (
                          <TableRow
                            key={i}
                            className={`cursor-pointer hover:bg-primary/5 ${isProduct ? 'bg-green-50/50' : ''}`}
                            onClick={() => s.bill_id && navigate(`/bills/${s.bill_id}?returnTo=${encodeURIComponent(buildReturnTo(location))}`)}
                            title={[s.bill_number && `Bill: ${s.bill_number}`, s.book_number && `Book: ${s.book_number}`].filter(Boolean).join(' · ') || undefined}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-1.5">
                                {isProduct && <ShoppingBag className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                                {s.service_name}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{s.time || '—'}</TableCell>
                            <TableCell>
                              {s.contribution_type === 'full' ? (
                                <span className="text-muted-foreground text-sm">Full</span>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  {s.contribution_percent}%
                                </Badge>
                              )}
                            </TableCell>
                            {canSeeFinancials && (
                              <TableCell className="text-right">
                                {isProduct ? (
                                  <div>
                                    <div className="font-medium">{formatCurrency(s.sale_amount)}</div>
                                    <div className="text-xs text-green-600">→ {formatCurrency(s.earnings)} incentive</div>
                                  </div>
                                ) : (
                                  <span className="font-medium">{formatCurrency(s.earnings)}</span>
                                )}
                              </TableCell>
                            )}
                            <TableCell className="text-right">
                              <span className="flex items-center justify-end gap-1">
                                <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                                {s.stars}
                              </span>
                            </TableCell>
                          </TableRow>
                          )
                        })}
                        <TableRow className="font-bold border-t-2 bg-muted/50">
                          <TableCell>Total</TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          {canSeeFinancials && (
                            <TableCell className="text-right">
                              {formatCurrency(activeEmployee.revenue_generated - (activeEmployee.product_incentives || 0))}
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <span className="flex items-center justify-end gap-1">
                              <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                              {activeEmployee.star_points}
                            </span>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : activeEmployee.daily_breakdown && activeEmployee.daily_breakdown.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Services</TableHead>
                          <TableHead>Contribution</TableHead>
                          <TableHead>Stars</TableHead>
                          {canSeeFinancials && <TableHead className="text-right">Earnings</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeEmployee.daily_breakdown.map((day) => (
                          <TableRow key={day.date}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {new Date(day.date + 'T00:00:00').toLocaleDateString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </TableCell>
                            <TableCell>{day.services_count}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {day.services.map((s, i) => {
                                  const isProduct = s.item_type === 'product'
                                  return (
                                  <Badge
                                    key={i}
                                    variant={isProduct ? 'outline' : s.contribution_type === 'full' ? 'default' : 'secondary'}
                                    className={`text-xs cursor-pointer hover:ring-2 hover:ring-primary/50 ${isProduct ? 'border-green-300 text-green-700 bg-green-50' : ''}`}
                                    title={[s.bill_number && `Bill: ${s.bill_number}`, s.book_number && `Book: ${s.book_number}`].filter(Boolean).join(' · ') || undefined}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (s.bill_id) navigate(`/bills/${s.bill_id}?returnTo=${encodeURIComponent(buildReturnTo(location))}`)
                                    }}
                                  >
                                    {isProduct
                                      ? `${s.service_name}: ${formatCurrency(s.sale_amount)} → ${formatCurrency(s.earnings)} (${s.contribution_percent || ''}%)`
                                      : `${s.time ? `${s.time} ` : ''}${s.service_name}: ${s.contribution_type === 'full' ? 'Full' : `${s.contribution_percent}%`}`
                                    }
                                  </Badge>
                                  )
                                })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                {day.stars}
                              </div>
                            </TableCell>
                            {canSeeFinancials && (
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(day.earnings)}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2 bg-muted/50">
                          <TableCell>Total</TableCell>
                          <TableCell>{activeEmployee.services_completed}</TableCell>
                          <TableCell></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                              {activeEmployee.star_points}
                            </div>
                          </TableCell>
                          {canSeeFinancials && (
                            <TableCell className="text-right">
                              {formatCurrency(activeEmployee.revenue_generated - (activeEmployee.product_incentives || 0))}
                            </TableCell>
                          )}
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-gray-500 text-center py-6 text-sm">
                      No data for this employee in the selected period
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Overview (when no specific employee is selected) */}
          {!activeEmployee && employees.length > 0 && (
            <>
              {/* Summary Row */}
              {totals && (
                <div
                  className={`grid grid-cols-2 gap-4 ${
                    !canSeeFinancials
                      ? 'md:grid-cols-2'
                      : showServiceEarningsCard
                        ? 'md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
                        : 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
                  }`}
                >
                  <Card>
                    <CardContent className="pt-5 pb-4 text-center">
                      <div className="text-xs text-muted-foreground mb-1">Total Services</div>
                      <div className="text-2xl font-bold">{totals.services}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-5 pb-4 text-center">
                      <div className="text-xs text-muted-foreground mb-1">Total Stars</div>
                      <div className="text-2xl font-bold flex items-center justify-center gap-1">
                        <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                        {Math.round(totals.stars * 100) / 100}
                      </div>
                    </CardContent>
                  </Card>
                  {canSeeFinancials && showServiceEarningsCard && (
                    <Card>
                      <CardContent className="pt-5 pb-4 text-center">
                        <div className="text-xs text-muted-foreground mb-1">Service Earnings</div>
                        <div className="text-2xl font-bold">{formatCurrency(totals.earnings)}</div>
                      </CardContent>
                    </Card>
                  )}
                  {canSeeFinancials && (
                    <>
                      <Card>
                        <CardContent className="pt-5 pb-4 text-center">
                          <div className="text-xs text-muted-foreground mb-1">Product Sales</div>
                          <div className="text-2xl font-bold">{formatCurrency(totals.productSales)}</div>
                        </CardContent>
                      </Card>
                      <Card
                        className="cursor-pointer hover:ring-2 hover:ring-green-200 transition-all"
                        onClick={() => document.getElementById('product-incentives')?.scrollIntoView({ behavior: 'smooth' })}
                      >
                        <CardContent className="pt-5 pb-4 text-center">
                          <div className="text-xs text-muted-foreground mb-1">Product Incentives</div>
                          <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.productIncentives || incentiveSummary.total_incentive || 0)}</div>
                        </CardContent>
                      </Card>
                      <Card
                        className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                        onClick={() => document.getElementById('staff-incentives')?.scrollIntoView({ behavior: 'smooth' })}
                      >
                        <CardContent className="pt-5 pb-4 text-center">
                          <div className="text-xs text-muted-foreground mb-1">Staff Incentives</div>
                          <div className="text-2xl font-bold text-primary">{formatCurrency(totals.staffIncentives || staffIncentiveTotal || 0)}</div>
                          {staffIncentivePeriod && (
                            <div className="text-xs text-muted-foreground mt-0.5">{monthLabel(staffIncentivePeriod.year, staffIncentivePeriod.month)}</div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4" />
                    Employee Performance
                  </CardTitle>
                  <CardDescription>
                    {effectiveStart}{effectiveStart !== effectiveEnd ? ` to ${effectiveEnd}` : ''}
                    {selectedBranch && ` \u2022 ${branches.find((b) => b.branch_id === selectedBranch)?.name || 'Branch'}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Services</TableHead>
                        <TableHead>Stars</TableHead>
                        {canSeeFinancials && showServiceEarningsCard && (
                          <TableHead className="text-right">Service Earnings</TableHead>
                        )}
                        {canSeeFinancials && (
                          <>
                            <TableHead className="text-right">Product Sales</TableHead>
                            <TableHead className="text-right">Product Incentives</TableHead>
                            <TableHead className="text-right">Staff Incentive</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((e) => (
                        <TableRow
                          key={e.employee_id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setActiveEmployeeId(e.employee_id)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {e.branches?.map((b) => (
                                <BranchColorDot key={b.id} color={b.color_code} />
                              )) || <BranchColorDot color={e.branch?.color_code} />}
                              {e.employee_name}
                            </div>
                          </TableCell>
                          <TableCell>{e.services_completed}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                              <span>{e.star_points}</span>
                              <span className="text-xs text-muted-foreground">/ {e.monthly_star_goal}</span>
                            </div>
                          </TableCell>
                          {canSeeFinancials && showServiceEarningsCard && (
                            <TableCell className="text-right font-bold">
                              {formatCurrency(e.revenue_generated - (e.product_incentives || 0))}
                            </TableCell>
                          )}
                          {canSeeFinancials && (
                            <>
                              <TableCell className="text-right">
                                {e.product_sales ? formatCurrency(e.product_sales) : '—'}
                              </TableCell>
                              <TableCell className="text-right font-medium text-green-600">
                                {e.product_incentives ? formatCurrency(e.product_incentives) : '—'}
                              </TableCell>
                              <TableCell className="text-right font-medium text-primary">
                                {staffIncentiveByEmployee.has(e.employee_id)
                                  ? formatCurrency(staffIncentiveByEmployee.get(e.employee_id).total_incentive)
                                  : '—'}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {canSeeFinancials && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Revenue by Employee</CardTitle>
                    <CardDescription>
                      Service earnings vs product sales per employee
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MultiBarChart
                      data={employees.slice(0, 15).map((e) => ({
                        employee_name: e.employee_name,
                        ...(showServiceEarningsCard ? { service_earnings: e.revenue_generated - (e.product_incentives || 0) } : {}),
                        product_sales: e.product_sales || 0,
                      }))}
                      bars={[
                        ...(showServiceEarningsCard ? [{ dataKey: 'service_earnings', name: 'Service Earnings', color: '#6366f1' }] : []),
                        { dataKey: 'product_sales', name: 'Product Sales', color: '#10b981' },
                      ]}
                      xKey="employee_name"
                      height={Math.max(250, Math.min(employees.length, 15) * 30)}
                    />
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {employees.length === 0 && !isLoading && (
            <Card>
              <CardContent className="py-16">
                <p className="text-gray-500 text-center">
                  No completed service data for the selected time range.
                </p>
                <p className="text-gray-400 text-center text-sm mt-2">
                  Try a wider date range or another branch. Staff incentive totals for the month are shown below.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Product Incentive Report (owners only) */}
          {canSeeFinancials && <Card id="product-incentives">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <IndianRupee className="h-4 w-4" />
                Product Incentives
              </CardTitle>
              <CardDescription>
                Product sale incentive earnings for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {incentiveLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : incentiveByEmployee.length === 0 ? (
                <p className="text-center text-gray-500 py-6 text-sm">No incentive data for this period</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Total Sales</p>
                      <p className="text-lg font-bold">{formatCurrency(incentiveSummary.total_sales || 0)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Total Incentive</p>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(incentiveSummary.total_incentive || 0)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Records</p>
                      <p className="text-lg font-bold">{incentiveSummary.record_count || 0}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {incentiveByEmployee.map((emp) => (
                      <div key={emp.employee_id} className="border rounded-lg">
                        <button
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedIncentiveEmp(expandedIncentiveEmp === emp.employee_id ? null : emp.employee_id)}
                        >
                          <div className="flex items-center gap-2">
                            <ChevronDown className={`h-4 w-4 transition-transform ${expandedIncentiveEmp === emp.employee_id ? '' : '-rotate-90'}`} />
                            <span className="font-medium">{emp.employee_name}</span>
                          </div>
                          <div className="flex gap-4 text-sm">
                            <span>Sales: <span className="font-semibold">{formatCurrency(emp.total_sales)}</span></span>
                            <span>Incentive: <span className="font-semibold text-green-600">{formatCurrency(emp.total_incentive)}</span></span>
                          </div>
                        </button>
                        {expandedIncentiveEmp === emp.employee_id && (
                          <div className="border-t">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Bill #</TableHead>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Product</TableHead>
                                  <TableHead className="text-right">Sale</TableHead>
                                  <TableHead className="text-right">%</TableHead>
                                  <TableHead className="text-right">Incentive</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(emp.records || []).map((r) => (
                                  <TableRow key={r.incentive_id}>
                                    <TableCell className="text-sm">{r.bill_number}</TableCell>
                                    <TableCell className="text-sm">
                                      {r.bill_date ? new Date(r.bill_date).toLocaleDateString('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short' }) : '—'}
                                    </TableCell>
                                    <TableCell>{r.product_name}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(r.sale_amount)}</TableCell>
                                    <TableCell className="text-right">{r.percentage}%</TableCell>
                                    <TableCell className="text-right font-medium text-green-600">{formatCurrency(r.incentive_amount)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>}

          {canSeeFinancials && staffIncentivePeriod && (
            <StaffIncentivesSection
              id="staff-incentives"
              embedded
              year={staffIncentivePeriod.year}
              month={staffIncentivePeriod.month}
              branchId={effectiveBranch}
              employeeId={activeEmployeeId || selectedEmployee || ''}
              showOwnerActions={isOwner}
              multiMonthNote={
                spansMultipleMonths
                  ? `Staff incentives are calculated per calendar month. Showing ${monthLabel(staffIncentivePeriod.year, staffIncentivePeriod.month)} (month of the range end date).`
                  : undefined
              }
            />
          )}
        </div>
      )}
    </div>
  )
}

export default StaffPerformancePage
