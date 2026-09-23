import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { serviceService } from '@/services/service.service'
import { skillService } from '@/services/skill.service'
import { productService } from '@/services/product.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
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

function serviceToFormData(service) {
  return {
    service_name: service.service_name || '',
    category_id: service.category?.category_id || '',
    price: service.price?.toString() ?? '',
    duration_minutes: service.duration_minutes?.toString() ?? '',
    star_points: service.star_points?.toString() ?? '',
    description: service.description || '',
    is_multi_employee: service.is_multi_employee === true,
    employee_count: service.employee_count ?? null,
    is_active: service.is_active ?? true,
    skill_ids: (service.skills || []).map((s) => s.id),
    tax_rate: String(service.tax_rate ?? 0),
    hsn_sac_code: service.hsn_sac_code || '',
  }
}

export default function ServiceFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = Boolean(id)

  const [formData, setFormData] = useState(initialFormData)
  const [recipes, setRecipes] = useState([])

  const { data: serviceDetailsResponse, isLoading: isLoadingServiceDetails } = useQuery({
    queryKey: ['service', id],
    queryFn: () => serviceService.getServiceById(id),
    enabled: isEdit && !!id,
  })
  const service = serviceDetailsResponse?.data

  const { data: categoriesData } = useQuery({
    queryKey: ['service-categories'],
    queryFn: () => serviceService.getCategories(),
  })
  const categories = categoriesData?.data || []

  const { data: skillsData } = useQuery({
    queryKey: ['skills', { active: 'true' }],
    queryFn: () => skillService.getSkills({ active: 'true' }),
  })
  const availableSkills = skillsData?.data || []

  const { data: recipeProductsData } = useQuery({
    queryKey: ['products', { usable_in_recipes: true }],
    queryFn: () => productService.getProducts({ usable_in_recipes: 'true', is_active: 'true', limit: 500 }),
  })
  const recipeProducts = recipeProductsData?.data || []

  useEffect(() => {
    if (service) {
      setFormData(serviceToFormData(service))
      setRecipes(
        (service.recipes || []).map((r) => ({
          product_id: r.product_id,
          quantity: String(r.quantity),
          unit: r.unit || 'ml',
        }))
      )
    }
  }, [service])

  const createMutation = useMutation({
    mutationFn: async ({ data, recipePayload }) => {
      const res = await serviceService.createService(data)
      const serviceId = res?.data?.data?.service_id || res?.data?.service_id
      if (recipePayload?.length > 0 && serviceId) {
        await serviceService.replaceServiceRecipes(serviceId, recipePayload)
      }
      return res
    },
    onSuccess: () => {
      toast.success('Service created successfully')
      queryClient.invalidateQueries({ queryKey: ['services'] })
      navigate('/services')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create service')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ serviceId, data, recipePayload }) => {
      const updated = await serviceService.updateService(serviceId, data)
      if (recipePayload) {
        await serviceService.replaceServiceRecipes(serviceId, recipePayload)
      }
      return updated
    },
    onSuccess: () => {
      toast.success('Service updated successfully')
      queryClient.invalidateQueries({ queryKey: ['services'] })
      queryClient.invalidateQueries({ queryKey: ['service', id] })
      navigate('/services')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update service')
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

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
          ? prev.skill_ids.filter((sid) => sid !== skillId)
          : [...prev.skill_ids, skillId],
      }
    })
  }

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
      is_multi_employee: !!formData.is_multi_employee,
      employee_count: formData.is_multi_employee && formData.employee_count
        ? parseInt(formData.employee_count, 10)
        : null,
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

    if (isEdit) {
      updateMutation.mutate({ serviceId: id, data, recipePayload })
    } else {
      createMutation.mutate({ data, recipePayload })
    }
  }

  if (isEdit && isLoadingServiceDetails) {
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
          to="/services"
          className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to services
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit service' : 'Add service'}
        </h1>
        {isEdit && service?.service_name && (
          <p className="text-gray-500 mt-1">{service.service_name}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Service details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service_name">Service Name *</Label>
              <Input
                id="service_name"
                value={formData.service_name}
                onChange={(e) => handleChange('service_name', e.target.value)}
                placeholder="e.g., Haircut, Facial"
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <SearchableSelect
                options={categories.map((cat) => ({ value: cat.category_id, label: cat.name }))}
                value={formData.category_id}
                onChange={(value) => handleChange('category_id', value)}
                placeholder="Select category"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Service description"
              />
            </div>

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
              {recipeProducts.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  No products with usage per piece yet. Set usage on a product under Inventory → Products, then add it here.
                </p>
              ) : recipes.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No recipe — this service won&apos;t deduct products in use.</p>
              ) : (
                <div className="space-y-2">
                  {recipes.map((line, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Product</Label>
                        <SearchableSelect
                          options={recipeProducts.map((p) => ({ value: p.product_id, label: `${p.product_name}${productUsageLabel(p)}` }))}
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

            <div className="space-y-2 pt-2 border-t">
              <Label>Required Skills</Label>
              <p className="text-xs text-gray-500">
                The system will auto-allocate the next available employee who has these skills. Leave empty for manual assignment only.
              </p>
              {availableSkills.length === 0 ? (
                <p className="text-xs text-gray-500 mt-2">
                  No skills defined yet. Add some under{' '}
                  <Link to="/skills" className="text-primary hover:underline">
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

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => navigate('/services')} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEdit ? 'Save changes' : 'Create service'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
