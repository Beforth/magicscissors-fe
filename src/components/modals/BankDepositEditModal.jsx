import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cashService } from '@/services/cash.service'
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
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function BankDepositEditModal({ open, onOpenChange, deposit = null }) {
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    bank_name: '',
    account_number: '',
    amount: '',
    reference_number: '',
    deposit_date: '',
    notes: '',
  })

  useEffect(() => {
    if (deposit) {
      setFormData({
        bank_name: deposit.bank_name || '',
        account_number: deposit.account_number || '',
        amount: deposit.amount?.toString() || '',
        reference_number: deposit.reference_number || '',
        deposit_date: deposit.deposit_date
          ? new Date(deposit.deposit_date).toISOString().split('T')[0]
          : '',
        notes: deposit.notes || '',
      })
    }
  }, [deposit, open])

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => cashService.updateDeposit(id, data),
    onSuccess: () => {
      toast.success('Bank deposit updated successfully')
      queryClient.invalidateQueries({ queryKey: ['bank-deposits'] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update deposit')
    },
  })

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!formData.bank_name.trim()) {
      toast.error('Bank name is required')
      return
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }

    updateMutation.mutate({
      id: deposit.id,
      data: {
        bank_name: formData.bank_name,
        account_number: formData.account_number || null,
        amount: parseFloat(formData.amount),
        reference_number: formData.reference_number || null,
        deposit_date: formData.deposit_date || null,
        notes: formData.notes || null,
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Edit Bank Deposit</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-bank-name">Bank Name *</Label>
            <Input
              id="edit-bank-name"
              value={formData.bank_name}
              onChange={(e) => handleChange('bank_name', e.target.value)}
              placeholder="e.g., State Bank of India"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-account-number">Account Number</Label>
            <Input
              id="edit-account-number"
              value={formData.account_number}
              onChange={(e) => handleChange('account_number', e.target.value)}
              placeholder="Enter account number"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount *</Label>
              <Input
                id="edit-amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-deposit-date">Deposit Date</Label>
              <Input
                id="edit-deposit-date"
                type="date"
                value={formData.deposit_date}
                onChange={(e) => handleChange('deposit_date', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-reference">Reference Number</Label>
            <Input
              id="edit-reference"
              value={formData.reference_number}
              onChange={(e) => handleChange('reference_number', e.target.value)}
              placeholder="Transaction reference"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-deposit-notes">Notes</Label>
            <Input
              id="edit-deposit-notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Deposit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default BankDepositEditModal
