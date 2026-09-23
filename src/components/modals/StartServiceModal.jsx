import { useState, useEffect, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { billService } from '@/services/bill.service'
import { branchService } from '@/services/branch.service'
import { rotationQueueService } from '@/services/rotationQueue.service'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatCurrency } from '@/lib/utils'
import { Loader2, Play, Users } from 'lucide-react'
import { toast } from 'sonner'

function StartServiceModal({ open, onOpenChange, item }) {
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [pickingQueue, setPickingQueue] = useState(false)

  const branchId = item?.branch_id || user?.branchId
  const serviceId = item?.service_id || null

  const { data: employeesData } = useQuery({
    queryKey: ['branch-employees', branchId],
    queryFn: () => branchService.getBranchEmployees(branchId),
    enabled: open && !!branchId,
  })
  const employees = employeesData?.data || []

  const pickFromQueue = useCallback(async (exclude = []) => {
    if (!branchId) return null
    try {
      const res = await rotationQueueService.pickNext({
        branchId,
        serviceId: serviceId || undefined,
        exclude,
        held: [],
      })
      const picked = res?.data ?? null
      return picked?.employee_id ? picked : null
    } catch (err) {
      console.warn('Rotation queue pick failed:', err)
      return null
    }
  }, [branchId, serviceId])

  useEffect(() => {
    if (!open) return
    setSelectedEmployee('')
  }, [open, item?.item_id])

  const handlePickFromQueue = async () => {
    setPickingQueue(true)
    const row = await pickFromQueue(selectedEmployee ? [selectedEmployee] : [])
    setPickingQueue(false)
    if (!row) {
      toast.warning('No eligible employee in the check-in queue')
      return
    }
    setSelectedEmployee(row.employee_id)
    toast.success(`Assigned ${row.full_name} from queue`)
  }

  const startServiceMutation = useMutation({
    mutationFn: () => {
      const payload = {}
      if (selectedEmployee) {
        payload.employee_id = selectedEmployee
      }
      return billService.assignEmployeeFromQueue(item.bill_id, item.item_id, payload)
    },
    onSuccess: () => {
      toast.success('Service started successfully!')
      queryClient.invalidateQueries({ queryKey: ['pending-services'] })
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['bill', String(item.bill_id)] })
      queryClient.invalidateQueries({ queryKey: ['rotation-queue'] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to start service')
    },
  })

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start Service</DialogTitle>
          <p className="text-sm text-gray-500">
            {item.bill_number} &bull; {item.customer_name || 'Customer'}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="font-medium">{item.item_name}</span>
              <span className="text-sm text-gray-500">{formatCurrency(item.total_price)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Billed on {item.bill_date ? new Date(item.bill_date).toLocaleDateString('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Assign Employee</Label>
            <p className="text-xs text-muted-foreground">
              Select an employee from the dropdown or pick from the check-in queue.
            </p>
            <SearchableSelect
              options={employees.map(emp => ({ value: emp.employee_id, label: emp.full_name }))}
              value={selectedEmployee}
              onChange={setSelectedEmployee}
              placeholder={pickingQueue ? 'Picking from queue…' : 'Select employee…'}
              disabled={pickingQueue}
            />
            {serviceId && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={handlePickFromQueue}
                disabled={pickingQueue}
              >
                {pickingQueue ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                From Queue
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={startServiceMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!selectedEmployee) {
                toast.error('Please select an employee or pick from queue')
                return
              }
              startServiceMutation.mutate()
            }}
            disabled={startServiceMutation.isPending || pickingQueue}
          >
            {startServiceMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Service
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default StartServiceModal
