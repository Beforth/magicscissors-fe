import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { serviceService } from '@/services/service.service'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ConfirmDialog from '@/components/modals/ConfirmDialog'

const KINDS = {
  service: {
    noun: 'service',
    title: 'Service categories',
    placeholder: 'e.g., Hair, Skin care, Nails',
    listKey: ['service-categories'],
    list: () => serviceService.getCategories(),
    create: serviceService.createCategory,
    update: serviceService.updateCategory,
    remove: serviceService.deleteCategory,
    count: (c) => c.services_count,
    invalidate: [['categories'], ['service-categories'], ['services']],
  },
  package: {
    noun: 'package',
    title: 'Package categories',
    placeholder: 'e.g., Bridal, Men, Monthly',
    listKey: ['package-categories'],
    list: () => serviceService.getPackageCategories(),
    create: serviceService.createPackageCategory,
    update: serviceService.updatePackageCategory,
    remove: serviceService.deletePackageCategory,
    count: (c) => c.packages_count,
    invalidate: [['package-categories'], ['packages']],
  },
}

const apiError = (e, fallback) => e.response?.data?.error?.message || fallback

/** List, add, rename, reorder and delete categories in one place (service or package categories). */
export default function CategoryManagerModal({ open, onOpenChange, kind = 'service' }) {
  const cfg = KINDS[kind]
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState(null) // { id, name, description, display_order }
  const [toDelete, setToDelete] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: cfg.listKey,
    queryFn: cfg.list,
    enabled: open,
  })
  const categories = data?.data || []

  const refresh = () => cfg.invalidate.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))

  const createMutation = useMutation({
    mutationFn: cfg.create,
    onSuccess: () => {
      toast.success('Category added')
      setNewName('')
      refresh()
    },
    onError: (e) => toast.error(apiError(e, 'Failed to add category')),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }) => cfg.update(id, body),
    onSuccess: () => {
      toast.success('Category updated')
      setEditing(null)
      refresh()
    },
    onError: (e) => toast.error(apiError(e, 'Failed to update category')),
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => cfg.remove(id),
    onSuccess: () => {
      toast.success('Category deleted')
      setToDelete(null)
      refresh()
    },
    onError: (e) => {
      toast.error(apiError(e, 'Failed to delete category'))
      setToDelete(null)
    },
  })

  const add = (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    createMutation.mutate({ name, display_order: categories.length })
  }

  const saveEdit = (e) => {
    e.preventDefault()
    if (!editing.name.trim()) return toast.error('Category name is required')
    updateMutation.mutate({
      id: editing.id,
      name: editing.name.trim(),
      description: editing.description?.trim() || null,
      display_order: parseInt(editing.display_order, 10) || 0,
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{cfg.title}</DialogTitle>
            <DialogDescription>Add, rename, reorder or delete. A category in use cannot be deleted until its {cfg.noun}s are moved.</DialogDescription>
          </DialogHeader>

          <form onSubmit={add} className="flex gap-2">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={cfg.placeholder}
              aria-label="New category name"
            />
            <Button type="submit" disabled={!newName.trim() || createMutation.isPending} className="shrink-0">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
              Add
            </Button>
          </form>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>}
            {!isLoading && categories.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No categories yet. Type a name above and press Enter.</p>
            )}
            {categories.map((c) => {
              const inUse = cfg.count(c) || 0
              if (editing?.id === c.category_id) {
                return (
                  <form key={c.category_id} onSubmit={saveEdit} className="space-y-3 rounded-lg border bg-secondary/40 p-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
                      <div className="space-y-1.5">
                        <Label htmlFor="cat-name">Name</Label>
                        <Input id="cat-name" autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cat-order">Order</Label>
                        <Input id="cat-order" type="number" min="0" value={editing.display_order} onChange={(e) => setEditing({ ...editing, display_order: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cat-desc">Description</Label>
                      <Input id="cat-desc" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Optional" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>
                        <X className="mr-1 h-4 w-4" /> Cancel
                      </Button>
                      <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                        Save
                      </Button>
                    </div>
                  </form>
                )
              }
              return (
                <div key={c.category_id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {inUse} {cfg.noun}{inUse === 1 ? '' : 's'}
                      {c.description ? ` · ${c.description}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${c.name}`}
                    onClick={() => setEditing({ id: c.category_id, name: c.name, description: c.description || '', display_order: String(c.display_order ?? 0) })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${c.name}`} onClick={() => setToDelete(c)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        variant="destructive"
        title={`Delete "${toDelete?.name}"?`}
        description={toDelete && cfg.count(toDelete) > 0 ? `${cfg.count(toDelete)} ${cfg.noun}(s) still use it, so it cannot be deleted.` : 'This category will be removed.'}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete.category_id)}
      />
    </>
  )
}
