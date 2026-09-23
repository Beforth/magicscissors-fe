import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { savingsPotService } from '@/services/savingsPot.service'
import { branchService } from '@/services/branch.service'

export default function SavingsPotPersonModal({ open, onOpenChange, editPerson }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    notes: '',
    branch_id: '',
  })

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  })
  const branches = branchesData?.data || []

  useEffect(() => {
    if (editPerson) {
      setFormData({
        name: editPerson.name || '',
        phone: editPerson.phone || '',
        notes: editPerson.notes || '',
        branch_id: editPerson.branch_id || '',
      })
    } else {
      setFormData({ name: '', phone: '', notes: '', branch_id: '' })
    }
  }, [editPerson, open])

  const mutation = useMutation({
    mutationFn: (data) =>
      editPerson ? savingsPotService.updatePerson(editPerson.id, data) : savingsPotService.createPerson(data),
    onSuccess: () => {
      toast.success(editPerson ? 'Person updated' : 'Person created')
      queryClient.invalidateQueries({ queryKey: ['savings-pot-persons'] })
      queryClient.invalidateQueries({ queryKey: ['savings-pots'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  })

  const handleSubmit = () => {
    if (!formData.name.trim()) return toast.error('Name is required')
    if (!editPerson && !formData.branch_id) return toast.error('Branch is required')

    const payload = { name: formData.name.trim() }
    if (!editPerson) payload.branch_id = formData.branch_id
    if (formData.phone.trim()) payload.phone = formData.phone.trim()
    if (formData.notes.trim()) payload.notes = formData.notes.trim()

    mutation.mutate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{editPerson ? 'Edit Person' : 'Add Person'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Person name"
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Phone number"
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes"
            />
          </div>
          {!editPerson && (
            <div>
              <Label>Branch *</Label>
              <SearchableSelect
                options={branches.map(b => ({ value: b.branch_id, label: b.name }))}
                value={formData.branch_id}
                onChange={(val) => setFormData({ ...formData, branch_id: val })}
                placeholder="Select branch"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editPerson ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
