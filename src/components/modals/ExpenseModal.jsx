import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { expenseService } from '@/services/expense.service'
import { branchService } from '@/services/branch.service'
import { upiAccountService } from '@/services/upiAccount.service'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'online', label: 'Online' },
  { value: 'other', label: 'Other' },
]

const today = () => new Date().toISOString().split('T')[0]

const initialFormData = {
  branch_id: '',
  category_id: '',
  amount: '',
  expense_date: today(),
  expense_time: '',
  payment_mode: '',
  upi_account_id: '',
  employee_id: '',
  vendor_name: '',
  description: '',
  notes: '',
  other_category_text: '',
  other_payment_mode_text: '',
}

function ExpenseModal({ open, onOpenChange, expense = null }) {
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const isOwner = user?.role === 'owner' || user?.role === 'developer'
  const isEditing = !!expense

  const [formData, setFormData] = useState(initialFormData)

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: expenseService.getCategories,
    enabled: open,
  })
  const categories = (categoriesData?.data || []).filter((c) => c.is_active)

  // Fetch branches (owner only)
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: open && isOwner,
  })
  const branches = branchesData?.data || []

  // Fetch UPI accounts when payment mode is UPI
  const isUpi = formData.payment_mode === 'upi'
  const { data: upiAccountsData } = useQuery({
    queryKey: ['upi-accounts-active'],
    queryFn: () => upiAccountService.getAccounts({ is_active: true }),
    enabled: open && isUpi,
  })
  const upiAccounts = upiAccountsData?.data || []

  // Detect Staff Advance category
  const selectedCategory = categories.find((c) => c.id === formData.category_id)
  const isStaffRelated = selectedCategory?.name === 'Staff Advance' || selectedCategory?.name === 'Staff Salary'
  const isOtherCategory = ['other', 'others'].includes(selectedCategory?.name?.toLowerCase())
  const isOtherPaymentMode = formData.payment_mode === 'other'

  // Fetch employees when Staff Advance selected
  const branchIdForEmployees = formData.branch_id || user?.branchId
  const { data: employeesData } = useQuery({
    queryKey: ['branch-employees', branchIdForEmployees],
    queryFn: () => branchService.getBranchEmployees(branchIdForEmployees),
    enabled: open && isStaffRelated && !!branchIdForEmployees,
  })
  const employees = employeesData?.data || []

  useEffect(() => {
    if (expense) {
      setFormData({
        branch_id: expense.branch_id || '',
        category_id: expense.category_id || '',
        amount: expense.amount?.toString() || '',
        expense_date: expense.expense_date
          ? new Date(expense.expense_date).toISOString().split('T')[0]
          : today(),
        expense_time: expense.expense_time || '',
        payment_mode: expense.payment_mode || '',
        upi_account_id: expense.upi_account_id || '',
        employee_id: expense.employee_id || '',
        vendor_name: expense.vendor_name || '',
        description: expense.description || '',
        notes: expense.notes || '',
        other_category_text: expense.other_category_text || '',
        other_payment_mode_text: expense.other_payment_mode_text || '',
      })
    } else {
      setFormData({
        ...initialFormData,
        branch_id: isOwner ? '' : (user?.branchId || ''),
        expense_date: today(),
      })
    }
  }, [expense, open, isOwner, user?.branchId])

  // Clear UPI account when payment mode changes away from UPI
  useEffect(() => {
    if (!isUpi && formData.upi_account_id) {
      setFormData((prev) => ({ ...prev, upi_account_id: '' }))
    }
  }, [isUpi])

  // Clear employee when category changes away from Staff Advance
  useEffect(() => {
    if (!isStaffRelated && formData.employee_id) {
      setFormData((prev) => ({ ...prev, employee_id: '' }))
    }
  }, [isStaffRelated])

  // Clear other category text when category changes away from "Other"
  useEffect(() => {
    if (!isOtherCategory && formData.other_category_text) {
      setFormData((prev) => ({ ...prev, other_category_text: '' }))
    }
  }, [isOtherCategory])

  // Clear other payment mode text when mode changes away from "other"
  useEffect(() => {
    if (!isOtherPaymentMode && formData.other_payment_mode_text) {
      setFormData((prev) => ({ ...prev, other_payment_mode_text: '' }))
    }
  }, [isOtherPaymentMode])

  const createMutation = useMutation({
    mutationFn: expenseService.createExpense,
    onSuccess: () => {
      toast.success('Expense created successfully')
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create expense')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => expenseService.updateExpense(id, data),
    onSuccess: () => {
      toast.success('Expense updated successfully')
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update expense')
    },
  })

  const isLoading = createMutation.isPending || updateMutation.isPending

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    const branchId = formData.branch_id || user?.branchId
    if (!branchId) {
      toast.error('Branch is required')
      return
    }
    if (!formData.category_id) {
      toast.error('Category is required')
      return
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }
    if (!formData.expense_date) {
      toast.error('Expense date is required')
      return
    }
    if (!formData.payment_mode) {
      toast.error('Payment mode is required')
      return
    }
    if (formData.payment_mode === 'upi' && !formData.upi_account_id) {
      toast.error('UPI account is required for UPI payments')
      return
    }

    const data = {
      branch_id: branchId,
      category_id: formData.category_id,
      amount: parseFloat(formData.amount),
      expense_date: formData.expense_date,
      expense_time: formData.expense_time || null,
      payment_mode: formData.payment_mode,
      upi_account_id: formData.upi_account_id || null,
      employee_id: formData.employee_id || null,
      vendor_name: formData.vendor_name.trim() || null,
      description: formData.description.trim() || null,
      notes: formData.notes.trim() || null,
      other_category_text: formData.other_category_text.trim() || null,
      other_payment_mode_text: formData.other_payment_mode_text.trim() || null,
    }

    if (isEditing) {
      updateMutation.mutate({ id: expense.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Expense' : 'Add New Expense'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Branch (owner selects, others auto-filled) */}
          {isOwner ? (
            <div className="space-y-2">
              <Label>Branch *</Label>
              <SearchableSelect
                options={branches.map(b => ({ value: b.branch_id, label: b.name }))}
                value={formData.branch_id}
                onChange={(value) => handleChange('branch_id', value)}
                placeholder="Select branch..."
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Branch</Label>
              <Input value={user?.branchName || 'Your Branch'} disabled />
            </div>
          )}

          {/* Category + Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <SearchableSelect
                options={categories.map(c => ({ value: c.id, label: c.name }))}
                value={formData.category_id}
                onChange={(value) => handleChange('category_id', value)}
                placeholder="Select category..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-amount">Amount *</Label>
              <Input
                id="exp-amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Other Category Text */}
          {isOtherCategory && (
            <div className="space-y-2">
              <Label htmlFor="exp-other-cat">Specify Category *</Label>
              <Input
                id="exp-other-cat"
                value={formData.other_category_text}
                onChange={(e) => handleChange('other_category_text', e.target.value)}
                placeholder="Enter the category name"
                maxLength={200}
              />
            </div>
          )}

          {/* Date + Time + Payment Mode */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="exp-date">Expense Date *</Label>
              <Input
                id="exp-date"
                type="date"
                value={formData.expense_date}
                onChange={(e) => handleChange('expense_date', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-time">Time</Label>
              <Input
                id="exp-time"
                type="time"
                value={formData.expense_time}
                onChange={(e) => handleChange('expense_time', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Mode *</Label>
              <SearchableSelect
                options={PAYMENT_MODES}
                value={formData.payment_mode}
                onChange={(value) => handleChange('payment_mode', value)}
                placeholder="Select mode..."
              />
            </div>
          </div>

          {/* Other Payment Mode Text */}
          {isOtherPaymentMode && (
            <div className="space-y-2">
              <Label htmlFor="exp-other-mode">Specify Payment Mode *</Label>
              <Input
                id="exp-other-mode"
                value={formData.other_payment_mode_text}
                onChange={(e) => handleChange('other_payment_mode_text', e.target.value)}
                placeholder="Enter the payment mode"
                maxLength={200}
              />
            </div>
          )}

          {/* UPI Account (only when payment mode is UPI) */}
          {isUpi && (
            <div className="space-y-2">
              <Label>UPI Account *</Label>
              <SearchableSelect
                options={upiAccounts.map(acc => ({ value: acc.account_id, label: acc.name }))}
                value={formData.upi_account_id}
                onChange={(value) => handleChange('upi_account_id', value)}
                placeholder="Select UPI account..."
              />
            </div>
          )}

          {/* Employee (only for Staff Advance) */}
          {isStaffRelated && (
            <div className="space-y-2">
              <Label>Employee</Label>
              <SearchableSelect
                options={employees.map(emp => ({ value: emp.employee_id, label: emp.full_name }))}
                value={formData.employee_id}
                onChange={(value) => handleChange('employee_id', value)}
                placeholder="Select employee..."
              />
            </div>
          )}

          {/* Vendor Name */}
          <div className="space-y-2">
            <Label htmlFor="exp-vendor">Vendor Name</Label>
            <Input
              id="exp-vendor"
              value={formData.vendor_name}
              onChange={(e) => handleChange('vendor_name', e.target.value)}
              placeholder="Vendor or supplier name"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="exp-desc">Description</Label>
            <Input
              id="exp-desc"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="What is this expense for?"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="exp-notes">Notes</Label>
            <Input
              id="exp-notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Update Expense' : 'Create Expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default ExpenseModal
