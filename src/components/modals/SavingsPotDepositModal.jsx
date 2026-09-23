import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatCurrency } from '@/lib/utils'
import { savingsPotService } from '@/services/savingsPot.service'

function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function SavingsPotDepositModal({ open, onOpenChange, allPots, persons, personId: initialPersonId, personName: initialPersonName }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    total_amount: '',
    person_name: '',
    person_id: '',
    date: nowLocal(),
    divide_equally: true,
    payment_mode: 'cash',
  })
  const [allocations, setAllocations] = useState([])

  // When modal opens, set person from props if provided
  useEffect(() => {
    if (open) {
      setFormData(prev => ({
        ...prev,
        total_amount: '',
        person_id: initialPersonId || '',
        person_name: initialPersonName || '',
        date: nowLocal(),
        divide_equally: true,
        payment_mode: 'cash',
      }))
    }
  }, [open, initialPersonId, initialPersonName])

  // Filter pots by selected person
  const filteredPots = useMemo(() => {
    if (!formData.person_id) return []
    return (allPots || []).filter((p) => p.person_id === formData.person_id && p.is_active)
  }, [allPots, formData.person_id])

  // Update allocations when filtered pots change
  useEffect(() => {
    setAllocations(filteredPots.map((p) => ({ savings_pot_id: p.pot_id, name: p.name, amount: '' })))
  }, [filteredPots])

  // When person changes via dropdown, auto-fill person_name
  const handlePersonChange = (personIdVal) => {
    const person = (persons || []).find((p) => p.id === personIdVal)
    setFormData(prev => ({
      ...prev,
      person_id: personIdVal,
      person_name: person?.name || '',
    }))
  }

  const equalShare = formData.total_amount && filteredPots.length > 0
    ? Math.round((Number(formData.total_amount) / filteredPots.length) * 100) / 100
    : 0

  const allocationsTotal = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)

  const mutation = useMutation({
    mutationFn: (data) => savingsPotService.deposit(data),
    onSuccess: () => {
      toast.success('Deposit recorded')
      queryClient.invalidateQueries({ queryKey: ['savings-pots'] })
      queryClient.invalidateQueries({ queryKey: ['savings-pot-persons'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  })

  const handleSubmit = () => {
    const amount = Number(formData.total_amount)
    if (!amount || amount <= 0) return toast.error('Enter a valid amount')
    if (!formData.person_id) return toast.error('Please select a person')
    if (!formData.person_name.trim()) return toast.error('Person name is required')
    if (filteredPots.length === 0) return toast.error('No active pots for this person')

    if (!formData.divide_equally) {
      if (Math.abs(allocationsTotal - amount) > 0.01) {
        return toast.error(`Allocations total (${formatCurrency(allocationsTotal)}) must equal total amount (${formatCurrency(amount)})`)
      }
    }

    const payload = {
      total_amount: amount,
      person_name: formData.person_name,
      date: formData.date,
      divide_equally: formData.divide_equally,
      payment_mode: formData.payment_mode,
      person_id: formData.person_id,
    }
    if (!formData.divide_equally) {
      payload.allocations = allocations
        .filter((a) => Number(a.amount) > 0)
        .map((a) => ({ savings_pot_id: a.savings_pot_id, amount: Number(a.amount) }))
    }
    mutation.mutate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Deposit to Savings Pots</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Person Selection */}
          <div>
            <Label>Person *</Label>
            <SearchableSelect
              options={(persons || []).map(p => ({ value: p.id, label: p.name }))}
              value={formData.person_id}
              onChange={handlePersonChange}
              placeholder="Select person"
              disabled={!!initialPersonId}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Total Amount *</Label>
              <Input
                type="number"
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                placeholder="1600"
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

          <div>
            <Label>Payment Mode</Label>
            <select
              className="w-full h-10 px-3 border rounded-md text-sm"
              value={formData.payment_mode}
              onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="divide_equally"
              checked={formData.divide_equally}
              onChange={(e) => setFormData({ ...formData, divide_equally: e.target.checked })}
              className="rounded border-gray-300"
            />
            <Label htmlFor="divide_equally" className="cursor-pointer">Divide equally among all pots</Label>
          </div>

          {/* Allocation Preview */}
          {formData.person_id && filteredPots.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Pot</th>
                    <th className="text-right px-3 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((alloc, i) => {
                    const potObj = (allPots || []).find((p) => p.pot_id === alloc.savings_pot_id)
                    return (
                      <tr key={alloc.savings_pot_id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900">{alloc.name}</div>
                          {potObj?.account_number && (
                            <div className="text-xs font-mono text-gray-500">
                              {potObj.account_number}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formData.divide_equally ? (
                            <span className="text-gray-600">{formatCurrency(equalShare)}</span>
                          ) : (
                            <Input
                              type="number"
                              value={alloc.amount}
                              onChange={(e) => {
                                const updated = [...allocations]
                                updated[i] = { ...updated[i], amount: e.target.value }
                                setAllocations(updated)
                              }}
                              className="w-28 text-right ml-auto"
                              placeholder="0"
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!formData.divide_equally && formData.total_amount && (
                <div className={`px-3 py-2 text-sm border-t ${Math.abs(allocationsTotal - Number(formData.total_amount)) > 0.01 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  Allocated: {formatCurrency(allocationsTotal)} / {formatCurrency(Number(formData.total_amount))}
                </div>
              )}
            </div>
          )}

          {formData.person_id && filteredPots.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">No active pots for this person.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending || filteredPots.length === 0}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Deposit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
