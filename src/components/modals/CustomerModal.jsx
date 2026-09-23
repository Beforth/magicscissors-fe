import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { customerService } from '@/services/customer.service'
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
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const initialFormData = {
  customer_name: '',
  phone: '',
  email: '',
  gender: '',
  age_category: '',
  date_of_birth: '',
  address: '',
  city: '',
  pincode: '',
  notes: '',
}

function CustomerModal({ open, onOpenChange, customer = null, minimal = false, prefill = null, onCreated = null }) {
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const isEditing = !!customer
  const canSeePhone = ['owner', 'developer', 'manager'].includes(user?.role)

  const [formData, setFormData] = useState(initialFormData)

  useEffect(() => {
    if (customer) {
      setFormData({
        customer_name: customer.customer_name || '',
        phone: canSeePhone ? (customer.phone || '') : '',
        email: customer.email || '',
        gender: customer.gender || '',
        age_category: customer.age_category || '',
        date_of_birth: customer.date_of_birth
          ? new Date(customer.date_of_birth).toISOString().split('T')[0]
          : '',
        address: customer.address || '',
        city: customer.city || '',
        pincode: customer.pincode || '',
        notes: customer.notes || '',
      })
    } else {
      setFormData(prefill ? { ...initialFormData, ...prefill } : initialFormData)
    }
  }, [customer, open, prefill])

  const createMutation = useMutation({
    mutationFn: customerService.createCustomer,
    onSuccess: (response) => {
      toast.success('Customer created successfully')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      if (onCreated && response?.data) {
        onCreated(response.data)
      }
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create customer')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => customerService.updateCustomer(id, data),
    onSuccess: () => {
      toast.success('Customer updated successfully')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer', customer?.customer_id] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update customer')
    },
  })

  const isLoading = createMutation.isPending || updateMutation.isPending

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!formData.customer_name.trim()) {
      toast.error('Customer name is required')
      return
    }

    if (canSeePhone && !formData.phone.trim()) {
      toast.error('Phone number is required')
      return
    }

    const data = Object.fromEntries(
      Object.entries(formData).map(([key, value]) => [
        key,
        typeof value === 'string' && !value.trim() ? null : value,
      ])
    )

    // For non-privileged roles editing: don't send phone if left empty
    if (!canSeePhone && !data.phone) {
      delete data.phone
    }

    if (isEditing) {
      updateMutation.mutate({ id: customer.customer_id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Customer' : 'Add New Customer'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name & Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Name *</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => handleChange('customer_name', e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone {canSeePhone ? '*' : ''}</Label>
              <Input
                id="phone"
                type={canSeePhone ? 'text' : 'password'}
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder={canSeePhone ? '10 digit phone' : (isEditing ? 'Leave empty to keep unchanged' : '10 digit phone')}
              />
            </div>
          </div>

          {/* Gender (shown in both minimal and full mode) */}
          {minimal ? (
            <div className="space-y-2">
              <Label>Gender</Label>
              <SearchableSelect
                options={[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                  { value: 'other', label: 'Other' },
                ]}
                value={formData.gender}
                onChange={(value) => handleChange('gender', value)}
                placeholder="Select gender"
              />
            </div>
          ) : (
            <>
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="email@example.com"
                />
              </div>

              {/* Gender & Age Category */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <SearchableSelect
                    options={[
                      { value: 'male', label: 'Male' },
                      { value: 'female', label: 'Female' },
                      { value: 'other', label: 'Other' },
                    ]}
                    value={formData.gender}
                    onChange={(value) => handleChange('gender', value)}
                    placeholder="Select gender"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Age Category</Label>
                  <SearchableSelect
                    options={[
                      { value: 'child', label: 'Child' },
                      { value: 'teen', label: 'Teen' },
                      { value: 'young', label: 'Young' },
                      { value: 'middle', label: 'Middle' },
                      { value: 'old', label: 'Senior' },
                    ]}
                    value={formData.age_category}
                    onChange={(value) => handleChange('age_category', value)}
                    placeholder="Select age"
                  />
                </div>
              </div>

              {/* Date of Birth */}
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => handleChange('date_of_birth', e.target.value)}
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Street address"
                />
              </div>

              {/* City & Pincode */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) => handleChange('pincode', e.target.value)}
                    placeholder="Pincode"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Any additional notes"
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CustomerModal
