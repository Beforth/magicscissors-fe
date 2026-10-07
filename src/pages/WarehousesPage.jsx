import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Pencil, MapPin, Loader2, Warehouse } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { branchService } from '@/services/branch.service'
import BranchModal from '@/components/modals/BranchModal'

export default function WarehousesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editBranch, setEditBranch] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['branches', { type: 'warehouse' }],
    queryFn: () => branchService.getBranches({ type: 'warehouse' }),
  })
  const warehouses = data?.data || []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Warehouses
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Warehouses receive purchases and transfer stock to salon branches. Each warehouse gets its own inventory location automatically. A branch can be both a warehouse and a salon — those will appear here too.
          </p>
        </div>
        <Button asChild>
          <Link to="/warehouses/new">
            Add Warehouse
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : warehouses.length === 0 ? (
            <p className="text-center text-gray-500 py-12">
              No warehouses yet.{' '}
              <Link to="/warehouses/new" className="text-primary hover:underline">
                Create your first warehouse
              </Link>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((b) => (
                  <TableRow key={b.branch_id}>
                    <TableCell className="font-medium">
                      {b.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-600">{b.code}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-800">Warehouse</span>
                        {b.is_salon && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">+ Salon</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {b.city ? `${b.city}${b.state ? `, ${b.state}` : ''}` : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {b.is_active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Active</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Inactive</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => { setEditBranch(b); setModalOpen(true) }}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editBranch && (
        <BranchModal
          open={modalOpen}
          onOpenChange={(open) => { setModalOpen(open); if (!open) setEditBranch(null) }}
          branch={editBranch}
        />
      )}
    </div>
  )
}
