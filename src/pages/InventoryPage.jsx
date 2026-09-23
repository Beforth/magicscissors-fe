import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryService } from '@/services/inventory.service'
import { productService } from '@/services/product.service'
import { branchService } from '@/services/branch.service'
import { reportsService } from '@/services/reports.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle,
  ClipboardList,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Warehouse,
  Droplets,
  Printer,
  Trash2,
} from 'lucide-react'
import TakeInUseModal from '@/components/modals/TakeInUseModal'
import BarcodeImage from '@/components/BarcodeImage'
import { printOpenBottleLabel, DEFAULT_LABEL_SIZE } from '@/lib/barcodePrint'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { toast } from 'sonner'

const emptyAdjustData = {
  product_id: '',
  location_id: '',
  quantity: '',
  adjustment_type: 'add',
  reason: '',
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function InventoryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const [page, setPage] = useState(1)
  const [selectedLocation, setSelectedLocation] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustData, setAdjustData] = useState(emptyAdjustData)
  const [showTakeInUseModal, setShowTakeInUseModal] = useState(false)
  const [inUseBranchId, setInUseBranchId] = useState(user?.branchId || '')
  const [viewInUseContainer, setViewInUseContainer] = useState(null)

  const { data: inUseDetailData, isLoading: loadingInUseDetail } = useQuery({
    queryKey: ['bottle-lifecycle-detail', viewInUseContainer?.open_container_id],
    queryFn: () => reportsService.getBottleLifecycleDetail(viewInUseContainer.open_container_id),
    enabled: !!viewInUseContainer?.open_container_id,
  })
  const inUseDetail = inUseDetailData?.data || inUseDetailData

  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['inventory', { page, location_id: selectedLocation }],
    queryFn: () => inventoryService.getInventory({
      page,
      limit: 20,
      location_id: selectedLocation || undefined,
    }),
  })

  const { data: locationsData } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => inventoryService.getLocations(),
  })

  const { data: productsData } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => productService.getProducts({ limit: 1000 }),
  })

  const { data: lowStockData } = useQuery({
    queryKey: ['low-stock-products'],
    queryFn: () => productService.getLowStock(),
  })

  const { data: branchesData } = useQuery({
    queryKey: ['branches-active'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
  })

  const { data: openContainersData, isLoading: loadingOpenContainers } = useQuery({
    queryKey: ['open-containers', inUseBranchId],
    queryFn: () => inventoryService.getOpenContainers({
      branch_id: inUseBranchId || undefined,
      status: 'active',
    }),
    enabled: !!inUseBranchId,
  })

  const inventory = inventoryData?.data || []
  const pagination = inventoryData?.pagination || { page: 1, totalPages: 1, total: 0 }
  const locations = locationsData?.data || []
  const products = productsData?.data || []
  const lowStockProducts = lowStockData?.data || []
  const branches = branchesData?.data || []
  const openContainers = openContainersData?.data || openContainersData || []

  const discardBottleMutation = useMutation({
    mutationFn: inventoryService.discardOpenContainer,
    onSuccess: () => {
      toast.success('Product removed from use')
      queryClient.invalidateQueries({ queryKey: ['open-containers'] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to discard bottle')
    },
  })

  const visibleInventory = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return inventory.filter((item) => {
      const productName = item.product.product_name?.toLowerCase() || ''
      const barcode = item.product.barcode?.toLowerCase() || ''
      const locationName = item.location.location_name?.toLowerCase() || ''
      const matchesSearch = !needle || productName.includes(needle) || barcode.includes(needle) || locationName.includes(needle)
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'low' && item.is_low_stock)
        || (statusFilter === 'reserved' && item.reserved_quantity > 0)
        || (statusFilter === 'available' && !item.is_low_stock)
      return matchesSearch && matchesStatus
    })
  }, [inventory, search, statusFilter])

  const summary = useMemo(() => {
    return inventory.reduce((acc, item) => {
      acc.onHand += item.quantity || 0
      acc.reserved += item.reserved_quantity || 0
      acc.available += item.available_quantity || 0
      if (item.is_low_stock) acc.lowStock += 1
      return acc
    }, { onHand: 0, reserved: 0, available: 0, lowStock: 0 })
  }, [inventory])

  const adjustMutation = useMutation({
    mutationFn: inventoryService.adjustStock,
    onSuccess: () => {
      toast.success('Stock adjusted successfully')
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['low-stock-products'] })
      queryClient.invalidateQueries({ queryKey: ['products-all'] })
      setShowAdjustModal(false)
      setAdjustData(emptyAdjustData)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to adjust stock')
    },
  })

  const openAdjustModal = (item, adjustmentType = 'add') => {
    setAdjustData({
      product_id: item?.product?.product_id || '',
      location_id: item?.location?.location_id || selectedLocation || '',
      quantity: '',
      adjustment_type: adjustmentType,
      reason: '',
    })
    setShowAdjustModal(true)
  }

  const handleAdjust = (e) => {
    e.preventDefault()
    const quantity = parseInt(adjustData.quantity, 10)
    if (!quantity && adjustData.adjustment_type !== 'set') {
      toast.error('Enter a quantity')
      return
    }
    if (!adjustData.reason.trim()) {
      toast.error('Reason is required for stock adjustments')
      return
    }
    adjustMutation.mutate({
      ...adjustData,
      quantity,
      reason: adjustData.reason.trim(),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Control</h1>
          <p className="text-sm text-gray-500 mt-1">Location-wise stock, reservations, low stock alerts, and adjustments.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/inventory/transfers')}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Stock Transfers
          </Button>
          <Button onClick={() => openAdjustModal(null, 'add')}>
            <Plus className="h-4 w-4 mr-2" />
            Adjust Stock
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Droplets className="h-5 w-5 text-blue-600" />
              Products in use
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <SearchableSelect
                options={branches.map(b => ({ value: b.branch_id, label: b.name }))}
                value={inUseBranchId}
                onChange={setInUseBranchId}
                placeholder="Branch"
                triggerClassName="w-[200px] h-9"
              />
              <Button
                size="sm"
                onClick={() => setShowTakeInUseModal(true)}
                disabled={!inUseBranchId}
              >
                <Plus className="h-4 w-4 mr-1" />
                Take in use
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">
            Stock is in pieces; usage is tracked in ml/g per product. Take a piece in use, stick the barcode on it, and service recipes deduct from here.
          </p>
          {loadingOpenContainers ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : openContainers.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-4 text-center">No products in use at this branch.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>In use since</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openContainers.map((c) => (
                  <TableRow key={c.open_container_id}>
                    <TableCell className="font-medium">{c.product_name}</TableCell>
                    <TableCell>
                      {c.barcode ? (
                        <button
                          type="button"
                          className="font-mono text-xs text-blue-600 hover:underline"
                          onClick={() => setViewInUseContainer(c)}
                        >
                          {c.barcode}
                        </button>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {c.remaining_volume} / {c.initial_volume} {c.volume_unit}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-medium text-gray-800">
                        {c.consumed_volume ?? (c.initial_volume - c.remaining_volume)} {c.volume_unit}
                      </span>
                      {(c.usage_count ?? 0) > 0 && (
                        <span className="block text-xs text-gray-500">
                          {c.usage_count} service{c.usage_count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      <span>{formatDateTime(c.opened_at)}</span>
                      {c.opened_by_name && (
                        <span className="block text-xs text-gray-400">by {c.opened_by_name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {c.barcode && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Print label"
                            onClick={() => {
                              printOpenBottleLabel(c, DEFAULT_LABEL_SIZE).catch(() => {
                                toast.error('Failed to print label')
                              })
                            }}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => {
                            if (window.confirm(`Stop tracking ${c.product_name} and mark as discarded?`)) {
                              discardBottleMutation.mutate(c.open_container_id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-50">
                <Warehouse className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-xs text-gray-500">On Hand</p>
                <p className="text-2xl font-semibold">{summary.onHand}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-50">
                <ShieldCheck className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Reserved</p>
                <p className="text-2xl font-semibold">{summary.reserved}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-50">
                <CheckCircle className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Available</p>
                <p className="text-2xl font-semibold">{summary.available}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={summary.lowStock > 0 ? 'border-red-200' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Low Stock Rows</p>
                <p className="text-2xl font-semibold">{summary.lowStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {lowStockProducts.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Location-specific Low Stock
              <Badge variant="destructive">{lowStockProducts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {lowStockProducts.slice(0, 6).map((product) => (
                <div
                  key={`${product.product_id}-${product.location?.location_id || 'all'}`}
                  className="rounded-md border border-red-100 bg-red-50 p-3"
                >
                  <div className="font-medium text-sm text-gray-900">{product.product_name}</div>
                  <div className="text-xs text-gray-600 mt-1">{product.location?.location_name || 'Unknown location'}</div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span>Available: <b>{product.available_quantity ?? product.total_stock}</b></span>
                    <span>Need: <b>{product.reorder_level}</b></span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_180px] gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product, barcode, or location"
              />
            </div>
            <div>
              <select
                className="w-full h-10 px-3 border rounded-md bg-white"
                value={selectedLocation}
                onChange={(e) => {
                  setSelectedLocation(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All locations</option>
                {locations.map((loc) => (
                  <option key={loc.location_id} value={loc.location_id}>
                    {loc.location_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                className="w-full h-10 px-3 border rounded-md bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All status</option>
                <option value="low">Low stock</option>
                <option value="reserved">Reserved</option>
                <option value="available">Healthy</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5" />
            Stock by Location
            <Badge variant="secondary">{pagination.total} records</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : visibleInventory.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
              No inventory records match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Batch / Expiry</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleInventory.map((item) => (
                    <TableRow key={item.inventory_id}>
                      <TableCell>
                        <div className="font-medium">{item.product.product_name}</div>
                        <div className="text-xs text-gray-500">
                          {item.product.barcode || item.product.sku || 'No barcode'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{item.location.location_name}</div>
                        <div className="text-xs text-gray-500">{item.location.location_type}</div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {item.reserved_quantity > 0 ? (
                          <span className="font-medium text-amber-700">{item.reserved_quantity}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{item.available_quantity}</TableCell>
                      <TableCell>
                        {item.is_low_stock ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Low
                          </Badge>
                        ) : item.reserved_quantity > 0 ? (
                          <Badge variant="warning">Reserved</Badge>
                        ) : (
                          <Badge variant="success">Healthy</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{item.batch_number || '-'}</div>
                        <div className="text-xs text-gray-500">{formatDate(item.expiry_date)}</div>
                      </TableCell>
                      <TableCell className="text-gray-500">{formatDate(item.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openAdjustModal(item, 'add')}>
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openAdjustModal(item, 'subtract')}>
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

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

      <Dialog open={showAdjustModal} onOpenChange={setShowAdjustModal}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdjust} className="space-y-4">
            <div className="space-y-2">
              <Label>Product *</Label>
              <select
                className="w-full h-10 px-3 border rounded-md bg-white"
                value={adjustData.product_id}
                onChange={(e) => setAdjustData({ ...adjustData, product_id: e.target.value })}
                required
              >
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.product_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Location *</Label>
              <select
                className="w-full h-10 px-3 border rounded-md bg-white"
                value={adjustData.location_id}
                onChange={(e) => setAdjustData({ ...adjustData, location_id: e.target.value })}
                required
              >
                <option value="">Select location</option>
                {locations.map((loc) => (
                  <option key={loc.location_id} value={loc.location_id}>
                    {loc.location_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Action *</Label>
                <select
                  className="w-full h-10 px-3 border rounded-md bg-white"
                  value={adjustData.adjustment_type}
                  onChange={(e) => setAdjustData({ ...adjustData, adjustment_type: e.target.value })}
                >
                  <option value="add">Add stock</option>
                  <option value="subtract">Remove stock</option>
                  <option value="set">Set counted quantity</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min="0"
                  value={adjustData.quantity}
                  onChange={(e) => setAdjustData({ ...adjustData, quantity: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Input
                value={adjustData.reason}
                onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                placeholder="Physical count, damage, correction, opening stock"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAdjustModal(false)
                  setAdjustData(emptyAdjustData)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={adjustMutation.isPending}>
                {adjustMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Adjustment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TakeInUseModal
        open={showTakeInUseModal}
        onOpenChange={setShowTakeInUseModal}
        defaultBranchId={inUseBranchId}
      />

      <Dialog open={!!viewInUseContainer} onOpenChange={(open) => { if (!open) setViewInUseContainer(null) }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewInUseContainer?.product_name}</DialogTitle>
          </DialogHeader>
          {viewInUseContainer && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">In use since</p>
                  <p className="font-medium">{formatDateTime(inUseDetail?.opened_at || viewInUseContainer.opened_at)}</p>
                  {(inUseDetail?.opened_by_name || viewInUseContainer.opened_by_name) && (
                    <p className="text-xs text-gray-400">
                      by {inUseDetail?.opened_by_name || viewInUseContainer.opened_by_name}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Used so far</p>
                  <p className="font-medium font-mono">
                    {inUseDetail?.consumed_volume ?? viewInUseContainer.consumed_volume ?? 0}{' '}
                    / {viewInUseContainer.initial_volume} {viewInUseContainer.volume_unit}
                  </p>
                  <p className="text-xs text-gray-400">
                    {viewInUseContainer.remaining_volume} {viewInUseContainer.volume_unit} left
                  </p>
                </div>
              </div>
              <div className="rounded-lg border bg-white p-4 flex flex-col items-center gap-2">
                <BarcodeImage value={viewInUseContainer.barcode} className="w-full" />
                <p className="text-xs font-mono text-gray-500">{viewInUseContainer.barcode}</p>
              </div>
              {loadingInUseDetail ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
              ) : (inUseDetail?.usage_log || []).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-800">Usage history</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inUseDetail.usage_log.map((log) => (
                        <TableRow key={log.log_id}>
                          <TableCell className="text-xs whitespace-nowrap">{formatDateTime(log.used_at)}</TableCell>
                          <TableCell className="text-sm">{log.service_name || log.item_name || '—'}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{log.amount} {log.unit}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic text-center">No service usage recorded yet.</p>
              )}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    printOpenBottleLabel(viewInUseContainer, DEFAULT_LABEL_SIZE).catch(() => {
                      toast.error('Failed to print label')
                    })
                  }}
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Print 50×25 label
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default InventoryPage
