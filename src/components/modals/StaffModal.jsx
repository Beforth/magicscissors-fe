import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { userService } from '@/services/user.service'
import { branchService } from '@/services/branch.service'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, User, Briefcase, Building, CreditCard } from 'lucide-react'
import { toast } from 'sonner'

const ROLES = [
  { value: 'employee', label: 'Employee' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'manager', label: 'Manager' },
  { value: 'owner', label: 'Owner' },
]

const initialFormData = {
  username: '',
  email: '',
  password: '',
  full_name: '',
  phone: '',
  role: 'employee',
  branch_id: '',
  additional_branches: [],
  is_active: true,
  // Employee details
  employee_code: '',
  joining_date: '',
  date_of_birth: '',
  address: '',
  aadhar_number: '',
  pan_number: '',
  base_salary: '',
  bank_account_number: '',
  bank_name: '',
  bank_ifsc: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
}

function StaffModal({ open, onOpenChange, staff = null }) {
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const isOwner = user?.role === 'owner' || user?.role === 'developer'
  const isEditing = !!staff

  const [formData, setFormData] = useState(initialFormData)
  const [activeTab, setActiveTab] = useState('basic')

  // Fetch branches
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: open,
  })

  const branches = branchesData?.data || []

  useEffect(() => {
    if (staff) {
      setFormData({
        username: staff.username || '',
        email: staff.email || '',
        password: '',
        full_name: staff.full_name || '',
        phone: staff.phone || '',
        role: staff.role || 'employee',
        branch_id: staff.branch_id || '',
        additional_branches: (staff.additional_branches || []).map(b => b.branch_id),
        is_active: staff.is_active ?? true,
        // Employee details
        employee_code: staff.employee_details?.employee_code || '',
        joining_date: staff.employee_details?.joining_date?.split('T')[0] || '',
        date_of_birth: staff.employee_details?.date_of_birth?.split('T')[0] || '',
        address: staff.employee_details?.address || '',
        aadhar_number: staff.employee_details?.aadhar_number || '',
        pan_number: staff.employee_details?.pan_number || '',
        base_salary: staff.employee_details?.base_salary || '',
        bank_account_number: staff.employee_details?.bank_account_number || '',
        bank_name: staff.employee_details?.bank_name || '',
        bank_ifsc: staff.employee_details?.bank_ifsc || '',
        emergency_contact_name: staff.employee_details?.emergency_contact_name || '',
        emergency_contact_phone: staff.employee_details?.emergency_contact_phone || '',
      })
    } else {
      setFormData({
        ...initialFormData,
        branch_id: user?.branchId || '',
      })
    }
    setActiveTab('basic')
  }, [staff, open, user])

  const createMutation = useMutation({
    mutationFn: userService.createUser,
    onSuccess: () => {
      toast.success('Staff member created successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create staff member')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => userService.updateUser(id, data),
    onSuccess: () => {
      toast.success('Staff member updated successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update staff member')
    },
  })

  const isLoading = createMutation.isPending || updateMutation.isPending

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    // Validation
    if (!formData.full_name.trim()) {
      toast.error('Full name is required')
      return
    }
    if (!formData.email.trim()) {
      toast.error('Email is required')
      return
    }
    if (!isEditing && !formData.password) {
      toast.error('Password is required')
      return
    }
    if (!isEditing && !formData.username.trim()) {
      toast.error('Username is required')
      return
    }

    const data = {
      ...formData,
      base_salary: formData.base_salary ? parseFloat(formData.base_salary) : null,
    }

    // Remove password if empty (for edits)
    if (!data.password) {
      delete data.password
    }

    if (isEditing) {
      updateMutation.mutate({ id: staff.user_id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {isEditing ? 'Edit Staff Member' : 'Add New Staff Member'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic" className="flex items-center gap-1">
                <User className="h-4 w-4" />
                Basic
              </TabsTrigger>
              <TabsTrigger value="employment" className="flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                Employment
              </TabsTrigger>
              <TabsTrigger value="bank" className="flex items-center gap-1">
                <CreditCard className="h-4 w-4" />
                Bank
              </TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => handleChange('full_name', e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => handleChange('username', e.target.value)}
                    placeholder="johndoe"
                    disabled={isEditing}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password {!isEditing && '*'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder={isEditing ? 'Leave blank to keep current' : 'Enter password'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <select
                    id="role"
                    className="w-full h-10 px-3 border rounded-md"
                    value={formData.role}
                    onChange={(e) => handleChange('role', e.target.value)}
                  >
                    {ROLES.filter(r => isOwner || r.value !== 'owner').map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="branch_id">Primary Branch *</Label>
                  <select
                    id="branch_id"
                    className="w-full h-10 px-3 border rounded-md"
                    value={formData.branch_id}
                    onChange={(e) => {
                      handleChange('branch_id', e.target.value)
                      // Remove from additional if selected as primary
                      handleChange('additional_branches', formData.additional_branches.filter(id => id !== e.target.value))
                    }}
                  >
                    <option value="">Select Branch</option>
                    {branches.map((branch) => (
                      <option key={branch.branch_id} value={branch.branch_id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 flex items-end">
                  <label className="flex items-center gap-2 h-10">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => handleChange('is_active', e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                    <span>Active</span>
                  </label>
                </div>
              </div>

              {isOwner && ['employee', 'manager', 'cashier'].includes(formData.role) && branches.length > 1 && formData.branch_id && (
                <div className="space-y-2">
                  <Label>Additional Branches</Label>
                  <div className="flex flex-wrap gap-3 p-3 border rounded-md max-h-32 overflow-y-auto">
                    {branches
                      .filter(b => b.branch_id !== formData.branch_id)
                      .map(b => (
                        <label key={b.branch_id} className="flex items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            checked={formData.additional_branches.includes(b.branch_id)}
                            onChange={(e) => {
                              const current = formData.additional_branches
                              if (e.target.checked) {
                                handleChange('additional_branches', [...current, b.branch_id])
                              } else {
                                handleChange('additional_branches', current.filter(id => id !== b.branch_id))
                              }
                            }}
                            className="h-4 w-4 rounded"
                          />
                          {b.name}
                        </label>
                      ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Employee will be available for selection in these branches during billing.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Employment Tab */}
            <TabsContent value="employment" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employee_code">Employee Code</Label>
                  <Input
                    id="employee_code"
                    value={formData.employee_code}
                    onChange={(e) => handleChange('employee_code', e.target.value)}
                    placeholder="EMP-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="joining_date">Joining Date</Label>
                  <Input
                    id="joining_date"
                    type="date"
                    value={formData.joining_date}
                    onChange={(e) => handleChange('joining_date', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleChange('date_of_birth', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="base_salary">Base Salary (₹)</Label>
                  <Input
                    id="base_salary"
                    type="number"
                    value={formData.base_salary}
                    onChange={(e) => handleChange('base_salary', e.target.value)}
                    placeholder="25000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Full address"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="aadhar_number">Aadhar Number</Label>
                  <Input
                    id="aadhar_number"
                    value={formData.aadhar_number}
                    onChange={(e) => handleChange('aadhar_number', e.target.value)}
                    placeholder="1234 5678 9012"
                    maxLength={12}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pan_number">PAN Number</Label>
                  <Input
                    id="pan_number"
                    value={formData.pan_number}
                    onChange={(e) => handleChange('pan_number', e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                  <Input
                    id="emergency_contact_name"
                    value={formData.emergency_contact_name}
                    onChange={(e) => handleChange('emergency_contact_name', e.target.value)}
                    placeholder="Contact person name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
                  <Input
                    id="emergency_contact_phone"
                    value={formData.emergency_contact_phone}
                    onChange={(e) => handleChange('emergency_contact_phone', e.target.value)}
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Bank Details Tab */}
            <TabsContent value="bank" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  value={formData.bank_name}
                  onChange={(e) => handleChange('bank_name', e.target.value)}
                  placeholder="e.g., State Bank of India"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_account_number">Account Number</Label>
                  <Input
                    id="bank_account_number"
                    value={formData.bank_account_number}
                    onChange={(e) => handleChange('bank_account_number', e.target.value)}
                    placeholder="Enter account number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_ifsc">IFSC Code</Label>
                  <Input
                    id="bank_ifsc"
                    value={formData.bank_ifsc}
                    onChange={(e) => handleChange('bank_ifsc', e.target.value.toUpperCase())}
                    placeholder="e.g., SBIN0001234"
                    maxLength={11}
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                Bank details are used for salary disbursement. This information is kept confidential
                and only accessible to owners and managers.
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
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
              {isEditing ? 'Update Staff' : 'Add Staff'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default StaffModal
