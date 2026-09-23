import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { branchService } from '@/services/branch.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

const initialFormData = {
  name: '',
  code: '',
  color_code: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  phone: '',
  email: '',
  is_active: true,
  is_salon: true,
  is_warehouse: false,
  open_time: '',
  close_time: '',
  gstin: '',
  legal_business_name: '',
}

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export default function BranchFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = Boolean(id)

  const [formData, setFormData] = useState(initialFormData)

  const { data: branchResponse, isLoading: isLoadingBranch } = useQuery({
    queryKey: ['branch', id],
    queryFn: () => branchService.getBranchById(id),
    enabled: isEdit && !!id,
  })
  const branch = branchResponse?.data

  useEffect(() => {
    if (branch) {
      setFormData({
        name: branch.name || '',
        code: branch.code || '',
        color_code: branch.color_code || '',
        address: branch.address || '',
        city: branch.city || '',
        state: branch.state || '',
        pincode: branch.pincode || '',
        phone: branch.phone || '',
        email: branch.email || '',
        is_active: branch.is_active ?? true,
        is_salon: branch.is_salon ?? true,
        is_warehouse: branch.is_warehouse ?? false,
        open_time: branch.open_time || '',
        close_time: branch.close_time || '',
        gstin: branch.gstin || '',
        legal_business_name: branch.legal_business_name || '',
      })
    }
  }, [branch])

  const createMutation = useMutation({
    mutationFn: branchService.createBranch,
    onSuccess: () => {
      toast.success('Branch created successfully')
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      navigate('/branches')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create branch')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => branchService.updateBranch(id, data),
    onSuccess: () => {
      toast.success('Branch updated successfully')
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      navigate('/branches')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update branch')
    },
  })

  const isLoading = createMutation.isPending || updateMutation.isPending

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Branch name is required')
      return
    }

    if (!formData.code.trim()) {
      toast.error('Branch code is required')
      return
    }

    if (!formData.is_salon && !formData.is_warehouse) {
      toast.error('Branch must be at least one of: salon or warehouse')
      return
    }
    if (formData.open_time && !HHMM_RE.test(formData.open_time)) {
      toast.error('Open time must be HH:MM (24h)')
      return
    }
    if (formData.close_time && !HHMM_RE.test(formData.close_time)) {
      toast.error('Close time must be HH:MM (24h)')
      return
    }

    const data = {
      name: formData.name,
      code: formData.code.toUpperCase(),
      color_code: formData.color_code || null,
      address: formData.address || null,
      city: formData.city || null,
      state: formData.state || null,
      pincode: formData.pincode || null,
      phone: formData.phone || null,
      email: formData.email || null,
      is_active: formData.is_active,
      is_salon: formData.is_salon,
      is_warehouse: formData.is_warehouse,
      open_time: formData.open_time || null,
      close_time: formData.close_time || null,
      gstin: formData.gstin?.trim() || null,
      legal_business_name: formData.legal_business_name?.trim() || null,
    }

    if (isEdit) {
      updateMutation.mutate({ id: branch.branch_id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  if (isEdit && isLoadingBranch) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          to="/branches"
          className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to branches
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Branch' : 'Add New Branch'}
        </h1>
        {isEdit && branch?.name && (
          <p className="text-gray-500 mt-1">{branch.name}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Branch details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Branch Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Main Branch"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Branch Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                  placeholder="MAIN"
                  disabled={isEdit}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color_code">Branch Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="color_code"
                  value={formData.color_code || '#6366f1'}
                  onChange={(e) => handleChange('color_code', e.target.value)}
                  className="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0.5"
                />
                <Input
                  value={formData.color_code}
                  onChange={(e) => handleChange('color_code', e.target.value)}
                  placeholder="#0000FF"
                  className="w-28 font-mono text-sm"
                />
                {formData.color_code && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleChange('color_code', '')}
                    className="text-gray-400"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Street address"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
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
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  placeholder="State"
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="Phone number"
                />
              </div>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="legal_business_name">Legal Business Name</Label>
                <Input
                  id="legal_business_name"
                  value={formData.legal_business_name}
                  onChange={(e) => handleChange('legal_business_name', e.target.value)}
                  placeholder="Registered business name on GST"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gstin">GSTIN</Label>
                <Input
                  id="gstin"
                  value={formData.gstin}
                  onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
                  placeholder="15-character GSTIN"
                  maxLength={15}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="open_time">Open Time (HH:MM, IST)</Label>
                <Input
                  id="open_time"
                  type="time"
                  value={formData.open_time}
                  onChange={(e) => handleChange('open_time', e.target.value)}
                  placeholder="09:30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="close_time">Close Time (HH:MM, IST)</Label>
                <Input
                  id="close_time"
                  type="time"
                  value={formData.close_time}
                  onChange={(e) => handleChange('close_time', e.target.value)}
                  placeholder="02:00"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Close time can be earlier than open time to indicate a shop-day that crosses midnight
              (e.g. 09:30 → 02:00). Auto-checkout runs 10 minutes after close.
            </p>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs text-gray-500 uppercase tracking-wide">Branch Type</Label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_salon}
                    onChange={(e) => handleChange('is_salon', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span>Salon (takes bills, has chairs & staff)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_warehouse}
                    onChange={(e) => handleChange('is_warehouse', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span>Warehouse (receives purchases, transfers stock to salons)</span>
                </label>
              </div>
              <p className="text-xs text-gray-500">
                A branch can be one or both. Pure-warehouse branches don't need open/close hours or chairs.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => handleChange('is_active', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="font-normal">
                Branch is active
              </Label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/branches')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEdit ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
