import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { upiAccountService } from '@/services/upiAccount.service'
import { branchService } from '@/services/branch.service'

export default function UpiAccountModal({ open, onOpenChange, editAccount }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({ name: '', branch_id: '' })

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  })
  const branches = branchesData?.data || []

  useEffect(() => {
    if (editAccount) {
      setFormData({ name: editAccount.name || '', branch_id: editAccount.branch_id || '' })
    } else {
      setFormData({ name: '', branch_id: '' })
    }
  }, [editAccount, open])

  const mutation = useMutation({
    mutationFn: (data) =>
      editAccount ? upiAccountService.updateAccount(editAccount.account_id, data) : upiAccountService.createAccount(data),
    onSuccess: () => {
      toast.success(editAccount ? 'Account updated' : 'Account created')
      queryClient.invalidateQueries({ queryKey: ['upi-accounts'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  })

  const handleSubmit = () => {
    if (!formData.name.trim()) return toast.error('Name is required')
    mutation.mutate(formData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>{editAccount ? 'Edit UPI Account' : 'New UPI Account'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. K1"
            />
          </div>
          <div>
            <Label>Branch</Label>
            <SearchableSelect
              options={branches.map(b => ({ value: b.branch_id, label: b.name }))}
              value={formData.branch_id}
              onChange={(val) => setFormData({ ...formData, branch_id: val })}
              placeholder="Select branch"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editAccount ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
