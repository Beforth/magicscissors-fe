import { useEffect, useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { billService } from '@/services/bill.service'
import { branchService } from '@/services/branch.service'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BranchColorDot } from '@/components/ui/branch-color-dot'
import { formatCurrency } from '@/lib/utils'
import {
  Search,
  UserCheck,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Building2,
  Clock,
  PlayCircle,
  Layers,
  Phone,
  Mail,
  ExternalLink,
  Pencil,
  TrendingUp,
  Scissors,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'

function StatusBadge({ status, onClick, loading }) {
  const isStarted = status === 'in_progress'

  if (isStarted) {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={(e) => {
          e.stopPropagation()
          onClick && onClick()
        }}
        title="Click to complete this service and clear it from active status"
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-white animate-pulse shrink-0" />
        )}
        <span>Started</span>
        <span className="text-[10px] opacity-80 underline ml-0.5">Mark Done</span>
      </button>
    )
  }

  // Pending
  return (
    <button
      type="button"
      disabled={loading}
      onClick={(e) => {
        e.stopPropagation()
        onClick && onClick()
      }}
      title="Click to complete this service and clear it from active status"
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
      ) : (
        <Clock className="h-3 w-3 shrink-0" />
      )}
      <span>Pending</span>
      <span className="text-[10px] opacity-80 underline ml-0.5">Mark Done</span>
    </button>
  )
}

function EmployeeProfileModal({ employee, open, onClose }) {
  const navigate = useNavigate()
  if (!employee) return null

  const assignments = (employee.assignments || []).filter(
    (a) => a.status !== 'completed' && a.bill_status !== 'completed'
  )
  const startedCount = assignments.filter((a) => a.status === 'in_progress').length
  const pendingCount = assignments.filter((a) => a.status === 'pending').length

  const initials = employee.employee_name
    ? employee.employee_name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'EM'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5">
        <DialogHeader className="space-y-3 pb-3 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold shrink-0 shadow-xs">
                {initials}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-foreground">
                  {employee.employee_name}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className="text-xs capitalize">
                    {employee.role || 'Staff'}
                  </Badge>
                  {employee.primary_branch && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                      <Building2 className="h-3 w-3" />
                      {employee.primary_branch}
                    </span>
                  )}
                  {employee.pay_type === 'incentive' ? (
                    <Badge variant="secondary" className="text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      {employee.base_salary != null ? `${employee.base_salary}% Commission` : 'Commission'}
                    </Badge>
                  ) : employee.pay_type === 'monthly' ? (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      mo • {formatCurrency(employee.base_salary || 0)}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          {(employee.phone || employee.email) && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
              {employee.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono">{employee.phone}</span>
                </div>
              )}
              {employee.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{employee.email}</span>
                </div>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Current Active Counters */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="rounded-lg border bg-muted/20 p-2.5">
            <span className="block text-[11px] text-muted-foreground font-medium">Active Services</span>
            <span className="text-lg font-bold text-foreground tabular-nums">{assignments.length}</span>
          </div>
          <div className="rounded-lg border bg-indigo-500/10 border-indigo-500/30 p-2.5">
            <span className="block text-[11px] text-indigo-700 dark:text-indigo-400 font-medium">Started / Busy</span>
            <span className="text-lg font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">{startedCount}</span>
          </div>
          <div className="rounded-lg border bg-amber-500/10 border-amber-500/30 p-2.5">
            <span className="block text-[11px] text-amber-700 dark:text-amber-400 font-medium">Pending</span>
            <span className="text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums">{pendingCount}</span>
          </div>
        </div>

        {/* Active Assigned Services List */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Scissors className="h-3.5 w-3.5 text-primary" />
            Currently Assigned Services ({assignments.length})
          </h4>

          {assignments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No active service assignments right now.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden max-h-60 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="py-2 text-[11px]">Service</TableHead>
                    <TableHead className="py-2 text-[11px]">Customer</TableHead>
                    <TableHead className="py-2 text-[11px]">Branch</TableHead>
                    <TableHead className="py-2 text-[11px] text-center w-24">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a.item_id}>
                      <TableCell className="py-2.5 text-xs font-medium text-foreground">
                        {a.service_name}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground">
                        {a.customer_name || '—'}
                      </TableCell>
                      <TableCell className="py-2.5 text-[11px] text-muted-foreground">
                        {a.branch_name || '—'}
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            a.status === 'in_progress'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-400'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                          }`}
                        >
                          {a.status === 'in_progress' ? 'Started' : 'Pending'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Action Buttons to Navigate */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 flex-1 sm:flex-initial"
              onClick={() => {
                onClose()
                navigate(`/staff-performance?employee=${employee.employee_id}`)
              }}
            >
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              View Performance
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 flex-1 sm:flex-initial"
              onClick={() => {
                onClose()
                navigate(`/staff/${employee.employee_id}/edit`)
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Profile
            </Button>
          </div>

          <Button type="button" variant="secondary" size="sm" onClick={onClose} className="w-full sm:w-auto text-xs">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EmployeeStatusPage() {
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const isOwner = user?.role === 'owner' || user?.role === 'developer'

  const [selectedBranch, setSelectedBranch] = useState(isOwner ? 'all' : (user?.branchId || ''))
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'in_progress' | 'pending'
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [completingItemId, setCompletingItemId] = useState(null)
  const [selectedEmployeeProfile, setSelectedEmployeeProfile] = useState(null)

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: isOwner,
  })
  const branches = branchesData?.data || []

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [selectedBranch, statusFilter, search])

  const effectiveBranchId = isOwner ? (selectedBranch || 'all') : (user?.branchId || '')

  const { data: statusData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['employee-status', effectiveBranchId],
    queryFn: () =>
      billService.getEmployeeStatus({
        branch_id: effectiveBranchId,
      }),
    enabled: !!effectiveBranchId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 5000,
  })

  const employees = statusData?.data || []

  // Flatten active assignments with employee details
  const allAssignments = useMemo(() => {
    const list = []
    const q = search.trim().toLowerCase()

    for (const emp of employees) {
      for (const a of emp.assignments || []) {
        // Skip completed services and completed bills - active queue only
        if (a.status === 'completed' || a.bill_status === 'completed') continue

        if (q) {
          const match =
            emp.employee_name?.toLowerCase().includes(q) ||
            a.customer_name?.toLowerCase().includes(q) ||
            a.service_name?.toLowerCase().includes(q) ||
            a.bill_number?.toLowerCase().includes(q) ||
            a.branch_name?.toLowerCase().includes(q)
          if (!match) continue
        }
        list.push({
          ...a,
          employee_id: emp.employee_id,
          employee_name: emp.employee_name,
          employee_raw: emp,
        })
      }
    }
    return list
  }, [employees, search])

  // Status counts (active services only)
  const counts = useMemo(() => {
    let inProgress = 0
    let pending = 0
    for (const a of allAssignments) {
      if (a.status === 'in_progress') inProgress++
      else if (a.status === 'pending') pending++
    }
    return {
      all: allAssignments.length,
      in_progress: inProgress,
      pending,
    }
  }, [allAssignments])

  // Filtered by status
  const filteredAssignments = useMemo(() => {
    if (statusFilter === 'all') return allAssignments
    return allAssignments.filter((a) => a.status === statusFilter)
  }, [allAssignments, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredAssignments.length / pageSize))
  const paginatedAssignments = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredAssignments.slice(start, start + pageSize)
  }, [filteredAssignments, page, pageSize])

  const completeItemMutation = useMutation({
    mutationFn: ({ billId, itemId, employeeIds }) =>
      billService.completeBillItem(billId, itemId, { employee_ids: employeeIds }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['employee-status'] })
      queryClient.invalidateQueries({ queryKey: ['rotation-queue'] })
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      setCompletingItemId(null)
      toast.success('Service completed & cleared from active board')
    },
    onError: (err) => {
      setCompletingItemId(null)
      toast.error(err.response?.data?.error?.message || 'Failed to complete service')
    },
  })

  const handleComplete = (assignment, employeeId) => {
    if (completingItemId) return
    setCompletingItemId(assignment.item_id)
    completeItemMutation.mutate({
      billId: assignment.bill_id,
      itemId: assignment.item_id,
      employeeIds: [employeeId],
    })
  }

  const branchOptions = useMemo(() => {
    if (!branches.length) return []
    return [
      { value: 'all', label: 'All Branches' },
      ...branches.map((b) => ({ value: b.branch_id, label: b.name })),
    ]
  }, [branches])

  const currentBranchName = useMemo(() => {
    if (selectedBranch === 'all') return 'All Branches'
    return branches.find((b) => b.branch_id === selectedBranch)?.name || 'Selected Branch'
  }, [selectedBranch, branches])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Employee Status</h1>
            <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5">
              {allAssignments.length} active
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Active service board — services appear here while being performed and automatically clear once completed.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {isOwner && branches.length > 0 && (
            <SearchableSelect
              options={branchOptions}
              value={selectedBranch}
              onChange={setSelectedBranch}
              placeholder="Select branch"
              triggerClassName="w-52"
            />
          )}
        </div>
      </div>

      {/* KPI Cards / Status Quick Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          onClick={() => setStatusFilter('all')}
          className={`cursor-pointer rounded-xl border p-4 transition-all ${
            statusFilter === 'all'
              ? 'bg-primary/10 border-primary/40 shadow-xs ring-1 ring-primary/20'
              : 'bg-card hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Active Services</span>
            <Layers className="h-4 w-4" />
          </div>
          <div className="text-3xl font-extrabold text-foreground mt-1.5 tabular-nums">{counts.all}</div>
          <span className="text-xs text-muted-foreground mt-0.5 block">Currently assigned to stylists</span>
        </div>

        <div
          onClick={() => setStatusFilter('in_progress')}
          className={`cursor-pointer rounded-xl border p-4 transition-all ${
            statusFilter === 'in_progress'
              ? 'bg-indigo-500/15 border-indigo-500/40 shadow-xs ring-1 ring-indigo-500/20'
              : 'bg-card hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
              Started / Busy
            </span>
            <PlayCircle className="h-4 w-4" />
          </div>
          <div className="text-3xl font-extrabold text-foreground mt-1.5 tabular-nums">{counts.in_progress}</div>
          <span className="text-xs text-muted-foreground mt-0.5 block">In chair with customer right now</span>
        </div>

        <div
          onClick={() => setStatusFilter('pending')}
          className={`cursor-pointer rounded-xl border p-4 transition-all ${
            statusFilter === 'pending'
              ? 'bg-amber-500/15 border-amber-500/40 shadow-xs ring-1 ring-amber-500/20'
              : 'bg-card hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-xs font-medium">
            <span>Pending Services</span>
            <Clock className="h-4 w-4" />
          </div>
          <div className="text-3xl font-extrabold text-foreground mt-1.5 tabular-nums">{counts.pending}</div>
          <span className="text-xs text-muted-foreground mt-0.5 block">Waiting to be started</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by employee, customer, service, bill # or branch..."
                className="pl-9"
              />
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <Button
                type="button"
                size="sm"
                variant={statusFilter === 'all' ? 'secondary' : 'ghost'}
                className="h-8 text-xs font-medium px-2.5"
                onClick={() => setStatusFilter('all')}
              >
                All Active ({counts.all})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={statusFilter === 'in_progress' ? 'secondary' : 'ghost'}
                className="h-8 text-xs font-medium px-2.5 gap-1.5"
                onClick={() => setStatusFilter('in_progress')}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                Started ({counts.in_progress})
              </Button>
              {counts.pending > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant={statusFilter === 'pending' ? 'secondary' : 'ghost'}
                  className="h-8 text-xs font-medium px-2.5 gap-1.5"
                  onClick={() => setStatusFilter('pending')}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Pending ({counts.pending})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredAssignments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500/60" />
            <div>
              <p className="font-semibold text-foreground text-base">
                All assigned services completed!
              </p>
              <p className="text-sm mt-0.5">
                {statusFilter !== 'all'
                  ? `There are no ${statusFilter.replace('_', ' ')} services in ${currentBranchName}.`
                  : `No staff currently engaged in services in ${currentBranchName}. When new services are assigned, they will appear here.`}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              {statusFilter !== 'all' && (
                <Button variant="outline" size="sm" onClick={() => setStatusFilter('all')}>
                  Show All Active
                </Button>
              )}
              {isOwner && selectedBranch !== 'all' && (
                <Button variant="outline" size="sm" onClick={() => setSelectedBranch('all')}>
                  View All Branches
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="py-3 font-semibold text-xs text-muted-foreground">Employee (Click for details)</TableHead>
                    <TableHead className="py-3 font-semibold text-xs text-muted-foreground">Branch</TableHead>
                    <TableHead className="py-3 font-semibold text-xs text-muted-foreground">Customer</TableHead>
                    <TableHead className="py-3 font-semibold text-xs text-muted-foreground">Service</TableHead>
                    <TableHead className="py-3 font-semibold text-xs text-muted-foreground">Bill #</TableHead>
                    <TableHead className="py-3 font-semibold text-xs text-muted-foreground text-center w-36">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAssignments.map((a) => (
                    <TableRow
                      key={`${a.employee_id}-${a.item_id}`}
                      className="hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => setSelectedEmployeeProfile(a.employee_raw || { employee_id: a.employee_id, employee_name: a.employee_name, assignments: [a] })}
                    >
                      <TableCell className="py-3 font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 group-hover:scale-105 transition-transform">
                            {a.employee_name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <span className="text-foreground font-semibold group-hover:text-primary transition-colors flex items-center gap-1">
                              {a.employee_name}
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-3 text-xs">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 text-foreground font-medium">
                          {a.branch_color ? (
                            <BranchColorDot color={a.branch_color} />
                          ) : (
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span>{a.branch_name || '—'}</span>
                        </div>
                      </TableCell>

                      <TableCell className="py-3 text-sm text-foreground">{a.customer_name || '—'}</TableCell>

                      <TableCell className="py-3 text-sm font-medium text-foreground">{a.service_name}</TableCell>

                      <TableCell className="py-3 text-xs text-muted-foreground font-mono">
                        {a.bill_number}
                        {a.bill_status && a.bill_status !== 'completed' && (
                          <span
                            className="ml-2 rounded-full bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                            title="The bill is not paid yet; the service can still be completed"
                          >
                            Unpaid
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <StatusBadge
                          status={a.status}
                          loading={completingItemId === a.item_id}
                          onClick={() => handleComplete(a, a.employee_id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t">
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                <span>
                  Showing <strong className="text-foreground">{Math.min((page - 1) * pageSize + 1, filteredAssignments.length)}</strong>–<strong className="text-foreground">{Math.min(page * pageSize, filteredAssignments.length)}</strong> of <strong className="text-foreground">{filteredAssignments.length}</strong> active assignments
                </span>
                {filteredAssignments.length > 10 && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1.5">
                      <span>Per page:</span>
                      <select
                        className="h-7 px-1.5 border border-input rounded bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value))
                          setPage(1)
                        }}
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground px-1">
                    Page <strong className="text-foreground">{page}</strong> of <strong className="text-foreground">{totalPages}</strong>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee Quick View & Profile Details Dialog */}
      {selectedEmployeeProfile && (
        <EmployeeProfileModal
          employee={selectedEmployeeProfile}
          open={!!selectedEmployeeProfile}
          onClose={() => setSelectedEmployeeProfile(null)}
        />
      )}
    </div>
  )
}

export default EmployeeStatusPage
