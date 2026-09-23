import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { shiftService } from '@/services/shift.service'
import { branchService } from '@/services/branch.service'
import { userService } from '@/services/user.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  SearchableSelect,
} from '@/components/ui/searchable-select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Clock, Loader2, Plus, Pencil, Power, PowerOff, Calendar, ChevronLeft, ChevronRight, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const initialShiftForm = {
  name: '',
  start_time: '',
  end_time: '',
  color_code: '#6366f1',
  grace_period: '5',
}

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const toYearMonth = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** Format HH:MM + minutes → display like 10:30 AM */
function formatGraceUntil(startTime, graceMinutes) {
  if (!HHMM_RE.test(startTime) || !Number.isFinite(graceMinutes) || graceMinutes < 0) return null
  const [h, m] = startTime.split(':').map(Number)
  const total = h * 60 + m + graceMinutes
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  const period = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh % 12 || 12
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`
}

function ShiftModal({ open, onOpenChange, shift = null, onSuccess }) {
  const isEditing = !!shift
  const [form, setForm] = useState(initialShiftForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (shift) {
      setForm({
        name: shift.name || '',
        start_time: shift.start_time || '',
        end_time: shift.end_time || '',
        color_code: shift.color_code || '#6366f1',
        grace_period: String(shift.grace_period ?? 5),
      })
    } else {
      setForm(initialShiftForm)
    }
  }, [shift, open])

  const graceMinutes = Number(form.grace_period)
  const graceUntil = formatGraceUntil(form.start_time, graceMinutes)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Shift name is required'); return }
    if (!HHMM_RE.test(form.start_time)) { toast.error('Start time must be HH:MM'); return }
    if (!HHMM_RE.test(form.end_time)) { toast.error('End time must be HH:MM'); return }

    const grace = Number(form.grace_period)
    if (!Number.isInteger(grace) || grace < 0 || grace > 120) {
      toast.error('Grace period must be a whole number of minutes (0–120)')
      return
    }

    const payload = {
      ...form,
      grace_period: grace,
    }

    setSaving(true)
    try {
      if (isEditing) {
        await shiftService.updateShift(shift.id, payload)
        toast.success('Shift updated')
      } else {
        await shiftService.createShift(payload)
        toast.success('Shift created')
      }
      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save shift')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shift_name">Shift Name *</Label>
            <Input
              id="shift_name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Morning"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time *</Label>
              <Input
                id="start_time"
                type="time"
                value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">End Time *</Label>
              <Input
                id="end_time"
                type="time"
                value={form.end_time}
                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="grace_period">Grace Period (minutes)</Label>
            <Input
              id="grace_period"
              type="text"
              inputMode="numeric"
              value={form.grace_period}
              onChange={(e) => {
                const v = e.target.value
                if (v === '' || /^\d+$/.test(v)) {
                  setForm((f) => ({ ...f, grace_period: v }))
                }
              }}
              placeholder="e.g. 30"
            />
            <p className="text-xs text-muted-foreground">
              Optional grace window after shift start (stored in minutes).
              {graceUntil
                ? ` Start ${form.start_time} + ${graceMinutes} min → until ${graceUntil}.`
                : ' Example: start 10:00 + 30 min → until 10:30 AM.'}
              {' '}Late time on attendance is still counted from shift start.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color_code}
                onChange={(e) => setForm((f) => ({ ...f, color_code: e.target.value }))}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0.5"
              />
              <Input
                value={form.color_code}
                onChange={(e) => setForm((f) => ({ ...f, color_code: e.target.value }))}
                placeholder="#6366f1"
                className="w-28 font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ShiftPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('shifts')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingShift, setEditingShift] = useState(null)

  const { user } = useSelector((state) => state.auth)
  const isOwnerDev = ['owner', 'developer'].includes(user?.role)
  const userBranchId = user?.branchId || user?.branch_id || user?.branch?.branch_id || user?.branch?.id || ''
  const [selectedBranchId, setSelectedBranchId] = useState(userBranchId)
  const [selectedMonth, setSelectedMonth] = useState(toYearMonth(new Date()))
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [detailDate, setDetailDate] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [employeeSearch, setEmployeeSearch] = useState('')

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
  })
  const branches = branchesData?.data || []

  const { data: shiftsData, isLoading: shiftsLoading, error: shiftsError } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => shiftService.getShifts(),
  })
  const shifts = shiftsData?.data || []

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['shift-assignments', selectedMonth],
    queryFn: () => shiftService.getAssignments({ month: selectedMonth }),
  })
  const assignments = assignmentsData?.data || []

  const effectiveBranchId = isOwnerDev ? selectedBranchId : userBranchId
  const { data: allUsersData } = useQuery({
    queryKey: ['users', { role: 'employee,manager,cashier', branch_id: effectiveBranchId }],
    queryFn: () => userService.getUsers({
      role: 'employee,manager,cashier',
      branch_id: effectiveBranchId || undefined,
      limit: 500,
    }),
  })

  const employees = allUsersData?.data || []

  const toggleMutation = useMutation({
    mutationFn: (id) => shiftService.toggleActive(id),
    onSuccess: () => {
      toast.success('Shift toggled')
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to toggle shift'),
  })

  const assignMutation = useMutation({
    mutationFn: ({ employeeId, shiftId, shiftDate }) =>
      shiftService.assignShift(employeeId, shiftId, shiftDate),
    onSuccess: () => {
      toast.success('Shift assigned')
      queryClient.invalidateQueries({ queryKey: ['shift-assignments'] })
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to assign shift'),
  })

  const removeAssignmentMutation = useMutation({
    mutationFn: (id) => shiftService.removeAssignment(id),
    onSuccess: () => {
      toast.success('Assignment removed')
      queryClient.invalidateQueries({ queryKey: ['shift-assignments'] })
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to remove assignment'),
  })

  const openAddModal = () => { setEditingShift(null); setModalOpen(true) }
  const openEditModal = (shift) => { setEditingShift(shift); setModalOpen(true) }

  const formatMonthYear = (monthStr) => {
    if (!monthStr) return ''
    const [year, month] = monthStr.split('-')
    const date = new Date(Number(year), Number(month) - 1, 1)
    return date.toLocaleDateString('default', { month: 'long', year: 'numeric' })
  }

  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const prev = new Date(year, month - 2, 1)
    setSelectedMonth(toYearMonth(prev))
  }

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const next = new Date(year, month, 1)
    setSelectedMonth(toYearMonth(next))
  }

  const calendarCells = useMemo(() => {
    if (!selectedMonth) return []
    const [year, monthNum] = selectedMonth.split('-').map(Number)
    const monthIdx = monthNum - 1
    const firstDay = new Date(year, monthIdx, 1)
    const startOfWeekDay = firstDay.getDay()
    const totalDays = new Date(year, monthIdx + 1, 0).getDate()
    const prevMonthTotalDays = new Date(year, monthIdx, 0).getDate()
    const cells = []
    for (let i = startOfWeekDay - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i
      const mStr = String(monthNum === 1 ? 12 : monthNum - 1).padStart(2, '0')
      const yVal = monthNum === 1 ? year - 1 : year
      cells.push({ day: d, dateStr: `${yVal}-${mStr}-${String(d).padStart(2, '0')}`, isCurrentMonth: false })
    }
    for (let i = 1; i <= totalDays; i++) {
      cells.push({
        day: i,
        dateStr: `${year}-${String(monthNum).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        isCurrentMonth: true,
      })
    }
    const remaining = 42 - cells.length
    for (let i = 1; i <= remaining; i++) {
      const mStr = String(monthNum === 12 ? 1 : monthNum + 1).padStart(2, '0')
      const yVal = monthNum === 12 ? year + 1 : year
      cells.push({ day: i, dateStr: `${yVal}-${mStr}-${String(i).padStart(2, '0')}`, isCurrentMonth: false })
    }
    return cells
  }, [selectedMonth])

  const getShiftForDate = (employeeId, dateStr) => {
    return assignments.find((a) => a.employee_id === employeeId && a.shift_date === dateStr) || null
  }

  const employeeId = (u) => u.user_id || u.id

  const employeeOptions = employees
    .map((u) => ({ value: employeeId(u), label: u.full_name }))

  const filteredEmployees = employeeSearch.trim()
    ? employees.filter((emp) => emp.full_name?.toLowerCase().includes(employeeSearch.trim().toLowerCase()))
    : employees

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shifts</h1>
          <p className="text-gray-500">Manage shift definitions and employee assignments</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-80 grid-cols-2">
          <TabsTrigger value="shifts" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Shifts
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Employee Schedule
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shifts" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Shift Definitions
              </CardTitle>
              <Button size="sm" onClick={openAddModal}>
                <Plus className="h-4 w-4 mr-1" />
                Add Shift
              </Button>
            </CardHeader>
            <CardContent>
              {shiftsLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : shiftsError ? (
                <div className="text-center py-10 text-red-500">Error loading shifts.</div>
              ) : shifts.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No shifts defined yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Employees</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shifts.map((shift) => (
                        <TableRow key={shift.id}>
                          <TableCell className="font-medium">{shift.name}</TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{shift.start_time} – {shift.end_time}</span>
                          </TableCell>
                          <TableCell>
                            {shift.color_code ? (
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded border" style={{ backgroundColor: shift.color_code }} />
                                <span className="text-xs font-mono text-gray-500">{shift.color_code}</span>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={shift.is_active ? 'success' : 'secondary'}>
                              {shift.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>{shift.employee_count ?? 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditModal(shift)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleMutation.mutate(shift.id)}
                                disabled={toggleMutation.isPending}
                              >
                                {shift.is_active ? <PowerOff className="h-4 w-4 text-gray-400" /> : <Power className="h-4 w-4 text-green-600" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          {/* Filter bar */}
          <Card>
            <CardContent className="pt-6 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="min-w-[200px]">
                  <Label className="text-xs mb-1 block">Employee</Label>
                  <SearchableSelect
                    options={employeeOptions}
                    value={selectedEmployeeId}
                    onChange={setSelectedEmployeeId}
                    placeholder="All employees"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Month</Label>
                  <div className="flex items-center gap-2 h-10 border rounded-md px-1 bg-background">
                    <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-semibold text-sm px-2 min-w-[120px] text-center">
                      {formatMonthYear(selectedMonth)}
                    </span>
                    <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              {isOwnerDev && (
                <div className="min-w-[200px]">
                  <Label className="text-xs mb-1 block">Branch</Label>
                  <SearchableSelect
                    options={branches.map((b) => ({ value: b.branch_id, label: b.name }))}
                    value={selectedBranchId}
                    onChange={setSelectedBranchId}
                    placeholder="All branches"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calendar Grid */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center font-semibold text-sm text-muted-foreground pb-2">
                    {day}
                  </div>
                ))}
                {calendarCells.map((cell, idx) => {
                  const dayAssignments = selectedEmployeeId
                    ? (() => {
                        const a = getShiftForDate(selectedEmployeeId, cell.dateStr)
                        return a ? [a] : []
                      })()
                    : assignments.filter((a) => a.shift_date === cell.dateStr)

                  const shiftGroups = {}
                  dayAssignments.forEach((a) => {
                    if (!shiftGroups[a.shift_id]) {
                      const shift = shifts.find((s) => s.id === a.shift_id)
                      shiftGroups[a.shift_id] = { ...a, shift }
                    }
                  })

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setDetailDate(cell.dateStr)
                        setShowDetailModal(true)
                        setEmployeeSearch('')
                      }}
                      className={`min-h-[90px] border rounded-lg p-2 transition-all flex flex-col justify-between cursor-pointer ${
                        cell.isCurrentMonth
                          ? 'bg-background hover:bg-slate-50 hover:shadow border-slate-100 hover:border-slate-300'
                          : 'bg-slate-50/40 opacity-40 border-slate-100/50 cursor-default'
                      }`}
                    >
                      <span className={`text-xs font-semibold self-end ${
                        cell.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {cell.day}
                      </span>
                      <div className="flex flex-col gap-1 mt-1">
                        {selectedEmployeeId ? (
                          (() => {
                            const a = getShiftForDate(selectedEmployeeId, cell.dateStr)
                            const shift = a ? shifts.find((s) => s.id === a.shift_id) : null
                            return shift ? (
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <div className="flex items-center gap-1 min-w-0">
                                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: shift.color_code || '#6366f1' }} />
                                  <span className="text-[10px] font-medium truncate">{shift.name}</span>
                                </div>
                                <span className="text-[9px] text-muted-foreground font-mono leading-tight pl-3">
                                  {shift.start_time}–{shift.end_time}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )
                          })()
                        ) : (
                          Object.values(shiftGroups).length > 0 ? (
                            Object.values(shiftGroups).slice(0, 3).map((sg) => (
                              <div key={sg.shift_id} className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sg.shift?.color_code || '#6366f1' }} />
                                <span className="text-[10px] truncate">{sg.shift?.name}</span>
                                <span className="text-[9px] text-muted-foreground ml-auto">
                                  {dayAssignments.filter((a) => a.shift_id === sg.shift_id).length}
                                </span>
                              </div>
                            ))
                          ) : (
                            cell.isCurrentMonth && <span className="text-gray-300 text-xs">—</span>
                          )
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Detail Modal - Assign Shifts */}
          <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader>
                <DialogTitle>
                  Assign Shifts for {detailDate}
                  {detailDate && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(detailDate + 'T00:00:00').getDay()]})
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>
              {detailDate && employees.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="Search employee name..."
                    className="pl-8 h-9"
                  />
                </div>
              )}
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {!detailDate ? (
                  <p className="text-muted-foreground">No date selected.</p>
                ) : employees.length === 0 ? (
                  <p className="text-muted-foreground">No employees found.</p>
                ) : filteredEmployees.length === 0 ? (
                  <p className="text-muted-foreground">No employees match "{employeeSearch}".</p>
                ) : (
                  (() => {
                    return filteredEmployees.map((emp) => {
                      const empId = employeeId(emp)
                      const existingAssignment = assignments.find(
                        (a) => a.employee_id === empId && a.shift_date === detailDate
                      )
                      return (
                        <div key={empId} className="flex items-center gap-3 p-2 border rounded-md">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{emp.full_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {emp.employee_details?.employee_code || ''}
                            </div>
                          </div>
                          <div className="w-44">
                            <SearchableSelect
                              options={shifts.filter((s) => s.is_active !== false).map((s) => ({
                                value: s.id,
                                label: `${s.name} (${s.start_time}–${s.end_time})`,
                              }))}
                              value={existingAssignment?.shift_id || ''}
                              onChange={(shiftId) => {
                                if (shiftId) {
                                  assignMutation.mutate({
                                    employeeId: empId,
                                    shiftId,
                                    shiftDate: detailDate,
                                  })
                                }
                              }}
                              placeholder="Select shift"
                              triggerClassName="h-9 text-xs"
                            />
                          </div>
                          {existingAssignment && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAssignmentMutation.mutate(existingAssignment.id)}
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-600 flex-shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )
                    })
                  })()
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => navigate(`/shifts/assignments/${detailDate}`)}>
                  View Assignments
                </Button>
                <Button variant="outline" onClick={() => setShowDetailModal(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Shift Modal */}
      <ShiftModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        shift={editingShift}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['shifts'] })}
      />
    </div>
  )
}

export default ShiftPage
