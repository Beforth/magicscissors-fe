import { useState, useMemo, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryService } from '@/services/inventory.service'
import { productService } from '@/services/product.service'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowRightLeft,
  Loader2,
  Plus,
  Check,
  X,
  Eye,
  Package,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

const statusConfig = {
  pending: { label: 'Pending', variant: 'warning', icon: Clock },
  completed: { label: 'Completed', variant: 'success', icon: CheckCircle },
  cancelled: { label: 'Cancelled', variant: 'destructive', icon: XCircle },
}

const BRANCH_STAFF = new Set(['cashier', 'manager'])

function StockTransfersPage() {
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const isBranchStaff = BRANCH_STAFF.has(user?.role)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState(null)
  const [transferData, setTransferData] = useState({
    from_location_id: '',
    to_location_id: '',
    items: [{ product_id: '', quantity: '' }],
    notes: '',
  })

  // Fetch transfers
  const { data: transfersData, isLoading } = useQuery({
    queryKey: ['stock-transfers', { page, status: statusFilter }],
    queryFn: () => inventoryService.getTransfers({
      page,
      limit: 20,
      status: statusFilter || undefined
    }),
  })

  // Fetch locations
  const { data: locationsData } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => inventoryService.getLocations(),
  })

  // Fetch products
  const { data: productsData } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => productService.getProducts({ limit: 1000 }),
  })

  const transfers = transfersData?.data || []
  const pagination = transfersData?.pagination || { page: 1, totalPages: 1, total: 0 }
  const locations = locationsData?.data || []
  const products = productsData?.data || []

  const userBranchIds = useMemo(() => {
    const ids = new Set()
    if (user?.branchId) ids.add(user.branchId)
    if (user?.branch_id) ids.add(user.branch_id)
    if (user?.branch?.branch_id) ids.add(user.branch.branch_id)
    if (user?.branch?.id) ids.add(user.branch.id)
    return ids
  }, [user])

  const myBranchLocations = useMemo(() => {
    if (userBranchIds.size === 0) return locations
    return locations.filter((loc) => loc.branch?.branch_id && userBranchIds.has(loc.branch.branch_id))
  }, [locations, userBranchIds])

  const defaultFromLocationId = myBranchLocations[0]?.location_id || ''

  const destinationLocations = useMemo(() => {
    const fromId = transferData.from_location_id
    const fromLoc = locations.find((l) => l.location_id === fromId)
    const fromBranchId = fromLoc?.branch?.branch_id
    return locations.filter((loc) => {
      if (loc.location_id === fromId) return false
      if (fromBranchId && loc.branch?.branch_id === fromBranchId) return false
      return true
    })
  }, [locations, transferData.from_location_id])

  const pendingIncoming = useMemo(
    () => transfers.filter((t) => t.status === 'pending' && t.can_approve).length,
    [transfers]
  )

  useEffect(() => {
    if (showCreateModal && isBranchStaff && defaultFromLocationId && !transferData.from_location_id) {
      setTransferData((prev) => ({ ...prev, from_location_id: defaultFromLocationId }))
    }
  }, [showCreateModal, isBranchStaff, defaultFromLocationId, transferData.from_location_id])

  const getAvailableAtLocation = (productId, locationId) => {
    if (!productId || !locationId) return null
    const product = products.find((p) => p.product_id === productId)
    const row = product?.stock_by_location?.find((l) => l.location_id === locationId)
    return row?.available_quantity ?? 0
  }

  const transferLineAvailable = useMemo(() => {
    return transferData.items.map((item) =>
      getAvailableAtLocation(item.product_id, transferData.from_location_id)
    )
  }, [transferData.items, transferData.from_location_id, products])

  // Create transfer mutation
  const createMutation = useMutation({
    mutationFn: inventoryService.createTransfer,
    onSuccess: () => {
      toast.success('Transfer request sent — receiving branch will be notified')
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setShowCreateModal(false)
      resetTransferForm()
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create transfer')
    },
  })

  const approveMutation = useMutation({
    mutationFn: inventoryService.approveTransfer,
    onSuccess: () => {
      toast.success('Transfer accepted — stock moved')
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setShowDetailModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to accept transfer')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => inventoryService.rejectTransfer(id, { reason }),
    onSuccess: () => {
      toast.success('Transfer declined')
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setShowDetailModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to decline transfer')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => inventoryService.cancelTransfer(id, { reason }),
    onSuccess: () => {
      toast.success('Transfer request cancelled')
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setShowDetailModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to cancel transfer')
    },
  })

  const resetTransferForm = () => {
    setTransferData({
      from_location_id: isBranchStaff ? defaultFromLocationId : '',
      to_location_id: '',
      items: [{ product_id: '', quantity: '' }],
      notes: '',
    })
  }

  const handleCreateTransfer = (e) => {
    e.preventDefault()

    if (transferData.from_location_id === transferData.to_location_id) {
      toast.error('Source and destination must be different')
      return
    }

    const validItems = transferData.items.filter((i) => i.product_id && parseInt(i.quantity) > 0)
    if (validItems.length === 0) {
      toast.error('Add at least one product with quantity')
      return
    }

    for (const item of validItems) {
      const available = getAvailableAtLocation(item.product_id, transferData.from_location_id)
      const qty = parseInt(item.quantity, 10)
      if (available != null && qty > available) {
        const product = products.find((p) => p.product_id === item.product_id)
        toast.error(`Insufficient stock for ${product?.product_name || 'product'} (available: ${available})`)
        return
      }
    }

    createMutation.mutate({
      ...transferData,
      items: validItems.map((i) => ({
        product_id: i.product_id,
        quantity: parseInt(i.quantity)
      })),
    })
  }

  const handleApproveTransfer = () => {
    if (selectedTransfer?.can_approve) {
      approveMutation.mutate(selectedTransfer.transfer_id)
    }
  }

  const handleRejectTransfer = () => {
    if (!selectedTransfer?.can_reject) return
    const reason = window.prompt('Reason for declining (optional)') || undefined
    rejectMutation.mutate({ id: selectedTransfer.transfer_id, reason })
  }

  const handleCancelTransfer = () => {
    if (!selectedTransfer?.can_cancel) return
    const reason = window.prompt('Reason for cancelling (optional)') || undefined
    cancelMutation.mutate({ id: selectedTransfer.transfer_id, reason })
  }

  const addTransferItem = () => {
    setTransferData({
      ...transferData,
      items: [...transferData.items, { product_id: '', quantity: '' }],
    })
  }

  const removeTransferItem = (index) => {
    if (transferData.items.length > 1) {
      setTransferData({
        ...transferData,
        items: transferData.items.filter((_, i) => i !== index),
      })
    }
  }

  const updateTransferItem = (index, field, value) => {
    const newItems = [...transferData.items]
    newItems[index][field] = value
    setTransferData({ ...transferData, items: newItems })
  }

  const viewTransferDetails = (transfer) => {
    setSelectedTransfer(transfer)
    setShowDetailModal(true)
  }

  const getLocationName = (locationId) => {
    const loc = locations.find(l => l.location_id === locationId)
    return loc?.location_name || 'Unknown'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Transfers</h1>
          <p className="text-gray-500">
            Request stock from your branch — receiving branch cashiers/managers accept via notification
          </p>
        </div>
        <Button onClick={() => { resetTransferForm(); setShowCreateModal(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Request Transfer
        </Button>
      </div>

      {pendingIncoming > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{pendingIncoming}</strong> transfer{pendingIncoming > 1 ? 's' : ''} waiting for your branch to accept.
          Check notifications or review pending rows below.
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-2xl font-bold">
                  {transfers.filter(t => t.status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold">
                  {transfers.filter(t => t.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ArrowRightLeft className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Transfers</p>
                <p className="text-2xl font-bold">{pagination.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="w-48">
              <Label className="mb-2 block">Filter by Status</Label>
              <select
                className="w-full h-10 px-3 border rounded-md"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transfers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer History
            <Badge variant="secondary" className="ml-2">
              {pagination.total} transfers
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <ArrowRightLeft className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No transfers found.</p>
              <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                Create Your First Transfer
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transfer ID</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead></TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => {
                  const StatusIcon = statusConfig[transfer.status]?.icon || Clock
                  return (
                    <TableRow key={transfer.transfer_id}>
                      <TableCell className="font-mono text-sm">
                        #{transfer.transfer_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {transfer.from_location?.location_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {transfer.from_location?.location_type}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {transfer.to_location?.location_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {transfer.to_location?.location_type}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {transfer.items?.length || 0} products
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {formatDate(transfer.requested_at)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            variant={statusConfig[transfer.status]?.variant || 'secondary'}
                            className="flex items-center gap-1 w-fit"
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig[transfer.status]?.label || transfer.status}
                          </Badge>
                          {transfer.status === 'pending' && transfer.can_approve && (
                            <p className="text-xs text-green-700 font-medium">Accept at your branch</p>
                          )}
                          {transfer.status === 'pending' && !transfer.can_approve && (
                            <p className="text-xs text-gray-500">
                              Awaiting {transfer.to_location?.branch?.name || 'receiving branch'}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewTransferDetails(transfer)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {transfer.can_approve && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700"
                              title="Accept transfer"
                              onClick={() => {
                                setSelectedTransfer(transfer)
                                approveMutation.mutate(transfer.transfer_id)
                              }}
                              disabled={approveMutation.isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
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

      {/* Create Transfer Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Request Stock Transfer
            </DialogTitle>
          </DialogHeader>

          {isBranchStaff && (
            <p className="text-sm text-gray-500 -mt-2">
              Send from your branch ({user?.branch?.name || 'assigned branch'}). The receiving branch
              gets a notification to accept.
            </p>
          )}

          <form onSubmit={handleCreateTransfer} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From (your branch) *</Label>
                <select
                  className="w-full h-10 px-3 border rounded-md"
                  value={transferData.from_location_id}
                  onChange={(e) =>
                    setTransferData({
                      ...transferData,
                      from_location_id: e.target.value,
                      to_location_id: '',
                    })
                  }
                  required
                  disabled={isBranchStaff && myBranchLocations.length <= 1}
                >
                  <option value="">Select Source</option>
                  {(isBranchStaff ? myBranchLocations : locations).map((loc) => (
                    <option key={loc.location_id} value={loc.location_id}>
                      {loc.location_name}
                      {loc.branch?.branch_name ? ` · ${loc.branch.branch_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>To (other branch) *</Label>
                <select
                  className="w-full h-10 px-3 border rounded-md"
                  value={transferData.to_location_id}
                  onChange={(e) => setTransferData({ ...transferData, to_location_id: e.target.value })}
                  required
                >
                  <option value="">Select Destination</option>
                  {destinationLocations.map((loc) => (
                    <option key={loc.location_id} value={loc.location_id}>
                      {loc.location_name}
                      {loc.branch?.branch_name ? ` · ${loc.branch.branch_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Products to Transfer *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addTransferItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Product
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {transferData.items.map((item, index) => {
                  const available = transferLineAvailable[index]
                  const qty = parseInt(item.quantity, 10) || 0
                  const overStock = available != null && qty > available
                  return (
                  <div key={index} className="space-y-1">
                    <div className="flex gap-2">
                    <select
                      className="flex-1 h-10 px-3 border rounded-md"
                      value={item.product_id}
                      onChange={(e) => updateTransferItem(index, 'product_id', e.target.value)}
                    >
                      <option value="">Select Product</option>
                      {products.map((p) => (
                        <option key={p.product_id} value={p.product_id}>
                          {p.product_name}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="1"
                      className={`w-24 ${overStock ? 'border-red-500' : ''}`}
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateTransferItem(index, 'quantity', e.target.value)}
                    />
                    {transferData.items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTransferItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    </div>
                    {item.product_id && transferData.from_location_id && (
                      <p className={`text-xs ${overStock ? 'text-red-600' : 'text-gray-500'}`}>
                        Available at source: {available ?? 0}
                        {overStock ? ` — exceeds available by ${qty - available}` : ''}
                      </p>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={transferData.notes}
                onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                placeholder="Transfer notes (optional)"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false)
                  resetTransferForm()
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transfer Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Transfer Details
            </DialogTitle>
          </DialogHeader>

          {selectedTransfer && (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <Badge variant={statusConfig[selectedTransfer.status]?.variant || 'secondary'}>
                  {statusConfig[selectedTransfer.status]?.label || selectedTransfer.status}
                </Badge>
              </div>

              {/* Transfer Route */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">From</p>
                    <p className="font-semibold">
                      {selectedTransfer.from_location?.location_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedTransfer.from_location?.location_type}
                    </p>
                  </div>
                  <ArrowRight className="h-6 w-6 text-primary" />
                  <div className="text-center">
                    <p className="text-xs text-gray-500">To</p>
                    <p className="font-semibold">
                      {selectedTransfer.to_location?.location_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedTransfer.to_location?.location_type}
                    </p>
                  </div>
                </div>
              </div>

              {/* Transfer accounting note */}
              {selectedTransfer.is_warehouse_to_salon && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
                  <p className="font-medium text-blue-900">Stock-only internal transfer</p>
                  <p className="text-blue-700 mt-1 text-xs">
                    Approval moves inventory between locations and writes transfer audit entries. It does not create cash income or branch expense entries.
                  </p>
                </div>
              )}

              {/* Items */}
              <div>
                <p className="text-sm font-medium mb-2">Products ({selectedTransfer.items?.length || 0})</p>
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {selectedTransfer.items?.map((item, index) => (
                    <div key={index} className="p-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.product_name || 'Unknown'}</p>
                      </div>
                      <Badge variant="outline">Qty: {item.quantity_requested}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {selectedTransfer.notes && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-sm">{selectedTransfer.notes}</p>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Created</p>
                  <p>{formatDate(selectedTransfer.requested_at)}</p>
                </div>
                {selectedTransfer.completed_at && (
                  <div>
                    <p className="text-gray-500">Completed</p>
                    <p>{formatDate(selectedTransfer.completed_at)}</p>
                  </div>
                )}
              </div>

              {selectedTransfer.status === 'pending' &&
                (selectedTransfer.can_approve ||
                  selectedTransfer.can_reject ||
                  selectedTransfer.can_cancel) && (
                <DialogFooter className="flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                    Close
                  </Button>
                  {selectedTransfer.can_cancel && (
                    <Button
                      variant="outline"
                      onClick={handleCancelTransfer}
                      disabled={cancelMutation.isPending}
                    >
                      Cancel request
                    </Button>
                  )}
                  {selectedTransfer.can_reject && (
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-200"
                      onClick={handleRejectTransfer}
                      disabled={rejectMutation.isPending}
                    >
                      Decline
                    </Button>
                  )}
                  {selectedTransfer.can_approve && (
                    <Button
                      onClick={handleApproveTransfer}
                      disabled={approveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Check className="h-4 w-4 mr-2" />
                      Accept transfer
                    </Button>
                  )}
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default StockTransfersPage
