import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { inventoryService } from '@/services/inventory.service'
import { productService } from '@/services/product.service'
import { branchService } from '@/services/branch.service'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import BarcodeImage from '@/components/BarcodeImage'
import { printOpenBottleLabel, DEFAULT_LABEL_SIZE } from '@/lib/barcodePrint'

const emptyForm = { product_id: '', branch_id: '', notes: '' }

function usageLabel(p) {
  const amt = p.consumption_amount ?? p.weight_value
  const unit = p.consumption_unit || p.weight_unit
  return amt ? ` · ${amt} ${unit}/pc` : ''
}

function branchStockLabel(available) {
  if (available == null) return ''
  const n = Number(available) || 0
  return n === 1 ? '1 pc' : `${n} pcs`
}

export default function TakeInUseModal({
  open,
  onOpenChange,
  defaultBranchId = '',
  defaultProductId = '',
  onTaken,
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ ...emptyForm, branch_id: defaultBranchId })
  const [takenContainer, setTakenContainer] = useState(null)

  useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...prev,
        branch_id: defaultBranchId || prev.branch_id,
        product_id: defaultProductId || prev.product_id,
      }))
    }
  }, [open, defaultBranchId, defaultProductId])

  const { data: branchesData } = useQuery({
    queryKey: ['branches-active'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: open,
  })

  const { data: usableProductsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['products-usable-in-recipes', form.branch_id],
    queryFn: () => productService.getProducts({
      usable_in_recipes: 'true',
      is_active: 'true',
      branch_id: form.branch_id,
      limit: 500,
    }),
    enabled: open && !takenContainer && !!form.branch_id,
  })

  const branches = branchesData?.data || []
  const usableProducts = usableProductsData?.data || []

  const selectedProduct = useMemo(
    () => usableProducts.find((p) => p.product_id === form.product_id),
    [usableProducts, form.product_id]
  )

  const selectedAvailable = selectedProduct?.branch_available_stock ?? null
  const canTakeInUse = selectedAvailable != null && selectedAvailable > 0

  const takeInUseMutation = useMutation({
    mutationFn: inventoryService.openContainer,
    onSuccess: (res) => {
      const container = res?.data || res
      setTakenContainer(container)
      queryClient.invalidateQueries({ queryKey: ['open-containers'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['products-usable-in-recipes'] })
      onTaken?.(container)
      toast.success('Product taken in use — stick the label on the bottle')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to take product in use')
    },
  })

  const handleClose = (nextOpen) => {
    if (!nextOpen) {
      setTakenContainer(null)
      setForm({ ...emptyForm, branch_id: defaultBranchId })
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {takenContainer ? (
          <>
            <DialogHeader>
              <DialogTitle>Label for {takenContainer.product_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-gray-600">
                Stick this barcode on the bottle. Service recipes will deduct from this unit when you complete bills.
              </p>
              <div className="rounded-lg border bg-white p-4 flex flex-col items-center gap-2">
                <BarcodeImage value={takenContainer.barcode} className="w-full" />
                <p className="text-xs text-gray-500 font-mono">{takenContainer.barcode}</p>
                <p className="text-sm text-gray-600">
                  {takenContainer.remaining_volume} / {takenContainer.initial_volume} {takenContainer.volume_unit} available
                </p>
                {takenContainer.opened_at && (
                  <p className="text-xs text-gray-500">
                    In use since {new Date(takenContainer.opened_at).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  printOpenBottleLabel(takenContainer, DEFAULT_LABEL_SIZE).catch(() => {
                    toast.error('Failed to print label')
                  })
                }}
              >
                Print 50×25 label
              </Button>
              <Button type="button" onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Take product in use</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (!form.product_id || !form.branch_id) {
                  toast.error('Select product and branch')
                  return
                }
                if (!canTakeInUse) {
                  toast.error('No sealed stock at this branch for the selected product')
                  return
                }
                takeInUseMutation.mutate({
                  product_id: form.product_id,
                  branch_id: form.branch_id,
                  notes: form.notes || undefined,
                })
              }}
            >
              <p className="text-sm text-gray-500">
                Removes 1 piece from this branch&apos;s stock. Available pieces are shown per product below.
              </p>
              <div className="space-y-2">
                <Label>Branch</Label>
                <SearchableSelect
                  options={branches.map(b => ({ value: b.branch_id, label: b.name }))}
                  value={form.branch_id}
                  onChange={(v) => setForm({ ...form, branch_id: v, product_id: '' })}
                  placeholder="Select branch"
                />
              </div>
              <div className="space-y-2">
                <Label>Product</Label>
                {!form.branch_id ? (
                  <p className="text-sm text-gray-400 italic py-2">Select a branch first to see stock.</p>
                ) : loadingProducts ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading products…
                  </div>
                ) : (
                  <>
                    <SearchableSelect
                      options={usableProducts.map(p => {
                        const avail = p.branch_available_stock ?? 0
                        return { value: p.product_id, label: `${p.product_name}${usageLabel(p)} — ${branchStockLabel(avail)} at branch` }
                      })}
                      value={form.product_id}
                      onChange={(v) => setForm({ ...form, product_id: v })}
                      placeholder="Select product"
                    />
                    {selectedProduct && (
                      <div className={`rounded-md border px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                        canTakeInUse ? 'border-green-200 bg-green-50/60' : 'border-amber-200 bg-amber-50/60'
                      }`}>
                        <span className="text-gray-700">
                          <span className="font-medium">{selectedProduct.product_name}</span>
                          {' '}at this branch
                        </span>
                        <Badge variant={canTakeInUse ? 'secondary' : 'destructive'}>
                          {branchStockLabel(selectedAvailable)} available
                        </Badge>
                      </div>
                    )}
                    {!canTakeInUse && selectedProduct && (
                      <p className="text-xs text-amber-700">
                        No sealed stock here. Transfer from warehouse or adjust stock at this branch.
                      </p>
                    )}
                  </>
                )}
                {form.branch_id && usableProducts.length === 0 && !loadingProducts && (
                  <p className="text-xs text-amber-600">
                    No products with usage per piece set. Edit a product and add usage amount + unit (e.g. 250 ml per piece).
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g. Backbar shelf A"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
                <Button
                  type="submit"
                  disabled={takeInUseMutation.isPending || !form.branch_id || !form.product_id || !canTakeInUse}
                >
                  {takeInUseMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Take in use
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
