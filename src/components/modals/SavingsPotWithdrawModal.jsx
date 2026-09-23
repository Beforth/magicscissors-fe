import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import { savingsPotService } from '@/services/savingsPot.service'

function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function SavingsPotWithdrawModal({ open, onOpenChange, pot }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    amount: '',
    person_name: '',
    reason: '',
    date: nowLocal(),
  })

  useEffect(() => {
    if (open) {
      setFormData({ amount: '', person_name: '', reason: '', date: nowLocal() })
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: (data) => savingsPotService.withdraw(pot.pot_id, data),
    onSuccess: () => {
      toast.success('Withdrawal recorded')
      queryClient.invalidateQueries({ queryKey: ['savings-pots'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  })

  const handleSubmit = () => {
    const amount = Number(formData.amount)
    if (!amount || amount <= 0) return toast.error('Enter a valid amount')
    if (pot && amount > pot.balance) return toast.error('Amount exceeds balance')
    if (!formData.person_name.trim()) return toast.error('Person name is required')
    mutation.mutate({ ...formData, amount })
  }

  if (!pot) return null

  const remaining = pot.balance - (Number(formData.amount) || 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Withdraw from {pot.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Current Balance</span>
              <span className="font-semibold">{formatCurrency(pot.balance)}</span>
            </div>
            {pot.account_number && (
              <div className="flex justify-between">
                <span className="text-gray-500">Pot Number</span>
                <span className="font-mono text-gray-700">{pot.account_number}</span>
              </div>
            )}
            {pot.maturity_date && (
              <div className="flex justify-between">
                <span className="text-gray-500">Maturity</span>
                <span>{new Date(pot.maturity_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
              </div>
            )}
            {formData.amount && (
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="text-gray-500">Remaining</span>
                <span className={remaining < 0 ? 'text-red-600 font-semibold' : 'font-semibold'}>{formatCurrency(Math.max(0, remaining))}</span>
              </div>
            )}
          </div>

          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="10000"
              max={pot.balance}
            />
          </div>
          <div>
            <Label>Person Name</Label>
            <Input
              value={formData.person_name}
              onChange={(e) => setFormData({ ...formData, person_name: e.target.value })}
              placeholder="Suresh"
            />
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Input
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Emergency expense"
            />
          </div>
          <div>
            <Label>Date & Time</Label>
            <Input
              type="datetime-local"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Withdraw
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
