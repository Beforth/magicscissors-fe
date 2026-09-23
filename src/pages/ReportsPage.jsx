import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery } from '@tanstack/react-query'
import { reportsService } from '@/services/reports.service'
import { branchService } from '@/services/branch.service'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
import {
  BarChart3,
  Calendar,
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Loader2,
  Download,
  Scissors,
  Package,
  Star,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Warehouse,
  ArrowRightLeft,
  Landmark,
  BoxesIcon,
  Droplets,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/export-utils'
import {
  RevenueAreaChart,
  RevenueBarChart,
  DonutChart,
  HorizontalBarChart,
  SimplePieChart,
  SimpleBarChart,
} from '@/components/charts'
import StaffIncentivesReport from '@/components/StaffIncentivesReport'

const REPORT_TYPES = [
  { id: 'daily', label: 'Daily Sales', icon: Calendar },
  { id: 'monthly', label: 'Monthly Revenue', icon: BarChart3 },
  { id: 'customers', label: 'Customer Analytics', icon: Users },
  { id: 'employees', label: 'Employee Performance', icon: Star },
  { id: 'services', label: 'Service Analytics', icon: Scissors },
  { id: 'inventory', label: 'Inventory Report', icon: Package },
  { id: 'backbar-consumption', label: 'Backbar Consumption', icon: Droplets },
  { id: 'service-liability', label: 'Service Liability', icon: TrendingDown },
  { id: 'supplier-credit', label: 'Supplier Credit', icon: DollarSign },
  // Warehouse reports (Feature 3)
  { id: 'wh-stock', label: 'Warehouse Stock', icon: Warehouse },
  { id: 'wh-purchases', label: 'Warehouse Purchases', icon: DollarSign },
  { id: 'wh-transfers', label: 'Transfers Out', icon: ArrowRightLeft },
  { id: 'branch-pl', label: 'Branch P&L', icon: Landmark },
  { id: 'stock-snapshot', label: 'Stock Value Snapshot', icon: BoxesIcon },
  { id: 'staff-incentives', label: 'Staff Incentives', icon: TrendingUp },
]

function ReportsPage() {
  const { user } = useSelector((state) => state.auth)
  const [activeReport, setActiveReport] = useState('daily')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [period, setPeriod] = useState(30)
  const [consumptionTab, setConsumptionTab] = useState('usage')
  const [consumptionStatus, setConsumptionStatus] = useState('')
  const [selectedBottleId, setSelectedBottleId] = useState(null)

  const branchId = user?.branchId || null

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: !branchId,
  })

  const branches = branchesData?.data || []

  // Daily Sales
  const { data: dailySalesData, isLoading: dailyLoading } = useQuery({
    queryKey: ['daily-sales', selectedDate, selectedBranch],
    queryFn: () => reportsService.getDailySales({
      date: selectedDate,
      branch_id: selectedBranch || undefined
    }),
    enabled: activeReport === 'daily',
  })

  // Monthly Revenue
  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ['monthly-revenue', selectedYear, selectedMonth, selectedBranch],
    queryFn: () => reportsService.getMonthlyRevenue({
      year: selectedYear,
      month: selectedMonth,
      branch_id: selectedBranch || undefined
    }),
    enabled: activeReport === 'monthly',
  })

  // Customer Analytics
  const { data: customerData, isLoading: customerLoading } = useQuery({
    queryKey: ['customer-analytics', period, selectedBranch],
    queryFn: () => reportsService.getCustomerAnalytics({
      period,
      branch_id: selectedBranch || undefined
    }),
    enabled: activeReport === 'customers',
  })

  // Employee Performance
  const { data: employeeData, isLoading: employeeLoading } = useQuery({
    queryKey: ['employee-performance', period, selectedBranch],
    queryFn: () => reportsService.getEmployeePerformance({
      period,
      branch_id: selectedBranch || undefined
    }),
    enabled: activeReport === 'employees',
  })

  // Service Analytics
  const { data: serviceData, isLoading: serviceLoading } = useQuery({
    queryKey: ['service-analytics', period, selectedBranch],
    queryFn: () => reportsService.getServiceAnalytics({
      period,
      branch_id: selectedBranch || undefined
    }),
    enabled: activeReport === 'services',
  })

  // Inventory Report
  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['inventory-report'],
    queryFn: () => reportsService.getInventoryReport({}),
    enabled: activeReport === 'inventory',
  })

  const consumptionParams = {
    period,
    branch_id: selectedBranch || branchId || undefined,
  }

  const { data: consumptionUsageData, isLoading: consumptionUsageLoading } = useQuery({
    queryKey: ['consumption-usage', consumptionParams],
    queryFn: () => reportsService.getConsumptionUsageByService(consumptionParams),
    enabled: activeReport === 'backbar-consumption' && consumptionTab === 'usage',
  })

  const { data: consumptionWastageData, isLoading: consumptionWastageLoading } = useQuery({
    queryKey: ['consumption-wastage', consumptionParams],
    queryFn: () => reportsService.getConsumptionWastage(consumptionParams),
    enabled: activeReport === 'backbar-consumption' && consumptionTab === 'wastage',
  })

  const { data: consumptionLifecycleData, isLoading: consumptionLifecycleLoading } = useQuery({
    queryKey: ['consumption-lifecycle', consumptionParams, consumptionStatus],
    queryFn: () => reportsService.getBottleLifecycle({
      ...consumptionParams,
      status: consumptionStatus || undefined,
    }),
    enabled: activeReport === 'backbar-consumption' && consumptionTab === 'lifecycle',
  })

  const { data: bottleDetailData, isLoading: bottleDetailLoading } = useQuery({
    queryKey: ['bottle-lifecycle-detail', selectedBottleId],
    queryFn: () => reportsService.getBottleLifecycleDetail(selectedBottleId),
    enabled: !!selectedBottleId,
  })

  // Service Liability
  const [liabilityStartDate, setLiabilityStartDate] = useState('')
  const [liabilityEndDate, setLiabilityEndDate] = useState('')
  const [liabilityExpandedBill, setLiabilityExpandedBill] = useState(null)

  const { data: liabilityData, isLoading: liabilityLoading } = useQuery({
    queryKey: ['service-liability', { branch: selectedBranch || branchId, start: liabilityStartDate, end: liabilityEndDate }],
    queryFn: () => reportsService.getServiceLiability({
      branch_id: selectedBranch || branchId || undefined,
      start_date: liabilityStartDate || undefined,
      end_date: liabilityEndDate || undefined,
    }),
    enabled: activeReport === 'service-liability',
  })

  // Supplier Credit
  const { data: supplierCreditData, isLoading: supplierCreditLoading } = useQuery({
    queryKey: ['supplier-credit', { branch: selectedBranch || branchId }],
    queryFn: () => reportsService.getSupplierCredit({
      branch_id: selectedBranch || branchId || undefined,
    }),
    enabled: activeReport === 'supplier-credit',
  })

  const dailySales = dailySalesData?.data
  const monthly = monthlyData?.data
  const customers = customerData?.data
  const employees = employeeData?.data
  const services = serviceData?.data
  const inventory = inventoryData?.data
  const consumptionUsage = consumptionUsageData?.data || consumptionUsageData
  const consumptionWastage = consumptionWastageData?.data || consumptionWastageData
  const consumptionLifecycle = consumptionLifecycleData?.data || consumptionLifecycleData
  const bottleDetail = bottleDetailData?.data || bottleDetailData
  const liability = liabilityData?.data || liabilityData || {}
  const supplierCredit = supplierCreditData?.data || supplierCreditData || {}

  // ── Warehouse reports (Feature 3) ──────────────────────────────────────
  const { data: whStockData } = useQuery({
    queryKey: ['wh-stock', selectedBranch],
    queryFn: () => reportsService.getWarehouseStockOnHand({ branch_id: selectedBranch }),
    enabled: activeReport === 'wh-stock' && !!selectedBranch,
  })
  const { data: whPurchasesData } = useQuery({
    queryKey: ['wh-purchases', selectedBranch],
    queryFn: () => reportsService.getWarehousePurchases({ branch_id: selectedBranch }),
    enabled: activeReport === 'wh-purchases' && !!selectedBranch,
  })
  const { data: whTransfersData } = useQuery({
    queryKey: ['wh-transfers', selectedBranch],
    queryFn: () => reportsService.getWarehouseTransfersOut({ branch_id: selectedBranch }),
    enabled: activeReport === 'wh-transfers' && !!selectedBranch,
  })
  const { data: branchPLData } = useQuery({
    queryKey: ['branch-pl', selectedBranch],
    queryFn: () => reportsService.getBranchPL({ branch_id: selectedBranch }),
    enabled: activeReport === 'branch-pl' && !!selectedBranch,
  })
  const { data: snapshotData } = useQuery({
    queryKey: ['stock-snapshot'],
    queryFn: () => reportsService.getStockValueSnapshot(),
    enabled: activeReport === 'stock-snapshot',
  })

  const whStock = whStockData?.data || []
  const whPurchases = whPurchasesData?.data || []
  const whTransfers = whTransfersData?.data || []
  const branchPL = branchPLData?.data || null
  const snapshot = snapshotData?.data || []

  // Export button component with dropdown
  const ExportButton = ({ data, filename, title, summaryCards = [] }) => {
    if (!data || data.length === 0) return null

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => exportToCSV(data, filename)}>
            <FileText className="h-4 w-4 mr-2" />
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportToExcel(data, filename, { title })}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export as Excel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportToPDF(data, filename, { title, summaryCards })}>
            <FileText className="h-4 w-4 mr-2" />
            Print / PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-500">View business insights and performance metrics</p>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="flex flex-wrap gap-2">
        {REPORT_TYPES.map((type) => (
          <Button
            key={type.id}
            variant={activeReport === type.id ? 'default' : 'outline'}
            onClick={() => setActiveReport(type.id)}
            className="flex items-center gap-2"
          >
            <type.icon className="h-4 w-4" />
            {type.label}
          </Button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {!branchId && (
              <div>
                <Label className="mb-2 block">Branch</Label>
                <select
                  className="h-10 px-3 border rounded-md min-w-[150px]"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
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

            {activeReport === 'daily' && (
              <div>
                <Label className="mb-2 block">Date</Label>
                <input
                  type="date"
                  className="h-10 px-3 border rounded-md"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            )}

            {activeReport === 'monthly' && (
              <>
                <div>
                  <Label className="mb-2 block">Year</Label>
                  <select
                    className="h-10 px-3 border rounded-md"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  >
                    {[2024, 2025, 2026].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="mb-2 block">Month</Label>
                  <select
                    className="h-10 px-3 border rounded-md"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {['customers', 'employees', 'services', 'backbar-consumption'].includes(activeReport) && (
              <div>
                <Label className="mb-2 block">Period</Label>
                <select
                  className="h-10 px-3 border rounded-md"
                  value={period}
                  onChange={(e) => setPeriod(parseInt(e.target.value))}
                >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                  <option value={365}>Last year</option>
                </select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Daily Sales Report */}
      {activeReport === 'daily' && (
        <div className="space-y-6">
          {dailyLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : dailySales ? (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Total Bills</p>
                        <p className="text-2xl font-bold">{dailySales.summary.total_bills}</p>
                      </div>
                      <BarChart3 className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Average Bill</p>
                        <p className="text-2xl font-bold">{formatCurrency(dailySales.summary.average_bill)}</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Total Discount</p>
                        <p className="text-2xl font-bold">{formatCurrency(dailySales.summary.total_discount)}</p>
                      </div>
                      <TrendingDown className="h-8 w-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Payment Modes */}
                <Card>
                  <CardHeader>
                    <CardTitle>By Payment Mode</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dailySales.by_payment_mode.length > 0 ? (
                      <DonutChart
                        data={dailySales.by_payment_mode.map(p => ({
                          name: p.payment_mode,
                          value: p.amount,
                        }))}
                        height={280}
                      />
                    ) : (
                      <p className="text-gray-500 text-center py-4">No data available</p>
                    )}
                  </CardContent>
                </Card>

                {/* Top Services */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Services</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dailySales.top_services.length > 0 ? (
                      <HorizontalBarChart
                        data={dailySales.top_services.slice(0, 8)}
                        dataKey="revenue"
                        nameKey="service_name"
                        height={280}
                      />
                    ) : (
                      <p className="text-gray-500 text-center py-4">No data available</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-gray-500">
                No data available for the selected date
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Monthly Revenue Report */}
      {activeReport === 'monthly' && (
        <div className="space-y-6">
          {monthlyLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : monthly ? (
            <>
              {/* Summary */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-gray-500">Total Bills</p>
                    <p className="text-2xl font-bold">{monthly.summary.total_bills}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-gray-500">Total Discount</p>
                    <p className="text-2xl font-bold">{formatCurrency(monthly.summary.total_discount)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Daily Breakdown Chart */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Daily Revenue Breakdown</CardTitle>
                  <ExportButton
                    data={monthly.daily_breakdown}
                    filename="monthly_revenue"
                    title={`Monthly Revenue - ${selectedMonth}/${selectedYear}`}
                    summaryCards={[
                      { label: 'Total Bills', value: monthly.summary.total_bills },
                    ]}
                  />
                </CardHeader>
                <CardContent>
                  <RevenueAreaChart
                    data={monthly.daily_breakdown.map(d => ({
                      ...d,
                      date: d.date.split('-')[2],
                    }))}
                    dataKey="revenue"
                    xKey="date"
                    height={280}
                  />
                </CardContent>
              </Card>

              {/* Branch Breakdown */}
              {monthly.branch_breakdown?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue by Branch</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RevenueBarChart
                      data={monthly.branch_breakdown}
                      dataKey="revenue"
                      xKey="branch_name"
                      height={280}
                    />
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Customer Analytics */}
      {activeReport === 'customers' && (
        <div className="space-y-6">
          {customerLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : customers ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-gray-500">New Customers (Last {period} days)</p>
                    <p className="text-3xl font-bold">{customers.new_customers}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Demographics */}
                <Card>
                  <CardHeader>
                    <CardTitle>By Gender</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {customers.demographics.by_gender.length > 0 ? (
                      <SimplePieChart
                        data={customers.demographics.by_gender.map(g => ({
                          name: g.gender.charAt(0).toUpperCase() + g.gender.slice(1),
                          value: g.count,
                        }))}
                        height={220}
                      />
                    ) : (
                      <p className="text-gray-500 text-center py-4">No data available</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>By Age Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {customers.demographics.by_age.length > 0 ? (
                      <SimpleBarChart
                        data={customers.demographics.by_age.map(a => ({
                          name: a.age_category.charAt(0).toUpperCase() + a.age_category.slice(1),
                          count: a.count,
                        }))}
                        dataKey="count"
                        xKey="name"
                        height={220}
                        color="#ec4899"
                      />
                    ) : (
                      <p className="text-gray-500 text-center py-4">No data available</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Top Customers */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Top Customers</CardTitle>
                  <ExportButton
                    data={customers.top_customers}
                    filename="top_customers"
                    title={`Top Customers - Last ${period} Days`}
                    summaryCards={[
                      { label: 'New Customers', value: customers.new_customers },
                    ]}
                  />
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Visits (Period)</TableHead>
                        <TableHead>Total Visits</TableHead>
                        <TableHead className="text-right">Spent (Period)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.top_customers.slice(0, 10).map((c) => (
                        <TableRow key={c.customer_id}>
                          <TableCell className="font-medium">{c.customer_name}</TableCell>
                          <TableCell>{c.phone_masked}</TableCell>
                          <TableCell>{c.visits_in_period}</TableCell>
                          <TableCell>{c.total_visits}</TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(c.total_spent)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {/* Employee Performance */}
      {activeReport === 'employees' && (
        <div className="space-y-6">
          {employeeLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : employees ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Employee Performance</CardTitle>
                    <CardDescription>Last {period} days</CardDescription>
                  </div>
                  <ExportButton
                    data={employees.employees}
                    filename="employee_performance"
                    title={`Employee Performance - Last ${period} Days`}
                  />
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Services Completed</TableHead>
                        <TableHead>Star Points</TableHead>
                        <TableHead className="text-right">Revenue Generated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.employees.map((e, i) => (
                        <TableRow key={e.employee_id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {i < 3 && (
                                <Badge variant={i === 0 ? 'default' : 'secondary'}>
                                  #{i + 1}
                                </Badge>
                              )}
                              {e.employee_name}
                            </div>
                          </TableCell>
                          <TableCell>{e.services_completed}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              {e.star_points}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(e.revenue_generated)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Revenue Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Employee</CardTitle>
                </CardHeader>
                <CardContent>
                  {employees.employees.length > 0 ? (
                    <HorizontalBarChart
                      data={employees.employees.slice(0, 10)}
                      dataKey="revenue_generated"
                      nameKey="employee_name"
                      height={Math.max(250, employees.employees.slice(0, 10).length * 40)}
                    />
                  ) : (
                    <p className="text-gray-500 text-center py-4">No data available</p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {/* Service Analytics */}
      {activeReport === 'services' && (
        <div className="space-y-6">
          {serviceLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : services ? (
            <>
              {/* By Category */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  {services.by_category.length > 0 ? (
                    <DonutChart
                      data={services.by_category.map(c => ({
                        name: c.category,
                        value: c.revenue,
                      }))}
                      height={300}
                    />
                  ) : (
                    <p className="text-gray-500 text-center py-4">No data available</p>
                  )}
                </CardContent>
              </Card>

              {/* Top Services */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Top Services</CardTitle>
                  <ExportButton
                    data={services.top_services}
                    filename="service_analytics"
                    title={`Service Analytics - Last ${period} Days`}
                  />
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Times Ordered</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services.top_services.slice(0, 15).map((s) => (
                        <TableRow key={s.service_id}>
                          <TableCell className="font-medium">{s.service_name}</TableCell>
                          <TableCell>{s.category}</TableCell>
                          <TableCell>{s.times_ordered}</TableCell>
                          <TableCell>{s.quantity_sold}</TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(s.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {/* Inventory Report */}
      {activeReport === 'inventory' && (
        <div className="space-y-6">
          {inventoryLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : inventory ? (
            <>
              {/* Summary */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-gray-500">Total Items</p>
                    <p className="text-2xl font-bold">{inventory.summary.total_items}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-gray-500">Stock Value</p>
                    <p className="text-2xl font-bold">{formatCurrency(inventory.summary.total_value)}</p>
                  </CardContent>
                </Card>
                <Card className="border-red-200">
                  <CardContent className="p-6">
                    <p className="text-sm text-red-500">Low Stock Items</p>
                    <p className="text-2xl font-bold text-red-600">{inventory.summary.low_stock_count}</p>
                  </CardContent>
                </Card>
                <Card className="border-orange-200">
                  <CardContent className="p-6">
                    <p className="text-sm text-orange-500">Expiring Soon</p>
                    <p className="text-2xl font-bold text-orange-600">{inventory.summary.expiring_soon_count}</p>
                  </CardContent>
                </Card>
              </div>

              {/* By Category */}
              <Card>
                <CardHeader>
                  <CardTitle>Stock Value by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  {inventory.by_category.length > 0 ? (
                    <RevenueBarChart
                      data={inventory.by_category}
                      dataKey="value"
                      xKey="category"
                      height={280}
                    />
                  ) : (
                    <p className="text-gray-500 text-center py-4">No data available</p>
                  )}
                </CardContent>
              </Card>

              {/* Low Stock Items */}
              {inventory.low_stock_items.length > 0 && (
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-red-600">Low Stock Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Current Stock</TableHead>
                          <TableHead>Reorder Level</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventory.low_stock_items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{item.product_name}</TableCell>
                            <TableCell>{item.location}</TableCell>
                            <TableCell className="text-red-600 font-bold">{item.quantity}</TableCell>
                            <TableCell>{item.reorder_level}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Backbar Consumption Reports (Phase 3) */}
      {activeReport === 'backbar-consumption' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'usage', label: 'Usage by Service' },
              { id: 'wastage', label: 'Wastage' },
              { id: 'lifecycle', label: 'Bottle Lifecycle' },
            ].map((tab) => (
              <Button
                key={tab.id}
                size="sm"
                variant={consumptionTab === tab.id ? 'default' : 'outline'}
                onClick={() => setConsumptionTab(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {consumptionTab === 'lifecycle' && (
            <Card>
              <CardContent className="py-3 px-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <Label className="text-xs">Status</Label>
                    <select
                      className="h-9 px-3 border rounded-md text-sm min-w-[140px]"
                      value={consumptionStatus}
                      onChange={(e) => setConsumptionStatus(e.target.value)}
                    >
                      <option value="">All</option>
                      <option value="active">Active</option>
                      <option value="empty">Empty</option>
                      <option value="discarded">Discarded</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {consumptionTab === 'usage' && (
            consumptionUsageLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : consumptionUsage ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="p-6">
                      <p className="text-sm text-gray-500">Total usages</p>
                      <p className="text-2xl font-bold">{consumptionUsage.summary?.total_usages ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <p className="text-sm text-gray-500">Service / product pairs</p>
                      <p className="text-2xl font-bold">{consumptionUsage.summary?.service_product_pairs ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <p className="text-sm text-gray-500">Volume deducted (mixed units)</p>
                      <p className="text-2xl font-bold">{consumptionUsage.summary?.total_amount ?? 0}</p>
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>Product usage per service</CardTitle>
                    <CardDescription>Backbar deductions from open bottles during the selected period</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {(consumptionUsage.rows || []).length === 0 ? (
                      <p className="text-center text-gray-500 py-10">No consumption recorded in this period.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Service</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Times used</TableHead>
                            <TableHead className="text-right">Total amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {consumptionUsage.rows.map((row) => (
                            <TableRow key={`${row.service_id}-${row.product_id}-${row.unit}`}>
                              <TableCell className="font-medium">{row.service_name}</TableCell>
                              <TableCell>{row.product_name}</TableCell>
                              <TableCell className="text-right">{row.usage_count}</TableCell>
                              <TableCell className="text-right font-mono">
                                {row.total_amount} {row.unit}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null
          )}

          {consumptionTab === 'wastage' && (
            consumptionWastageLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : consumptionWastage ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border-amber-200">
                    <CardContent className="p-6">
                      <p className="text-sm text-amber-600">Bottles discarded</p>
                      <p className="text-2xl font-bold text-amber-700">{consumptionWastage.summary?.bottles_discarded ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-amber-200">
                    <CardContent className="p-6">
                      <p className="text-sm text-amber-600">Volume wasted (mixed units)</p>
                      <p className="text-2xl font-bold text-amber-700">{consumptionWastage.summary?.total_wasted_volume ?? 0}</p>
                    </CardContent>
                  </Card>
                </div>
                {(consumptionWastage.by_product || []).length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Wastage by product</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Bottles</TableHead>
                            <TableHead className="text-right">Wasted volume</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {consumptionWastage.by_product.map((row) => (
                            <TableRow key={`${row.product_id}-${row.unit}`}>
                              <TableCell className="font-medium">{row.product_name}</TableCell>
                              <TableCell className="text-right">{row.bottles_discarded}</TableCell>
                              <TableCell className="text-right font-mono">{row.wasted_volume} {row.unit}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
                <Card>
                  <CardHeader><CardTitle>Discarded bottles</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    {(consumptionWastage.rows || []).length === 0 ? (
                      <p className="text-center text-gray-500 py-10">No discarded bottles in this period.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Barcode</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead className="text-right">Wasted</TableHead>
                            <TableHead>Discarded</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {consumptionWastage.rows.map((row) => (
                            <TableRow key={row.open_container_id}>
                              <TableCell className="font-medium">{row.product_name}</TableCell>
                              <TableCell className="font-mono text-xs">{row.barcode}</TableCell>
                              <TableCell>{row.branch_name}</TableCell>
                              <TableCell className="text-right font-mono text-amber-700">
                                {row.wasted_volume} {row.volume_unit}
                              </TableCell>
                              <TableCell className="text-sm text-gray-500">
                                {row.discarded_at ? new Date(row.discarded_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null
          )}

          {consumptionTab === 'lifecycle' && (
            consumptionLifecycleLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : consumptionLifecycle ? (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Total bottles</p><p className="text-2xl font-bold">{consumptionLifecycle.summary?.total_bottles ?? 0}</p></CardContent></Card>
                  <Card><CardContent className="p-6"><p className="text-sm text-green-600">Active</p><p className="text-2xl font-bold text-green-700">{consumptionLifecycle.summary?.active ?? 0}</p></CardContent></Card>
                  <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Empty</p><p className="text-2xl font-bold">{consumptionLifecycle.summary?.empty ?? 0}</p></CardContent></Card>
                  <Card><CardContent className="p-6"><p className="text-sm text-amber-600">Discarded</p><p className="text-2xl font-bold text-amber-700">{consumptionLifecycle.summary?.discarded ?? 0}</p></CardContent></Card>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>Bottle lifecycle</CardTitle>
                    <CardDescription>Bottles opened in the selected period — click a row for full usage history</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {(consumptionLifecycle.rows || []).length === 0 ? (
                      <p className="text-center text-gray-500 py-10">No bottles opened in this period.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Barcode</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Volume</TableHead>
                            <TableHead className="text-right">Uses</TableHead>
                            <TableHead>Opened</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {consumptionLifecycle.rows.map((row) => (
                            <TableRow
                              key={row.open_container_id}
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() => setSelectedBottleId(row.open_container_id)}
                            >
                              <TableCell className="font-medium">{row.product_name}</TableCell>
                              <TableCell className="font-mono text-xs">{row.barcode}</TableCell>
                              <TableCell>
                                <Badge variant={row.status === 'active' ? 'default' : row.status === 'discarded' ? 'destructive' : 'secondary'}>
                                  {row.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm font-mono">
                                {row.remaining_volume}/{row.initial_volume} {row.volume_unit}
                                <span className="text-gray-400 ml-1">({row.consumed_volume} used)</span>
                              </TableCell>
                              <TableCell className="text-right">{row.usage_count}</TableCell>
                              <TableCell className="text-sm text-gray-500">
                                {row.opened_at ? new Date(row.opened_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null
          )}

          <Dialog open={!!selectedBottleId} onOpenChange={(open) => { if (!open) setSelectedBottleId(null) }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Bottle usage history</DialogTitle>
              </DialogHeader>
              {bottleDetailLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : bottleDetail ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500">Product</span><p className="font-medium">{bottleDetail.product_name}</p></div>
                    <div><span className="text-gray-500">Barcode</span><p className="font-mono">{bottleDetail.barcode}</p></div>
                    <div><span className="text-gray-500">Status</span><p><Badge>{bottleDetail.status}</Badge></p></div>
                    <div><span className="text-gray-500">Branch</span><p>{bottleDetail.branch_name}</p></div>
                    <div><span className="text-gray-500">Volume</span><p className="font-mono">{bottleDetail.remaining_volume}/{bottleDetail.initial_volume} {bottleDetail.volume_unit}</p></div>
                    <div><span className="text-gray-500">Consumed</span><p className="font-mono">{bottleDetail.consumed_volume} {bottleDetail.volume_unit}</p></div>
                  </div>
                  {(bottleDetail.usage_log || []).length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No service deductions recorded yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Bill</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bottleDetail.usage_log.map((log) => (
                          <TableRow key={log.log_id}>
                            <TableCell className="text-sm">{log.used_at ? new Date(log.used_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}</TableCell>
                            <TableCell>{log.service_name || log.item_name || '—'}</TableCell>
                            <TableCell className="font-mono text-xs">{log.bill_number || '—'}</TableCell>
                            <TableCell className="text-right font-mono">{log.amount} {log.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Service Liability Report */}
      {activeReport === 'service-liability' && (
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs">From</Label>
                  <input type="date" value={liabilityStartDate} onChange={(e) => setLiabilityStartDate(e.target.value)} className="flex h-9 w-[150px] rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <input type="date" value={liabilityEndDate} onChange={(e) => setLiabilityEndDate(e.target.value)} className="flex h-9 w-[150px] rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
                </div>
                {(liabilityStartDate || liabilityEndDate) && (
                  <Button variant="ghost" size="sm" onClick={() => { setLiabilityStartDate(''); setLiabilityEndDate('') }}>Clear</Button>
                )}
              </div>
            </CardContent>
          </Card>

          {liabilityLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : liability.summary ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-gray-500">Total Received</p>
                    <p className="text-2xl font-bold">{formatCurrency(liability.summary.total_received)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-gray-500">Completed (Earned)</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(liability.summary.total_completed)}</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200">
                  <CardContent className="p-6">
                    <p className="text-sm text-amber-600">Pending (Liability)</p>
                    <p className="text-2xl font-bold text-amber-600">{formatCurrency(liability.summary.total_pending)}</p>
                    <p className="text-xs text-gray-500 mt-1">{liability.summary.bills_with_pending} bills with pending items</p>
                  </CardContent>
                </Card>
              </div>

              {(liability.bills || []).length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Bills with Pending Services</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bill #</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Received</TableHead>
                          <TableHead className="text-right">Pending</TableHead>
                          <TableHead className="text-center">Items</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {liability.bills.map((b) => (
                          <>
                            <TableRow
                              key={b.bill_id}
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() => setLiabilityExpandedBill(liabilityExpandedBill === b.bill_id ? null : b.bill_id)}
                            >
                              <TableCell className="font-medium">{b.bill_number}</TableCell>
                              <TableCell>{b.customer?.customer_name || '—'}</TableCell>
                              <TableCell>{b.bill_date ? new Date(b.bill_date).toLocaleDateString('en-IN', { timeZone: 'UTC' }) : '—'}</TableCell>
                              <TableCell className="text-right">{formatCurrency(b.total_received)}</TableCell>
                              <TableCell className="text-right text-amber-600 font-semibold">{formatCurrency(b.pending_amount)}</TableCell>
                              <TableCell className="text-center">{(b.pending_items || []).length}</TableCell>
                            </TableRow>
                            {liabilityExpandedBill === b.bill_id && (b.pending_items || []).map((item) => (
                              <TableRow key={item.item_id} className="bg-amber-50/50">
                                <TableCell></TableCell>
                                <TableCell colSpan={3} className="text-sm text-gray-600">
                                  {item.item_name} <Badge variant="secondary" className="ml-1">{item.item_type}</Badge>
                                </TableCell>
                                <TableCell className="text-right text-sm">{formatCurrency(item.amount)}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="text-amber-600">{item.status}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <p className="text-center text-gray-500 py-8">No data available</p>
          )}
        </div>
      )}

      {/* Supplier Credit Report */}
      {activeReport === 'supplier-credit' && (
        <div className="space-y-6">
          {supplierCreditLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : supplierCredit.summary ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-red-200">
                  <CardContent className="p-6">
                    <p className="text-sm text-red-500">Total Pending Credit</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(supplierCredit.summary.total_pending)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-gray-500">Suppliers with Pending</p>
                    <p className="text-2xl font-bold">{supplierCredit.summary.suppliers_with_pending}</p>
                  </CardContent>
                </Card>
              </div>

              {(supplierCredit.suppliers || []).length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Supplier Credit Summary</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Supplier</TableHead>
                          <TableHead className="text-right">Total Amount</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead className="text-right">Pending</TableHead>
                          <TableHead className="text-center">Batches</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supplierCredit.suppliers.map((s) => (
                          <TableRow key={s.supplier_id}>
                            <TableCell className="font-medium">{s.supplier_name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(s.total_amount)}</TableCell>
                            <TableCell className="text-right text-green-600">{formatCurrency(s.paid_amount)}</TableCell>
                            <TableCell className="text-right text-red-600 font-semibold">{formatCurrency(s.pending_amount)}</TableCell>
                            <TableCell className="text-center">{s.batch_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <p className="text-center text-gray-500 py-8">No data available</p>
          )}
        </div>
      )}

      {/* ─── Warehouse: Stock-on-hand ──────────────────────────────────── */}
      {activeReport === 'wh-stock' && (
        <div>
          {!selectedBranch ? (
            <p className="text-center text-gray-500 py-8">Select a warehouse branch to view stock.</p>
          ) : (
            <Card>
              <CardHeader><CardTitle>Stock on hand — {branches.find(b => b.branch_id === selectedBranch)?.name || ''}</CardTitle></CardHeader>
              <CardContent>
                {whStock.length === 0 ? (
                  <p className="text-center text-gray-500 py-6">No stock at this branch.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Value at cost</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {whStock.map((r) => (
                        <TableRow key={r.product_id}>
                          <TableCell className="font-medium">{r.product_name}</TableCell>
                          <TableCell className="text-sm text-gray-600">{r.sku_name || '—'}</TableCell>
                          <TableCell className="text-right">{r.quantity}</TableCell>
                          <TableCell className="text-right">{r.cost_price != null ? formatCurrency(r.cost_price) : <span className="text-rose-600 text-xs">missing</span>}</TableCell>
                          <TableCell className="text-right font-medium">{r.value_at_cost ? formatCurrency(r.value_at_cost) : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── Warehouse: Purchases by supplier ──────────────────────────── */}
      {activeReport === 'wh-purchases' && (
        <div>
          {!selectedBranch ? (
            <p className="text-center text-gray-500 py-8">Select a warehouse branch.</p>
          ) : (
            <Card>
              <CardHeader><CardTitle>Purchases by supplier</CardTitle></CardHeader>
              <CardContent>
                {whPurchases.length === 0 ? (
                  <p className="text-center text-gray-500 py-6">No purchases yet.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-center">Batches</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {whPurchases.map((s) => (
                        <TableRow key={s.supplier_id}>
                          <TableCell className="font-medium">{s.supplier_name}</TableCell>
                          <TableCell className="text-center">{s.batches}</TableCell>
                          <TableCell className="text-right">{formatCurrency(s.total_amount)}</TableCell>
                          <TableCell className="text-right text-green-700">{formatCurrency(s.paid_amount)}</TableCell>
                          <TableCell className="text-right text-rose-700">{formatCurrency(s.pending_amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── Warehouse: Transfers out per branch ───────────────────────── */}
      {activeReport === 'wh-transfers' && (
        <div>
          {!selectedBranch ? (
            <p className="text-center text-gray-500 py-8">Select a warehouse branch.</p>
          ) : (
            <Card>
              <CardHeader><CardTitle>Transfers out per receiving branch</CardTitle></CardHeader>
              <CardContent>
                {whTransfers.length === 0 ? (
                  <p className="text-center text-gray-500 py-6">No transfers yet.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Branch</TableHead>
                      <TableHead className="text-center">Transfers</TableHead>
                      <TableHead className="text-right">Total value (cost)</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {whTransfers.map((r) => (
                        <TableRow key={r.branch_id}>
                          <TableCell className="font-medium">{r.branch_name}</TableCell>
                          <TableCell className="text-center">{r.transfer_count}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(r.total_value_at_cost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── Branch P&L ────────────────────────────────────────────────── */}
      {activeReport === 'branch-pl' && (
        <div>
          {!selectedBranch ? (
            <p className="text-center text-gray-500 py-8">Select a branch to view P&amp;L.</p>
          ) : !branchPL ? (
            <p className="text-center text-gray-500 py-8">Loading…</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Card><CardContent className="p-4">
                  <div className="text-xs text-gray-500 uppercase">Revenue</div>
                  <div className="text-2xl font-bold text-green-700">{formatCurrency(branchPL.revenue || 0)}</div>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <div className="text-xs text-gray-500 uppercase">Total Expense</div>
                  <div className="text-2xl font-bold text-rose-700">{formatCurrency(branchPL.total_expense || 0)}</div>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <div className="text-xs text-gray-500 uppercase">Stock from warehouse</div>
                  <div className="text-2xl font-bold text-violet-700">{formatCurrency(branchPL.stock_from_warehouse_expense || 0)}</div>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <div className="text-xs text-gray-500 uppercase">Profit</div>
                  <div className={'text-2xl font-bold ' + ((branchPL.profit || 0) >= 0 ? 'text-green-700' : 'text-rose-700')}>{formatCurrency(branchPL.profit || 0)}</div>
                </CardContent></Card>
              </div>
              <Card>
                <CardHeader><CardTitle>Expenses by category</CardTitle></CardHeader>
                <CardContent>
                  {(branchPL.expenses_by_category || []).length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No expenses.</p>
                  ) : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {branchPL.expenses_by_category.map((e) => (
                          <TableRow key={e.name}>
                            <TableCell>{e.name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(e.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ─── Stock value snapshot (all locations) ──────────────────────── */}
      {activeReport === 'stock-snapshot' && (
        <Card>
          <CardHeader>
            <CardTitle>Stock value snapshot</CardTitle>
            <CardDescription>Inventory valued at cost across every location.</CardDescription>
          </CardHeader>
          <CardContent>
            {snapshot.length === 0 ? (
              <p className="text-center text-gray-500 py-6">No stock anywhere yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Value at cost</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {snapshot.map((r) => (
                    <TableRow key={r.location_id}>
                      <TableCell className="font-medium">{r.location_name}</TableCell>
                      <TableCell>{r.branch_name || '—'}</TableCell>
                      <TableCell>
                        {r.is_warehouse && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-800 mr-1">Warehouse</span>}
                        {r.is_salon && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">Salon</span>}
                      </TableCell>
                      <TableCell className="text-right">{r.units}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(r.value_at_cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Staff incentives (Feature 5) ──────────────────────────────── */}
      {activeReport === 'staff-incentives' && (
        <StaffIncentivesReport />
      )}
    </div>
  )
}

export default ReportsPage
