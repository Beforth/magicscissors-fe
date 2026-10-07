import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users,
  Receipt,
  TrendingUp,
  Building2,
  Plus,
  UserPlus,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from 'lucide-react'
import { reportsService } from '@/services/reports.service'
import LowStockAlertsCard from '@/components/dashboard/LowStockAlertsCard'
import { BranchColorDot } from '@/components/ui/branch-color-dot'
import { cashService } from '@/services/cash.service'

function OwnerDashboard() {
  const { user } = useSelector((state) => state.auth)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [cashStatus, setCashStatus] = useState(null)

  useEffect(() => {
    if (user && !['owner', 'developer'].includes(user.role)) {
      if (user.role === 'employee') navigate('/dashboard/employee', { replace: true })
      else if (user.role === 'manager') navigate('/dashboard/manager', { replace: true })
      else if (user.role === 'cashier') navigate('/dashboard/cashier', { replace: true })
      return
    }

    const fetchDashboardStats = async () => {
      try {
        setLoading(true)
        const response = await reportsService.getDashboardStats()
        setStats(response.data)
        // Fetch cash status
        try {
          const cashResponse = await cashService.getDashboardStatus()
          setCashStatus(cashResponse.data)
        } catch (cashErr) {
          console.error('Failed to fetch cash status:', cashErr)
        }
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardStats()
  }, [])

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '₹0'
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatNumber = (value) => {
    if (!value && value !== 0) return '0'
    return new Intl.NumberFormat('en-IN').format(value)
  }

  const getChangeType = (change) => {
    if (!change) return 'neutral'
    return change >= 0 ? 'positive' : 'negative'
  }

  const formatChange = (change) => {
    if (!change && change !== 0) return '0%'
    const sign = change >= 0 ? '+' : ''
    return `${sign}${change.toFixed(1)}%`
  }

  const statCards = stats ? [
    {
      name: 'Total Bills',
      value: formatNumber(stats.monthlyBills),
      change: formatChange(stats.billsChange),
      changeType: getChangeType(stats.billsChange),
      icon: Receipt,
      description: 'This month',
    },
    {
      name: 'Active Customers',
      value: formatNumber(stats.activeCustomers),
      change: formatChange(stats.customersChange),
      changeType: getChangeType(stats.customersChange),
      icon: Users,
      description: 'Visited this month',
    },
    {
      name: 'Average Bill',
      value: formatCurrency(stats.averageBillValue),
      change: formatChange(stats.avgBillChange),
      changeType: getChangeType(stats.avgBillChange),
      icon: TrendingUp,
      description: 'Per transaction',
    },
  ] : []

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.fullName || 'Owner'}
          </h1>
          <p className="text-gray-500">Loading dashboard data...</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60 mt-1" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.fullName || 'Owner'}
          </h1>
          <p className="text-red-500">Failed to load dashboard data: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      {/* ── Hero Banner ─────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 backdrop-blur-md px-3 py-1 mb-3 ring-1 ring-white/80 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Owner Overview</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 leading-tight tracking-tight">
            Welcome back,<br />
            <span className="text-blue-700">
              {user?.fullName?.split(' ')[0] || 'Owner'}
            </span>
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 font-medium">Here's what's happening across your salons today.</p>
        </div>
      </div>

      {/* Quick actions */}
      <section aria-label="Quick actions">
        <div className="mb-3">
          <h2 className="text-sm font-bold text-slate-800">Quick actions</h2>
          <p className="text-xs text-slate-400">Jump straight into your daily work</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { title: 'Create a bill', detail: 'Start a new transaction', path: '/bills/new' },
            { title: 'Customers', detail: 'Find or add a customer', path: '/customers' },
            { title: 'Reports', detail: 'Review business insights', path: '/reports' },
          ].map(({ title, detail, path }) => (
            <button
              key={title}
              type="button"
              onClick={() => navigate(path)}
              className="group flex min-h-[64px] items-center justify-between rounded-3xl glass-card px-5 py-4 text-left transition-all hover:bg-white hover:scale-[1.01] hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <span className="block font-bold text-slate-800 text-sm">{title}</span>
                <span className="block truncate text-xs text-slate-400 font-medium">{detail}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.name} className="rounded-3xl glass-card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">{stat.name}</span>
              <span className="text-xs font-bold text-slate-500 bg-white/80 px-2.5 py-1 rounded-full border border-white/80 shadow-2xs">Monthly</span>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-800 tabular-nums leading-none">{stat.value}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className={`flex items-center ${
                stat.changeType === 'positive' ? 'text-emerald-600' :
                stat.changeType === 'negative' ? 'text-rose-600' : 'text-slate-500'
              }`}>
                {stat.change}
              </span>
              <span className="text-slate-400">{stat.description}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Branch Performance */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Branch Performance</CardTitle>
              <CardDescription>
                Revenue comparison across all branches
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.branchPerformance && stats.branchPerformance.length > 0 ? (
              stats.branchPerformance.map((branch) => (
                <div
                  key={branch.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-gray-900 flex items-center gap-1.5">
                        <BranchColorDot color={branch.color_code} />
                        {branch.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatNumber(branch.billCount)} bills this month
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(branch.revenue)}
                    </p>
                    {branch.growth !== undefined && (
                      <Badge
                        variant={branch.growth >= 0 ? "success" : "destructive"}
                        className="mt-1"
                      >
                        {formatChange(branch.growth)}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No branch data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Today's Summary */}
      {stats?.todaySummary && (
        <Card>
          <CardHeader>
            <CardTitle>Today's Summary</CardTitle>
            <CardDescription>
              Real-time overview of today's activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {formatNumber(stats.todaySummary.billCount)}
                </p>
                <p className="text-sm text-gray-600">Bills Created</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">
                  {formatNumber(stats.todaySummary.newCustomers)}
                </p>
                <p className="text-sm text-gray-600">New Customers</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">
                  {formatNumber(stats.todaySummary.servicesProvided)}
                </p>
                <p className="text-sm text-gray-600">Services</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cash Drawer Status */}
      {cashStatus && cashStatus.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cash Drawer Status</CardTitle>
                <CardDescription>Today's cash position across all branches</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cashStatus.map((branch) => {
                if (branch.error) {
                  return (
                    <div key={branch.branch_id} className="p-4 bg-gray-50 rounded-lg">
                      <p className="font-medium text-gray-900 flex items-center gap-1.5">
                        <BranchColorDot color={branch.color_code} />
                        {branch.branch_name}
                      </p>
                      <p className="text-sm text-red-500 mt-1">{branch.error}</p>
                    </div>
                  )
                }
                const isHealthy = branch.expected_cash >= 0
                return (
                  <div
                    key={branch.branch_id}
                    className={`p-4 rounded-lg border ${
                      branch.is_reconciled
                        ? Math.abs(branch.difference) < 1
                          ? 'bg-green-50 border-green-200'
                          : branch.difference > 0
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-red-50 border-red-200'
                        : isHealthy
                          ? 'bg-gray-50 border-gray-200'
                          : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium text-gray-900 flex items-center gap-1.5">
                        <BranchColorDot color={branch.color_code} />
                        {branch.branch_name}
                      </p>
                      {branch.is_reconciled && (
                        <Badge variant="success" className="text-xs">Reconciled</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500">Opening</p>
                        <p className="font-semibold">{formatCurrency(branch.opening_balance)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Cash In</p>
                        <p className="font-semibold text-green-600">{formatCurrency(branch.cash_income)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Cash Out</p>
                        <p className="font-semibold text-red-600">
                          {formatCurrency(branch.cash_expenses + branch.bank_deposits + branch.counter_withdrawals + branch.savings_pot_deposits)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Expected</p>
                        <p className={`font-bold ${isHealthy ? 'text-gray-900' : 'text-red-600'}`}>
                          {formatCurrency(branch.expected_cash)}
                        </p>
                      </div>
                    </div>
                    {branch.is_reconciled && (
                      <div className="mt-2 pt-2 border-t text-sm flex justify-between">
                        <span className="text-gray-500">Actual / Diff</span>
                        <span className={`font-semibold ${
                          Math.abs(branch.difference) < 1 ? 'text-green-600' : branch.difference > 0 ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(branch.actual_cash)} ({branch.difference >= 0 ? '+' : ''}{formatCurrency(branch.difference)})
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Low Stock Alerts */}
      <LowStockAlertsCard maxItems={4} />

    </div>
  )
}

export default OwnerDashboard
