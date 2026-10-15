import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { userService } from '@/services/user.service'
import { branchService } from '@/services/branch.service'
import { skillService } from '@/services/skill.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import {
  User,
  Briefcase,
  CreditCard,
  Package,
  ArrowLeft,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/lib/utils'

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
  gender: '',
  role: 'employee',
  branch_id: '',
  additional_branches: [],
  is_active: true,
  // Employee details
  employee_code: '',
  biometric_id: '',
  joining_date: '',
  date_of_birth: '',
  address: '',
  aadhar_number: '',
  pan_number: '',
  base_salary: '',
  pay_type: '',
  bank_account_number: '',
  bank_name: '',
  bank_ifsc: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  shift_start: '',
  shift_end: '',
  has_flexible_timing: false,
  skill_ids: [],
}

const initialAssetForm = {
  name: '',
  amount: '',
  quantity: '1',
  type: 'debit',
  notes: '',
}

const PATCHABLE_FIELDS = [
  'email',
  'full_name',
  'phone',
  'gender',
  'role',
  'branch_id',
  'additional_branches',
  'is_active',
  'employee_code',
  'biometric_id',
  'joining_date',
  'date_of_birth',
  'address',
  'aadhar_number',
  'pan_number',
  'base_salary',
  'pay_type',
  'bank_account_number',
  'bank_name',
  'bank_ifsc',
  'emergency_contact_name',
  'emergency_contact_phone',
  'shift_start',
  'shift_end',
  'has_flexible_timing',
  'skill_ids',
]

function normalizeFieldValue(field, value) {
  if (value === null || value === undefined || value === '') return null
  if (field === 'base_salary') return parseFloat(value) || null
  if (field === 'additional_branches' || field === 'skill_ids') {
    return [...(value || [])].sort()
  }
  if (typeof value === 'boolean') return value
  return String(value).trim()
}

const SALARY_FIELDS = ['base_salary', 'pay_type']

function buildStaffPatchPayload(current, original, canEditSalary) {
  const patch = {}

  for (const field of PATCHABLE_FIELDS) {
    // Backend returns 403 if a non-owner/developer sends salary keys at all
    if (!canEditSalary && SALARY_FIELDS.includes(field)) continue
    const currentValue = normalizeFieldValue(field, current[field])
    const originalValue = normalizeFieldValue(field, original[field])
    if (JSON.stringify(currentValue) !== JSON.stringify(originalValue)) {
      if (field === 'base_salary') {
        patch[field] = current.base_salary ? parseFloat(current.base_salary) : null
      } else if (field === 'pay_type') {
        patch[field] = current.pay_type || null
      } else if (field === 'email') {
        patch[field] = current.email?.trim() || null
      } else {
        patch[field] = current[field]
      }
    }
  }

  if (current.password) {
    patch.password = current.password
  }

  return patch
}

function StaffFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const isOwner = user?.role === 'owner' || user?.role === 'developer'
  const isEditing = !!id

  const [formData, setFormData] = useState(initialFormData)
  const [originalFormData, setOriginalFormData] = useState(null)
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'basic')

  // Asset state
  const [assetForm, setAssetForm] = useState(initialAssetForm)
  const [showAssetForm, setShowAssetForm] = useState(false)
  const [editingAssetId, setEditingAssetId] = useState(null)
  const [showTransactionLog, setShowTransactionLog] = useState(false)

  // Fetch user data when editing
  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ['user', id],
    queryFn: () => userService.getUserById(id),
    enabled: isEditing,
  })

  // Fetch branches
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
  })

  const branches = branchesData?.data || []

  // Fetch skills for the picker
  const { data: skillsData } = useQuery({
    queryKey: ['skills', { active: 'true' }],
    queryFn: () => skillService.getSkills({ active: 'true' }),
  })
  const allSkills = skillsData?.data || []

  const toggleSkill = (skillId) => {
    setFormData((prev) => {
      const has = prev.skill_ids.includes(skillId)
      return {
        ...prev,
        skill_ids: has
          ? prev.skill_ids.filter((id) => id !== skillId)
          : [...prev.skill_ids, skillId],
      }
    })
  }

  // Fetch assets (only when editing)
  const { data: assetsData, isLoading: isLoadingAssets } = useQuery({
    queryKey: ['user-assets', id],
    queryFn: () => userService.getEmployeeAssets(id),
    enabled: isEditing,
  })

  // Normalize assets data to support both `id` and `asset_id`, as well as `createdAt` and `created_at`
  const allNormalizedAssets = useMemo(() => {
    const rawAssets = assetsData?.data || []
    return rawAssets.map((asset) => ({
      ...asset,
      id: asset.id || asset.asset_id,
      createdAt: asset.createdAt || asset.created_at,
    }))
  }, [assetsData])

  // Current active assets that the employee currently holds
  const activeAssets = useMemo(() => {
    // Group quantities by asset name to compute what the employee currently holds
    const totals = {}
    allNormalizedAssets.forEach((asset) => {
      const nameKey = asset.name.trim().toLowerCase()
      if (!totals[nameKey]) {
        totals[nameKey] = {
          name: asset.name,
          amount: parseFloat(asset.amount) || 0,
          quantity: 0,
          id: asset.id,
        }
      }
      totals[nameKey].quantity += parseInt(asset.quantity) || 0
    })
    // Only show items that are currently possessed (quantity > 0)
    return Object.values(totals).filter(item => item.quantity > 0)
  }, [allNormalizedAssets])

  const totalAssetsValue = useMemo(() => {
    return activeAssets.reduce((sum, asset) => {
      return sum + (parseFloat(asset.amount) || 0) * (parseInt(asset.quantity) || 0)
    }, 0)
  }, [activeAssets])

  // Populate form when user data loads
  useEffect(() => {
    if (userData?.data) {
      const staff = userData.data
      const loadedFormData = {
        username: staff.username || '',
        email: staff.email || '',
        password: '',
        full_name: staff.full_name || '',
        phone: staff.phone || '',
        gender: staff.gender || '',
        role: staff.role || 'employee',
        branch_id: staff.branch_id || '',
        additional_branches: (staff.additional_branches || []).map(b => b.branch_id),
        is_active: staff.is_active ?? true,
        employee_code: staff.employee_details?.employee_code || '',
        biometric_id: staff.employee_details?.biometric_id || '',
        joining_date: staff.employee_details?.joining_date?.split('T')[0] || '',
        date_of_birth: staff.employee_details?.date_of_birth?.split('T')[0] || '',
        address: staff.employee_details?.address || '',
        aadhar_number: staff.employee_details?.aadhar_number || '',
        pan_number: staff.employee_details?.pan_number || '',
        base_salary: staff.employee_details?.base_salary ?? '',
        pay_type: staff.employee_details?.pay_type || staff.pay_type || '',
        bank_account_number: staff.employee_details?.bank_account_number || '',
        bank_name: staff.employee_details?.bank_name || '',
        bank_ifsc: staff.employee_details?.bank_ifsc || '',
        emergency_contact_name: staff.employee_details?.emergency_contact_name || '',
        emergency_contact_phone: staff.employee_details?.emergency_contact_phone || '',
        shift_start: staff.employee_details?.shift_start || '',
        shift_end: staff.employee_details?.shift_end || '',
        has_flexible_timing: staff.employee_details?.has_flexible_timing ?? false,
        skill_ids: (staff.skills || []).map((s) => s.id),
      }
      setFormData(loadedFormData)
      setOriginalFormData(loadedFormData)
    } else if (!isEditing) {
      setFormData({
        ...initialFormData,
        branch_id: user?.branchId || '',
      })
    }
  }, [userData, isEditing, user])

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: userService.createUser,
    onSuccess: (response) => {
      toast.success('Staff member created successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      const newUserId = response?.data?.user_id
      if (newUserId) {
        navigate(`/staff/${newUserId}/edit`, { state: { tab: 'assets' } })
      } else {
        navigate('/staff')
      }
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
      queryClient.invalidateQueries({ queryKey: ['user', id] })
      navigate('/staff')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update staff member')
    },
  })

  const addAssetMutation = useMutation({
    mutationFn: (data) => userService.addEmployeeAsset(id, data),
    onSuccess: () => {
      toast.success('Asset added successfully')
      queryClient.invalidateQueries({ queryKey: ['user-assets', id] })
      resetAssetForm()
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to add asset')
    },
  })

  const updateAssetMutation = useMutation({
    mutationFn: ({ assetId, data }) => userService.updateEmployeeAsset(id, assetId, data),
    onSuccess: () => {
      toast.success('Asset updated successfully')
      queryClient.invalidateQueries({ queryKey: ['user-assets', id] })
      resetAssetForm()
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update asset')
    },
  })

  const deleteAssetMutation = useMutation({
    mutationFn: (assetId) => userService.deleteEmployeeAsset(id, assetId),
    onSuccess: () => {
      toast.success('Asset deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['user-assets', id] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete asset')
    },
  })

  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const isAssetSubmitting = addAssetMutation.isPending || updateAssetMutation.isPending

  // --- Handlers ---

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!formData.full_name.trim()) {
      toast.error('Full name is required')
      setActiveTab('basic')
      return
    }
    if (!isEditing && !formData.username.trim()) {
      toast.error('Username is required')
      setActiveTab('basic')
      return
    }
    if (!isEditing && !formData.password) {
      toast.error('Password is required')
      setActiveTab('basic')
      return
    }

    if (isEditing) {
      if (!originalFormData) {
        toast.error('Staff data is still loading')
        return
      }

      const data = buildStaffPatchPayload(formData, originalFormData, isOwner)
      if (Object.keys(data).length === 0) {
        toast.info('No changes to save')
        return
      }

      updateMutation.mutate({ id, data })
      return
    }

    const createData = { ...formData, gender: formData.gender || null }
    if (isOwner) {
      createData.base_salary = formData.base_salary ? parseFloat(formData.base_salary) : null
      createData.pay_type = formData.pay_type || null
    } else {
      delete createData.base_salary
      delete createData.pay_type
    }
    createMutation.mutate(createData)
  }

  const resetAssetForm = () => {
    setAssetForm(initialAssetForm)
    setShowAssetForm(false)
    setEditingAssetId(null)
  }

  const handleAssetSubmit = () => {
    if (!assetForm.name.trim()) {
      toast.error('Asset name is required')
      return
    }
    if ((assetForm.type === 'credit' || assetForm.type === 'broken') && !assetForm.notes?.trim()) {
      toast.error('Reason is required')
      return
    }
    if (!assetForm.amount || parseFloat(assetForm.amount) <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }
    if (!assetForm.quantity || parseInt(assetForm.quantity) <= 0) {
      toast.error('Quantity must be at least 1')
      return
    }

    const qty = parseInt(assetForm.quantity)
    const isReturning = assetForm.type === 'credit' || assetForm.type === 'broken'
    const payload = {
      name: assetForm.name.trim(),
      amount: parseFloat(assetForm.amount),
      quantity: isReturning ? -qty : qty,
      notes: assetForm.type === 'broken' ? `[Broken] ${assetForm.notes?.trim()}` : (assetForm.notes?.trim() || null),
    }

    if (editingAssetId) {
      updateAssetMutation.mutate({ assetId: editingAssetId, data: payload })
    } else {
      addAssetMutation.mutate(payload)
    }
  }

  const handleEditAsset = (asset) => {
    const qty = parseInt(asset.quantity) || 0
    const isBroken = asset.notes?.startsWith('[Broken] ')
    const notesContent = isBroken ? asset.notes.replace('[Broken] ', '') : (asset.notes || '')
    setAssetForm({
      name: asset.name || '',
      amount: asset.amount?.toString() || '',
      quantity: Math.abs(qty).toString() || '1',
      type: qty < 0 ? (isBroken ? 'broken' : 'credit') : 'debit',
      notes: notesContent,
    })
    setEditingAssetId(asset.id)
    setShowAssetForm(true)
  }

  const handleDeleteAsset = (assetId) => {
    if (window.confirm('Are you sure you want to delete this asset?')) {
      deleteAssetMutation.mutate(assetId)
    }
  }

  // --- Loading state ---

  if (isEditing && isLoadingUser) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // --- Render ---

  return (
    <div className="space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/staff')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/staff" className="hover:text-foreground transition-colors">
              Staff
            </Link>
            <span>/</span>
            <span className="text-foreground">
              {isEditing ? 'Edit Staff Member' : 'Add Staff Member'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Staff Member' : 'Add Staff Member'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basic" className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  Basic
                </TabsTrigger>
                <TabsTrigger value="employment" className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" />
                  Employment
                </TabsTrigger>
                <TabsTrigger value="skills" className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Skills
                </TabsTrigger>
                <TabsTrigger value="bank" className="flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" />
                  Bank
                </TabsTrigger>
                <TabsTrigger value="assets" className="flex items-center gap-1.5">
                  <Package className="h-4 w-4" />
                  Assets
                </TabsTrigger>
              </TabsList>

              {/* ==================== Basic Info Tab ==================== */}
              <TabsContent value="basic" className="space-y-4 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Label htmlFor="username">Username {!isEditing && '*'}</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => handleChange('username', e.target.value)}
                      placeholder="johndoe"
                      disabled={isEditing}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <select
                      id="gender"
                      className="w-full h-10 px-3 border rounded-md"
                      value={formData.gender}
                      onChange={(e) => handleChange('gender', e.target.value)}
                    >
                      <option value="">Not specified</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Employee gender.
                    </p>
                  </div>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="branch_id">Primary Branch *</Label>
                    <select
                      id="branch_id"
                      className="w-full h-10 px-3 border rounded-md"
                      value={formData.branch_id}
                      onChange={(e) => {
                        handleChange('branch_id', e.target.value)
                        handleChange(
                          'additional_branches',
                          formData.additional_branches.filter(bid => bid !== e.target.value)
                        )
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
                                  handleChange('additional_branches', current.filter(bid => bid !== b.branch_id))
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

              {/* ==================== Employment Tab ==================== */}
              <TabsContent value="employment" className="space-y-4 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Label htmlFor="biometric_id">Biometric ID</Label>
                    <Input
                      id="biometric_id"
                      value={formData.biometric_id}
                      onChange={(e) => handleChange('biometric_id', e.target.value)}
                      placeholder="00000004"
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Label htmlFor="base_salary">
                      {formData.pay_type === 'incentive' ? 'Service Incentive (%)' : 'Salary (₹)'}
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="base_salary"
                          type="number"
                          min="0"
                          max={formData.pay_type === 'incentive' ? '100' : undefined}
                          step="any"
                          value={formData.base_salary}
                          onChange={(e) => handleChange('base_salary', e.target.value)}
                          placeholder={formData.pay_type === 'incentive' ? 'e.g. 20' : '25000'}
                          disabled={!isOwner}
                          className={formData.pay_type === 'incentive' ? 'pr-7' : ''}
                        />
                        {formData.pay_type === 'incentive' && (
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">%</span>
                        )}
                      </div>
                      <select
                        id="pay_type"
                        aria-label="Pay type"
                        className="h-10 px-3 border rounded-md disabled:opacity-50"
                        value={formData.pay_type}
                        onChange={(e) => handleChange('pay_type', e.target.value)}
                        disabled={!isOwner}
                      >
                        <option value="">—</option>
                        <option value="daily">Daily</option>
                        <option value="monthly">Monthly</option>
                        <option value="incentive">Incentive based</option>
                      </select>
                    </div>
                    {formData.pay_type === 'incentive' && (
                      <p className="text-xs text-muted-foreground">
                        This employee earns this percentage of each service they complete (e.g. 20%)
                      </p>
                    )}
                    {!isOwner && (
                      <p className="text-xs text-muted-foreground">
                        Only the owner or developer can change salary / incentive rate
                      </p>
                    )}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              {/* ==================== Skills Tab ==================== */}
              <TabsContent value="skills" className="space-y-4 mt-6">
                <div>
                  <Label>Skills</Label>
                  <p className="text-xs text-gray-500 mt-1">
                    Tap a skill to assign it to this employee. The system uses these to auto-allocate work at billing time — services that need a skill go to the next available employee who has it.
                  </p>
                </div>
                {allSkills.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center">
                    <p className="text-sm text-gray-500">
                      No skills defined yet. Create them under{' '}
                      <Link to="/skills" className="text-primary hover:underline">Catalog → Skills</Link>.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {allSkills.map((skill) => {
                        const selected = formData.skill_ids.includes(skill.id)
                        return (
                          <button
                            key={skill.id}
                            type="button"
                            onClick={() => toggleSkill(skill.id)}
                            className={
                              selected
                                ? 'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors'
                                : 'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:border-primary hover:text-primary transition-colors'
                            }
                          >
                            {skill.name}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs text-gray-400">
                      {formData.skill_ids.length} of {allSkills.length} selected
                    </p>
                  </>
                )}
              </TabsContent>

              {/* ==================== Bank Details Tab ==================== */}
              <TabsContent value="bank" className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => handleChange('bank_name', e.target.value)}
                    placeholder="e.g., State Bank of India"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              {/* ==================== Assets Tab ==================== */}
              <TabsContent value="assets" className="space-y-4 mt-6">
                {!isEditing ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Package className="h-12 w-12 text-muted-foreground/40 mb-4" />
                    <h3 className="text-lg font-semibold text-muted-foreground">Assets</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Save the staff member first to manage their assets.
                    </p>
                  </div>
                ) : (
                  <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Assigned Assets</h3>
                      <p className="text-sm text-muted-foreground">
                        Track equipment, tools and items assigned to this staff member.
                      </p>
                    </div>
                    {!showAssetForm && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          resetAssetForm()
                          setShowAssetForm(true)
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Add Asset
                      </Button>
                    )}
                  </div>

                  {/* Inline Add/Edit Form */}
                  {showAssetForm && (
                    <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                      <p className="text-sm font-medium">
                        {editingAssetId ? 'Edit Asset' : 'New Asset'}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="asset_name" className="text-xs">Name *</Label>
                          <Input
                            id="asset_name"
                            value={assetForm.name}
                            onChange={(e) => setAssetForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Hair Dryer"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="asset_type" className="text-xs">Type *</Label>
                          <select
                            id="asset_type"
                            className="w-full h-10 px-3 border rounded-md text-sm bg-white"
                            value={assetForm.type}
                            onChange={(e) => setAssetForm(prev => ({ ...prev, type: e.target.value }))}
                          >
                            <option value="debit">Given (Debit)</option>
                            <option value="credit">Returned (Credit)</option>
                            <option value="broken">Broken (Credit)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="asset_amount" className="text-xs">Amount (&#8377;) *</Label>
                          <Input
                            id="asset_amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={assetForm.amount}
                            onChange={(e) => setAssetForm(prev => ({ ...prev, amount: e.target.value }))}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="asset_quantity" className="text-xs">Quantity *</Label>
                          <Input
                            id="asset_quantity"
                            type="number"
                            min="1"
                            step="1"
                            value={assetForm.quantity}
                            onChange={(e) => setAssetForm(prev => ({ ...prev, quantity: e.target.value }))}
                            placeholder="1"
                          />
                        </div>
                      </div>

                      {/* Reason input (Always visible, but marked mandatory if credit/Returned or broken) */}
                      <div className="space-y-1">
                        <Label htmlFor="asset_notes" className="text-xs">
                          Reason {(assetForm.type === 'credit' || assetForm.type === 'broken') && '*'}
                        </Label>
                        <Input
                          id="asset_notes"
                          value={assetForm.notes}
                          onChange={(e) => setAssetForm(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder={
                            assetForm.type === 'credit'
                              ? "Reason for returning (required)"
                              : assetForm.type === 'broken'
                              ? "How did it break? (required)"
                              : "Optional comments/reason"
                          }
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAssetSubmit}
                          disabled={isAssetSubmitting}
                        >
                          {isAssetSubmitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                          {editingAssetId ? 'Update' : 'Add'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={resetAssetForm}
                          disabled={isAssetSubmitting}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Assets Table */}
                  {isLoadingAssets ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : allNormalizedAssets.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground border rounded-lg">
                      <Package className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No assets assigned yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Active Assets Holdings */}
                      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-muted/20 border-b">
                          <h4 className="text-sm font-semibold text-gray-900">Current Possessed Assets</h4>
                          <p className="text-xs text-muted-foreground">List of assets currently in possession of the employee.</p>
                        </div>
                        {activeAssets.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground text-xs">
                            No assets currently in possession. All previously assigned items have been returned.
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="text-right">Rate (&#8377;)</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead className="text-right">Total Value</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {activeAssets.map((asset) => (
                                <TableRow key={asset.id}>
                                  <TableCell className="font-medium text-gray-900">{asset.name}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(asset.amount)}</TableCell>
                                  <TableCell className="text-right font-semibold text-primary">{asset.quantity}</TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(asset.amount * asset.quantity)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                            <TableFooter>
                              <TableRow>
                                <TableCell colSpan={3} className="font-semibold">
                                  Current Assets Net Value
                                </TableCell>
                                <TableCell className="text-right font-bold text-gray-900">
                                  {formatCurrency(totalAssetsValue)}
                                </TableCell>
                              </TableRow>
                            </TableFooter>
                          </Table>
                        )}
                      </div>

                      {/* Transaction Logs (Collapsible Accordion) */}
                      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                        <button
                          type="button"
                          className="w-full flex items-center justify-between px-4 py-3.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                          onClick={() => setShowTransactionLog(prev => !prev)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">Transaction History Logs</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                              {allNormalizedAssets.length}
                            </span>
                          </div>
                          {showTransactionLog ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                        {showTransactionLog && (
                          <div className="border-t">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Name / Reason</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead className="text-right">Rate (&#8377;)</TableHead>
                                  <TableHead className="text-right">Quantity</TableHead>
                                  <TableHead className="text-right">Transaction Value</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {allNormalizedAssets.map((asset) => {
                                  const isCredit = (parseInt(asset.quantity) || 0) < 0
                                  return (
                                    <TableRow key={asset.id} className={isCredit ? 'bg-green-50/20' : 'bg-rose-50/10'}>
                                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                        {formatDate(asset.createdAt)}
                                      </TableCell>
                                      <TableCell className="max-w-[200px]">
                                        <div className="font-medium text-gray-900 truncate" title={asset.name}>
                                          {asset.name}
                                        </div>
                                        {asset.notes && (
                                          <div className="text-xs text-muted-foreground mt-0.5 break-words">
                                            <span className="font-semibold text-gray-500">Reason:</span> {asset.notes}
                                          </div>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {isCredit ? (
                                          asset.notes?.startsWith('[Broken] ') ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                              Broken (Credit)
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800">
                                              Returned (Credit)
                                            </span>
                                          )
                                        ) : (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                                            Given (Debit)
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right text-xs">
                                        {formatCurrency(asset.amount)}
                                      </TableCell>
                                      <TableCell className="text-right font-mono text-xs">
                                        {Math.abs(parseInt(asset.quantity) || 0)}
                                      </TableCell>
                                      <TableCell className="text-right font-medium text-xs">
                                        {formatCurrency(parseFloat(asset.amount) * Math.abs(parseInt(asset.quantity) || 0))}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditAsset(asset)}
                                            disabled={isAssetSubmitting || deleteAssetMutation.isPending}
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700"
                                            onClick={() => handleDeleteAsset(asset.id)}
                                            disabled={deleteAssetMutation.isPending}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/staff')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? 'Update Staff' : 'Add Staff'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default StaffFormPage
