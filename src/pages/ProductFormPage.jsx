import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { productService } from '@/services/product.service'
import { skuService } from '@/services/sku.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

const emptyFormData = {
  sku_id: '',
  product_name: '',
  brand: '',
  category_id: '',
  barcode: '',
  sku: '',
  weight_value: '',
  weight_unit: 'ml',
  consumption_amount: '',
  consumption_unit: 'ml',
  mrp: '',
  selling_price: '',
  cost_price: '',
  product_type: 'retail',
  reorder_level: 10,
  tax_rate: '18',
  hsn_sac_code: '',
}

function productToFormData(product) {
  return {
    sku_id: product.sku_id || product.parent_sku?.id || '',
    product_name: product.product_name || '',
    brand: product.brand || '',
    category_id: product.category?.category_id || '',
    barcode: product.barcode || '',
    sku: product.sku || '',
    weight_value: product.weight_value ?? '',
    weight_unit: product.weight_unit || 'ml',
    consumption_amount: product.consumption_amount ?? product.weight_value ?? '',
    consumption_unit: product.consumption_unit || product.weight_unit || 'ml',
    mrp: product.mrp ?? '',
    selling_price: product.selling_price ?? '',
    cost_price: product.cost_price ?? '',
    product_type: product.product_type || 'retail',
    reorder_level: product.reorder_level ?? 10,
    tax_rate: String(product.tax_rate ?? 0),
    hsn_sac_code: product.hsn_sac_code || '',
  }
}

function buildSubmitPayload(formData, skus) {
  const parentSku = formData.sku_id ? skus.find((s) => s.id === formData.sku_id) : null
  return {
    ...formData,
    sku_id: formData.sku_id || null,
    brand: parentSku ? (parentSku.brand || null) : (formData.brand || null),
    category_id: parentSku
      ? (parentSku.category_id || parentSku.category?.id || null)
      : (formData.category_id || null),
    weight_value: formData.weight_value !== '' ? parseFloat(formData.weight_value) : null,
    weight_unit: formData.weight_unit || null,
    consumption_amount: formData.consumption_amount !== '' ? parseFloat(formData.consumption_amount) : null,
    consumption_unit: formData.consumption_unit || null,
    mrp: formData.mrp !== '' ? parseFloat(formData.mrp) : null,
    selling_price: formData.selling_price !== '' ? parseFloat(formData.selling_price) : null,
    cost_price: formData.cost_price !== '' ? parseFloat(formData.cost_price) : null,
    reorder_level: parseInt(formData.reorder_level, 10) || 10,
    tax_rate: formData.tax_rate !== '' ? parseFloat(formData.tax_rate) : 0,
    hsn_sac_code: formData.hsn_sac_code?.trim() || null,
    barcode: formData.barcode?.trim() ? formData.barcode.trim() : undefined,
    sku: formData.sku?.trim() ? formData.sku.trim() : undefined,
  }
}

export default function ProductFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const isEdit = Boolean(id)
  const isOwner = user?.role === 'owner' || user?.role === 'developer'
  const canManageProducts = ['owner', 'developer', 'manager', 'cashier'].includes(user?.role)

  const [formData, setFormData] = useState(emptyFormData)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (!user) return
    if (!canManageProducts) {
      toast.error(`You do not have permission to ${isEdit ? 'edit' : 'create'} products`)
      navigate('/products', { replace: true })
    }
  }, [user, isEdit, canManageProducts, navigate])

  const { data: productData, isLoading: loadingProduct } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productService.getProductById(id),
    enabled: isEdit && !!id,
  })
  const product = productData?.data || productData

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => productService.getCategories(),
  })

  const { data: skusData } = useQuery({
    queryKey: ['skus', { active: 'true' }],
    queryFn: () => skuService.getSkus({ active: 'true' }),
  })

  const categories = categoriesData?.data || []
  const skus = skusData?.data || []
  const parentSku = formData.sku_id ? skus.find((s) => s.id === formData.sku_id) : null

  useEffect(() => {
    if (product) {
      setFormData(productToFormData(product))
      setShowAdvanced(!!product.sku)
    }
  }, [product])

  const createMutation = useMutation({
    mutationFn: productService.createProduct,
    onSuccess: () => {
      toast.success('Product created successfully')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      navigate('/products')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create product')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ productId, data }) => productService.updateProduct(productId, data),
    onSuccess: () => {
      toast.success('Product updated successfully')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', id] })
      navigate('/products')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update product')
    },
  })

  const regenerateMutation = useMutation({
    mutationFn: productService.regenerateBarcode,
    onSuccess: (res) => {
      toast.success('Barcode regenerated')
      const newBarcode = res?.data?.barcode
      if (newBarcode) setFormData((prev) => ({ ...prev, barcode: newBarcode }))
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', id] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to regenerate barcode')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const submitData = buildSubmitPayload(formData, skus)
    if (isEdit) {
      updateMutation.mutate({ productId: id, data: submitData })
    } else {
      createMutation.mutate(submitData)
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending

  if (isEdit && loadingProduct) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full">
      <div>
        <Link
          to="/products"
          className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to products
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit product' : 'Add product'}
        </h1>
        {isEdit && product?.product_name && (
          <p className="text-gray-500 mt-1">{product.product_name}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Product details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Parent SKU</Label>
              <select
                className="w-full h-10 px-3 border rounded-md"
                value={formData.sku_id}
                onChange={(e) => setFormData({ ...formData, sku_id: e.target.value })}
              >
                <option value="">— None (standalone product) —</option>
                {skus.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.brand ? ` · ${s.brand}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Group variants under one SKU so they share name, brand, and category.
              </p>
            </div>

            {parentSku && (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-gray-600 space-y-0.5">
                <div><span className="font-medium text-gray-700">Brand:</span> {parentSku.brand || '—'}</div>
                <div><span className="font-medium text-gray-700">Category:</span> {parentSku.category?.name || '—'}</div>
                <div className="text-gray-400 pt-1">Inherited from SKU. Edit the SKU to change.</div>
              </div>
            )}

            <div>
              <Label>{parentSku ? 'Variant label *' : 'Product name *'}</Label>
              <Input
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                placeholder={parentSku ? 'e.g., 250ml' : 'Product name'}
                required
              />
            </div>

            {!parentSku && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Brand</Label>
                  <Input
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <select
                    className="w-full h-10 px-3 border rounded-md"
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.category_id} value={cat.category_id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Pack size (optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.weight_value}
                  onChange={(e) => setFormData({ ...formData, weight_value: e.target.value })}
                  placeholder="e.g., 250"
                />
              </div>
              <div>
                <Label>Pack unit</Label>
                <select
                  className="w-full h-10 px-3 border rounded-md"
                  value={formData.weight_unit}
                  onChange={(e) => setFormData({ ...formData, weight_unit: e.target.value })}
                >
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="piece">piece</option>
                </select>
              </div>
            </div>

            <div className="rounded-md border border-blue-100 bg-blue-50/40 p-3 space-y-3">
              <div>
                <Label className="text-blue-900">Usage per piece (for service recipes)</Label>
                <p className="text-xs text-blue-700/80 mt-0.5">
                  Stock is in pieces. When taken in use, this amount is available for recipes (e.g. 250 ml per bottle).
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Amount per piece</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.consumption_amount}
                    onChange={(e) => setFormData({ ...formData, consumption_amount: e.target.value })}
                    placeholder="e.g. 250"
                  />
                </div>
                <div>
                  <Label className="text-xs">Usage unit</Label>
                  <select
                    className="w-full h-10 px-3 border rounded-md bg-white"
                    value={formData.consumption_unit}
                    onChange={(e) => setFormData({ ...formData, consumption_unit: e.target.value })}
                  >
                    <option value="ml">ml</option>
                    <option value="L">L</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <Label>Barcode</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.barcode}
                  readOnly
                  placeholder={isEdit ? '' : 'Auto-generated on save'}
                  className="font-mono bg-gray-50"
                />
                {isEdit && isOwner && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Regenerate barcode"
                    onClick={() => {
                      if (window.confirm('Regenerate the barcode? Printed labels for this product will become invalid.')) {
                        regenerateMutation.mutate(id)
                      }
                    }}
                    disabled={regenerateMutation.isPending}
                  >
                    {regenerateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            {!showAdvanced ? (
              <button
                type="button"
                onClick={() => setShowAdvanced(true)}
                className="text-xs text-primary hover:underline"
              >
                Show advanced (legacy SKU code)
              </button>
            ) : (
              <div>
                <Label>Legacy SKU code</Label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>MRP</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.mrp}
                  onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                />
              </div>
              <div>
                <Label>Selling price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.selling_price}
                  onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                />
              </div>
              <div>
                <Label>Cost price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Product type *</Label>
                <select
                  className="w-full h-10 px-3 border rounded-md"
                  value={formData.product_type}
                  onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                  required
                >
                  <option value="retail">Retail (for sale)</option>
                  <option value="consumption">Consumption (internal use)</option>
                </select>
              </div>
              <div>
                <Label>Reorder level</Label>
                <Input
                  type="number"
                  value={formData.reorder_level}
                  onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                />
              </div>
              <div>
                <Label>GST rate (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                />
              </div>
              <div>
                <Label>HSN code</Label>
                <Input
                  value={formData.hsn_sac_code}
                  onChange={(e) => setFormData({ ...formData, hsn_sac_code: e.target.value })}
                  placeholder="e.g. 3305"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => navigate('/products')}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEdit ? 'Save changes' : 'Create product'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
