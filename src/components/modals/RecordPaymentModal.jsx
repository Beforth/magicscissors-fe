import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatCurrency } from '@/lib/utils'
import { purchaseBatchService } from '@/services/purchaseBatch.service'

export default function RecordPaymentModal({ open, onOpenChange, batch }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    amount: '',
    payment_mode: 'cash',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
  })

  useEffect(() => {
    if (open) {
      setFormData({
        amount: '',
        payment_mode: 'cash',
        payment_date: new Date().toISOString().split('T')[0],
        notes: '',
      })
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: (data) => purchaseBatchService.recordPayment(batch.batch_id, data),
    onSuccess: () => {
      toast.success('Payment recorded')
      queryClient.invalidateQueries({ queryKey: ['purchase-batch', batch.batch_id] })
      queryClient.invalidateQueries({ queryKey: ['purchase-batches'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  })

  const handleSubmit = () => {
    const amount = Number(formData.amount)
    if (!amount || amount <= 0) return toast.error('Enter a valid amount')
    if (batch && amount > batch.pending_amount) return toast.error('Amount exceeds pending balance')
    mutation.mutate({ ...formData, amount })
  }

  if (!batch) return null

  const pendingAmount = Number(batch.pending_amount) || 0
  const enteredAmount = Number(formData.amount) || 0
  const remainingAfterPayment = pendingAmount - enteredAmount
  const exceedsPending = enteredAmount > pendingAmount && formData.amount !== ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Pending amount</span>
              <span className="font-semibold text-red-600">{formatCurrency(pendingAmount)}</span>
            </div>
            {formData.amount !== '' && (
              <>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-500">Paying now</span>
                  <span className="font-medium">{formatCurrency(enteredAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    {exceedsPending ? 'Exceeds pending by' : 'Remaining after payment'}
                  </span>
                  <span
                    className={
                      exceedsPending
                        ? 'font-semibold text-red-600'
                        : remainingAfterPayment === 0
                          ? 'font-semibold text-green-600'
                          : 'font-semibold text-amber-700'
                    }
                  >
                    {formatCurrency(Math.abs(remainingAfterPayment))}
                  </span>
                </div>
              </>
            )}
          </div>
          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0"
            />
            {formData.amount === '' && (
              <p className="text-xs text-muted-foreground mt-1">
                Enter amount to see remaining balance
              </p>
            )}
          </div>
          <div>
            <Label>Payment Mode</Label>
            <SearchableSelect
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'upi', label: 'UPI' },
                { value: 'card', label: 'Card' },
                { value: 'online', label: 'Online' },
              ]}
              value={formData.payment_mode}
              onChange={(val) => setFormData({ ...formData, payment_mode: val })}
              placeholder="Select payment mode"
            />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={formData.payment_date} onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })} />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Second installment" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
