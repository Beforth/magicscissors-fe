import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { counterWithdrawalService } from '@/services/savingsPot.service'
import { branchService } from '@/services/branch.service'
import CounterWithdrawalModal from '@/components/modals/CounterWithdrawalModal'
import { BranchColorDot } from '@/components/ui/branch-color-dot'

export default function CounterWithdrawalsPage() {
  const { user } = useSelector((state) => state.auth)
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedBranch, setSelectedBranch] = useState(user?.branchId || '')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  })
  const branches = branchesData?.data || []

  const { data, isLoading } = useQuery({
    queryKey: ['counter-withdrawals', { page, selectedBranch, startDate, endDate }],
    queryFn: () => counterWithdrawalService.getAll({
      page,
      limit: 20,
      branch_id: selectedBranch || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    }),
  })
  const withdrawals = data?.data || []
  const summary = data?.meta?.summary || {}
  const pagination = data?.pagination || {}

  const deleteMutation = useMutation({
    mutationFn: (id) => counterWithdrawalService.delete(id),
    onSuccess: () => {
      toast.success('Withdrawal deleted')
      queryClient.invalidateQueries({ queryKey: ['counter-withdrawals'] })
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to delete'),
  })

  const handleDelete = (item) => {
    if (window.confirm('Delete this withdrawal?')) {
      deleteMutation.mutate(item.id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Counter Withdrawals</h1>
          <p className="text-sm text-gray-500 mt-1">Track cash withdrawals from the counter</p>
        </div>
        <Button onClick={() => { setEditItem(null); setModalOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Record Withdrawal
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">Branch</Label>
              <SearchableSelect
                options={[{ value: 'all', label: 'All Branches' }, ...branches.map(b => ({ value: b.branch_id, label: b.name }))]}
                value={selectedBranch}
                onChange={(val) => { setSelectedBranch(val === 'all' ? '' : val); setPage(1) }}
                placeholder="All branches"
                triggerClassName="w-[180px]"
              />
            </div>
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1) }} className="w-[150px]" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1) }} className="w-[150px]" />
            </div>
            {(startDate || endDate) && (
              <Button variant="ghost" size="sm" onClick={() => { setStartDate(''); setEndDate(''); setPage(1) }}>Clear</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : withdrawals.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No withdrawals found</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Person</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDate(item.withdraw_date)}</TableCell>
                      <TableCell className="font-medium">{item.person_name}</TableCell>
                      <TableCell className="text-gray-500">{item.reason || '—'}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5">
                          <BranchColorDot color={item.branch_color_code} />
                          {item.branch_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(item.amount)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setEditItem(item); setModalOpen(true) }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(item)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Summary + Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-sm font-medium">
                  Total: <span className="text-primary">{formatCurrency(summary.total_amount || 0)}</span>
                </div>
                {pagination.total_pages > 1 && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
                    <span className="text-sm text-gray-500 px-2 self-center">Page {page} of {pagination.total_pages}</span>
                    <Button size="sm" variant="outline" disabled={page >= pagination.total_pages} onClick={() => setPage(page + 1)}>Next</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CounterWithdrawalModal
        open={modalOpen}
        onOpenChange={(open) => { setModalOpen(open); if (!open) setEditItem(null) }}
        editItem={editItem}
      />
    </div>
  )
}
