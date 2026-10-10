import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { expenseService } from '@/services/expense.service'
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
import {
  Plus,
  Search,
  Loader2,
  Wallet,
  Pencil,
  Trash2,
  Filter,
  X,
  IndianRupee,
  Hash,
  Tag,
} from 'lucide-react'
import { toast } from 'sonner'
import ExpenseModal from '@/components/modals/ExpenseModal'
import ExpenseCategoryModal from '@/components/modals/ExpenseCategoryModal'

const PAYMENT_MODES = [
  { value: '', label: 'All Modes' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'online', label: 'Online' },
  { value: 'other', label: 'Other' },
]

const PAYMENT_MODE_LABELS = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  online: 'Online',
  other: 'Other',
}

const DATE_PRESETS = [
  { label: 'Today', getValue: () => {
    const today = new Date().toISOString().split('T')[0]
    return { start_date: today, end_date: today }
  }},
  { label: 'This Week', getValue: () => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    return { start_date: start.toISOString().split('T')[0], end_date: now.toISOString().split('T')[0] }
  }},
  { label: 'This Month', getValue: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start_date: start.toISOString().split('T')[0], end_date: now.toISOString().split('T')[0] }
  }},
  { label: 'Last Month', getValue: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { start_date: start.toISOString().split('T')[0], end_date: end.toISOString().split('T')[0] }
  }},
]

function ExpensesPage() {
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const isOwner = user?.role === 'owner' || user?.role === 'developer'
  const canCreateCategory = isOwner || user?.role === 'manager'

  // Tab state
  const [activeTab, setActiveTab] = useState('expenses')

  // Filter state
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [paymentMode, setPaymentMode] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Modal state
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)

  // Fetch branches (owner only, for filter dropdown)
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: isOwner,
  })
  const branches = branchesData?.data || []

  // Fetch categories (for filter dropdown + categories tab)
  const { data: categoriesData } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: expenseService.getCategories,
  })
  const allCategories = categoriesData?.data || []

  // Build query params for expenses
  const queryParams = {
    page,
    limit: 20,
    search: search || undefined,
    category_id: categoryFilter || undefined,
    payment_mode: paymentMode || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    branch_id: branchFilter || undefined,
  }

  // Fetch expenses
  const { data: expensesData, isLoading: expensesLoading, error: expensesError } = useQuery({
    queryKey: ['expenses', queryParams],
    queryFn: () => expenseService.getExpenses(queryParams),
  })
  const expenses = expensesData?.data || []
  const pagination = expensesData?.pagination || { page: 1, total_pages: 1, total: 0 }

  // Fetch summary (owner only)
  const summaryParams = {
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    branch_id: branchFilter || undefined,
  }
  const { data: summaryData } = useQuery({
    queryKey: ['expense-summary', summaryParams],
    queryFn: () => expenseService.getSummary(summaryParams),
    enabled: isOwner,
  })
  const summary = summaryData?.data || null

  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: (id) => expenseService.deleteExpense(id),
    onSuccess: () => {
      toast.success('Expense deleted')
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete expense')
    },
  })

  // Toggle category active/inactive
  const toggleCategoryMutation = useMutation({
    mutationFn: ({ id, is_active }) => expenseService.updateCategory(id, { is_active }),
    onSuccess: () => {
      toast.success('Category status updated')
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update category')
    },
  })

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: (id) => expenseService.deleteCategory(id),
    onSuccess: () => {
      toast.success('Category deleted')
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete category')
    },
  })

  const hasActiveFilters = startDate || endDate || paymentMode || branchFilter || categoryFilter

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setPaymentMode('')
    setBranchFilter('')
    setCategoryFilter('')
    setSearch('')
    setPage(1)
  }

  const applyDatePreset = (preset) => {
    const { start_date, end_date } = preset.getValue()
    setStartDate(start_date)
    setEndDate(end_date)
    setPage(1)
  }

  const handleAddExpense = () => {
    setSelectedExpense(null)
    setExpenseModalOpen(true)
  }

  const handleEditExpense = (expense) => {
    setSelectedExpense(expense)
    setExpenseModalOpen(true)
  }

  const handleAddCategory = () => {
    setSelectedCategory(null)
    setCategoryModalOpen(true)
  }

  const handleEditCategory = (category) => {
    setSelectedCategory(category)
    setCategoryModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500">Track and manage salon expenses</p>
        </div>
        {activeTab === 'expenses' ? (
          <Button onClick={handleAddExpense}>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        ) : canCreateCategory ? (
          <Button onClick={handleAddCategory}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        <Button
          variant={activeTab === 'expenses' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('expenses')}
        >
          <Wallet className="h-4 w-4 mr-2" />
          Expenses
        </Button>
        <Button
          variant={activeTab === 'categories' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('categories')}
        >
          <Tag className="h-4 w-4 mr-2" />
          Categories
        </Button>
      </div>

      {activeTab === 'expenses' ? (
        <>
          {/* Search + Filters */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search expenses..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                  />
                </div>
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
                <div className="border-t pt-3 space-y-3">
                  {/* Date Presets */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm text-gray-500 mr-1">Quick:</span>
                    {DATE_PRESETS.map((preset) => (
                      <Button
                        key={preset.label}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => applyDatePreset(preset)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>

                  {/* Filter row */}
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
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Category</Label>
                      <select
                        className="h-9 px-3 border rounded-md text-sm min-w-[150px]"
                        value={categoryFilter}
                        onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
                      >
                        <option value="">All Categories</option>
                        {allCategories.filter((c) => c.is_active).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Payment Mode</Label>
                      <select
                        className="h-9 px-3 border rounded-md text-sm min-w-[130px]"
                        value={paymentMode}
                        onChange={(e) => { setPaymentMode(e.target.value); setPage(1) }}
                      >
                        {PAYMENT_MODES.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
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

          {/* Summary Section (Owner only) */}
          {isOwner && summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <IndianRupee className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Expenses</p>
                      <p className="text-xl font-bold">{formatCurrency(summary.total_amount || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Hash className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Expense Count</p>
                      <p className="text-xl font-bold">{summary.total_count || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Expenses Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Expenses
                <Badge variant="secondary" className="ml-2">
                  {pagination.total} total
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expensesLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : expensesError ? (
                <div className="text-center py-10 text-red-500">
                  Error loading expenses. Please try again.
                </div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  No expenses found. Add your first expense!
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Mode</TableHead>
                      {isOwner && <TableHead>Branch</TableHead>}
                      <TableHead>Created By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(expense.expense_date)}
                          {expense.expense_time && (
                            <span className="text-xs text-muted-foreground ml-1">{expense.expense_time}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{expense.category_name}</Badge>
                          {expense.other_category_text && (
                            <span className="text-xs text-gray-500 ml-1">({expense.other_category_text})</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {expense.description || expense.vendor_name || '—'}
                        </TableCell>
                        <TableCell className="font-bold">
                          {formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {PAYMENT_MODE_LABELS[expense.payment_mode] || expense.payment_mode}
                          </Badge>
                          {expense.upi_account_name && (
                            <span className="text-xs text-gray-500 ml-1">({expense.upi_account_name})</span>
                          )}
                          {expense.other_payment_mode_text && (
                            <span className="text-xs text-gray-500 ml-1">({expense.other_payment_mode_text})</span>
                          )}
                        </TableCell>
                        {isOwner && (
                          <TableCell>{expense.branch_name}</TableCell>
                        )}
                        <TableCell className="truncate max-w-[100px]">
                          {expense.created_by_name}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditExpense(expense)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {isOwner && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => {
                                  if (window.confirm('Delete this expense?')) {
                                    deleteExpenseMutation.mutate(expense.id)
                                  }
                                }}
                                disabled={deleteExpenseMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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
        </>
      ) : (
        /* Categories Tab */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Expense Categories
              <Badge variant="secondary" className="ml-2">
                {allCategories.length} total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allCategories.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                No categories found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expenses</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allCategories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell className="text-gray-500">
                        {cat.description || '—'}
                      </TableCell>
                      <TableCell>
                        {canCreateCategory ? (
                          <button
                            onClick={() =>
                              toggleCategoryMutation.mutate({
                                id: cat.id,
                                is_active: !cat.is_active,
                              })
                            }
                            disabled={toggleCategoryMutation.isPending}
                          >
                            <Badge
                              variant={cat.is_active ? 'success' : 'secondary'}
                              className="cursor-pointer"
                            >
                              {cat.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </button>
                        ) : (
                          <Badge variant={cat.is_active ? 'success' : 'secondary'}>
                            {cat.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{cat.expense_count ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canCreateCategory && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCategory(cat)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {isOwner && (cat.expense_count ?? 0) === 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => {
                                if (window.confirm(`Delete category "${cat.name}"?`)) {
                                  deleteCategoryMutation.mutate(cat.id)
                                }
                              }}
                              disabled={deleteCategoryMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <ExpenseModal
        open={expenseModalOpen}
        onOpenChange={setExpenseModalOpen}
        expense={selectedExpense}
      />
      <ExpenseCategoryModal
        open={categoryModalOpen}
        onOpenChange={setCategoryModalOpen}
        category={selectedCategory}
      />
    </div>
  )
}

export default ExpensesPage
