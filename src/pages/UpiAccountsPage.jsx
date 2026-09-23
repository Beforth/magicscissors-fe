import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { upiAccountService } from '@/services/upiAccount.service'
import { branchService } from '@/services/branch.service'
import UpiAccountModal from '@/components/modals/UpiAccountModal'

export default function UpiAccountsPage() {
  const { user } = useSelector((state) => state.auth)
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editAccount, setEditAccount] = useState(null)
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().split('T')[0])
  const [collectionBranch, setCollectionBranch] = useState(user?.branchId || '')

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  })
  const branches = branchesData?.data || []

  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['upi-accounts', user?.branchId],
    queryFn: () => upiAccountService.getAccounts({ branch_id: user?.branchId }),
  })
  const accounts = accountsData?.data || []

  const { data: collectionData, isLoading: collectionLoading } = useQuery({
    queryKey: ['upi-daily-collection', { date: collectionDate, branch: collectionBranch }],
    queryFn: () => upiAccountService.getDailyCollection({
      date: collectionDate,
      branch_id: collectionBranch || undefined,
    }),
  })
  const collection = collectionData?.data || collectionData || {}
  const collectionAccounts = collection.accounts || []

  const deleteMutation = useMutation({
    mutationFn: (id) => upiAccountService.deleteAccount(id),
    onSuccess: () => {
      toast.success('Account deleted')
      queryClient.invalidateQueries({ queryKey: ['upi-accounts'] })
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  })

  const handleDelete = (acc) => {
    if (window.confirm(`Delete UPI account "${acc.name}"?`)) {
      deleteMutation.mutate(acc.account_id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">UPI Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">Manage UPI sound box accounts and view daily collections</p>
        </div>
        <Button onClick={() => { setEditAccount(null); setModalOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Accounts Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {accountsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-center text-gray-500 py-6">No UPI accounts configured</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {accounts.map((acc) => (
                <div key={acc.account_id} className="border rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="font-medium">{acc.name}</p>
                      {acc.branch_name && <p className="text-xs text-gray-500">{acc.branch_name}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={acc.is_active ? 'default' : 'secondary'}>
                      {acc.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => { setEditAccount(acc); setModalOpen(true) }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(acc)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Collection Report */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Daily Collection Report</CardTitle>
            <div className="flex gap-2 items-end">
              <div>
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <div>
                <Label className="text-xs">Branch</Label>
                <SearchableSelect
                  options={[{ value: 'all', label: 'All Branches' }, ...branches.map(b => ({ value: b.branch_id, label: b.name }))]}
                  value={collectionBranch}
                  onChange={(val) => setCollectionBranch(val === 'all' ? '' : val)}
                  placeholder="All branches"
                  triggerClassName="w-[160px]"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {collectionLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : collectionAccounts.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No UPI transactions for this date</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collectionAccounts.map((acc) => (
                  <TableRow key={acc.account_id || 'unassigned'}>
                    <TableCell className="font-medium">{acc.account_name}</TableCell>
                    <TableCell className="text-right">{acc.transaction_count}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(acc.total_amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50 font-semibold">
                  <TableCell>Grand Total</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right">{formatCurrency(collection.grand_total || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <UpiAccountModal
        open={modalOpen}
        onOpenChange={(open) => { setModalOpen(open); if (!open) setEditAccount(null) }}
        editAccount={editAccount}
      />
    </div>
  )
}
