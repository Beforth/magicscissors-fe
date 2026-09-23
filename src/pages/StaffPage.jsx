import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { userService } from '@/services/user.service'
import { branchService } from '@/services/branch.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BranchColorDot } from '@/components/ui/branch-color-dot'
import { formatDate } from '@/lib/utils'
import {
  Users,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Star,
  Building2,
} from 'lucide-react'
import { toast } from 'sonner'

const roleColors = {
  owner: 'bg-purple-100 text-purple-700',
  developer: 'bg-blue-100 text-blue-700',
  manager: 'bg-green-100 text-green-700',
  cashier: 'bg-orange-100 text-orange-700',
  employee: 'bg-gray-100 text-gray-700',
}

function StaffPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)
  const isOwner = user?.role === 'owner' || user?.role === 'developer'

  const [search, setSearch] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [page, setPage] = useState(1)

  // Fetch users
  const { data, isLoading, error } = useQuery({
    queryKey: ['users', { page, search, role: selectedRole, branch_id: selectedBranch, is_active: activeFilter }],
    queryFn: () => userService.getUsers({
      page,
      limit: 20,
      search: search || undefined,
      role: selectedRole || undefined,
      branch_id: selectedBranch || undefined,
      is_active: activeFilter || undefined,
    }),
  })

  // Fetch branches for filter
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: isOwner,
  })

  const users = data?.data || []
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 }
  const branches = branchesData?.data || []

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: userService.deleteUser,
    onSuccess: () => {
      toast.success('User deactivated successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to deactivate user')
    },
  })

  const handleAddUser = () => {
    navigate('/staff/new')
  }

  const handleEditUser = (staffMember) => {
    navigate(`/staff/${staffMember.user_id}/edit`)
  }

  const handleDeleteUser = (userId) => {
    if (window.confirm('Are you sure you want to deactivate this user?')) {
      deleteMutation.mutate(userId)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-gray-500">Manage employees, managers and staff</p>
        </div>
        <Button onClick={handleAddUser}>
          <Plus className="h-4 w-4 mr-2" />
          Add Staff Member
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Staff</p>
                <p className="text-2xl font-bold">{pagination.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.is_active).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Star className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Managers</p>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.role === 'manager').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Branches</p>
                <p className="text-2xl font-bold">{branches.length || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, employee ID, phone..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                />
              </div>
            </div>
            <select
              className="h-10 px-3 border rounded-md min-w-[150px]"
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All Roles</option>
              <option value="manager">Manager</option>
              <option value="cashier">Cashier</option>
              <option value="employee">Employee</option>
              {isOwner && <option value="owner">Owner</option>}
            </select>
            {isOwner && (
              <select
                className="h-10 px-3 border rounded-md min-w-[150px]"
                value={selectedBranch}
                onChange={(e) => {
                  setSelectedBranch(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.branch_id} value={branch.branch_id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            )}
            <select
              className="h-10 px-3 border rounded-md"
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff Members
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
              Error loading staff. Please try again.
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No staff members found.</p>
              <Button className="mt-4" onClick={handleAddUser}>
                Add First Staff Member
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Biometric ID</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((staff) => (
                  <TableRow key={staff.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-primary font-semibold">
                            {staff.full_name?.charAt(0)?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{staff.full_name}</p>
                          <p className="text-xs text-gray-500">@{staff.username}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-gray-600">
                      {staff.employee_details?.biometric_id || '—'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{staff.email}</p>
                        {staff.phone && (
                          <p className="text-xs text-gray-500">{staff.phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={roleColors[staff.role] || 'bg-gray-100'}>
                        {staff.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <BranchColorDot color={staff.branch?.color_code} />
                        {staff.branch?.name || (
                          <span className="text-gray-400">All Branches</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {staff.employee_details?.joining_date
                        ? formatDate(staff.employee_details.joining_date)
                        : formatDate(staff.created_at)}
                    </TableCell>
                    <TableCell>
                      {staff.is_active ? (
                        <Badge variant="success" className="flex items-center gap-1 w-fit">
                          <UserCheck className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <UserX className="h-3 w-3" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(staff)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isOwner && staff.user_id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteUser(staff.user_id)}
                            disabled={deleteMutation.isPending}
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
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages}
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
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}

export default StaffPage
