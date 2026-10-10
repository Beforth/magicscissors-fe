import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Warehouse } from 'lucide-react'
import { toast } from 'sonner'
import { branchService } from '@/services/branch.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
  gstin: '',
  legal_business_name: '',
  is_active: true,
}

export default function WarehouseCreatePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState(initialFormData)

  const createMutation = useMutation({
    mutationFn: branchService.createBranch,
    onSuccess: () => {
      toast.success('Warehouse created successfully')
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      navigate('/warehouses')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create warehouse')
    },
  })

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Warehouse name is required')
      return
    }
    if (!formData.code.trim()) {
      toast.error('Warehouse code is required')
      return
    }

    createMutation.mutate({
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      color_code: formData.color_code || null,
      address: formData.address?.trim() || null,
      city: formData.city?.trim() || null,
      state: formData.state?.trim() || null,
      pincode: formData.pincode?.trim() || null,
      phone: formData.phone?.trim() || null,
      email: formData.email?.trim() || null,
      gstin: formData.gstin?.trim() || null,
      legal_business_name: formData.legal_business_name?.trim() || null,
      is_active: formData.is_active,
      is_salon: false,
      is_warehouse: true,
      open_time: null,
      close_time: null,
    })
  }

  const isLoading = createMutation.isPending

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/warehouses')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Warehouse className="h-6 w-6 text-violet-600" />
            Add Warehouse
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create a central warehouse to receive purchases and transfer stock to salon branches.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic details</CardTitle>
            <CardDescription>Name and code identify this warehouse across purchases and transfers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Warehouse name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Central Warehouse"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Warehouse code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                  placeholder="WH-MAIN"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color_code">Label color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="color_code"
                  value={formData.color_code || '#7c3aed'}
                  onChange={(e) => handleChange('color_code', e.target.value)}
                  className="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0.5"
                />
                <Input
                  value={formData.color_code}
                  onChange={(e) => handleChange('color_code', e.target.value)}
                  placeholder="#7c3aed"
                  className="w-32 font-mono text-sm"
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location & contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>GST / invoice details</CardTitle>
            <CardDescription>Optional — used on purchase and transfer documents.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="legal_business_name">Legal business name</Label>
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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => handleChange('is_active', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm">Warehouse is active</span>
            </label>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3 pb-8">
          <Button type="button" variant="outline" onClick={() => navigate('/warehouses')} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create warehouse
          </Button>
        </div>
      </form>
    </div>
  )
}
