import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { maintenanceService } from '@/services/maintenance.service'
import { branchService } from '@/services/branch.service'
import MaintenanceModal from '@/components/modals/MaintenanceModal'

const STATUS_OPTIONS = [
  { value: 'sent', label: 'Sent' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready', label: 'Ready' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
]

const STATUS_BADGE = {
  sent: 'warning',
  in_progress: 'default',
  ready: 'success',
  returned: 'secondary',
  cancelled: 'destructive',
}

const STATUS_LABEL = {
  sent: 'Sent',
  in_progress: 'In Progress',
  ready: 'Ready',
  returned: 'Returned',
  cancelled: 'Cancelled',
}

const ITEM_TYPE_LABEL = {
  machine: 'Machine',
  equipment: 'Equipment',
  furniture: 'Furniture',
  other: 'Other',
}

export default function MaintenancePage() {
  const { user } = useSelector((state) => state.auth)
  const queryClient = useQueryClient()

  const isOwner = user?.role === 'owner' || user?.role === 'developer'
  const canManage = isOwner || user?.role === 'manager' || user?.role === 'cashier'

  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [filterBranch, setFilterBranch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  })
  const branches = branchesData?.data || []

  const queryParams = {
    page,
    page_size: pageSize,
    ...(filterBranch ? { branch_id: filterBranch } : {}),
    ...(filterStatus ? { status: filterStatus } : {}),
    ...(startDate ? { start_date: startDate } : {}),
    ...(endDate ? { end_date: endDate } : {}),
  }

  const { data: recordsData, isLoading } = useQuery({
    queryKey: ['maintenance-records', queryParams],
    queryFn: () => maintenanceService.getRecords(queryParams),
  })
  const records = recordsData?.data || []
  const totalPages = recordsData?.pagination?.total_pages || 1

  const deleteMutation = useMutation({
    mutationFn: (id) => maintenanceService.deleteRecord(id),
    onSuccess: () => {
      toast.success('Record deleted')
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] })
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to delete'),
  })

  const handleDelete = (record) => {
    if (window.confirm(`Delete maintenance record for "${record.item_name}"?`)) {
      deleteMutation.mutate(record.id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Track items sent for repair or servicing</p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditRecord(null); setModalOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Record
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            {isOwner && (
              <div>
                <Label className="text-xs">Branch</Label>
                <SearchableSelect
                  options={[{ value: 'all', label: 'All Branches' }, ...branches.map(b => ({ value: b.branch_id, label: b.name }))]}
                  value={filterBranch}
                  onChange={(val) => { setFilterBranch(val === 'all' ? '' : val); setPage(1) }}
                  placeholder="All branches"
                  triggerClassName="w-[160px]"
                />
              </div>
            )}
            <div>
              <Label className="text-xs">Status</Label>
                <SearchableSelect
                  options={[{ value: 'all', label: 'All Statuses' }, ...STATUS_OPTIONS]}
                  value={filterStatus}
                  onChange={(val) => { setFilterStatus(val === 'all' ? '' : val); setPage(1) }}
                  placeholder="All statuses"
                  triggerClassName="w-[150px]"
                />
            </div>
            <div>
              <Label className="text-xs">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                className="w-[150px]"
              />
            </div>
            <div>
              <Label className="text-xs">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                className="w-[150px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No maintenance records found</p>
              <p className="text-sm text-gray-400 mt-1">Add a record to start tracking items sent for repair</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Item Type</TableHead>
                  <TableHead>Vendor Name</TableHead>
                  <TableHead>Vendor Phone</TableHead>
                  <TableHead>Sent Date</TableHead>
                  <TableHead>Expected Return</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.item_name}</TableCell>
                    <TableCell>{ITEM_TYPE_LABEL[record.item_type] || record.item_type}</TableCell>
                    <TableCell>{record.vendor_name}</TableCell>
                    <TableCell>{record.vendor_phone || '—'}</TableCell>
                    <TableCell>{formatDate(record.sent_date)}</TableCell>
                    <TableCell>{formatDate(record.expected_return_date)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[record.status] || 'secondary'}>
                        {STATUS_LABEL[record.status] || record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {record.estimated_cost != null ? formatCurrency(record.estimated_cost) : '—'}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditRecord(record); setModalOpen(true) }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {isOwner && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => handleDelete(record)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <MaintenanceModal
        open={modalOpen}
        onOpenChange={(open) => { setModalOpen(open); if (!open) setEditRecord(null) }}
        editRecord={editRecord}
      />
    </div>
  )
}
