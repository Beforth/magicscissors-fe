import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Loader2,
  Plus,
  Trash2,
  ArrowLeft,
  PackagePlus,
  Warehouse,
  Store,
  PackageCheck,
  CreditCard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatCurrency } from '@/lib/utils'
import { purchaseBatchService } from '@/services/purchaseBatch.service'
import { supplierService } from '@/services/supplier.service'
import { productService } from '@/services/product.service'
import { branchService } from '@/services/branch.service'
import SupplierModal from '@/components/modals/SupplierModal'

const emptyLine = () => ({ product_id: '', quantity: '', unit_cost: '' })

function getLocalDatetimeString(date = new Date()) {
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}

function OptionCard({ active, onClick, icon: Icon, title, description }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-4 transition-colors ${
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className="flex gap-3">
        <div
          className={`p-2 rounded-md shrink-0 ${
            active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium text-sm text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
    </button>
  )
}

export default function PurchaseBatchCreatePage() {
  const navigate = useNavigate()

  const [supplierId, setSupplierId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [emergencyMode, setEmergencyMode] = useState(false)
  const [purchaseDate, setPurchaseDate] = useState(() => getLocalDatetimeString())
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([emptyLine()])
  const [addPayment, setAddPayment] = useState(false)
  const [payment, setPayment] = useState({ amount: '', payment_mode: 'cash', notes: '' })
  const [autoAddInventory, setAutoAddInventory] = useState(true)
  const [supplierModalOpen, setSupplierModalOpen] = useState(false)

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierService.getSuppliers({ limit: 100 }),
  })
  const suppliers = suppliersData?.data || []

  const { data: productsData } = useQuery({
    queryKey: ['products-purchase'],
    queryFn: () => productService.getProducts({ limit: 500 }),
  })
  const products = productsData?.data || []

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
  })
  const branchesList = branchesData?.data || []

  const warehouseBranches = branchesList.filter((b) => b.is_warehouse)
  const destinationOptions = emergencyMode ? branchesList : warehouseBranches
  const selectedBranch = branchesList.find((b) => b.branch_id === branchId)

  const productOptions = useMemo(
    () =>
      products.map((p) => {
        const name = p.product_name || p.name || 'Product'
        const parts = [name]
        if (p.sku) parts.push(p.sku)
        if (p.barcode) parts.push(p.barcode)
        return { value: p.product_id, label: parts.join(' · ') }
      }),
    [products]
  )

  useEffect(() => {
    if (!branchId && warehouseBranches.length > 0 && !emergencyMode) {
      setBranchId(warehouseBranches[0].branch_id)
    }
    if (!emergencyMode && branchId && !warehouseBranches.some((b) => b.branch_id === branchId)) {
      setBranchId(warehouseBranches[0]?.branch_id || '')
    }
  }, [branchId, emergencyMode, warehouseBranches])

  const lineCount = items.filter(
    (i) => i.product_id && Number(i.quantity) > 0 && Number(i.unit_cost) >= 0
  ).length

  const totalAmount = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const cost = Number(item.unit_cost) || 0
    return sum + qty * cost
  }, 0)

  const addItem = () => setItems([...items, emptyLine()])

  const removeItem = (index) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index, field, value) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }

    if (field === 'product_id' && value) {
      const product = products.find((p) => p.product_id === value)
      if (product?.cost_price != null && !updated[index].unit_cost) {
        updated[index].unit_cost = String(product.cost_price)
      }
    }

    setItems(updated)
  }

  const mutation = useMutation({
    mutationFn: (data) => purchaseBatchService.createBatch(data),
    onSuccess: (res) => {
      toast.success(autoAddInventory ? 'Purchase created and stock received' : 'Purchase batch created')
      const batchId = res?.data?.batch_id || res?.batch_id
      if (batchId) navigate(`/purchase-batches/${batchId}`)
      else navigate('/purchase-batches')
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to create batch'),
  })

  const handleSubmit = () => {
    if (!supplierId) return toast.error('Select a supplier')
    if (!branchId) return toast.error('Select a destination branch')

    const validItems = items.filter(
      (i) => i.product_id && Number(i.quantity) > 0 && Number(i.unit_cost) >= 0
    )
    if (validItems.length === 0) {
      return toast.error('Add at least one line with product, quantity, and unit cost')
    }

    const payload = {
      supplier_id: supplierId,
      branch_id: branchId,
      purchase_date: new Date(purchaseDate).toISOString(),
      notes: notes || undefined,
      items: validItems.map((i) => ({
        product_id: i.product_id,
        quantity: Number(i.quantity),
        unit_cost: Number(i.unit_cost),
      })),
      auto_add_inventory: autoAddInventory,
    }

    if (addPayment && Number(payment.amount) > 0) {
      payload.initial_payment = {
        amount: Number(payment.amount),
        payment_mode: payment.payment_mode,
        notes: payment.notes || undefined,
      }
    }

    mutation.mutate(payload)
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/purchase-batches')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Purchase</h1>
          <p className="text-sm text-gray-500 mt-1">
            Buy from a supplier and optionally receive stock into inventory immediately.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Purchase details</CardTitle>
              <CardDescription>Supplier, destination, and date</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Supplier</Label>
                  <div className="flex gap-2">
                    <SearchableSelect
                      options={suppliers.map((s) => ({ value: s.supplier_id, label: s.name }))}
                      value={supplierId}
                      onChange={setSupplierId}
                      placeholder="Select supplier"
                      triggerClassName="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setSupplierModalOpen(true)}
                      title="Add supplier"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Purchase date &amp; time</Label>
                  <Input
                    type="datetime-local"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Receive stock at</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <OptionCard
                    active={!emergencyMode}
                    onClick={() => setEmergencyMode(false)}
                    icon={Warehouse}
                    title="Warehouse (default)"
                    description="Normal flow — stock enters the central warehouse first."
                  />
                  <OptionCard
                    active={emergencyMode}
                    onClick={() => setEmergencyMode(true)}
                    icon={Store}
                    title="Salon branch (emergency)"
                    description="Direct delivery to a salon when warehouse is skipped."
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Destination branch</Label>
                <SearchableSelect
                  options={destinationOptions.map((b) => ({ value: b.branch_id, label: `${b.name}${b.is_warehouse ? ' (warehouse)' : ''}` }))}
                  value={branchId}
                  onChange={setBranchId}
                  placeholder={emergencyMode ? 'Select salon branch' : 'Select warehouse'}
                />
                {!emergencyMode && warehouseBranches.length === 0 && (
                  <p className="text-xs text-red-600">
                    No warehouse branch configured. Mark a branch as warehouse or use emergency mode.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Invoice #, delivery note, etc."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Line items</CardTitle>
                  <CardDescription>{lineCount} valid line(s)</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add line
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto overflow-y-visible border-t sm:border-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Product</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-28">Unit cost</TableHead>
                      <TableHead className="text-right w-28">Line total</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="relative">
                          <SearchableSelect
                            options={productOptions}
                            value={item.product_id}
                            onChange={(val) => updateItem(i, 'product_id', val)}
                            placeholder="Search product…"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_cost}
                            onChange={(e) => updateItem(i, 'unit_cost', e.target.value)}
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(
                            (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0)
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeItem(i)}
                            disabled={items.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setAddPayment(!addPayment)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-gray-500" />
                  <div>
                    <CardTitle className="text-lg">Supplier payment</CardTitle>
                    <CardDescription>Optional initial payment on create</CardDescription>
                  </div>
                </div>
                <Badge variant={addPayment ? 'default' : 'secondary'}>
                  {addPayment ? 'Enabled' : 'Off'}
                </Badge>
              </div>
            </CardHeader>
            {addPayment && (
              <CardContent className="space-y-4 border-t pt-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPayment((p) => ({ ...p, amount: String(totalAmount) }))
                    }
                  >
                    Pay full amount
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddPayment(false)}
                  >
                    Skip payment
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      value={payment.amount}
                      onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payment mode</Label>
                    <SearchableSelect
                      options={[
                        { value: 'cash', label: 'Cash' },
                        { value: 'upi', label: 'UPI' },
                        { value: 'card', label: 'Card' },
                        { value: 'online', label: 'Online' },
                      ]}
                      value={payment.payment_mode}
                      onChange={(val) => setPayment({ ...payment, payment_mode: val })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Input
                      value={payment.notes}
                      onChange={(e) => setPayment({ ...payment, notes: e.target.value })}
                      placeholder="Advance / partial"
                    />
                  </div>
                </div>
              </CardContent>
            )}
            {!addPayment && (
              <CardContent className="pt-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddPayment(true)}
                >
                  Record payment now
                </Button>
              </CardContent>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="xl:sticky xl:top-4">
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Lines</span>
                  <span className="font-medium">{lineCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Destination</span>
                  <span className="font-medium text-right max-w-[160px] truncate">
                    {selectedBranch?.name || '—'}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="text-gray-700 font-medium">Grand total</span>
                  <span className="text-xl font-bold tabular-nums">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">
                  Inventory
                </Label>
                <OptionCard
                  active={autoAddInventory}
                  onClick={() => setAutoAddInventory(true)}
                  icon={PackageCheck}
                  title="Receive stock now"
                  description="Increases on-hand quantity at the selected branch. Recommended."
                />
                <OptionCard
                  active={!autoAddInventory}
                  onClick={() => setAutoAddInventory(false)}
                  icon={PackagePlus}
                  title="Record purchase only"
                  description="Save the PO now; receive stock later from the batch detail page."
                />
              </div>

              <div className="hidden xl:flex flex-col gap-2 pt-2">
                <Button onClick={handleSubmit} disabled={mutation.isPending} className="w-full">
                  {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create purchase
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/purchase-batches')}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-white/95 backdrop-blur p-4 md:pl-[var(--sidebar-width,0px)] xl:hidden">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/purchase-batches')}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create
            </Button>
          </div>
        </div>
      </div>

      <SupplierModal
        open={supplierModalOpen}
        onOpenChange={setSupplierModalOpen}
        editSupplier={null}
        onSuccess={(supplier) => {
          if (supplier?.supplier_id) setSupplierId(supplier.supplier_id)
        }}
      />
    </div>
  )
}
