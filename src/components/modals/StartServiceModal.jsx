import { useState, useEffect } from 'react'
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
import { Kbd } from '@/components/ui/kbd'
import { Loader2, Play, Users, X } from 'lucide-react'
import { toast } from 'sonner'

function StartServiceModal({ open, onOpenChange, item }) {
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const [selected, setSelected] = useState([]) // [{ employee_id, full_name }]
  const [pickingQueue, setPickingQueue] = useState(false)

  const branchId = item?.branch_id || user?.branchId
  const serviceId = item?.service_id || null
  const alreadyOn = item?.employees || []
  const isAdding = alreadyOn.length > 0

  const { data: employeesData } = useQuery({
    queryKey: ['branch-employees', branchId],
    queryFn: () => branchService.getBranchEmployees(branchId),
    enabled: open && !!branchId,
  })
  const employees = employeesData?.data || []

  const takenIds = new Set([...alreadyOn.map((e) => e.employee_id), ...selected.map((e) => e.employee_id)])

  useEffect(() => {
    if (!open) return
    setSelected([])
  }, [open, item?.item_id])

  const addEmployee = (employeeId) => {
    const emp = employees.find((e) => e.employee_id === employeeId)
    if (!emp || takenIds.has(employeeId)) return
    setSelected((prev) => [...prev, { employee_id: emp.employee_id, full_name: emp.full_name }])
  }

  const handlePickFromQueue = async () => {
    if (!branchId) return
    setPickingQueue(true)
    try {
      const res = await rotationQueueService.pickNext({ branchId, serviceId: serviceId || undefined, exclude: [...takenIds], held: [] })
      const row = res?.data ?? null
      if (!row?.employee_id) {
        toast.warning('No eligible employee in the check-in queue')
        return
      }
      setSelected((prev) => [...prev, { employee_id: row.employee_id, full_name: row.full_name }])
      toast.success(`Added ${row.full_name} from queue`)
    } catch (err) {
      console.warn('Rotation queue pick failed:', err)
      toast.warning('No eligible employee in the check-in queue')
    } finally {
      setPickingQueue(false)
    }
  }

  const startServiceMutation = useMutation({
    // One call per employee; the first one starts the service, the rest join it.
    mutationFn: async () => {
      for (const emp of selected) {
        await billService.assignEmployeeFromQueue(item.bill_id, item.item_id, { employee_id: emp.employee_id })
      }
    },
    onSuccess: () => {
      toast.success(isAdding ? 'Employee added' : 'Service started')
      queryClient.invalidateQueries({ queryKey: ['pending-services'] })
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['bill', String(item.bill_id)] })
      queryClient.invalidateQueries({ queryKey: ['rotation-queue'] })
      queryClient.invalidateQueries({ queryKey: ['employee-status'] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to assign employee')
      queryClient.invalidateQueries({ queryKey: ['pending-services'] })
    },
  })

  const submit = () => {
    if (selected.length === 0) {
      toast.error('Add at least one employee')
      return
    }
    startServiceMutation.mutate()
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'BUTTON' && !e.target.closest('[data-searchable-select-dropdown]')) {
            e.preventDefault()
            if (!startServiceMutation.isPending && !pickingQueue) submit()
          } else if (e.altKey && e.key.toLowerCase() === 'q') {
            e.preventDefault()
            if (serviceId && !pickingQueue) handlePickFromQueue()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{isAdding ? 'Add Employee' : 'Start Service'}</DialogTitle>
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
            {isAdding && (
              <p className="mt-1 text-xs text-muted-foreground">
                Already on this service: <span className="font-medium text-foreground">{alreadyOn.map((e) => e.full_name).join(', ')}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{isAdding ? 'Add more employees' : 'Assign employees'}</Label>
            <p className="text-xs text-muted-foreground">Add one or more. The service shows as Started as soon as the first one is assigned.</p>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((emp) => (
                  <span key={emp.employee_id} className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                    {emp.full_name}
                    <button type="button" aria-label={`Remove ${emp.full_name}`} onClick={() => setSelected((prev) => prev.filter((p) => p.employee_id !== emp.employee_id))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <SearchableSelect
              key={selected.length}
              options={employees.filter((e) => !takenIds.has(e.employee_id)).map((emp) => ({ value: emp.employee_id, label: emp.full_name }))}
              value=""
              onChange={addEmployee}
              placeholder={pickingQueue ? 'Picking from queue…' : selected.length ? 'Add another employee…' : 'Select employee…'}
              disabled={pickingQueue}
            />
            {employees.length > 0 && employees.every((e) => takenIds.has(e.employee_id)) && (
              <p className="text-xs text-amber-700">Everyone at this branch is already on this service. Add more staff under Staff → Add employee.</p>
            )}
            {serviceId && (
              <Button type="button" variant="secondary" size="sm" className="w-full" onClick={handlePickFromQueue} disabled={pickingQueue}>
                {pickingQueue ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
                From Queue
                <Kbd className="ml-2">Alt+Q</Kbd>
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={startServiceMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={startServiceMutation.isPending || pickingQueue}>
            {startServiceMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                {isAdding ? 'Add' : 'Start Service'}
                <Kbd className="ml-2 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground">Enter</Kbd>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default StartServiceModal
