import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { billService } from '@/services/bill.service'
import { branchService } from '@/services/branch.service'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, UserCheck, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_CONFIG = {
  pending:     { label: 'Started',   className: 'bg-indigo-600 text-white border-indigo-600' },
  in_progress: { label: 'Started',   className: 'bg-indigo-600 text-white border-indigo-600' },
  completed:   { label: 'Completed', className: 'bg-green-600 text-white border-green-600' },
}

function StatusBadge({ status, onClick, loading }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const canComplete = status === 'pending' || status === 'in_progress'

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
        ${cfg.className}
        ${canComplete ? 'cursor-pointer hover:opacity-80 active:scale-95' : 'cursor-default opacity-70'}
      `}
      onClick={canComplete && !loading ? onClick : undefined}
      title={canComplete ? 'Click to mark as completed' : ''}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : cfg.label}
    </span>
  )
}

function EmployeeStatusPage() {
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const isOwner = user?.role === 'owner' || user?.role === 'developer'
  const [selectedBranch, setSelectedBranch] = useState(user?.branchId || '')
  const [search, setSearch] = useState('')
  const [completingItemId, setCompletingItemId] = useState(null)

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: isOwner,
  })
  const branches = branchesData?.data || []

  // Only query when a branch is explicitly selected or user has a fixed branch
  const effectiveBranchId = selectedBranch || user?.branchId || ''
  const { data: statusData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['employee-status', effectiveBranchId],
    queryFn: () => billService.getEmployeeStatus({ branch_id: effectiveBranchId }),
    enabled: !!effectiveBranchId,
    refetchInterval: 30000,
  })

  const employees = statusData?.data || []

  const filteredEmployees = employees
    .map((emp) => ({
      ...emp,
      assignments: emp.assignments.filter((a) => {
        if (a.status === 'completed') return false
        if (!search) return true
        const q = search.toLowerCase()
        return (
          emp.employee_name?.toLowerCase().includes(q) ||
          a.customer_name?.toLowerCase().includes(q) ||
          a.service_name?.toLowerCase().includes(q) ||
          a.bill_number?.toLowerCase().includes(q)
        )
      }),
    }))
    .filter((emp) => emp.assignments.length > 0)

  const completeItemMutation = useMutation({
    mutationFn: ({ billId, itemId, employeeIds }) =>
      billService.completeBillItem(billId, itemId, { employee_ids: employeeIds }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['employee-status', effectiveBranchId] })
      queryClient.invalidateQueries({ queryKey: ['rotation-queue'] })
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      setCompletingItemId(null)
      if (data?.data?.bill_completed) {
        toast.success(`Bill ${data.data.bill_number || ''} completed`)
      } else {
        toast.success('Service marked as completed')
      }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <UserCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employee Status</h1>
            <p className="text-sm text-gray-500">Today's service assignments — click Started to mark complete</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {isOwner && branches.length > 0 && (
            <SearchableSelect
              options={branches.map((b) => ({ value: b.branch_id, label: b.name }))}
              value={selectedBranch}
              onChange={setSelectedBranch}
              placeholder="Select branch"
              triggerClassName="w-52"
            />
          )}
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by employee, customer, service or bill..."
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredEmployees.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No services in progress or completed today</p>
            <p className="text-sm mt-1">Services assigned to employees will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Bill #</TableHead>
                  <TableHead className="text-center w-32">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.flatMap((emp) =>
                  emp.assignments.map((a, idx) => (
                    <TableRow key={`${emp.employee_id}-${a.item_id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                            {emp.employee_name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span>{emp.employee_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{a.customer_name}</TableCell>
                      <TableCell>{a.service_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {a.bill_number}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge
                          status={a.status}
                          loading={completingItemId === a.item_id}
                          onClick={() => handleComplete(a, emp.employee_id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default EmployeeStatusPage
