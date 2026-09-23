import React, { useRef, useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { billService } from '@/services/bill.service'
import { branchService } from '@/services/branch.service'
import { serviceService } from '@/services/service.service'
import { rotationQueueService } from '@/services/rotationQueue.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { formatDateTime, formatCurrency, formatDate, formatDateStored } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Printer,
  Receipt,
  User,
  Building2,
  Calendar,
  CreditCard,
  Loader2,
  Phone,
  FileText,
  Banknote,
  Smartphone,
  Trash2,
  Pencil,
  Armchair,
  Check,
  XCircle,
  Package,
  Settings2,
  ChevronDown,
  X,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { printThermalReceipt } from '@/components/ThermalReceipt'
import CompleteBillModal from '@/components/modals/CompleteBillModal'
import StartServiceModal from '@/components/modals/StartServiceModal'
import ConfirmDialog from '@/components/modals/ConfirmDialog'
import EmployeeRotationPanel from '@/components/billing/EmployeeRotationPanel'

const statusColors = {
  completed: 'success',
  pending: 'warning',
  partial: 'warning',
  draft: 'secondary',
  cancelled: 'destructive',
}

const paymentIcons = {
  cash: Banknote,
  card: CreditCard,
  upi: Smartphone,
}

function BillDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const returnTo = searchParams.get('returnTo')
  const goBack = () => navigate(returnTo || '/bills')
  const printRef = useRef(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editRemovedItemIds, setEditRemovedItemIds] = useState([])
  const [editAddedServices, setEditAddedServices] = useState([])
  const [editServiceSelect, setEditServiceSelect] = useState('')
  const [completeBillModalOpen, setCompleteBillModalOpen] = useState(false)
  const [completePendingItemModalOpen, setCompletePendingItemModalOpen] = useState(false)
  const [selectedPendingItemForComplete, setSelectedPendingItemForComplete] = useState(null)
  const [removedPackageInstanceIds, setRemovedPackageInstanceIds] = useState([])
  const [reconfigModalOpen, setReconfigModalOpen] = useState(false)
  const [reconfigPackage, setReconfigPackage] = useState(null) // { package_instance_id, package_id, package_name }
  const [reconfigServices, setReconfigServices] = useState([]) // [{ service_id, employee_id, employee_ids }]
  const [reconfigPrice, setReconfigPrice] = useState('')
  const [editBookNumberOpen, setEditBookNumberOpen] = useState(false)
  const [editBookNumberValue, setEditBookNumberValue] = useState('')
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [completingItemId, setCompletingItemId] = useState(null)
  const [assigningItemId, setAssigningItemId] = useState(null)
  const [selectResetKey, setSelectResetKey] = useState(0)
  const [queueOpen, setQueueOpen] = useState(false)

  const deleteBillMutation = useMutation({
    mutationFn: () => billService.cancelBill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['chairs'] })
      goBack()
    },
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['bill', id],
    queryFn: () => billService.getBillById(id),
    enabled: !!id,
  })

  const bill = data?.data

  // Fetch branch employees for reconfigure modal
  const branchId = bill?.branch?.branch_id
  const { data: employeesData } = useQuery({
    queryKey: ['employees', branchId],
    queryFn: () => branchService.getBranchEmployees(branchId),
    enabled: !!branchId && reconfigModalOpen,
  })
  const employees = employeesData?.data || []

  // Fetch services catalog for add service in edit modal
  const { data: servicesCatalogData } = useQuery({
    queryKey: ['services', 'active'],
    queryFn: () => serviceService.getServices({ is_active: 'true' }),
    enabled: editModalOpen,
  })
  const servicesCatalog = servicesCatalogData?.data || []

  // Fetch rotation queue for available employee dropdown
  const { data: queueData } = useQuery({
    queryKey: ['rotation-queue', branchId],
    queryFn: () => rotationQueueService.getQueue({ branchId }),
    enabled: !!branchId,
  })
  const availableEmployees = useMemo(
    () => (queueData?.data?.queue || []).filter((e) => e.display_status === 'available'),
    [queueData]
  )

  // Fetch package details when reconfiguring
  const reconfigPkgId = reconfigPackage?.package_id
  const { data: reconfigPkgData } = useQuery({
    queryKey: ['package', reconfigPkgId],
    queryFn: () => serviceService.getPackageById(reconfigPkgId),
    enabled: !!reconfigPkgId && reconfigModalOpen,
  })
  const reconfigPkgDetail = reconfigPkgData?.data

  const updateBillMutation = useMutation({
    mutationFn: (data) => billService.updateBill(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill', id] })
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      setEditModalOpen(false)
      toast.success('Bill updated')
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update bill')
    },
  })

  const getItemEmployeeIds = (item) => {
    const ids = []
    if (item.employees?.length) {
      for (const e of item.employees) {
        if (e.employee_id) ids.push(e.employee_id)
      }
    } else if (item.employee?.employee_id || item.employee?.id) {
      ids.push(item.employee?.employee_id || item.employee?.id)
    } else if (item.employee_id) {
      ids.push(item.employee_id)
    }
    return ids
  }

  const getDropdownOptions = (item) => {
    const assignedIds = getItemEmployeeIds(item)
    return availableEmployees.filter(e => !assignedIds.includes(e.employee_id))
  }

  const completeItemMutation = useMutation({
    mutationFn: ({ itemId, employeeIds }) =>
      billService.completeBillItem(id, itemId, { employee_ids: employeeIds }),
    onSuccess: (data) => {
      queryClient.setQueryData(['bill', id], (old) => {
        if (!old?.data?.items) return old
        return {
          ...old,
          data: {
            ...old.data,
            items: old.data.items.map((item) =>
              item.item_id === data?.data?.item_id
                ? { ...item, status: 'completed' }
                : item
            ),
          },
        }
      })
      queryClient.invalidateQueries({ queryKey: ['bill', id] })
      queryClient.invalidateQueries({ queryKey: ['rotation-queue'] })
      queryClient.invalidateQueries({ queryKey: ['pending-services'] })
      setCompletingItemId(null)
      toast.success('Service completed')
    },
    onError: (err) => {
      setCompletingItemId(null)
      toast.error(err.response?.data?.error?.message || 'Failed to complete service')
    },
  })

  const assignEmployeeMutation = useMutation({
    mutationFn: ({ itemId, employeeId }) =>
      billService.assignEmployeeFromQueue(id, itemId, employeeId ? { employee_id: employeeId } : {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill', id] })
      queryClient.invalidateQueries({ queryKey: ['rotation-queue'] })
      setAssigningItemId(null)
      setSelectResetKey(k => k + 1)
      toast.success('Employee assigned')
    },
    onError: (err) => {
      setAssigningItemId(null)
      setSelectResetKey(k => k + 1)
      toast.error(err.response?.data?.error?.message || 'No eligible employee in queue')
    },
  })

  const unassignEmployeeMutation = useMutation({
    mutationFn: ({ itemId, employeeId }) =>
      billService.unassignEmployee(id, itemId, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill', id] })
      queryClient.invalidateQueries({ queryKey: ['rotation-queue'] })
      setSelectResetKey(k => k + 1)
      toast.success('Employee removed')
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Failed to remove employee')
    },
  })

  useEffect(() => {
    if (editModalOpen) {
      setEditRemovedItemIds([])
      setEditAddedServices([])
      setEditServiceSelect('')
      setRemovedPackageInstanceIds([])
    }
  }, [editModalOpen])

  // Group bill items for screen display (packages grouped, singles separate)
  const groupedBillItems = useMemo(() => {
    if (!bill?.items) return []

    // Tier 1: Use package_summary if available (new backend)
    if (bill.package_summary?.length) {
      const groups = []
      const itemsByInstance = {}

      // Map items by package_instance_id
      bill.items.forEach((item) => {
        if (item.package_instance_id) {
          if (!itemsByInstance[item.package_instance_id]) {
            itemsByInstance[item.package_instance_id] = []
          }
          itemsByInstance[item.package_instance_id].push(item)
        }
      })

      // Build package groups from summary
      const usedItemIds = new Set()
      bill.package_summary.forEach((pkg) => {
        const pkgItems = itemsByInstance[pkg.package_instance_id] || []
        pkgItems.forEach((i) => usedItemIds.add(i.item_id))
        groups.push({
          type: 'package',
          package_instance_id: pkg.package_instance_id,
          package_name: pkg.package_name,
          package_price: pkg.package_price,
          package_id: pkg.package_id,
          items: pkgItems,
          total: pkgItems.reduce((s, i) => s + i.total_price, 0),
          subtotal: pkgItems.reduce((s, i) => s + i.unit_price * i.quantity, 0),
          discount: pkgItems.reduce((s, i) => s + (i.discount_amount || 0), 0),
          savings: pkg.savings ?? 0,
        })
      })

      // Remaining items as singles
      bill.items.forEach((item) => {
        if (!usedItemIds.has(item.item_id)) {
          groups.push({ type: 'single', item })
        }
      })

      return groups
    }

    // Tier 2: Group by package_instance_id if present
    const hasInstanceIds = bill.items.some((i) => i.package_instance_id)
    if (hasInstanceIds) {
      const groups = []
      const instanceMap = {}
      bill.items.forEach((item) => {
        if (item.package_instance_id) {
          if (!instanceMap[item.package_instance_id]) {
            instanceMap[item.package_instance_id] = []
          }
          instanceMap[item.package_instance_id].push(item)
        } else {
          groups.push({ type: 'single', item })
        }
      })
      Object.entries(instanceMap).forEach(([instanceId, items]) => {
        const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
        const discount = items.reduce((s, i) => s + (i.discount_amount || 0), 0)
        groups.push({
          type: 'package',
          package_instance_id: instanceId,
          package_name: items[0].notes || 'Package',
          package_price: subtotal,
          items,
          total: items.reduce((s, i) => s + i.total_price, 0),
          subtotal,
          discount,
          savings: 0,
        })
      })
      return groups
    }

    // Tier 3: Legacy fallback — group by notes
    const groups = []
    const noteGroups = {}
    bill.items.forEach((item) => {
      if (item.notes && bill.items.filter((i) => i.notes === item.notes).length > 1) {
        if (!noteGroups[item.notes]) {
          noteGroups[item.notes] = []
        }
        noteGroups[item.notes].push(item)
      } else {
        groups.push({ type: 'single', item })
      }
    })
    Object.entries(noteGroups).forEach(([noteName, items]) => {
      const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
      const discount = items.reduce((s, i) => s + (i.discount_amount || 0), 0)
      groups.push({
        type: 'package',
        package_name: noteName,
        items,
        total: items.reduce((s, i) => s + i.total_price, 0),
        subtotal,
        discount,
        savings: 0,
      })
    })
    return groups
  }, [bill?.items, bill?.package_summary])

  // Compute print-friendly items (packages collapsed into single lines)
  const printItems = useMemo(() => {
    if (!bill?.items) return []

    // Prefer package_summary for new-format bills
    if (bill.package_summary?.length) {
      const result = []
      const usedItemIds = new Set()

      bill.package_summary.forEach((pkg) => {
        const pkgItems = bill.items.filter((i) => i.package_instance_id === pkg.package_instance_id)
        pkgItems.forEach((i) => usedItemIds.add(i.item_id))
        const totalPrice = pkgItems.reduce((s, i) => s + i.total_price, 0)
        const unitPrice = pkgItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
        const discountAmount = pkgItems.reduce((s, i) => s + (i.discount_amount || 0), 0)
        result.push({
          item_name: pkg.package_name,
          item_type: 'package',
          quantity: 1,
          unit_price: unitPrice,
          discount_amount: discountAmount,
          total_price: totalPrice,
        })
      })

      bill.items.forEach((item) => {
        if (!usedItemIds.has(item.item_id)) {
          result.push(item)
        }
      })

      return result
    }

    // Fallback: existing notes-matching logic for old bills
    const packageGroups = {}
    const standalone = []

    bill.items.forEach((item) => {
      if (item.notes && bill.items.filter((i) => i.notes === item.notes).length > 1) {
        const pkgName = item.notes
        if (!packageGroups[pkgName]) {
          packageGroups[pkgName] = { item_name: pkgName, item_type: 'package', quantity: 1, unit_price: 0, discount_amount: 0, total_price: 0 }
        }
        packageGroups[pkgName].total_price += item.total_price
        packageGroups[pkgName].unit_price += item.unit_price * item.quantity
        packageGroups[pkgName].discount_amount += item.discount_amount || 0
      } else {
        standalone.push(item)
      }
    })

    return [...Object.values(packageGroups), ...standalone]
  }, [bill?.items, bill?.package_summary])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !bill) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-10 text-center text-red-500">
            {error?.response?.data?.error?.message || 'Bill not found'}
          </CardContent>
        </Card>
      </div>
    )
  }

  const isPending = bill.status === 'pending' || bill.status === 'partial'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={goBack}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            title="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Receipt className="h-6 w-6" />
              {bill.bill_number}
              {bill.book_number && (
                <span className="text-lg font-normal text-muted-foreground">
                  (No. {bill.book_number})
                </span>
              )}
              <Badge
                variant={statusColors[bill.status] || 'secondary'}
                className="text-sm"
              >
                {bill.status.toUpperCase()}
              </Badge>
            </h1>
            <p className="text-gray-500">
              Created on {formatDateTime(bill.created_at)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {isPending && (
            <>
              <Button
                onClick={() => {
                  setCompleteBillModalOpen(true)
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Complete Bill
              </Button>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={() => setCancelConfirmOpen(true)}
                disabled={deleteBillMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Bill
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => printThermalReceipt(bill)} title="Print Receipt">
            <Printer className="h-4 w-4" />
          </Button>
          {bill.status !== 'cancelled' && bill.status !== 'completed' && (
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(true)}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {bill.status !== 'cancelled' && !isPending && (
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleteBillMutation.isPending}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Bill Content - This is what gets printed */}
      <div ref={printRef}>
        {/* Print Header (hidden on screen) */}
        <div className="hidden print:block print-header">
          <h1>{bill.branch?.branch_name}</h1>
          <p>Tax Invoice / Bill of Supply</p>
        </div>

        {/* Customer, Branch, Bill Info & Chair */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Customer Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <button
                className="font-semibold text-lg hover:text-primary hover:underline text-left"
                onClick={() => navigate(`/customers/${bill.customer?.customer_id}`)}
              >
                {bill.customer?.customer_name}
              </button>
              {bill.customer?.phone_masked && (
                <p className="text-gray-600 flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3" />
                  {bill.customer.phone_masked}
                </p>
              )}
              {bill.branch?.branch_name && (
                <p className="text-gray-600 flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {bill.branch.branch_name}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Bill Info + Chair */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Bill Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-lg">{formatDateStored(bill.bill_date)}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-gray-600 font-medium">
                  Bill Book No.: {bill.book_number || '—'}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    setEditBookNumberValue(bill.book_number || '')
                    setEditBookNumberOpen(true)
                  }}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>
              <p className="text-gray-600">
                {bill.created_by?.full_name && `By ${bill.created_by.full_name}`}
              </p>
              {bill.chair && (
                <p className="text-gray-600 flex items-center gap-1 mt-1">
                  <Armchair className="h-3.5 w-3.5" />
                  Chair: {bill.chair.chair_number}
                  {bill.chair.chair_name && ` - ${bill.chair.chair_name}`}
                </p>
              )}
              {bill.is_imported && (
                <Badge variant="outline" className="mt-2">
                  <FileText className="h-3 w-3 mr-1" />
                  Imported
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Check-in Queue */}
          {bill.status !== 'completed' && (
            <div className="relative z-10">
              <EmployeeRotationPanel
                branchId={bill?.branch?.branch_id}
                accordion
                accordionOpen={queueOpen}
                onAccordionToggle={() => setQueueOpen((o) => !o)}
                floatExpand
              />
            </div>
          )}
        </div>

        {/* Bill Items - Screen version (shows all expanded items) */}
        <Card className="mt-6 no-print">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Served By</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  let rowNum = 0
                  return groupedBillItems.map((group, gIdx) => {
                    if (group.type === 'package') {
                      rowNum++
                      const headerNum = rowNum
                      return (
                        <React.Fragment key={`pkg-${group.package_instance_id || gIdx}`}>
                          {/* Package header row */}
                          <TableRow className="bg-blue-50/60">
                            <TableCell className="text-gray-500">{headerNum}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-blue-600" />
                                <span className="font-semibold text-blue-900">
                                  {group.package_name}
                                </span>
                                <Badge variant="outline" className="text-xs">Package</Badge>
                                {group.savings > 0 && (
                                  <Badge variant="success" className="text-xs">
                                    Save {formatCurrency(group.savings)}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">1</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(group.subtotal)}
                            </TableCell>
                            <TableCell className="text-right text-red-500">
                              {group.discount > 0 ? `-${formatCurrency(group.discount)}` : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(group.total)}
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-center">
                              {group.items.some((i) => i.status === 'pending') ? (
                                <Badge variant="warning" className="text-xs">Pending</Badge>
                              ) : (
                                <Badge variant="success" className="text-xs">Completed</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                          {/* Indented service rows */}
                          {group.items.map((item) => (
                            <TableRow key={item.item_id} className="bg-blue-50/30">
                              <TableCell></TableCell>
                              <TableCell>
                                <div className="pl-6 text-sm text-gray-700">
                                  {item.item_name ?? item.service?.service_name ?? 'Service'}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(item.unit_price)}
                              </TableCell>
                              <TableCell className="text-right text-sm text-red-500">
                                {item.discount_amount > 0
                                  ? `-${formatCurrency(item.discount_amount)}`
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(item.total_price)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {item.status === 'completed' ? (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {(item.employees?.length > 0 ? item.employees : item.employee ? [{ full_name: item.employee.full_name }] : []).map((emp, i) => (
                                      <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                                        {emp.full_name}
                                      </span>
                                    )) || '-'}
                                  </div>
                                ) : (item.employees?.length > 0 || item.employee?.employee_id) ? (
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                                    {(item.employees?.length > 0 ? item.employees : item.employee?.employee_id ? [{ employee_id: item.employee.employee_id, full_name: item.employee.full_name }] : []).map((emp) => (
                                      <span key={emp.employee_id} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${emp.completed_at ? 'bg-green-100 text-green-800' : 'bg-primary text-primary-foreground'}`}>
                                        {emp.full_name}
                                        {!emp.completed_at && (
                                          <button
                                            type="button"
                                            className="hover:text-primary-foreground/70"
                                            onClick={() => unassignEmployeeMutation.mutate({ itemId: item.item_id, employeeId: emp.employee_id })}
                                            disabled={unassignEmployeeMutation.isPending}
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        )}
                                      </span>
                                    ))}
                                    </div>
                                    {getDropdownOptions(item).length > 0 && (
                                    <SearchableSelect
                                      key={`${item.item_id}-${selectResetKey}`}
                                      options={getDropdownOptions(item).map(emp => ({ value: emp.employee_id, label: emp.full_name }))}
                                      value=""
                                      onChange={(empId) => {
                                        setAssigningItemId(item.item_id)
                                        assignEmployeeMutation.mutate({ itemId: item.item_id, employeeId: empId })
                                      }}
                                      disabled={assigningItemId === item.item_id}
                                      placeholder="Select employee"
                                      triggerClassName="h-7 w-auto min-w-[120px] px-2 gap-1"
                                    />
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() => {
                                        setAssigningItemId(item.item_id)
                                        assignEmployeeMutation.mutate({ itemId: item.item_id })
                                      }}
                                      disabled={assigningItemId === item.item_id}
                                    >
                                      {assigningItemId === item.item_id
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : 'From Queue'}
                                    </Button>
                                    <SearchableSelect
                                      key={selectResetKey}
                                      options={getDropdownOptions(item).map(emp => ({ value: emp.employee_id, label: emp.full_name }))}
                                      onChange={(empId) => {
                                        setAssigningItemId(item.item_id)
                                        assignEmployeeMutation.mutate({ itemId: item.item_id, employeeId: empId })
                                      }}
                                      disabled={assigningItemId === item.item_id}
                                      placeholder="Select employee"
                                      triggerClassName="h-7 w-auto min-w-[160px] px-2 gap-1"
                                    />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {(() => {
                                    const itemEmployeeCount = getItemEmployeeIds(item).length
                                    const showStarted = itemEmployeeCount > 0 && (item.status === 'in_progress' || item.status === 'pending')
                                    return showStarted ? (
                                      <Badge
                                        variant="default"
                                        className={`text-xs capitalize ${completingItemId === item.item_id ? 'opacity-50' : 'cursor-pointer hover:bg-primary/80'}`}
                                        onClick={() => {
                                          if (completingItemId) return
                                          const employeeIds = getItemEmployeeIds(item)
                                          if (!employeeIds.length) {
                                            toast.error('No employee assigned to this service')
                                            return
                                          }
                                          setCompletingItemId(item.item_id)
                                          completeItemMutation.mutate({ itemId: item.item_id, employeeIds })
                                        }}
                                      >
                                        {completingItemId === item.item_id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : 'Started'}
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant={itemEmployeeCount > 0 && item.status !== 'pending' ? 'success' : 'warning'}
                                        className="text-xs capitalize"
                                      >
                                        {itemEmployeeCount > 0 ? (item.status || 'completed') : 'pending'}
                                      </Badge>
                                    )
                                  })()}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      )
                    }

                    // Single item
                    rowNum++
                    const item = group.item
                    return (
                      <TableRow key={item.item_id}>
                        <TableCell className="text-gray-500">{rowNum}</TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {item.item_name ??
                              item.service?.service_name ??
                              item.service?.serviceName ??
                              item.package?.package_name ??
                              item.package?.packageName ??
                              item.product?.product_name ??
                              item.product?.productName ??
                              item.notes ??
                              'Unknown Item'}
                          </div>
                          <div className="text-sm text-gray-500 capitalize">
                            {item.item_type}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right text-red-500">
                          {item.discount_amount > 0
                            ? `-${formatCurrency(item.discount_amount)}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.total_price)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.status === 'completed' ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {(item.employees?.length > 0 ? item.employees : item.employee ? [{ full_name: item.employee.full_name }] : []).map((emp, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                                  {emp.full_name}
                                </span>
                              )) || '-'}
                            </div>
                          ) : (item.employees?.length > 0 || item.employee?.employee_id) ? (
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                              {(item.employees?.length > 0 ? item.employees : item.employee?.employee_id ? [{ employee_id: item.employee.employee_id, full_name: item.employee.full_name }] : []).map((emp) => (
                                <span key={emp.employee_id} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${emp.completed_at ? 'bg-green-100 text-green-800' : 'bg-primary text-primary-foreground'}`}>
                                  {emp.full_name}
                                  {!emp.completed_at && (
                                    <button
                                      type="button"
                                      className="hover:text-primary-foreground/70"
                                      onClick={() => unassignEmployeeMutation.mutate({ itemId: item.item_id, employeeId: emp.employee_id })}
                                      disabled={unassignEmployeeMutation.isPending}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  )}
                                </span>
                              ))}
                              </div>
                              {getDropdownOptions(item).length > 0 && (
                              <SearchableSelect
                                key={`${item.item_id}-${selectResetKey}`}
                                options={getDropdownOptions(item).map(emp => ({ value: emp.employee_id, label: emp.full_name }))}
                                value=""
                                onChange={(empId) => {
                                  setAssigningItemId(item.item_id)
                                  assignEmployeeMutation.mutate({ itemId: item.item_id, employeeId: empId })
                                }}
                                disabled={assigningItemId === item.item_id}
                                placeholder="Select employee"
                                triggerClassName="h-7 w-auto min-w-[120px] px-2 gap-1"
                              />
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setAssigningItemId(item.item_id)
                                  assignEmployeeMutation.mutate({ itemId: item.item_id })
                                }}
                                disabled={assigningItemId === item.item_id}
                              >
                                {assigningItemId === item.item_id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : 'From Queue'}
                              </Button>
                              <SearchableSelect
                                key={selectResetKey}
                                options={getDropdownOptions(item).map(emp => ({ value: emp.employee_id, label: emp.full_name }))}
                                onChange={(empId) => {
                                  setAssigningItemId(item.item_id)
                                  assignEmployeeMutation.mutate({ itemId: item.item_id, employeeId: empId })
                                }}
                                disabled={assigningItemId === item.item_id}
                                placeholder="Select employee"
                                triggerClassName="h-7 w-auto min-w-[160px] px-2 gap-1"
                              />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {(() => {
                              const itemEmployeeCount = getItemEmployeeIds(item).length
                              const showStarted = itemEmployeeCount > 0 && (item.status === 'in_progress' || item.status === 'pending')
                              return showStarted ? (
                                <Badge
                                  variant="default"
                                  className={`text-xs capitalize ${completingItemId === item.item_id ? 'opacity-50' : 'cursor-pointer hover:bg-primary/80'}`}
                                  onClick={() => {
                                    if (completingItemId) return
                                    const employeeIds = getItemEmployeeIds(item)
                                    if (!employeeIds.length) {
                                      toast.error('No employee assigned to this service')
                                      return
                                    }
                                    setCompletingItemId(item.item_id)
                                    completeItemMutation.mutate({ itemId: item.item_id, employeeIds })
                                  }}
                                >
                                  {completingItemId === item.item_id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : 'Started'}
                                </Badge>
                              ) : (
                                <Badge
                                  variant={itemEmployeeCount > 0 && item.status !== 'pending' ? 'success' : 'warning'}
                                  className="text-xs capitalize"
                                >
                                  {itemEmployeeCount > 0 ? (item.status || 'completed') : 'pending'}
                                </Badge>
                              )
                            })()}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                })()}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={7} className="text-right font-medium">
                    Subtotal
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(bill.subtotal)}
                  </TableCell>
                </TableRow>
                {bill.discount_amount > 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-right font-medium text-red-500">
                      Discount
                    </TableCell>
                    <TableCell className="text-right text-red-500">
                      -{formatCurrency(bill.discount_amount)}
                    </TableCell>
                  </TableRow>
                )}
                {(bill.taxable_subtotal ?? 0) > 0 && bill.tax_amount > 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-right font-medium text-gray-600">
                      Taxable value
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(bill.taxable_subtotal)}
                    </TableCell>
                  </TableRow>
                )}
                {bill.tax_amount > 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-right font-medium">
                      GST (CGST + SGST)
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(bill.tax_amount)}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-gray-50">
                  <TableCell colSpan={7} className="text-right font-bold text-lg">
                    Total Amount
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg text-primary">
                    {formatCurrency(bill.total_amount)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        {/* Bill Items - Print version (packages collapsed) */}
        <Card className="mt-6 hidden print-only" style={{ display: 'none' }}>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {printItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-gray-500">{index + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {item.item_name || 'Unknown Item'}
                      </div>
                      <div className="text-sm text-gray-500 capitalize">
                        {item.item_type}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.unit_price)}
                    </TableCell>
                    <TableCell className="text-right text-red-500">
                      {item.discount_amount > 0
                        ? `-${formatCurrency(item.discount_amount)}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.total_price)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="text-right font-medium">
                    Subtotal
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(bill.subtotal)}
                  </TableCell>
                </TableRow>
                {bill.discount_amount > 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-right font-medium text-red-500">
                      Discount
                    </TableCell>
                    <TableCell className="text-right text-red-500">
                      -{formatCurrency(bill.discount_amount)}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-gray-50">
                  <TableCell colSpan={5} className="text-right font-bold text-lg">
                    Total Amount
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg text-primary">
                    {formatCurrency(bill.total_amount)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        {/* Payments */}
        {bill.payments?.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bill.payments.map((payment) => {
                  const PaymentIcon = paymentIcons[payment.payment_mode] || CreditCard
                  return (
                    <div
                      key={payment.payment_id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          <PaymentIcon className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium capitalize">{payment.payment_mode}</p>
                          {payment.transaction_reference && (
                            <p className="text-sm text-gray-500">
                              Ref: {payment.transaction_reference}
                            </p>
                          )}
                          {payment.bank_name && (
                            <p className="text-sm text-gray-500">{payment.bank_name}</p>
                          )}
                        </div>
                      </div>
                      <p className="font-bold text-lg">{formatCurrency(payment.amount)}</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending bill — no payments yet */}
        {isPending && (!bill.payments || bill.payments.length === 0) && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 text-gray-500">
                <p>No payments recorded yet.</p>
                <Button
                  className="mt-3 bg-green-600 hover:bg-green-700"
                  onClick={() => setCompleteBillModalOpen(true)}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Complete Bill & Collect Payment
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {bill.notes && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">{bill.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Print Footer (hidden on screen) */}
        <div className="hidden print:block footer">
          <Separator className="my-4" />
          <p>Thank you for your visit!</p>
          <p>Bill generated on {formatDateTime(new Date())}</p>
        </div>
      </div>

      {/* Edit Bill — item status + package operations */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Bill
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Add or remove services from this bill.
          </p>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {groupedBillItems.map((group, gIdx) => {
              if (group.type === 'package') {
                const isRemoved = group.package_instance_id &&
                  removedPackageInstanceIds.includes(group.package_instance_id)

                return (
                  <div
                    key={`edit-pkg-${group.package_instance_id || gIdx}`}
                    className={`border rounded-lg p-3 ${isRemoved ? 'opacity-50 bg-red-50' : 'bg-blue-50/40'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-sm">{group.package_name}</span>
                        <Badge variant="outline" className="text-xs">Package</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {isPending && group.package_instance_id && group.package_id && !isRemoved && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setReconfigPackage({
                                package_instance_id: group.package_instance_id,
                                package_id: group.package_id,
                                package_name: group.package_name,
                              })
                              setReconfigServices(
                                group.items.map((item) => ({
                                  service_id: item.service_id || item.service?.service_id,
                                  employee_id: item.employee?.employee_id || null,
                                  employee_ids: item.employees?.map(e => e.employee_id) || [],
                                }))
                              )
                              setReconfigPrice(group.subtotal?.toString() || '')
                              setReconfigModalOpen(true)
                            }}
                          >
                            <Settings2 className="h-3 w-3 mr-1" />
                            Reconfigure
                          </Button>
                        )}
                        {group.package_instance_id && (
                          <Button
                            variant={isRemoved ? 'outline' : 'destructive'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              if (isRemoved) {
                                setRemovedPackageInstanceIds((prev) =>
                                  prev.filter((id) => id !== group.package_instance_id)
                                )
                              } else {
                                const hasInProgress = group.items?.some((i) => i.status === 'in_progress')
                                if (hasInProgress) {
                                  toast.error('This package contains started services. Complete them first.')
                                  return
                                }
                                setRemovedPackageInstanceIds((prev) => [
                                  ...prev,
                                  group.package_instance_id,
                                ])
                              }
                            }}
                          >
                            {isRemoved ? 'Undo Remove' : 'Remove'}
                          </Button>
                        )}
                      </div>
                    </div>
                    {!isRemoved && group.items.map((item) => (
                      <div
                        key={item.item_id}
                        className="flex items-center justify-between py-1 pl-6 text-sm"
                      >
                        <span className="truncate flex-1 text-gray-700">
                          {item.item_name ?? item.service?.service_name ?? 'Service'}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {formatCurrency(item.unit_price || item.total_price)}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              }

              // Single item
              const item = group.item
              const isItemRemoved = editRemovedItemIds.includes(item.item_id)
              return (
                <div
                  key={item.item_id}
                  className={`flex items-center justify-between p-2 rounded border ${isItemRemoved ? 'opacity-50 bg-red-50' : 'bg-gray-50'}`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {item.item_name ??
                        item.service?.service_name ??
                        item.service?.serviceName ??
                        item.package?.package_name ??
                        item.package?.packageName ??
                        item.product?.product_name ??
                        item.product?.productName ??
                        item.notes ??
                        'Unknown'}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatCurrency(item.unit_price || item.total_price)}
                    </span>
                  </div>
                  <Button
                    variant={isItemRemoved ? 'outline' : 'ghost'}
                    size="sm"
                    className={`h-7 w-7 p-0 ml-2 shrink-0 ${isItemRemoved ? 'text-green-600' : 'text-red-500 hover:text-red-700'}`}
                    onClick={() => {
                      if (isItemRemoved) {
                        setEditRemovedItemIds((prev) => prev.filter((id) => id !== item.item_id))
                      } else {
                        if (item.status === 'in_progress') {
                          toast.error('Started services cannot be removed. Complete the service first.')
                          return
                        }
                        setEditRemovedItemIds((prev) => [...prev, item.item_id])
                      }
                    }}
                  >
                    {isItemRemoved ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              )
            })}

            {/* Added services */}
            {editAddedServices.map((svc, idx) => (
              <div
                key={`added-${idx}`}
                className="flex items-center justify-between p-2 rounded border bg-green-50"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">{svc.service_name}</span>
                  <Badge variant="outline" className="text-[10px]">Pending</Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatCurrency(svc.price)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 ml-2 shrink-0 text-red-500 hover:text-red-700"
                  onClick={() => setEditAddedServices((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            {/* Add Service */}
            <div className="border border-dashed rounded-lg p-3 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Add Service</p>
              <div className="flex gap-2">
                <SearchableSelect
                  value={editServiceSelect}
                  onChange={setEditServiceSelect}
                  placeholder="Select a service…"
                  options={servicesCatalog.map(svc => ({ value: svc.service_id, label: `${svc.service_name} — ${formatCurrency(svc.price)}` }))}
                  formatOption={(opt) => `${opt.label}`}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!editServiceSelect}
                  onClick={() => {
                    const svc = servicesCatalog.find((s) => s.service_id === editServiceSelect)
                    if (!svc) return
                    if (editAddedServices.some((s) => s.service_id === svc.service_id)) {
                      toast.warning('Service already added')
                      return
                    }
                    setEditAddedServices((prev) => [
                      ...prev,
                      {
                        service_id: svc.service_id,
                        service_name: svc.service_name,
                        price: parseFloat(svc.price) || 0,
                      },
                    ])
                    setEditServiceSelect('')
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(false)}
              disabled={updateBillMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const payload = {}

                // Collect removed item IDs (individual + package instances)
                const allRemovedIds = [...editRemovedItemIds]
                if (removedPackageInstanceIds.length > 0) {
                  bill.items.forEach((i) => {
                    if (i.package_instance_id && removedPackageInstanceIds.includes(i.package_instance_id)) {
                      allRemovedIds.push(i.item_id)
                    }
                  })
                }
                if (allRemovedIds.length > 0) {
                  payload.remove_item_ids = [...new Set(allRemovedIds)]
                }

                // Package instance removals
                if (removedPackageInstanceIds.length > 0) {
                  payload.remove_package_instance_ids = removedPackageInstanceIds
                }

                // Add new services
                if (editAddedServices.length > 0) {
                  payload.add_items = editAddedServices.map((svc) => ({
                    item_type: 'service',
                    service_id: svc.service_id,
                    quantity: 1,
                    unit_price: svc.price,
                    discount_amount: 0,
                    discount_percentage: 0,
                    status: 'pending',
                  }))
                }

                if (Object.keys(payload).length === 0) {
                  toast.info('No changes to save')
                  return
                }

                updateBillMutation.mutate(payload)
              }}
              disabled={updateBillMutation.isPending}
            >
              {updateBillMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Bill Book Number */}
      <Dialog open={editBookNumberOpen} onOpenChange={setEditBookNumberOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Bill Book Number</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-book-number">Bill Book No. (No.)</Label>
            <Input
              id="edit-book-number"
              value={editBookNumberValue}
              onChange={(e) => setEditBookNumberValue(e.target.value)}
              placeholder="e.g. 123"
              maxLength={50}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBookNumberOpen(false)} disabled={updateBillMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                updateBillMutation.mutate(
                  { book_number: editBookNumberValue.trim() || null },
                  { onSuccess: () => setEditBookNumberOpen(false) }
                )
              }}
              disabled={updateBillMutation.isPending}
            >
              {updateBillMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reconfigure Package Sub-Modal */}
      <Dialog open={reconfigModalOpen} onOpenChange={setReconfigModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Reconfigure — {reconfigPackage?.package_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {/* Package price */}
            <div>
              <Label className="text-sm font-medium">Package Price</Label>
              <Input
                type="number"
                value={reconfigPrice}
                onChange={(e) => setReconfigPrice(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Services list from package details */}
            {reconfigPkgDetail ? (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Services</Label>
                {/* Standalone services */}
                {(reconfigPkgDetail.services || []).map((svc, sIdx) => (
                  <div key={svc.service_id} className="border rounded p-2 space-y-1">
                    <div className="text-sm font-medium">{svc.service_name}</div>
                    <div className="text-xs text-gray-500">
                      Price: {formatCurrency(svc.service_price)}
                    </div>
                    <select
                      className="w-full h-8 px-2 text-sm border rounded-md"
                      value={reconfigServices[sIdx]?.employee_id || ''}
                      onChange={(e) => {
                        setReconfigServices((prev) => {
                          const next = [...prev]
                          if (!next[sIdx]) next[sIdx] = { service_id: svc.service_id }
                          next[sIdx] = { ...next[sIdx], service_id: svc.service_id, employee_id: e.target.value || null }
                          return next
                        })
                      }}
                    >
                      <option value="">No employee</option>
                      {employees.map((emp) => (
                        <option key={emp.employee_id} value={emp.employee_id}>
                          {emp.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {/* Service groups (OR groups) */}
                {(reconfigPkgDetail.service_groups || []).map((group, gIdx) => {
                  const serviceIdx = (reconfigPkgDetail.services || []).length + gIdx
                  return (
                    <div key={`group-${gIdx}`} className="border rounded p-2 space-y-1">
                      <div className="text-sm font-medium text-blue-700">
                        Choose one (Group {gIdx + 1})
                      </div>
                      <select
                        className="w-full h-8 px-2 text-sm border rounded-md"
                        value={reconfigServices[serviceIdx]?.service_id || ''}
                        onChange={(e) => {
                          setReconfigServices((prev) => {
                            const next = [...prev]
                            next[serviceIdx] = {
                              service_id: e.target.value || null,
                              employee_id: next[serviceIdx]?.employee_id || null,
                            }
                            return next
                          })
                        }}
                      >
                        <option value="">Select service</option>
                        {(group.services || []).map((s) => (
                          <option key={s.service_id} value={s.service_id}>
                            {s.service_name} ({formatCurrency(s.service_price)})
                          </option>
                        ))}
                      </select>
                      <select
                        className="w-full h-8 px-2 text-sm border rounded-md"
                        value={reconfigServices[serviceIdx]?.employee_id || ''}
                        onChange={(e) => {
                          setReconfigServices((prev) => {
                            const next = [...prev]
                            if (!next[serviceIdx]) next[serviceIdx] = {}
                            next[serviceIdx] = { ...next[serviceIdx], employee_id: e.target.value || null }
                            return next
                          })
                        }}
                      >
                        <option value="">No employee</option>
                        {employees.map((emp) => (
                          <option key={emp.employee_id} value={emp.employee_id}>
                            {emp.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Loading package details...</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReconfigModalOpen(false)
                setReconfigPackage(null)
              }}
              disabled={updateBillMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const selectedServices = reconfigServices
                  .filter((s) => s?.service_id)
                  .map((s) => {
                    const entry = { service_id: s.service_id }
                    if (s.employee_ids?.length > 1) {
                      entry.employee_ids = s.employee_ids
                    } else if (s.employee_id) {
                      entry.employee_id = s.employee_id
                    }
                    return entry
                  })

                const payload = {
                  update_package_services: {
                    package_instance_id: reconfigPackage.package_instance_id,
                    package_price: parseFloat(reconfigPrice) || 0,
                    selected_services: selectedServices,
                  },
                }
                updateBillMutation.mutate(payload)
                setReconfigModalOpen(false)
                setReconfigPackage(null)
              }}
              disabled={updateBillMutation.isPending || !reconfigPkgDetail}
            >
              {updateBillMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save Reconfiguration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Bill Modal */}
      <CompleteBillModal
        open={completeBillModalOpen}
        onOpenChange={setCompleteBillModalOpen}
        bill={bill}
      />
      <StartServiceModal
        open={completePendingItemModalOpen}
        onOpenChange={setCompletePendingItemModalOpen}
        item={selectedPendingItemForComplete}
      />
      <ConfirmDialog
        open={cancelConfirmOpen}
        onOpenChange={setCancelConfirmOpen}
        title="Cancel Bill"
        description={`Cancel bill ${bill?.bill_number}? This action cannot be undone.`}
        confirmLabel="Cancel Bill"
        onConfirm={() => { setCancelConfirmOpen(false); deleteBillMutation.mutate() }}
      />
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Bill"
        description={`Delete bill ${bill?.bill_number}? This will cancel the bill and cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { setDeleteConfirmOpen(false); deleteBillMutation.mutate() }}
      />
    </div>
  )
}

export default BillDetailPage
