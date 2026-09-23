import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { billService } from '@/services/bill.service'
import { upiAccountService } from '@/services/upiAccount.service'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatCurrency } from '@/lib/utils'
import {
  Loader2,
  Banknote,
  CreditCard,
  Smartphone,
  Plus,
  Trash2,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import ServiceConsumptionPicker, {
  buildContainerSelections,
  isConsumptionComplete,
} from '@/components/billing/ServiceConsumptionPicker'

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'upi', label: 'UPI', icon: Smartphone },
]

function CompleteBillModal({ open, onOpenChange, bill }) {
  const queryClient = useQueryClient()

  const { data: upiAccountsData } = useQuery({
    queryKey: ['upi-accounts', 'active'],
    queryFn: () => upiAccountService.getAccounts({ is_active: 'true' }),
  })
  const upiAccounts = upiAccountsData?.data || []

  const [payments, setPayments] = useState([{ payment_mode: 'cash', amount: '' }])
  const [notes, setNotes] = useState('')
  const [pendingItemIds, setPendingItemIds] = useState([])
  const [containerSelections, setContainerSelections] = useState({})

  const totalAmount = bill?.total_amount || 0
  // Full payment always required — pending items are services to be completed later
  const payableAmount = totalAmount

  useEffect(() => {
    if (open && bill) {
      setNotes('')
      setPendingItemIds(bill.items?.filter((i) => i.status === 'pending').map((i) => i.item_id) || [])
      setContainerSelections({})
      setPayments([{ payment_mode: 'cash', amount: totalAmount > 0 ? totalAmount.toFixed(2) : '' }])
    }
  }, [open, bill, totalAmount])

  const { data: previewData } = useQuery({
    queryKey: ['consumption-preview', bill?.bill_id, pendingItemIds.join(',')],
    queryFn: () =>
      billService.getConsumptionPreview(bill.bill_id, { pending_item_ids: pendingItemIds }),
    enabled: open && !!bill?.bill_id,
  })
  const consumptionRequirements = previewData?.data?.requirements || previewData?.requirements || []

  const completeMutation = useMutation({
    mutationFn: (data) => billService.completeBill(bill.bill_id, data),
    onSuccess: () => {
      toast.success('Bill completed successfully!')
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['bill', String(bill.bill_id)] })
      queryClient.invalidateQueries({ queryKey: ['chairs'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['open-containers'] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to complete bill')
    },
  })

  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  const remaining = payableAmount - totalPaid

  const handleAddPayment = () => {
    setPayments([...payments, { payment_mode: 'cash', amount: '' }])
  }

  const handleRemovePayment = (index) => {
    if (payments.length > 1) {
      setPayments(payments.filter((_, i) => i !== index))
    }
  }

  const handlePaymentChange = (index, field, value) => {
    setPayments(payments.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  const handleSetFullAmount = (index) => {
    const otherPayments = payments.reduce(
      (sum, p, i) => (i !== index ? sum + (parseFloat(p.amount) || 0) : sum),
      0
    )
    const remainingAmount = Math.max(0, payableAmount - otherPayments)
    handlePaymentChange(index, 'amount', remainingAmount.toFixed(2))
  }

  const handleTogglePendingItem = (itemId) => {
    setPendingItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    )
  }

  const handleSubmit = () => {
    const validPayments = payments.filter((p) => parseFloat(p.amount) > 0)
    if (validPayments.length === 0) {
      toast.error('Please add at least one payment')
      return
    }

    // Cannot keep ALL items pending
    if (bill.items && pendingItemIds.length === bill.items.length) {
      toast.error('Cannot keep all items pending — at least one item must be completed')
      return
    }

    const paymentTotal = validPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
    if (Math.abs(paymentTotal - payableAmount) > 0.01) {
      toast.error(
        `Payment total (${formatCurrency(paymentTotal)}) must equal bill total (${formatCurrency(payableAmount)})`
      )
      return
    }

    const payload = {
      payments: validPayments.map((p) => ({
        payment_mode: p.payment_mode,
        amount: parseFloat(p.amount),
        ...(p.upi_account_id ? { upi_account_id: p.upi_account_id } : {}),
      })),
      notes: notes || undefined,
    }

    if (pendingItemIds.length > 0) {
      payload.pending_item_ids = pendingItemIds
    }

    if (
      consumptionRequirements.length > 0 &&
      !isConsumptionComplete(consumptionRequirements, containerSelections)
    ) {
      toast.error('Select open bottles for all backbar products used by services')
      return
    }

    const containerSelectionsPayload = buildContainerSelections(containerSelections)
    if (containerSelectionsPayload.length > 0) {
      payload.container_selections = containerSelectionsPayload
    }

    completeMutation.mutate(payload)
  }

  if (!bill) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Complete Bill</DialogTitle>
          <p className="text-sm text-gray-500">
            {bill.bill_number} {bill.customer?.customer_name && `\u2022 ${bill.customer.customer_name}`}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Items with option to mark as pending */}
          {bill.items?.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Services
                <span className="font-normal text-muted-foreground ml-1">(check to mark as pending for later)</span>
              </Label>
              <div className="border rounded-lg divide-y max-h-48 overflow-auto">
                {bill.items.map((item) => {
                  const isPending = pendingItemIds.includes(item.item_id)
                  return (
                    <label
                      key={item.item_id}
                      className={`flex items-center gap-3 p-2.5 cursor-pointer hover:bg-gray-50 ${isPending ? 'bg-amber-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isPending}
                        onChange={() => handleTogglePendingItem(item.item_id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className={`text-sm flex-1 truncate ${isPending ? 'text-amber-700' : 'text-gray-700'}`}>
                        {item.item_name || item.service?.service_name || item.package?.package_name || item.product?.product_name || 'Item'}
                      </span>
                      <span className="text-sm text-gray-500 shrink-0">
                        {formatCurrency(item.total_price)}
                      </span>
                      {isPending && (
                        <Badge variant="warning" className="text-[10px] px-1.5 py-0">Pending</Badge>
                      )}
                    </label>
                  )
                })}
              </div>
              {pendingItemIds.length > 0 && (
                <p className="text-xs text-amber-600 mt-1.5">
                  {pendingItemIds.length} service{pendingItemIds.length > 1 ? 's' : ''} will remain pending — employee will be assigned when completed later. Full payment is still required.
                </p>
              )}
            </div>
          )}

          <ServiceConsumptionPicker
            billId={bill.bill_id}
            branchId={bill.branch?.branch_id || bill.branch_id}
            pendingItemIds={pendingItemIds}
            selections={containerSelections}
            onChange={setContainerSelections}
            enabled={open}
          />

          {/* Totals */}
          <div className="text-sm space-y-1 pt-1 border-t">
            {bill.subtotal != null && (
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(bill.subtotal)}</span>
              </div>
            )}
            {bill.discount_amount > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Discount</span>
                <span>-{formatCurrency(bill.discount_amount)}</span>
              </div>
            )}
            {(bill.taxable_subtotal ?? 0) > 0 && bill.tax_amount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Taxable value</span>
                <span>{formatCurrency(bill.taxable_subtotal)}</span>
              </div>
            )}
            {bill.tax_amount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>GST (CGST + SGST)</span>
                <span>{formatCurrency(bill.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-1">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(payableAmount)}</span>
            </div>
          </div>

          {/* Payments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Payment</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddPayment}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" /> Split
              </Button>
            </div>
            <div className="space-y-2">
              {payments.map((payment, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <div className="flex gap-1">
                    {PAYMENT_MODES.map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => handlePaymentChange(index, 'payment_mode', mode.value)}
                        className={`p-1.5 rounded border transition-colors ${
                          payment.payment_mode === mode.value
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        title={mode.label}
                      >
                        <mode.icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                  {payment.payment_mode === 'upi' && upiAccounts.length > 0 && (
                    <SearchableSelect
                      value={payment.upi_account_id || ''}
                      onChange={(val) => handlePaymentChange(index, 'upi_account_id', val)}
                      placeholder="UPI Acct"
                      options={upiAccounts.map(acc => ({ value: acc.account_id, label: acc.name }))}
                      triggerClassName="w-[100px]"
                    />
                  )}
                  <div className="flex-1 relative">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      value={payment.amount}
                      onChange={(e) => handlePaymentChange(index, 'amount', e.target.value)}
                      className="pr-14"
                    />
                    <button
                      type="button"
                      onClick={() => handleSetFullAmount(index)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary hover:underline"
                    >
                      Full
                    </button>
                  </div>
                  {payments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePayment(index)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {payments.length > 1 && (
              <div className="text-xs flex gap-4 mt-1">
                <span className="text-gray-500">Paid: {formatCurrency(totalPaid)}</span>
                {remaining !== 0 && (
                  <span className={remaining > 0 ? 'text-red-500' : 'text-green-500'}>
                    {remaining > 0 ? 'Remaining' : 'Excess'}: {formatCurrency(Math.abs(remaining))}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-medium mb-1 block">Notes (optional)</Label>
            <Input
              placeholder="Add notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={completeMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={completeMutation.isPending || Math.abs(totalPaid - payableAmount) > 0.01}
          >
            {completeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Complete Payment {formatCurrency(payableAmount)}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CompleteBillModal
