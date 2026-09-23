import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { billService } from '@/services/bill.service'
import { branchService } from '@/services/branch.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { formatDateTimeStored, formatCurrency } from '@/lib/utils'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/export-utils'
import { printThermalReceipt } from '@/components/ThermalReceipt'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Search,
  Receipt,
  Loader2,
  Download,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  Trash2,
  MoreHorizontal,
  Printer,
  Check,
  Armchair,
  XCircle,
  Filter,
  X,
  Play,
} from 'lucide-react'
import { toast } from 'sonner'
import CompleteBillModal from '@/components/modals/CompleteBillModal'
import StartServiceModal from '@/components/modals/StartServiceModal'
import ConfirmDialog from '@/components/modals/ConfirmDialog'

const statusColors = {
  completed: 'success',
  pending: 'warning',
  partial: 'warning',
  draft: 'secondary',
  cancelled: 'destructive',
}

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PAYMENT_MODES = [
  { value: '', label: 'All Modes' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'online', label: 'Online' },
  { value: 'other', label: 'Other' },
]

const DATE_PRESETS = [
  { label: 'Today', getValue: () => {
    const today = new Date().toISOString().split('T')[0]
    return { start_date: today, end_date: today }
  }},
  { label: 'This Week', getValue: () => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    return { start_date: start.toISOString().split('T')[0], end_date: now.toISOString().split('T')[0] }
  }},
  { label: 'This Month', getValue: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start_date: start.toISOString().split('T')[0], end_date: now.toISOString().split('T')[0] }
  }},
  { label: 'Last Month', getValue: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { start_date: start.toISOString().split('T')[0], end_date: end.toISOString().split('T')[0] }
  }},
]

function BillsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const isOwner = user?.role === 'owner' || user?.role === 'developer'

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [paymentMode, setPaymentMode] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [sortBy, setSortBy] = useState('bill_date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [showFilters, setShowFilters] = useState(false)
  const [completeBillModalOpen, setCompleteBillModalOpen] = useState(false)
  const [selectedBillForComplete, setSelectedBillForComplete] = useState(null)
  const [viewMode, setViewMode] = useState('bills') // 'bills' | 'pending-services'
  const [pendingServicePage, setPendingServicePage] = useState(1)
  const [startServiceModalOpen, setStartServiceModalOpen] = useState(false)
  const [selectedStartItem, setSelectedStartItem] = useState(null)
  const [deleteConfirmBill, setDeleteConfirmBill] = useState(null)
  const [completeConfirmItem, setCompleteConfirmItem] = useState(null)

  // Fetch branches for owner filter
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: isOwner,
  })
  const branches = branchesData?.data || []

  const deleteBillMutation = useMutation({
    mutationFn: (id) => billService.cancelBill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['chairs'] })
      toast.success('Bill cancelled')
    },
  })

  const completeItemMutation = useMutation({
    mutationFn: ({ billId, itemId, employeeIds }) =>
      billService.completeBillItem(billId, itemId, { employee_ids: employeeIds }),
    onSuccess: () => {
      toast.success('Service completed successfully!')
      queryClient.invalidateQueries({ queryKey: ['pending-services'] })
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['rotation-queue'] })
      queryClient.invalidateQueries({ queryKey: ['staff-performance'] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to complete service')
    },
  })

  const queryParams = {
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    payment_mode: paymentMode || undefined,
    branch_id: branchFilter || undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['bills', queryParams],
    queryFn: () => billService.getBills(queryParams),
  })

  const bills = data?.data || []
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 }

  // Pending services query
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-services', { page: pendingServicePage, search, branch_id: branchFilter }],
    queryFn: () => billService.getPendingServices({
      page: pendingServicePage,
      limit: 20,
      search: search || undefined,
      branch_id: branchFilter || undefined,
    }),
    enabled: viewMode === 'pending-services',
  })
  const pendingItems = pendingData?.data || []
  const pendingPagination = pendingData?.pagination || { page: 1, total_pages: 1, total: 0 }

  const hasActiveFilters = startDate || endDate || paymentMode || branchFilter

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setPaymentMode('')
    setBranchFilter('')
    setSortBy('bill_date')
    setSortOrder('desc')
    setPage(1)
  }

  const applyDatePreset = (preset) => {
    const { start_date, end_date } = preset.getValue()
    setStartDate(start_date)
    setEndDate(end_date)
    setPage(1)
  }

  const handleOpenComplete = async (bill) => {
    try {
      const fullBill = await billService.getBillById(bill.bill_id)
      setSelectedBillForComplete(fullBill.data)
      setCompleteBillModalOpen(true)
    } catch {
      toast.error('Failed to load bill details')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <p className="text-gray-500">View and manage all bills</p>
        </div>
        <div className="flex gap-2">
          {bills.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  const exportData = bills.map(b => ({
                    bill_number: b.bill_number,
                    customer_name: b.customer?.customer_name,
                    branch: b.branch?.branch_name,
                    chair: b.chair?.chair_number || '',
                    date: b.bill_date?.split('T')[0],
                    subtotal: b.subtotal,
                    discount: b.discount_amount,
                    total_amount: b.total_amount,
                    status: b.status,
                  }))
                  exportToCSV(exportData, 'bills')
                }}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const exportData = bills.map(b => ({
                    bill_number: b.bill_number,
                    customer_name: b.customer?.customer_name,
                    branch: b.branch?.branch_name,
                    chair: b.chair?.chair_number || '',
                    date: b.bill_date?.split('T')[0],
                    subtotal: b.subtotal,
                    discount: b.discount_amount,
                    total_amount: b.total_amount,
                    status: b.status,
                  }))
                  exportToExcel(exportData, 'bills', { title: 'Bills Report' })
                }}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const exportData = bills.map(b => ({
                    bill_number: b.bill_number,
                    customer_name: b.customer?.customer_name,
                    branch: b.branch?.branch_name,
                    chair: b.chair?.chair_number || '',
                    date: b.bill_date?.split('T')[0],
                    subtotal: b.subtotal,
                    discount: b.discount_amount,
                    total_amount: b.total_amount,
                    status: b.status,
                  }))
                  const totalAmount = bills.reduce((sum, b) => sum + (b.total_amount || 0), 0)
                  exportToPDF(exportData, 'bills', {
                    title: 'Bills Report',
                    summaryCards: [
                      { label: 'Total Bills', value: String(bills.length) },
                      { label: 'Total Amount', value: formatCurrency(totalAmount) },
                    ]
                  })
                }}>
                  <FileText className="h-4 w-4 mr-2" />
                  Print / PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="outline" onClick={() => navigate('/bills/new?type=previous')}>
            <Plus className="h-4 w-4 mr-2" />
            Previous Bill
          </Button>
          <Button onClick={() => navigate('/bills/new?type=current')}>
            <Plus className="h-4 w-4 mr-2" />
            Current Bill
          </Button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={viewMode === 'bills' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('bills')}
        >
          <Receipt className="h-4 w-4 mr-2" />
          Bills
        </Button>
        <Button
          variant={viewMode === 'pending-services' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('pending-services')}
        >
          <FileText className="h-4 w-4 mr-2" />
          Pending Services
        </Button>
      </div>

      {viewMode === 'pending-services' ? (
        /* Pending Services View */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pending Services</CardTitle>
            <p className="text-sm text-muted-foreground">Services from completed bills that haven't been performed yet</p>
          </CardHeader>
          <CardContent>
            {pendingLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pendingItems.length === 0 ? (
              <p className="text-center text-gray-500 py-10">No pending services found</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Bill Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      {isOwner && <TableHead>Branch</TableHead>}
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingItems.map((item) => (
                      <TableRow key={item.item_id}>
                        <TableCell
                          className="font-medium cursor-pointer text-primary hover:underline"
                          onClick={() => navigate(`/bills/${item.bill_id}`)}
                        >
                          {item.bill_number}
                        </TableCell>
                        <TableCell>{item.customer_name || '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.item_name}
                            {item.status === 'in_progress' ? (
                              <Badge variant="default" className="text-[10px]">In Progress</Badge>
                            ) : (
                              <Badge variant="warning" className="text-[10px]">Pending</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {item.bill_date ? new Date(item.bill_date).toLocaleDateString('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total_price)}</TableCell>
                        {isOwner && <TableCell>{item.branch_name}</TableCell>}
                        <TableCell className="text-right">
                          {item.status === 'pending' ? (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedStartItem(item)
                                setStartServiceModalOpen(true)
                              }}
                            >
                              <Play className="h-3.5 w-3.5 mr-1" />
                              Start Service
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => setCompleteConfirmItem(item)}
                            >
                              <Check className="h-3.5 w-3.5 mr-1" />
                              Complete
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {pendingPagination.total > 20 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-500">
                      Page {pendingPagination.page} of {pendingPagination.total_pages} ({pendingPagination.total} total)
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPendingServicePage((p) => Math.max(1, p - 1))} disabled={pendingServicePage <= 1}>Previous</Button>
                      <Button variant="outline" size="sm" onClick={() => setPendingServicePage((p) => p + 1)} disabled={pendingServicePage >= pendingPagination.total_pages}>Next</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
      <>
      {/* Search, Status Tabs & Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by bill number, book no. or customer..."
                className="pl-10"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <Button
              variant={showFilters ? 'default' : 'outline'}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 h-2 w-2 bg-white rounded-full inline-block" />
              )}
            </Button>
          </div>

          {/* Status Tabs */}
          <div className="flex gap-1">
            {STATUS_TABS.map((tab) => (
              <Button
                key={tab.value}
                variant={statusFilter === tab.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter(tab.value)
                  setPage(1)
                }}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="border-t pt-3 space-y-3">
              {/* Date Presets */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-gray-500 mr-1">Quick:</span>
                {DATE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => applyDatePreset(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              {/* Date Range + Filters Row */}
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">From Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                    className="w-[160px] h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">To Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                    className="w-[160px] h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Payment Mode</Label>
                  <select
                    className="h-9 px-3 border rounded-md text-sm min-w-[130px]"
                    value={paymentMode}
                    onChange={(e) => { setPaymentMode(e.target.value); setPage(1) }}
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                {isOwner && (
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Branch</Label>
                    <select
                      className="h-9 px-3 border rounded-md text-sm min-w-[150px]"
                      value={branchFilter}
                      onChange={(e) => { setBranchFilter(e.target.value); setPage(1) }}
                    >
                      <option value="">All Branches</option>
                      {branches.map((b) => (
                        <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Sort By</Label>
                  <select
                    className="h-9 px-3 border rounded-md text-sm min-w-[130px]"
                    value={`${sortBy}_${sortOrder}`}
                    onChange={(e) => {
                      const [by, order] = e.target.value.split('_')
                      setSortBy(by)
                      setSortOrder(order)
                      setPage(1)
                    }}
                  >
                    <option value="bill_date_desc">Date (Newest)</option>
                    <option value="bill_date_asc">Date (Oldest)</option>
                    <option value="totalAmount_desc">Amount (High)</option>
                    <option value="totalAmount_asc">Amount (Low)</option>
                  </select>
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bills Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Bills
            <Badge variant="secondary" className="ml-2">
              {pagination.total} total
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-10 text-red-500">
              Error loading bills. Please try again.
            </div>
          ) : bills.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              No bills found. Create your first bill!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Chair</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill) => (
                  <TableRow key={bill.bill_id}>
                    <TableCell className="font-mono text-sm">
                      <span
                        className="cursor-pointer hover:text-primary hover:underline"
                        onClick={() => navigate(`/bills/${bill.bill_id}`)}
                      >
                        {bill.bill_number}
                      </span>
                      {bill.book_number && (
                        <span className="text-muted-foreground font-normal ml-1">(No. {bill.book_number})</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <button
                        className="hover:text-primary hover:underline text-left"
                        onClick={() => navigate(`/customers/${bill.customer?.customer_id}`)}
                      >
                        {bill.customer?.customer_name}
                      </button>
                    </TableCell>
                    <TableCell>{bill.branch?.branch_name}</TableCell>
                    <TableCell>
                      {bill.chair ? (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Armchair className="h-3.5 w-3.5 text-gray-400" />
                          {bill.chair.chair_number}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDateTimeStored(bill.bill_date)}</TableCell>
                    <TableCell className="font-bold">
                      {formatCurrency(bill.total_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[bill.status] || 'secondary'}>
                        {bill.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/bills/${bill.bill_id}`)}>
                            <Receipt className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          {(bill.status === 'pending' || bill.status === 'partial') && (
                            <DropdownMenuItem onClick={() => handleOpenComplete(bill)}>
                              <Check className="h-4 w-4 mr-2" />
                              Complete
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={async () => {
                            try {
                              const fullBill = await billService.getBillById(bill.bill_id)
                              printThermalReceipt(fullBill.data)
                            } catch {
                              navigate(`/bills/${bill.bill_id}`)
                            }
                          }}>
                            <Printer className="h-4 w-4 mr-2" />
                            Print Receipt
                          </DropdownMenuItem>
                          {bill.status !== 'cancelled' && (
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => setDeleteConfirmBill(bill)}
                              disabled={deleteBillMutation.isPending}
                            >
                              {bill.status === 'pending' ? (
                                <>
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Cancel
                                </>
                              ) : (
                                <>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Complete Bill Modal */}
      <CompleteBillModal
        open={completeBillModalOpen}
        onOpenChange={setCompleteBillModalOpen}
        bill={selectedBillForComplete}
      />
      </>
      )}

      {/* Start Service Modal */}
      <StartServiceModal
        open={startServiceModalOpen}
        onOpenChange={setStartServiceModalOpen}
        item={selectedStartItem}
      />

      {/* Cancel / Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteConfirmBill}
        onOpenChange={(open) => { if (!open) setDeleteConfirmBill(null) }}
        title={deleteConfirmBill?.status === 'pending' ? 'Cancel Bill' : 'Delete Bill'}
        description={`${deleteConfirmBill?.status === 'pending' ? 'Cancel' : 'Delete'} bill ${deleteConfirmBill?.bill_number}? This action cannot be undone.`}
        confirmLabel={deleteConfirmBill?.status === 'pending' ? 'Cancel Bill' : 'Delete'}
        variant="destructive"
        loading={deleteBillMutation.isPending}
        onConfirm={() => { deleteBillMutation.mutate(deleteConfirmBill?.bill_id); setDeleteConfirmBill(null) }}
      />

      {/* Complete Service Confirmation Dialog */}
      <ConfirmDialog
        open={!!completeConfirmItem}
        onOpenChange={(open) => { if (!open) setCompleteConfirmItem(null) }}
        title="Complete Service"
        description={`Mark "${completeConfirmItem?.item_name}" as completed?`}
        confirmLabel="Complete"
        loading={completeItemMutation.isPending}
        onConfirm={() => {
          completeItemMutation.mutate({
            billId: completeConfirmItem.bill_id,
            itemId: completeConfirmItem.item_id,
            employeeIds: [],
          })
          setCompleteConfirmItem(null)
        }}
      />
    </div>
  )
}

export default BillsPage
