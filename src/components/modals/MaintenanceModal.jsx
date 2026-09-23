import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { maintenanceService } from '@/services/maintenance.service'
import { branchService } from '@/services/branch.service'

const ITEM_TYPES = [
  { value: 'machine', label: 'Machine' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'other', label: 'Other' },
]

const STATUSES = [
  { value: 'sent', label: 'Sent' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready', label: 'Ready' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
]

const initialFormData = {
  item_name: '',
  item_description: '',
  item_type: 'equipment',
  vendor_name: '',
  vendor_phone: '',
  vendor_address: '',
  sent_date: new Date().toISOString().split('T')[0],
  expected_return_date: '',
  estimated_cost: '',
  actual_cost: '',
  actual_return_date: '',
  status: 'sent',
  notes: '',
  branch_id: '',
}

export default function MaintenanceModal({ open, onOpenChange, editRecord }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState(initialFormData)

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  })
  const branches = branchesData?.data || []

  useEffect(() => {
    if (editRecord) {
      setFormData({
        item_name: editRecord.item_name || '',
        item_description: editRecord.item_description || '',
        item_type: editRecord.item_type || 'equipment',
        vendor_name: editRecord.vendor_name || '',
        vendor_phone: editRecord.vendor_phone || '',
        vendor_address: editRecord.vendor_address || '',
        sent_date: editRecord.sent_date ? editRecord.sent_date.split('T')[0] : '',
        expected_return_date: editRecord.expected_return_date ? editRecord.expected_return_date.split('T')[0] : '',
        estimated_cost: editRecord.estimated_cost ?? '',
        actual_cost: editRecord.actual_cost ?? '',
        actual_return_date: editRecord.actual_return_date ? editRecord.actual_return_date.split('T')[0] : '',
        status: editRecord.status || 'sent',
        notes: editRecord.notes || '',
        branch_id: editRecord.branch_id || '',
      })
    } else {
      setFormData(initialFormData)
    }
  }, [editRecord, open])

  const mutation = useMutation({
    mutationFn: (data) =>
      editRecord
        ? maintenanceService.updateRecord(editRecord.id, data)
        : maintenanceService.createRecord(data),
    onSuccess: () => {
      toast.success(editRecord ? 'Record updated' : 'Record created')
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  })

  const handleSubmit = () => {
    if (!formData.item_name.trim()) return toast.error('Item name is required')
    if (!formData.vendor_name.trim()) return toast.error('Vendor name is required')
    if (!formData.sent_date) return toast.error('Sent date is required')
    if (!formData.branch_id) return toast.error('Branch is required')

    const payload = {
      ...formData,
      estimated_cost: formData.estimated_cost !== '' ? Number(formData.estimated_cost) : null,
      actual_cost: formData.actual_cost !== '' ? Number(formData.actual_cost) : null,
      expected_return_date: formData.expected_return_date || null,
      actual_return_date: formData.actual_return_date || null,
    }
    mutation.mutate(payload)
  }

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{editRecord ? 'Edit Maintenance Record' : 'New Maintenance Record'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
          {/* Item Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Item Name *</Label>
              <Input
                value={formData.item_name}
                onChange={(e) => handleChange('item_name', e.target.value)}
                placeholder="e.g. Hair Dryer"
              />
            </div>
            <div>
              <Label>Item Type</Label>
              <SearchableSelect
                options={ITEM_TYPES.map(t => ({ value: t.value, label: t.label }))}
                value={formData.item_type}
                onChange={(val) => handleChange('item_type', val)}
                placeholder="Select type"
              />
            </div>
          </div>
          <div>
            <Label>Item Description</Label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.item_description}
              onChange={(e) => handleChange('item_description', e.target.value)}
              placeholder="Description of the item..."
              rows={2}
            />
          </div>

          {/* Vendor Details */}
          <div className="border-t pt-3">
            <p className="text-sm font-medium text-gray-500 mb-3">Vendor Details</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vendor Name *</Label>
                <Input
                  value={formData.vendor_name}
                  onChange={(e) => handleChange('vendor_name', e.target.value)}
                  placeholder="e.g. ABC Repairs"
                />
              </div>
              <div>
                <Label>Vendor Phone</Label>
                <Input
                  value={formData.vendor_phone}
                  onChange={(e) => handleChange('vendor_phone', e.target.value)}
                  placeholder="Phone number"
                />
              </div>
            </div>
            <div className="mt-3">
              <Label>Vendor Address</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.vendor_address}
                onChange={(e) => handleChange('vendor_address', e.target.value)}
                placeholder="Vendor address..."
                rows={2}
              />
            </div>
          </div>

          {/* Dates & Cost */}
          <div className="border-t pt-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sent Date *</Label>
                <Input
                  type="date"
                  value={formData.sent_date}
                  onChange={(e) => handleChange('sent_date', e.target.value)}
                />
              </div>
              <div>
                <Label>Expected Return Date</Label>
                <Input
                  type="date"
                  value={formData.expected_return_date}
                  onChange={(e) => handleChange('expected_return_date', e.target.value)}
                />
              </div>
              <div>
                <Label>Estimated Cost</Label>
                <Input
                  type="number"
                  value={formData.estimated_cost}
                  onChange={(e) => handleChange('estimated_cost', e.target.value)}
                  placeholder="0"
                />
              </div>
              {editRecord && (
                <div>
                  <Label>Actual Cost</Label>
                  <Input
                    type="number"
                    value={formData.actual_cost}
                    onChange={(e) => handleChange('actual_cost', e.target.value)}
                    placeholder="0"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Status & Return (edit only) */}
          {editRecord && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <SearchableSelect
                  options={STATUSES.map(s => ({ value: s.value, label: s.label }))}
                  value={formData.status}
                  onChange={(val) => handleChange('status', val)}
                  placeholder="Select status"
                />
              </div>
              <div>
                <Label>Actual Return Date</Label>
                <Input
                  type="date"
                  value={formData.actual_return_date}
                  onChange={(e) => handleChange('actual_return_date', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Notes & Branch */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Branch *</Label>
              <SearchableSelect
                options={branches.map(b => ({ value: b.branch_id, label: b.name }))}
                value={formData.branch_id}
                onChange={(val) => handleChange('branch_id', val)}
                placeholder="Select branch"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editRecord ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
