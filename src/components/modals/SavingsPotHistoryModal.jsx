import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate, formatTime } from '@/lib/utils'
import { savingsPotService } from '@/services/savingsPot.service'
import ConfirmDialog from '@/components/modals/ConfirmDialog'

export default function SavingsPotHistoryModal({ open, onOpenChange, pot, canManage = false }) {
  const queryClient = useQueryClient()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [editingId, setEditingId] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [deleteEntry, setDeleteEntry] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['savings-pot-history', pot?.pot_id, { startDate, endDate, page }],
    queryFn: () => savingsPotService.getHistory(pot.pot_id, {
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      page,
      limit: 20,
    }),
    enabled: !!pot?.pot_id && open,
  })
  const history = data?.data || []
  const pagination = data?.pagination || {}

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['savings-pot-history'] })
    queryClient.invalidateQueries({ queryKey: ['savings-pots'] })
    queryClient.invalidateQueries({ queryKey: ['savings-pot-persons'] })
  }

  const updateMutation = useMutation({
    mutationFn: ({ entry, amount }) =>
      entry.type === 'deposit'
        ? savingsPotService.updateDeposit(entry.id, { amount })
        : savingsPotService.updateWithdrawal(entry.id, { amount }),
    onSuccess: () => {
      toast.success('Amount updated')
      setEditingId(null)
      setEditAmount('')
      invalidateAll()
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to update amount'),
  })

  const deleteMutation = useMutation({
    mutationFn: (entry) =>
      entry.type === 'deposit'
        ? savingsPotService.deleteDeposit(entry.id)
        : savingsPotService.deleteWithdrawal(entry.id),
    onSuccess: () => {
      toast.success('Entry deleted')
      setDeleteEntry(null)
      invalidateAll()
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to delete entry'),
    onSettled: () => setDeleteEntry(null),
  })

  const startEdit = (entry) => {
    setEditingId(entry.id)
    setEditAmount(entry.amount)
  }

  const handleSaveEdit = (entry) => {
    const amount = parseFloat(editAmount)
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    updateMutation.mutate({ entry, amount })
  }

  if (!pot) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>History — {pot.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <span className="text-sm text-gray-500">Current Balance</span>
            <span className="font-semibold text-lg">{formatCurrency(pot.balance)}</span>
          </div>

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1) }} />
            </div>
            <div className="flex-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1) }} />
            </div>
            {(startDate || endDate) && (
              <Button variant="ghost" size="sm" onClick={() => { setStartDate(''); setEndDate(''); setPage(1) }}>Clear</Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">No transactions found</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Person</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                      <TableCell className="text-sm">{formatTime(entry.created_at || entry.date)}</TableCell>
                      <TableCell>
                        <Badge variant={entry.type === 'deposit' ? 'default' : 'secondary'}>
                          {entry.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{entry.person_name}</TableCell>
                      <TableCell className="text-right">
                        {editingId === entry.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="h-8 w-28 text-right"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              autoFocus
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-600 hover:text-green-700"
                              onClick={() => handleSaveEdit(entry)}
                              disabled={updateMutation.isPending}
                              title="Save"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => { setEditingId(null); setEditAmount('') }}
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className={`font-medium ${entry.type === 'withdrawal' ? 'text-red-600' : 'text-green-600'}`}>
                            {entry.type === 'withdrawal' ? '-' : '+'}{formatCurrency(entry.amount)}
                          </span>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => startEdit(entry)}
                              title="Edit amount"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-600 hover:text-red-700"
                              onClick={() => setDeleteEntry(entry)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination.total_pages > 1 && (
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm text-gray-500">Page {page} of {pagination.total_pages}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
                    <Button size="sm" variant="outline" disabled={page >= pagination.total_pages} onClick={() => setPage(page + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>

      <ConfirmDialog
        open={!!deleteEntry}
        onOpenChange={(open) => { if (!open) setDeleteEntry(null) }}
        title={deleteEntry?.type === 'deposit' ? 'Delete deposit?' : 'Delete withdrawal?'}
        description={`Delete the ${deleteEntry?.type} of ${deleteEntry ? formatCurrency(deleteEntry.amount) : ''} by ${deleteEntry?.person_name || 'this person'}? The pot balance will be adjusted. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteEntry)}
      />
    </Dialog>
  )
}
