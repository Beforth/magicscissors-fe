import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { supplierService } from '@/services/supplier.service'
import SupplierModal from '@/components/modals/SupplierModal'

export default function SuppliersPage() {
  const { user } = useSelector((state) => state.auth)
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', { page, search, branch: user?.branchId }],
    queryFn: () => supplierService.getSuppliers({
      page,
      limit: 20,
      search: search || undefined,
      branch_id: user?.branchId || undefined,
    }),
  })
  const suppliers = data?.data || []
  const pagination = data?.pagination || {}

  const deleteMutation = useMutation({
    mutationFn: (id) => supplierService.deleteSupplier(id),
    onSuccess: () => {
      toast.success('Supplier deleted')
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage product suppliers</p>
        </div>
        <Button onClick={() => { setEditSupplier(null); setModalOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : suppliers.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No suppliers found</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-center">Batches</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((s) => (
                    <TableRow key={s.supplier_id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.phone || '—'}</TableCell>
                      <TableCell className="text-sm">{s.branch_name}</TableCell>
                      <TableCell className="text-right">
                        <span className={s.pending_amount > 0 ? 'text-red-600 font-semibold' : ''}>
                          {formatCurrency(s.pending_amount || 0)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{s.batch_count || 0}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setEditSupplier(s); setModalOpen(true) }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => {
                              if (window.confirm(`Delete "${s.name}"?`)) deleteMutation.mutate(s.supplier_id)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pagination.total_pages > 1 && (
                <div className="flex justify-between items-center px-4 py-3 border-t">
                  <span className="text-sm text-gray-500">Page {page} of {pagination.total_pages}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
                    <Button size="sm" variant="outline" disabled={page >= pagination.total_pages} onClick={() => setPage(page + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <SupplierModal
        open={modalOpen}
        onOpenChange={(open) => { setModalOpen(open); if (!open) setEditSupplier(null) }}
        editSupplier={editSupplier}
      />
    </div>
  )
}
