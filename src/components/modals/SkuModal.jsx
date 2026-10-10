import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { skuService } from '@/services/sku.service'
import { productService } from '@/services/product.service'

const initial = {
  code: '',
  name: '',
  brand: '',
  category_id: '',
  description: '',
}

function SkuModal({ open, onOpenChange, sku = null }) {
  const queryClient = useQueryClient()
  const isEditing = !!sku

  const [form, setForm] = useState(initial)

  useEffect(() => {
    if (sku) {
      setForm({
        code: sku.code || '',
        name: sku.name || '',
        brand: sku.brand || '',
        category_id: sku.category_id || '',
        description: sku.description || '',
      })
    } else {
      setForm({ ...initial })
    }
  }, [sku, open])

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => productService.getCategories(),
    enabled: open,
  })
  const categories = categoriesData?.data || []

  const createMutation = useMutation({
    mutationFn: skuService.createSku,
    onSuccess: () => {
      toast.success('SKU created')
      queryClient.invalidateQueries({ queryKey: ['skus'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to create SKU'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => skuService.updateSku(id, data),
    onSuccess: () => {
      toast.success('SKU updated')
      queryClient.invalidateQueries({ queryKey: ['skus'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to update SKU'),
  })

  const isLoading = createMutation.isPending || updateMutation.isPending

  const handleChange = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('SKU name is required')
      return
    }
    const payload = {
      code: form.code.trim() || undefined,
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      category_id: form.category_id || null,
      description: form.description.trim() || null,
    }
    if (isEditing) updateMutation.mutate({ id: sku.id, data: payload })
    else createMutation.mutate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit SKU' : 'Add New SKU'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Loreal Shampoo"
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={form.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
                placeholder="e.g., Loreal"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => handleChange('code', e.target.value)}
                placeholder="auto-generated"
                maxLength={50}
                disabled={isEditing}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category_id">Category</Label>
            <select
              id="category_id"
              className="w-full h-10 px-3 border rounded-md text-sm"
              value={form.category_id}
              onChange={(e) => handleChange('category_id', e.target.value)}
            >
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id || c.category_id} value={c.id || c.category_id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Optional"
              maxLength={1000}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
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

export default SkuModal
