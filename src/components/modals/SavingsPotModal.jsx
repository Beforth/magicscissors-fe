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

export default function SavingsPotModal({ open, onOpenChange, editPot }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    name: '',
    account_number: '',
    target_amount: '',
    duration_months: '',
    start_date: '',
    person_id: '',
  })

  const { data: personsData } = useQuery({
    queryKey: ['savings-pot-persons'],
    queryFn: () => savingsPotService.getPersons(),
  })
  const persons = personsData?.data || []

  const selectedPerson = persons.find((p) => p.id === formData.person_id)

  useEffect(() => {
    if (editPot) {
      setFormData({
        name: editPot.name || '',
        account_number: editPot.account_number || '',
        target_amount: editPot.target_amount || '',
        duration_months: editPot.duration_months || '',
        start_date: editPot.start_date ? editPot.start_date.split('T')[0] : '',
        person_id: editPot.person_id || '',
      })
    } else {
      setFormData({ name: '', account_number: '', target_amount: '', duration_months: '', start_date: '', person_id: '' })
    }
  }, [editPot, open])

  const mutation = useMutation({
    mutationFn: (data) =>
      editPot ? savingsPotService.updatePot(editPot.pot_id, data) : savingsPotService.createPot(data),
    onSuccess: () => {
      toast.success(editPot ? 'Pot updated' : 'Pot created')
      queryClient.invalidateQueries({ queryKey: ['savings-pots'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  })

  const getMaturityDate = () => {
    if (!formData.start_date || !formData.duration_months) return ''
    const start = new Date(formData.start_date)
    start.setMonth(start.getMonth() + Number(formData.duration_months))
    return start.toISOString().split('T')[0]
  }

  const handleSubmit = () => {
    if (!formData.name.trim()) return toast.error('Name is required')
    if (!editPot && !formData.account_number.trim()) return toast.error('Account number is required')
    if (!editPot && !formData.person_id) return toast.error('Person is required')
    const payload = {
      name: formData.name,
      account_number: formData.account_number,
      target_amount: formData.target_amount ? Number(formData.target_amount) : undefined,
      duration_months: formData.duration_months ? Number(formData.duration_months) : undefined,
      start_date: formData.start_date,
      person_id: formData.person_id || null,
    }
    mutation.mutate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{editPot ? 'Edit Savings Pot' : 'New Savings Pot'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. FD Account 1"
            />
          </div>
          <div>
            <Label>Account Number {!editPot && '*'}</Label>
            <Input
              value={formData.account_number}
              onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
              placeholder="Enter account number"
            />
          </div>
          <div>
            <Label>Target Amount</Label>
            <Input
              type="number"
              value={formData.target_amount}
              onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
              placeholder="100000"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Duration (months)</Label>
              <Input
                type="number"
                value={formData.duration_months}
                onChange={(e) => setFormData({ ...formData, duration_months: e.target.value })}
                placeholder="12"
              />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
          </div>
          {getMaturityDate() && (
            <p className="text-sm text-gray-500">Maturity Date: <span className="font-medium">{getMaturityDate()}</span></p>
          )}
          <div>
            <Label>Person {!editPot && '*'}</Label>
            <SearchableSelect
              options={persons.map(p => ({ value: p.id, label: p.name + (p.branch_name ? ` (${p.branch_name})` : '') }))}
              value={formData.person_id}
              onChange={(val) => setFormData({ ...formData, person_id: val })}
              placeholder="Select person"
            />
            {selectedPerson?.branch_name && (
              <p className="text-xs text-gray-500 mt-1">Branch: {selectedPerson.branch_name}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editPot ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
