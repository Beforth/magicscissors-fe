import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { serviceService } from '@/services/service.service'
import { skillService } from '@/services/skill.service'
import { productService } from '@/services/product.service'
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
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const initialFormData = {
  service_name: '',
  category_id: '',
  price: '',
  duration_minutes: '',
  star_points: '',
  description: '',
  is_multi_employee: false,
  employee_count: null,
  is_active: true,
  skill_ids: [],
  tax_rate: '18',
  hsn_sac_code: '',
}

function ServiceModal({ open, onOpenChange, service = null }) {
  const queryClient = useQueryClient()
  const isEditing = !!service

  const [formData, setFormData] = useState(initialFormData)
  const [recipes, setRecipes] = useState([])

  // When editing, fetch full service details so form has is_multi_employee, employee_count, etc.
  const { data: serviceDetailsResponse, isLoading: isLoadingServiceDetails } = useQuery({
    queryKey: ['service', service?.service_id],
    queryFn: () => serviceService.getServiceById(service.service_id),
    enabled: open && !!service?.service_id,
  })
  const serviceDetails = serviceDetailsResponse?.data

  // Use fetched details when editing (so type field is populated); otherwise use list item or null
  const serviceForForm = isEditing && serviceDetails ? serviceDetails : service

  // Fetch categories when modal is open
  const { data: categoriesData } = useQuery({
    queryKey: ['service-categories'],
    queryFn: () => serviceService.getCategories(),
    enabled: open,
  })

  const categories = categoriesData?.data || []

  // Skills picker — show all active skills.
  // (Original spec restricted this to employee-assigned skills, but the user
  //  relaxed the rule to make service setup easier. If a service ends up
  //  requiring a skill no employee has, allocation will leave the bill row
  //  unassigned and warn the cashier.)
  const { data: skillsData } = useQuery({
    queryKey: ['skills', { active: 'true' }],
    queryFn: () => skillService.getSkills({ active: 'true' }),
    enabled: open,
  })
  const availableSkills = skillsData?.data || []

  const { data: recipeProductsData } = useQuery({
    queryKey: ['products', { usable_in_recipes: true }],
    queryFn: () => productService.getProducts({ usable_in_recipes: 'true', is_active: 'true', limit: 500 }),
    enabled: open && isEditing,
  })
  const recipeProducts = recipeProductsData?.data || []

  const productUsageLabel = (p) => {
    const amt = p.consumption_amount ?? p.weight_value
    const unit = p.consumption_unit || p.weight_unit
    return amt ? ` (${amt} ${unit}/pc)` : ''
  }

  const toggleSkill = (skillId) => {
    setFormData((prev) => {
      const has = prev.skill_ids.includes(skillId)
      return {
        ...prev,
        skill_ids: has
          ? prev.skill_ids.filter((id) => id !== skillId)
          : [...prev.skill_ids, skillId],
      }
    })
  }

  useEffect(() => {
    if (serviceForForm) {
      setFormData({
        service_name: serviceForForm.service_name || '',
        category_id: serviceForForm.category?.category_id || '',
        price: serviceForForm.price?.toString() ?? '',
        duration_minutes: serviceForForm.duration_minutes?.toString() ?? '',
        star_points: serviceForForm.star_points?.toString() ?? '',
        description: serviceForForm.description || '',
        is_multi_employee: serviceForForm.is_multi_employee === true,
        employee_count: serviceForForm.employee_count ?? null,
        is_active: serviceForForm.is_active ?? true,
        skill_ids: (serviceForForm.skills || []).map((s) => s.id),
        tax_rate: String(serviceForForm.tax_rate ?? 0),
        hsn_sac_code: serviceForForm.hsn_sac_code || '',
      })
      setRecipes(
        (serviceForForm.recipes || []).map((r) => ({
          product_id: r.product_id,
          quantity: String(r.quantity),
          unit: r.unit || 'ml',
        }))
      )
    } else {
      setFormData({ ...initialFormData })
      setRecipes([])
    }
  }, [serviceForForm, open])

  const createMutation = useMutation({
    mutationFn: serviceService.createService,
    onSuccess: () => {
      toast.success('Service created successfully')
      queryClient.invalidateQueries({ queryKey: ['services'] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create service')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, recipePayload }) => {
      const updated = await serviceService.updateService(id, data)
      if (recipePayload) {
        await serviceService.replaceServiceRecipes(id, recipePayload)
      }
      return updated
    },
    onSuccess: () => {
      toast.success('Service updated successfully')
      queryClient.invalidateQueries({ queryKey: ['services'] })
      queryClient.invalidateQueries({ queryKey: ['service', service?.service_id] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update service')
    },
  })

  const isLoading = createMutation.isPending || updateMutation.isPending

  const addRecipeLine = () => {
    setRecipes((prev) => [...prev, { product_id: '', quantity: '', unit: 'ml' }])
  }

  const updateRecipeLine = (index, field, value) => {
    setRecipes((prev) => prev.map((line, i) => {
      if (i !== index) return line
      const next = { ...line, [field]: value }
      if (field === 'product_id' && value) {
        const product = recipeProducts.find((p) => p.product_id === value)
        if (product) {
          next.unit = product.consumption_unit || product.weight_unit || line.unit || 'ml'
        }
      }
      return next
    }))
  }

  const removeRecipeLine = (index) => {
    setRecipes((prev) => prev.filter((_, i) => i !== index))
  }

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!formData.service_name.trim()) {
      toast.error('Service name is required')
      return
    }

    if (!formData.price || parseFloat(formData.price) < 0) {
      toast.error('Valid price is required')
      return
    }

    if (formData.is_multi_employee && (!formData.employee_count || formData.employee_count < 2)) {
      toast.error('Number of employees must be at least 2 for multiple-employee services')
      return
    }

    const data = {
      service_name: formData.service_name,
      category_id: formData.category_id || null,
      price: parseFloat(formData.price),
      duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes, 10) : null,
      star_points: Math.max(0, parseInt(formData.star_points, 10) || 0) || 0,
      description: formData.description || null,
      is_multi_employee: !!(formData.is_multi_employee),
      employee_count: formData.is_multi_employee && formData.employee_count ? parseInt(formData.employee_count, 10) : null,
      is_active: formData.is_active,
      skill_ids: formData.skill_ids,
      tax_rate: formData.tax_rate !== '' ? parseFloat(formData.tax_rate) : 0,
      hsn_sac_code: formData.hsn_sac_code?.trim() || null,
    }

    const recipePayload = recipes
      .filter((r) => r.product_id && Number(r.quantity) > 0)
      .map((r) => ({
        product_id: r.product_id,
        quantity: Number(r.quantity),
        unit: r.unit || 'ml',
      }))

    if (isEditing) {
      updateMutation.mutate({ id: service.service_id, data, recipePayload })
    } else {
      createMutation.mutate(data)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Service' : 'Add New Service'}
          </DialogTitle>
        </DialogHeader>

        {isEditing && isLoadingServiceDetails ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Service Name */}
          <div className="space-y-2">
            <Label htmlFor="service_name">Service Name *</Label>
            <Input
              id="service_name"
              value={formData.service_name}
              onChange={(e) => handleChange('service_name', e.target.value)}
              placeholder="e.g., Haircut, Facial"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <SearchableSelect
              options={categories.map(cat => ({ value: cat.category_id, label: cat.name }))}
              value={formData.category_id}
              onChange={(value) => handleChange('category_id', value)}
              placeholder="Select category"
            />
          </div>

          {/* Price & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (₹) *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => handleChange('price', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_rate">GST Rate (%)</Label>
              <Input
                id="tax_rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.tax_rate}
                onChange={(e) => handleChange('tax_rate', e.target.value)}
                placeholder="18"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hsn_sac_code">SAC Code</Label>
              <Input
                id="hsn_sac_code"
                value={formData.hsn_sac_code}
                onChange={(e) => handleChange('hsn_sac_code', e.target.value)}
                placeholder="e.g. 996712"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration_minutes">Duration (mins)</Label>
              <Input
                id="duration_minutes"
                type="number"
                min="0"
                value={formData.duration_minutes}
                onChange={(e) => handleChange('duration_minutes', e.target.value)}
                placeholder="30"
              />
            </div>
          </div>

          {/* Star Points */}
          <div className="space-y-2">
            <Label htmlFor="star_points">Star Points</Label>
            <Input
              id="star_points"
              type="number"
              min="0"
              value={formData.star_points}
              onChange={(e) => handleChange('star_points', e.target.value)}
              placeholder="Points earned by customer"
            />
          </div>

          {/* Single vs Multiple Employee */}
          <div className="space-y-2">
            <Label>Employee Type</Label>
            <SearchableSelect
              options={[
                { value: 'single', label: 'Single employee (one staff does this service)' },
                { value: 'multiple', label: 'Multiple employees (can be done by multiple staff)' },
              ]}
              value={formData.is_multi_employee ? 'multiple' : 'single'}
              onChange={(value) => {
                const isMulti = value === 'multiple'
                handleChange('is_multi_employee', isMulti)
                if (!isMulti) handleChange('employee_count', null)
              }}
              placeholder="Select type"
            />
          </div>

          {formData.is_multi_employee && (
            <div className="space-y-2">
              <Label htmlFor="employee_count">Number of employees</Label>
              <Input
                id="employee_count"
                type="number"
                min={2}
                max={20}
                value={formData.employee_count ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  handleChange('employee_count', v === '' ? null : (parseInt(v, 10) || null))
                }}
                placeholder="e.g. 2"
              />
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Service description"
            />
          </div>

          {isEditing && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label>Service recipe (optional)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRecipeLine}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add product
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Optional — deduct from products in use when this service is completed. Amount uses each product&apos;s usage unit (ml, g, etc.).
              </p>
              {recipes.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No recipe — this service won&apos;t deduct products in use.</p>
              ) : (
                <div className="space-y-2">
                  {recipes.map((line, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Product</Label>
                        <SearchableSelect
                          options={recipeProducts.map(p => ({ value: p.product_id, label: `${p.product_name}${productUsageLabel(p)}` }))}
                          value={line.product_id}
                          onChange={(v) => updateRecipeLine(index, 'product_id', v)}
                          placeholder="Product"
                          triggerClassName="h-9"
                        />
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={line.quantity}
                          onChange={(e) => updateRecipeLine(index, 'quantity', e.target.value)}
                          placeholder="15"
                          className="h-9"
                        />
                      </div>
                      <div className="w-16 space-y-1">
                        <Label className="text-xs">Unit</Label>
                        <Input
                          value={line.unit}
                          onChange={(e) => updateRecipeLine(index, 'unit', e.target.value)}
                          placeholder="ml"
                          className="h-9"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => removeRecipeLine(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Required Skills */}
          <div className="space-y-2 pt-2 border-t">
            <Label>Required Skills</Label>
            <p className="text-xs text-gray-500">
              The system will auto-allocate the next available employee who has these skills. Leave empty for manual assignment only.
            </p>
            {availableSkills.length === 0 ? (
              <p className="text-xs text-gray-500 mt-2">
                No skills defined yet. Add some under{' '}
                <Link to="/skills" className="text-primary hover:underline" onClick={() => onOpenChange(false)}>
                  Catalog → Skills
                </Link>.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-2">
                {availableSkills.map((skill) => {
                  const selected = formData.skill_ids.includes(skill.id)
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => toggleSkill(skill.id)}
                      className={
                        selected
                          ? 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors'
                          : 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:border-primary hover:text-primary transition-colors'
                      }
                    >
                      {skill.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => handleChange('is_active', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="is_active" className="font-normal">
              Service is active
            </Label>
          </div>

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
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ServiceModal
