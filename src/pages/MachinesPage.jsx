import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { machineService } from '@/services/machine.service'
import { branchService } from '@/services/branch.service'

export default function MachinesPage() {
  const { user } = useSelector((state) => state.auth)
  const queryClient = useQueryClient()
  const isOwner = user?.role === 'owner' || user?.role === 'developer'

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filterBranch, setFilterBranch] = useState('all')
  const [form, setForm] = useState({ machine_no: '', branch_id: '', label: '', is_active: true })

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  })
  const branches = branchesData?.data || []

  const { data: machinesData, isLoading } = useQuery({
    queryKey: ['machines', filterBranch],
    queryFn: () => machineService.list(filterBranch !== 'all' ? { branch_id: filterBranch } : {}),
  })
  const machines = machinesData?.data || []

  const createMutation = useMutation({
    mutationFn: machineService.create,
    onSuccess: () => {
      toast.success('Machine registered')
      queryClient.invalidateQueries({ queryKey: ['machines'] })
      closeModal()
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed to register'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => machineService.update(id, data),
    onSuccess: () => {
      toast.success('Machine updated')
      queryClient.invalidateQueries({ queryKey: ['machines'] })
      closeModal()
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed to update'),
  })

  const deleteMutation = useMutation({
    mutationFn: machineService.remove,
    onSuccess: () => {
      toast.success('Machine deleted')
      queryClient.invalidateQueries({ queryKey: ['machines'] })
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed to delete'),
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ machine_no: '', branch_id: branches[0]?.branch_id || '', label: '', is_active: true })
    setModalOpen(true)
  }
  const openEdit = (m) => {
    setEditing(m)
    setForm({
      machine_no: m.machine_no,
      branch_id: m.branch_id,
      label: m.label || '',
      is_active: m.is_active,
    })
    setModalOpen(true)
  }
  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.machine_no.trim()) return toast.error('Machine number required')
    if (!form.branch_id) return toast.error('Branch required')

    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        data: { branch_id: form.branch_id, label: form.label || null, is_active: form.is_active },
      })
    } else {
      createMutation.mutate({
        machine_no: form.machine_no.trim(),
        branch_id: form.branch_id,
        label: form.label || null,
      })
    }
  }

  const handleDelete = (m) => {
    if (!confirm(`Delete machine ${m.machine_no}? Existing punches remain as orphans.`)) return
    deleteMutation.mutate(m.id)
  }

  const isBusy = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Punch Machines</h1>
          <p className="text-gray-500">
            Register attendance machines. Each machine is tied to one branch; punches from it attribute to that branch.
          </p>
        </div>
        {isOwner && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Register Machine
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 max-w-sm">
              <Label className="text-xs font-medium text-gray-700 mb-1.5 block">Branch</Label>
              <SearchableSelect
                options={[{ value: 'all', label: 'All branches' }, ...branches.map(b => ({ value: b.branch_id, label: b.name }))]}
                value={filterBranch}
                onChange={setFilterBranch}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Machines Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Machine List
            <Badge variant="secondary" className="ml-2">
              {machines.length} total
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : machines.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No machines registered yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Machine No</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  {isOwner && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {machines.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono">{m.machine_no}</TableCell>
                    <TableCell>{m.branch?.name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{m.label || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={m.is_active ? 'success' : 'secondary'}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(m)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit machine' : 'Register machine'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="machine_no">Machine Number *</Label>
              <Input
                id="machine_no"
                value={form.machine_no}
                onChange={(e) => setForm({ ...form, machine_no: e.target.value })}
                placeholder="M-001"
                disabled={!!editing}
              />
              {editing && (
                <p className="text-xs text-muted-foreground">Machine number cannot be changed after registration.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Branch *</Label>
              <SearchableSelect
                options={branches.map(b => ({ value: b.branch_id, label: b.name }))}
                value={form.branch_id}
                onChange={(v) => setForm({ ...form, branch_id: v })}
                placeholder="Select branch"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Reception bio-metric"
              />
            </div>

            {editing && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="is_active" className="font-normal">
                  Machine is active
                </Label>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal} disabled={isBusy}>
                Cancel
              </Button>
              <Button type="submit" disabled={isBusy}>
                {isBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? 'Update' : 'Register'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
