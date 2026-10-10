import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { cashService } from '@/services/cash.service'
import { branchService } from '@/services/branch.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Building, Loader2, Pencil, IndianRupee, Filter, X } from 'lucide-react'
import BankDepositEditModal from '@/components/modals/BankDepositEditModal'

function BankDepositsPage() {
  const { user } = useSelector((state) => state.auth)
  const isOwner = user?.role === 'owner' || user?.role === 'developer'
  const isManager = user?.role === 'manager'
  const canFilterDates = isOwner || isManager

  const [page, setPage] = useState(1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingDeposit, setEditingDeposit] = useState(null)

  // Fetch branches (owner only)
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: isOwner,
  })
  const branches = branchesData?.data || []

  // Build query params
  const queryParams = {
    page,
    limit: 20,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    branch_id: branchFilter || undefined,
  }

  // Fetch deposits
  const { data: depositsData, isLoading, error } = useQuery({
    queryKey: ['bank-deposits', queryParams],
    queryFn: () => cashService.getDeposits(queryParams),
  })

  const deposits = depositsData?.data || []
  const summary = depositsData?.summary || {}
  const pagination = depositsData?.pagination || { page: 1, total_pages: 1, total: 0 }

  const hasActiveFilters = startDate || endDate || branchFilter

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setBranchFilter('')
    setPage(1)
  }

  const handleEdit = (deposit) => {
    setEditingDeposit(deposit)
    setEditModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bank Receipts</h1>
          <p className="text-gray-500">View and manage bank deposit records</p>
        </div>
      </div>

      {/* Summary */}
      {summary.total_amount !== undefined && (
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <IndianRupee className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-purple-600">Total Deposits</p>
                <p className="text-2xl font-bold text-purple-700">
                  {formatCurrency(summary.total_amount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {canFilterDates && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-4">
              <Button
                variant={showFilters ? 'default' : 'outline'}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-1 h-2 w-2 bg-white rounded-full inline-block" />
                )}
              </Button>
            </div>

            {showFilters && (
              <div className="border-t pt-3">
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">From Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                      className="w-[160px] h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">To Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                      className="w-[160px] h-9"
                    />
                  </div>
                  {isOwner && (
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Branch</Label>
                      <select
                        className="h-9 px-3 border rounded-md text-sm min-w-[150px]"
                        value={branchFilter}
                        onChange={(e) => { setBranchFilter(e.target.value); setPage(1) }}
                      >
                        <option value="">All Branches</option>
                        {branches.map((b) => (
                          <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deposits Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Bank Deposits
            <Badge variant="secondary" className="ml-2">
              {pagination.total} total
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-10 text-red-500">
              Error loading deposits. Please try again.
            </div>
          ) : deposits.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Building className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No bank deposits found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Bank Name</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deposits.map((deposit) => (
                  <TableRow key={deposit.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(deposit.deposit_date)}
                    </TableCell>
                    <TableCell className="font-medium">{deposit.bank_name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {deposit.account_number || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {deposit.reference_number || '—'}
                    </TableCell>
                    <TableCell className="font-bold">
                      {formatCurrency(deposit.amount)}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-gray-500">
                      {deposit.notes || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {deposit.is_editable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(deposit)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.total_pages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                  disabled={page === pagination.total_pages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <BankDepositEditModal
        open={editModalOpen}
        onOpenChange={(open) => {
          setEditModalOpen(open)
          if (!open) setEditingDeposit(null)
        }}
        deposit={editingDeposit}
      />
    </div>
  )
}

export default BankDepositsPage
