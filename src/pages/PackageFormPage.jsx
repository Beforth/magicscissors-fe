import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { serviceService } from '@/services/service.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2, Plus, Minus, Trash2, Package, Star, Search, Gift } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'

const initialFormData = {
  package_name: '',
  category_id: '',
  package_price: '',
  validity_days: '365',
  description: '',
  is_active: true,
  services: [], // [{ service_id, service_name, quantity, service_price, star_points }]
  service_groups: [], // [{ group_label, services: [{ service_id, service_name, quantity, service_price, star_points, bonus_services: [] }] }]
}

function ServiceSearchDropdown({ services, onSelect, label, placeholder = 'Search services...', compact = false }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return services
    const term = query.toLowerCase()
    return services.filter((s) => s.service_name.toLowerCase().includes(term))
  }, [services, query])

  // Group filtered results by category
  const groupedResults = useMemo(() => {
    const grouped = {}
    filtered.forEach((service) => {
      const cat = service.category?.category_name || 'Other'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(service)
    })
    return grouped
  }, [filtered])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={compact ? '' : 'space-y-2'}>
      {label && <Label>{label}</Label>}
      <div className="relative" ref={containerRef}>
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          className={compact ? 'pl-8 h-7 text-xs' : 'pl-9'}
        />
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-52 overflow-y-auto">
            {Object.keys(groupedResults).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-3">
                {query ? 'No matching services' : 'No services available'}
              </p>
            ) : (
              Object.entries(groupedResults).map(([category, categoryServices]) => (
                <div key={category}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                    {category}
                  </div>
                  {categoryServices.map((service) => (
                    <button
                      key={service.service_id}
                      type="button"
                      onClick={() => {
                        onSelect(service)
                        setQuery('')
                        setIsOpen(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 flex items-center justify-between"
                    >
                      <span>{service.service_name}</span>
                      <span className="text-xs text-gray-500 flex items-center gap-2">
                        {formatCurrency(service.price)}
                        {service.star_points > 0 && (
                          <span className="inline-flex items-center text-amber-600">
                            <Star className="h-3 w-3 fill-amber-400 stroke-amber-500 mr-0.5" />
                            {service.star_points}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function PackageFormPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = !!id
  const goBack = () => navigate('/packages')

  const { data: pkgData, isLoading: pkgLoading } = useQuery({
    queryKey: ['package', id],
    queryFn: () => serviceService.getPackageById(id),
    enabled: isEditing,
  })
  const pkg = isEditing ? pkgData?.data : null

  const [formData, setFormData] = useState(initialFormData)

  // Fetch all active services
  const { data: servicesData } = useQuery({
    queryKey: ['services', 'active'],
    queryFn: () => serviceService.getServices({ is_active: 'true' }),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['package-categories'],
    queryFn: () => serviceService.getPackageCategories(),
  })

  const services = servicesData?.data || []
  const packageCategories = categoriesData?.data || []

  // Calculate totals (standalone + one per OR group; individual = standalone + max per group)
  const totals = useMemo(() => {
    let individualPrice = formData.services.reduce((sum, s) => sum + (s.service_price * s.quantity), 0)
    let totalStars = formData.services.reduce((sum, s) => sum + ((s.star_points || 0) * s.quantity), 0)
    formData.service_groups.forEach((g) => {
      // Only parent option prices count (bonus services are free)
      const groupPrices = (g.services || []).map(s => (s.service_price || 0) * (s.quantity || 1))
      individualPrice += groupPrices.length ? Math.max(...groupPrices) : 0
      const groupStars = (g.services || []).map(s => ((s.star_points || 0)) * (s.quantity || 1))
      totalStars += groupStars.length ? Math.max(...groupStars) : 0
    })
    const packagePrice = formData.package_price ? parseFloat(formData.package_price) : null
    const savings = packagePrice != null ? individualPrice - packagePrice : 0
    const totalServices =
      formData.services.reduce((sum, s) => sum + s.quantity, 0) + formData.service_groups.length
    return { individualPrice, savings, totalServices, totalStars }
  }, [formData.services, formData.service_groups, formData.package_price])

  useEffect(() => {
    if (pkg) {
      setFormData({
        package_name: pkg.package_name || '',
        category_id: pkg.category_id || '',
        package_price: pkg.package_price?.toString() || '',
        validity_days: pkg.validity_days?.toString() || '365',
        description: pkg.description || '',
        is_active: pkg.is_active ?? true,
        services: pkg.services?.map(s => ({
          service_id: s.service_id,
          service_name: s.service_name,
          quantity: s.quantity,
          service_price: s.service_price,
          star_points: s.star_points || 0,
        })) || [],
        service_groups: pkg.service_groups?.map(g => ({
          group_label: g.group_label || '',
          services: (g.services || []).map(s => ({
            service_id: s.service_id,
            service_name: s.service_name,
            quantity: s.quantity,
            service_price: s.service_price,
            star_points: s.star_points || 0,
            bonus_services: (s.bonus_services || []).map(bs => ({
              service_id: bs.service_id,
              service_name: bs.service_name,
              quantity: bs.quantity || 1,
            })),
          })),
        })) || [],
      })
    } else {
      setFormData(initialFormData)
    }
  }, [pkg])

  const createMutation = useMutation({
    mutationFn: serviceService.createPackage,
    onSuccess: () => {
      toast.success('Package created successfully')
      queryClient.invalidateQueries({ queryKey: ['packages'] })
      goBack()
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create package')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => serviceService.updatePackage(id, data),
    onSuccess: () => {
      toast.success('Package updated successfully')
      queryClient.invalidateQueries({ queryKey: ['packages'] })
      goBack()
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update package')
    },
  })

  const isLoading = createMutation.isPending || updateMutation.isPending

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddService = (service) => {
    const existingIndex = formData.services.findIndex(s => s.service_id === service.service_id)
    if (existingIndex >= 0) {
      // Increment quantity
      const updatedServices = [...formData.services]
      updatedServices[existingIndex].quantity += 1
      handleChange('services', updatedServices)
    } else {
      handleChange('services', [
        ...formData.services,
        {
          service_id: service.service_id,
          service_name: service.service_name,
          quantity: 1,
          service_price: service.price,
          star_points: service.star_points || 0,
        }
      ])
    }
  }

  const handleUpdateQuantity = (index, delta) => {
    const updatedServices = [...formData.services]
    updatedServices[index].quantity = Math.max(1, updatedServices[index].quantity + delta)
    handleChange('services', updatedServices)
  }

  const handleUpdateServicePrice = (index, value) => {
    const num = parseFloat(value)
    if (Number.isNaN(num) || num < 0) return
    const updatedServices = [...formData.services]
    updatedServices[index].service_price = num
    handleChange('services', updatedServices)
  }

  const handleRemoveService = (index) => {
    handleChange('services', formData.services.filter((_, i) => i !== index))
  }

  // OR group handlers
  const handleAddGroup = () => {
    handleChange('service_groups', [
      ...formData.service_groups,
      { group_label: '', services: [] },
    ])
  }

  const handleRemoveGroup = (groupIndex) => {
    handleChange(
      'service_groups',
      formData.service_groups.filter((_, i) => i !== groupIndex)
    )
  }

  const handleUpdateGroupLabel = (groupIndex, value) => {
    const updated = [...formData.service_groups]
    updated[groupIndex] = { ...updated[groupIndex], group_label: value }
    handleChange('service_groups', updated)
  }

  const handleAddServiceToGroup = (groupIndex, service) => {
    const updated = [...formData.service_groups]
    const group = updated[groupIndex]
    const list = group.services || []
    const existing = list.find((s) => s.service_id === service.service_id)
    if (existing) {
      existing.quantity += 1
    } else {
      list.push({
        service_id: service.service_id,
        service_name: service.service_name,
        quantity: 1,
        service_price: service.price,
        star_points: service.star_points || 0,
        bonus_services: [],
      })
    }
    updated[groupIndex] = { ...group, services: [...list] }
    handleChange('service_groups', updated)
  }

  const handleRemoveServiceFromGroup = (groupIndex, serviceIndex) => {
    const updated = [...formData.service_groups]
    const list = (updated[groupIndex].services || []).filter((_, i) => i !== serviceIndex)
    updated[groupIndex] = { ...updated[groupIndex], services: list }
    handleChange('service_groups', updated)
  }

  const handleUpdateGroupServiceQuantity = (groupIndex, serviceIndex, delta) => {
    const updated = [...formData.service_groups]
    const list = [...(updated[groupIndex].services || [])]
    list[serviceIndex] = {
      ...list[serviceIndex],
      quantity: Math.max(1, (list[serviceIndex].quantity || 1) + delta),
    }
    updated[groupIndex] = { ...updated[groupIndex], services: list }
    handleChange('service_groups', updated)
  }

  const handleUpdateGroupServicePrice = (groupIndex, serviceIndex, value) => {
    const num = parseFloat(value)
    if (Number.isNaN(num) || num < 0) return
    const updated = [...formData.service_groups]
    const list = [...(updated[groupIndex].services || [])]
    list[serviceIndex] = { ...list[serviceIndex], service_price: num }
    updated[groupIndex] = { ...updated[groupIndex], services: list }
    handleChange('service_groups', updated)
  }

  // Bonus service handlers
  const handleAddBonusService = (groupIndex, serviceIndex, bonusService) => {
    const updated = [...formData.service_groups]
    const list = [...(updated[groupIndex].services || [])]
    const parentService = { ...list[serviceIndex] }
    const bonuses = [...(parentService.bonus_services || [])]
    // Don't add duplicate bonus
    if (bonuses.find((b) => b.service_id === bonusService.service_id)) {
      toast.error('This bonus service is already added')
      return
    }
    bonuses.push({
      service_id: bonusService.service_id,
      service_name: bonusService.service_name,
      quantity: 1,
    })
    parentService.bonus_services = bonuses
    list[serviceIndex] = parentService
    updated[groupIndex] = { ...updated[groupIndex], services: list }
    handleChange('service_groups', updated)
  }

  const handleRemoveBonusService = (groupIndex, serviceIndex, bonusIndex) => {
    const updated = [...formData.service_groups]
    const list = [...(updated[groupIndex].services || [])]
    const parentService = { ...list[serviceIndex] }
    parentService.bonus_services = (parentService.bonus_services || []).filter((_, i) => i !== bonusIndex)
    list[serviceIndex] = parentService
    updated[groupIndex] = { ...updated[groupIndex], services: list }
    handleChange('service_groups', updated)
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!formData.package_name.trim()) {
      toast.error('Package name is required')
      return
    }

    const priceVal = formData.package_price ? parseFloat(formData.package_price) : null
    if (priceVal !== null && (isNaN(priceVal) || priceVal < 0)) {
      toast.error('Package price must be zero or greater')
      return
    }

    // Services are optional for flat packages (name-only packages)

    const data = {
      package_name: formData.package_name.trim(),
      category_id: formData.category_id || null,
      package_price: priceVal,
      validity_days: parseInt(formData.validity_days, 10) || 365,
      description: formData.description?.trim() || null,
      is_active: !!formData.is_active,
      services: (formData.services || []).map((s) => ({
        service_id: s.service_id,
        quantity: Number(s.quantity) || 1,
        service_price: s.service_price != null ? Number(s.service_price) : null,
      })),
      service_groups: (formData.service_groups || [])
        .filter((g) => (g.services || []).length > 0)
        .map((g) => ({
          group_label: (g.group_label || '').trim() || 'Choose one',
          services: (g.services || []).flatMap((s) => {
            // Parent option service
            const parentEntry = {
              service_id: s.service_id,
              quantity: Number(s.quantity) || 1,
              service_price: s.service_price != null ? Number(s.service_price) : null,
              is_free: false,
            }
            // Bonus services linked to this parent
            const bonusEntries = (s.bonus_services || []).map((bs) => ({
              service_id: bs.service_id,
              quantity: Number(bs.quantity) || 1,
              service_price: 0,
              is_free: true,
              bonus_for_service_id: s.service_id,
            }))
            return [parentEntry, ...bonusEntries]
          }),
        })),
    }

    if (isEditing) {
      updateMutation.mutate({ id: pkg.package_id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  if (isEditing && pkgLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full">
      <div>
        <Link to="/packages" className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" />
          Back to packages
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Package className="h-6 w-6" />
          {isEditing ? 'Edit package' : 'Create package'}
        </h1>
        {isEditing && pkg?.package_name && <p className="mt-1 text-gray-500">{pkg.package_name}</p>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Package details</CardTitle>
        </CardHeader>
        <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Package Details */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="package_name">Package Name *</Label>
              <Input
                id="package_name"
                value={formData.package_name}
                onChange={(e) => handleChange('package_name', e.target.value)}
                placeholder="e.g., Bridal Package"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category_id">Category</Label>
              <select
                id="category_id"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.category_id}
                onChange={(e) => handleChange('category_id', e.target.value)}
              >
                <option value="">No Category</option>
                {packageCategories.map((cat) => (
                  <option key={cat.category_id} value={cat.category_id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="package_price">Package Price (₹)</Label>
              <Input
                id="package_price"
                type="number"
                min="0"
                value={formData.package_price}
                onChange={(e) => handleChange('package_price', e.target.value)}
                placeholder="Optional – uses sum of services if empty"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="validity_days">Validity (Days)</Label>
              <Input
                id="validity_days"
                type="number"
                min="1"
                value={formData.validity_days}
                onChange={(e) => handleChange('validity_days', e.target.value)}
                placeholder="365"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Package description"
              />
            </div>
          </div>

          {/* Service Selection - Search Dropdown */}
          <ServiceSearchDropdown
            services={services}
            onSelect={(service) => {
              handleAddService(service)
            }}
            label="Add Services"
            placeholder="Search and add services..."
          />

          {/* Selected Services (included in package) */}
          {formData.services.length > 0 && (
            <div className="space-y-2">
              <Label>Included Services ({formData.services.reduce((s, x) => s + x.quantity, 0)} services)</Label>
              <div className="border rounded-lg divide-y">
                {formData.services.map((service, index) => (
                  <div key={index} className="p-3 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{service.service_name}</p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(service.service_price)} × {service.quantity} = {formatCurrency(service.service_price * service.quantity)}
                        {service.star_points > 0 && (
                          <span className="inline-flex items-center ml-2 text-amber-600">
                            <Star className="h-3 w-3 fill-amber-400 stroke-amber-500 mr-0.5" />
                            {service.star_points * service.quantity} stars
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <Label className="text-xs text-gray-500">Price (₹)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-24 h-8 text-sm"
                          value={service.service_price}
                          onChange={(e) => handleUpdateServicePrice(index, e.target.value)}
                        />
                      </div>
                      <div className="flex items-center border rounded">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(index, -1)}
                          className="p-1 hover:bg-gray-100"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-2 text-sm">{service.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(index, 1)}
                          className="p-1 hover:bg-gray-100"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(index)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OR groups (choose one per group) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>OR Groups (customer chooses one service per group)</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddGroup}>
                <Plus className="h-4 w-4 mr-1" />
                Add group
              </Button>
            </div>
            {formData.service_groups.map((group, groupIndex) => (
              <div key={groupIndex} className="border rounded-lg p-3 space-y-2 bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="e.g. Hair Color / Beard Trim / Clean Shave"
                    value={group.group_label}
                    onChange={(e) => handleUpdateGroupLabel(groupIndex, e.target.value)}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveGroup(groupIndex)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <ServiceSearchDropdown
                  services={services}
                  onSelect={(service) => handleAddServiceToGroup(groupIndex, service)}
                  placeholder="Search and add services to group..."
                />
                {(group.services || []).length > 0 && (
                  <div className="divide-y border rounded bg-white">
                    {(group.services || []).map((s, sIdx) => (
                      <div key={sIdx} className="p-2 space-y-1.5">
                        {/* Parent option row */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium flex items-center gap-1.5">
                            {s.service_name}
                            {s.star_points > 0 && (
                              <span className="inline-flex items-center text-amber-600 text-xs font-normal">
                                <Star className="h-3 w-3 fill-amber-400 stroke-amber-500 mr-0.5" />
                                {s.star_points * (s.quantity || 1)}
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-20 h-7 text-xs"
                              value={s.service_price}
                              onChange={(e) => handleUpdateGroupServicePrice(groupIndex, sIdx, e.target.value)}
                            />
                            <div className="flex items-center border rounded">
                              <button
                                type="button"
                                onClick={() => handleUpdateGroupServiceQuantity(groupIndex, sIdx, -1)}
                                className="p-0.5 hover:bg-gray-100"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="px-1 text-xs">{s.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateGroupServiceQuantity(groupIndex, sIdx, 1)}
                                className="p-0.5 hover:bg-gray-100"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveServiceFromGroup(groupIndex, sIdx)}
                              className="p-0.5 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Bonus services for this option */}
                        {(s.bonus_services || []).length > 0 && (
                          <div className="ml-5 space-y-1">
                            {s.bonus_services.map((bs, bIdx) => (
                              <div key={bIdx} className="flex items-center justify-between gap-2 py-0.5 px-2 bg-green-50 rounded text-xs">
                                <span className="flex items-center gap-1.5 text-green-800">
                                  <Gift className="h-3 w-3" />
                                  {bs.service_name}
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0">Free</Badge>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBonusService(groupIndex, sIdx, bIdx)}
                                  className="p-0.5 text-red-500 hover:bg-red-100 rounded"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add bonus service picker */}
                        <div className="ml-5">
                          <ServiceSearchDropdown
                            services={services}
                            onSelect={(service) => handleAddBonusService(groupIndex, sIdx, service)}
                            placeholder="Add free bonus service..."
                            compact
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Summary */}
          {(formData.services.length > 0 || formData.service_groups.length > 0) && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Individual Price:</span>
                <span>{formatCurrency(totals.individualPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Package Price:</span>
                <span className="font-bold">
                  {formData.package_price ? formatCurrency(parseFloat(formData.package_price)) : '—'}
                </span>
              </div>
              {totals.savings > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Customer Savings:</span>
                  <span className="font-bold">{formatCurrency(totals.savings)}</span>
                </div>
              )}
              {totals.totalStars > 0 && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 stroke-amber-500" />
                    Total Stars:
                  </span>
                  <span className="font-bold">{totals.totalStars}</span>
                </div>
              )}
            </div>
          )}

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
              Package is active
            </Label>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Update Package' : 'Create Package'}
            </Button>
          </div>
        </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default PackageFormPage
