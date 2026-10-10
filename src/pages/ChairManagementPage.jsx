import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { chairService } from '@/services/chair.service'
import { branchService } from '@/services/branch.service'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Armchair,
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Wrench,
  Power,
  PowerOff,
  Eye,
  Unlock,
} from 'lucide-react'
import { toast } from 'sonner'
import ChairModal from '@/components/modals/ChairModal'

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'inactive', label: 'Inactive' },
]

const statusStyles = {
  available: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    dot: 'bg-green-500',
    text: 'text-green-700',
    badge: 'success',
  },
  occupied: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-500',
    text: 'text-red-700',
    badge: 'destructive',
  },
  maintenance: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    dot: 'bg-yellow-500',
    text: 'text-yellow-700',
    badge: 'warning',
  },
  inactive: {
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    dot: 'bg-gray-500',
    text: 'text-gray-500',
    badge: 'secondary',
  },
}

function ChairManagementPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const userBranchId = user?.branchId || null

  const [selectedBranch, setSelectedBranch] = useState(userBranchId || '')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingChair, setEditingChair] = useState(null)

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: !userBranchId,
  })

  const branches = branchesData?.data || []
  const activeBranchId = selectedBranch || userBranchId

  const { data: chairsData, isLoading } = useQuery({
    queryKey: ['chairs', { branch_id: activeBranchId }],
    queryFn: () => chairService.getChairs({ branch_id: activeBranchId }),
    enabled: !!activeBranchId,
  })

  const chairs = chairsData?.data || []

  const filteredChairs =
    statusFilter === 'all' ? chairs : chairs.filter((c) => c.status === statusFilter)

  const statusUpdateMutation = useMutation({
    mutationFn: ({ id, data }) => chairService.updateChairStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chairs'] })
      toast.success('Chair status updated')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update chair status')
    },
  })

  const handleStatusChange = (chairId, newStatus) => {
    statusUpdateMutation.mutate({ id: chairId, data: { status: newStatus } })
  }

  const handleEdit = (chair) => {
    setEditingChair(chair)
    setModalOpen(true)
  }

  const handleAdd = () => {
    setEditingChair(null)
    setModalOpen(true)
  }

  // Summary counts
  const counts = {
    total: chairs.length,
    available: chairs.filter((c) => c.status === 'available').length,
    occupied: chairs.filter((c) => c.status === 'occupied').length,
    maintenance: chairs.filter((c) => c.status === 'maintenance').length,
    inactive: chairs.filter((c) => c.status === 'inactive').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Salon Floor
          </h1>
          <p className="text-gray-500">Manage chairs and track occupancy</p>
        </div>
        <Button onClick={handleAdd} disabled={!activeBranchId}>
          Add Chair
        </Button>
      </div>

      {/* Branch selector + Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {!userBranchId && (
          <div>
            <select
              className="h-10 px-3 border rounded-md"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="">Select Branch</option>
              {branches.map((b) => (
                <option key={b.branch_id} value={b.branch_id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
              {f.value !== 'all' && counts[f.value] > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 min-w-[20px] text-xs">
                  {counts[f.value]}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Chair Grid */}
      {!activeBranchId ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            Please select a branch to view chairs.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredChairs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            {chairs.length === 0
              ? 'No chairs found. Add your first chair!'
              : 'No chairs match the selected filter.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredChairs.map((chair) => {
            const style = statusStyles[chair.status] || statusStyles.inactive
            return (
              <Card
                key={chair.chair_id}
                className={`${style.bg} ${style.border} border-2 transition-shadow hover:shadow-md`}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Header: number + status dot */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${style.dot}`} />
                      <span className="font-bold text-lg">{chair.chair_number}</span>
                    </div>
                    <Badge variant={style.badge} className="text-xs capitalize">
                      {chair.status}
                    </Badge>
                  </div>

                  {/* Name */}
                  {chair.chair_name && (
                    <p className="text-sm text-gray-600 truncate">{chair.chair_name}</p>
                  )}

                  {/* Occupied info */}
                  {chair.status === 'occupied' && chair.current_bill && (
                    <div className="text-xs space-y-1 p-2 bg-white/60 rounded border border-red-100">
                      <p className="font-mono font-medium">
                        {chair.current_bill.bill_number}
                      </p>
                      {chair.current_bill.customer_name && (
                        <p className="text-gray-600">{chair.current_bill.customer_name}</p>
                      )}
                      {chair.current_bill.customer_phone && (
                        <p className="text-gray-500">{chair.current_bill.customer_phone}</p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    {chair.status === 'occupied' && chair.current_bill && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => navigate(`/bills/${chair.current_bill.bill_id}`)}
                      >
                        View Bill
                      </Button>
                    )}

                    {chair.status === 'inactive' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => handleStatusChange(chair.chair_id, 'available')}
                        disabled={statusUpdateMutation.isPending}
                      >
                        Activate
                      </Button>
                    )}

                    {(chair.status === 'available' || chair.status === 'maintenance') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleEdit(chair)}
                      >
                        Edit
                      </Button>
                    )}

                    {/* More actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-xs font-semibold">
                          •••
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {chair.status === 'available' && (
                          <>
                            <DropdownMenuItem onClick={() => handleEdit(chair)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(chair.chair_id, 'maintenance')}
                            >
                              Set Maintenance
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(chair.chair_id, 'inactive')}
                            >
                              Deactivate
                            </DropdownMenuItem>
                          </>
                        )}
                        {chair.status === 'occupied' && (
                          <>
                            {chair.current_bill && (
                              <DropdownMenuItem
                                onClick={() => navigate(`/bills/${chair.current_bill.bill_id}`)}
                              >
                                View Bill
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => {
                                if (window.confirm('Release this chair? The associated bill will remain pending.')) {
                                  handleStatusChange(chair.chair_id, 'available')
                                }
                              }}
                            >
                              Release Chair
                            </DropdownMenuItem>
                          </>
                        )}
                        {chair.status === 'maintenance' && (
                          <>
                            <DropdownMenuItem onClick={() => handleEdit(chair)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(chair.chair_id, 'available')}
                            >
                              <Power className="h-4 w-4 mr-2" />
                              Set Available
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(chair.chair_id, 'inactive')}
                            >
                              <PowerOff className="h-4 w-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          </>
                        )}
                        {chair.status === 'inactive' && (
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(chair.chair_id, 'available')}
                          >
                            <Power className="h-4 w-4 mr-2" />
                            Activate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Summary Bar */}
      {activeBranchId && chairs.length > 0 && (
        <div className="text-sm text-gray-500 flex flex-wrap gap-3">
          <span>{counts.total} chairs</span>
          <span className="text-gray-300">|</span>
          <span className="text-green-600">{counts.available} Available</span>
          <span className="text-gray-300">|</span>
          <span className="text-red-600">{counts.occupied} Occupied</span>
          <span className="text-gray-300">|</span>
          <span className="text-yellow-600">{counts.maintenance} Maintenance</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">{counts.inactive} Inactive</span>
        </div>
      )}

      {/* Chair Modal */}
      <ChairModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        chair={editingChair}
        branchId={activeBranchId}
      />
    </div>
  )
}

export default ChairManagementPage
