import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { counterWithdrawalService } from '@/services/savingsPot.service'
import { branchService } from '@/services/branch.service'

export default function CounterWithdrawalModal({ open, onOpenChange, editItem }) {
  const { user } = useSelector((state) => state.auth)
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    branch_id: '',
    amount: '',
    person_name: '',
    reason: '',
    withdraw_date: new Date().toISOString().split('T')[0],
  })

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  })
  const branches = branchesData?.data || []

  useEffect(() => {
    if (editItem) {
      setFormData({
        branch_id: editItem.branch_id || '',
        amount: editItem.amount || '',
        person_name: editItem.person_name || '',
        reason: editItem.reason || '',
        withdraw_date: editItem.withdraw_date ? editItem.withdraw_date.split('T')[0] : new Date().toISOString().split('T')[0],
      })
    } else {
      setFormData({
        branch_id: user?.branchId || '',
        amount: '',
        person_name: '',
        reason: '',
        withdraw_date: new Date().toISOString().split('T')[0],
      })
    }
  }, [editItem, open, user])

  const mutation = useMutation({
    mutationFn: (data) =>
      editItem ? counterWithdrawalService.update(editItem.id, data) : counterWithdrawalService.create(data),
    onSuccess: async () => {
      toast.success(editItem ? 'Updated' : 'Withdrawal recorded')
      await queryClient.invalidateQueries({ queryKey: ['counter-withdrawals'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  })

  const handleSubmit = () => {
    if (!formData.amount || Number(formData.amount) <= 0) return toast.error('Enter a valid amount')
    if (!formData.person_name.trim()) return toast.error('Person name is required')
    mutation.mutate({ ...formData, amount: Number(formData.amount) })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit Withdrawal' : 'Record Counter Withdrawal'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Branch</Label>
            <SearchableSelect
              options={branches.map(b => ({ value: b.branch_id, label: b.name }))}
              value={formData.branch_id}
              onChange={(val) => setFormData({ ...formData, branch_id: val })}
              placeholder="Select branch"
            />
          </div>
          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="5000"
            />
          </div>
          <div>
            <Label>Person Name</Label>
            <Input
              value={formData.person_name}
              onChange={(e) => setFormData({ ...formData, person_name: e.target.value })}
              placeholder="Owner Name"
            />
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Input
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Cash pickup"
            />
          </div>
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={formData.withdraw_date}
              onChange={(e) => setFormData({ ...formData, withdraw_date: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editItem ? 'Update' : 'Record'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
