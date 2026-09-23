import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Loader2,
  Eye,
  PackagePlus,
  Clock,
  IndianRupee,
  PackageCheck,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { purchaseBatchService } from '@/services/purchaseBatch.service'
import { supplierService } from '@/services/supplier.service'
import { branchService } from '@/services/branch.service'

export default function PurchaseBatchesPage() {
  const navigate = useNavigate()

  const [page, setPage] = useState(1)
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierService.getSuppliers({ limit: 100 }),
  })
  const suppliers = suppliersData?.data || []

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
  })
  const branches = branchesData?.data || []

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-batches', { page, selectedSupplier, selectedBranch, startDate, endDate }],
    queryFn: () =>
      purchaseBatchService.getBatches({
        page,
        limit: 20,
        supplier_id: selectedSupplier || undefined,
        branch_id: selectedBranch || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }),
  })
  const batches = data?.data || []
  const pagination = data?.pagination || {}

  const summary = useMemo(() => {
    return batches.reduce(
      (acc, b) => {
        acc.totalAmount += b.total_amount || 0
        acc.pendingAmount += b.pending_amount || 0
        if (!b.stock_received) acc.stockPending += 1
        return acc
      },
      { totalAmount: 0, pendingAmount: 0, stockPending: 0 }
    )
  }, [batches])

  const hasFilters = !!(startDate || endDate || selectedSupplier || selectedBranch)

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedSupplier('')
    setSelectedBranch('')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Batches</h1>
          <p className="text-sm text-gray-500 mt-1">
            Record supplier purchases, receive stock into inventory, and track payments.
          </p>
        </div>
        <Button onClick={() => navigate('/purchase-batches/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Purchase
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-50">
                <PackagePlus className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-xs text-gray-500">On this page</p>
                <p className="text-2xl font-semibold">{batches.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={summary.stockPending > 0 ? 'border-amber-200' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-50">
                <Clock className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Stock not received</p>
                <p className="text-2xl font-semibold">{summary.stockPending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-50">
                <IndianRupee className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Pending payments (page)</p>
                <p className="text-2xl font-semibold text-red-600">
                  {formatCurrency(summary.pendingAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <CardTitle className="text-base">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Supplier</Label>
              <SearchableSelect
                options={[
                  { value: 'all', label: 'All suppliers' },
                  ...suppliers.map((s) => ({ value: s.supplier_id, label: s.name })),
                ]}
                value={selectedSupplier || 'all'}
                onChange={(val) => {
                  setSelectedSupplier(val === 'all' ? '' : val)
                  setPage(1)
                }}
                placeholder="All suppliers"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Destination branch</Label>
              <SearchableSelect
                options={[
                  { value: 'all', label: 'All branches' },
                  ...branches.map((b) => ({ value: b.branch_id, label: `${b.name}${b.is_warehouse ? ' (warehouse)' : ''}` })),
                ]}
                value={selectedBranch || 'all'}
                onChange={(val) => {
                  setSelectedBranch(val === 'all' ? '' : val)
                  setPage(1)
                }}
                placeholder="All branches"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>
          {hasFilters && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-16 px-4">
              <PackagePlus className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No purchase batches found</p>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                {hasFilters
                  ? 'Try clearing filters or widening the date range.'
                  : 'Create your first purchase to receive stock from a supplier.'}
              </p>
              <Button className="mt-4" onClick={() => navigate('/purchase-batches/new')}>
                <Plus className="h-4 w-4 mr-2" />
                New Purchase
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead className="w-[52px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow
                        key={batch.batch_id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => navigate(`/purchase-batches/${batch.batch_id}`)}
                      >
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(batch.purchase_date)}
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate" title={batch.branch_name}>
                          {batch.branch_name || '—'}
                        </TableCell>
                        <TableCell className="font-medium max-w-[160px] truncate" title={batch.supplier?.name}>
                          {batch.supplier?.name || '—'}
                        </TableCell>
                        <TableCell>
                          {batch.stock_received ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-0">
                              <PackageCheck className="h-3 w-3 mr-1" />
                              Received
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-800 border-amber-300 bg-amber-50">
                              <Clock className="h-3 w-3 mr-1" />
                              Awaiting
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatCurrency(batch.total_amount)}
                        </TableCell>
                        <TableCell className="text-right text-green-700 whitespace-nowrap">
                          {formatCurrency(batch.paid_amount)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {batch.pending_amount > 0 ? (
                            <span className="text-red-600 font-semibold">
                              {formatCurrency(batch.pending_amount)}
                            </span>
                          ) : (
                            <Badge variant="secondary" className="font-normal">
                              Paid
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/purchase-batches/${batch.batch_id}`)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t bg-gray-50/80">
                <p className="text-sm text-gray-600">
                  Page total:{' '}
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(summary.totalAmount)}
                  </span>
                </p>
                {pagination.total_pages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-500 tabular-nums">
                      {page} / {pagination.total_pages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= pagination.total_pages}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
