import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import {
  Loader2, Clock, Coffee, CheckCircle2, XCircle, UserMinus, Zap,
  RefreshCw, Calendar, ChevronLeft, ChevronRight, List, Search
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { attendanceService } from '@/services/attendance.service'
import { branchService } from '@/services/branch.service'
import { machineService } from '@/services/machine.service'

const STATUS_META = {
  on_floor:     { label: 'On floor',     badge: 'success',     icon: CheckCircle2 },
  on_break:     { label: 'On break',     badge: 'warning',     icon: Coffee },
  checked_out:  { label: 'Checked out',  badge: 'secondary',   icon: Clock },
  not_arrived:  { label: 'Not arrived',  badge: 'outline',     icon: XCircle },
  on_leave:     { label: 'On leave',     badge: 'secondary',   icon: UserMinus },
}

function formatTimeStored(iso) {
  if (!iso) return '—'
  // Prefer wall-clock digits (IST-as-UTC naive ISO) over browser-local parsing
  const m = String(iso).match(/(\d{2}):(\d{2})/)
  if (m) return `${m[1]}:${m[2]}`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function parseHHMMToMinutes(value) {
  if (!value || !/^\d{1,2}:\d{2}/.test(String(value))) return null
  const [h, m] = String(value).slice(0, 5).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function parseCheckInMinutes(iso) {
  if (!iso) return null
  const m = String(iso).match(/[T ](\d{2}):(\d{2})/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Format late_penalty_hours as minutes/hours after grace (e.g. 0.02 → 1m, 1.5 → 1h 30m). */
function formatLate(hours) {
  const h = typeof hours === 'number' ? hours : parseFloat(hours)
  if (!Number.isFinite(h) || h <= 0) return null
  const totalMin = Math.round(h * 60)
  if (totalMin < 60) return `${totalMin}m`
  const hrs = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  return mins ? `${hrs}h ${mins}m` : `${hrs}h`
}

/**
 * Always derive late label from check-in vs shift start (minutes after start).
 * Example: start 10:28, check-in 10:29 → 1m. Independent of checkout.
 */
function getLateLabel(emp) {
  if (!emp?.check_in || emp.has_flexible_timing) return null
  const startMin = parseHHMMToMinutes(emp.shift_start)
  const inMin = parseCheckInMinutes(emp.check_in)
  if (startMin == null || inMin == null) return formatLate(emp.late_penalty_hours)

  const lateMin = inMin - startMin
  if (lateMin <= 0) return null
  return formatLate(lateMin / 60)
}

const toYearMonth = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export default function AttendancePage() {
  const { user } = useSelector((state) => state.auth)
  const queryClient = useQueryClient()
  const canAct = ['owner', 'developer', 'manager', 'cashier'].includes(user?.role)

  const [branchId, setBranchId] = useState(user?.branchId || '')
  const [leaveModal, setLeaveModal] = useState(null) // { employee, reason }
  const [leaveReason, setLeaveReason] = useState('')
  const [punchModal, setPunchModal] = useState(null) // { employee, type }
  const [punchDateTime, setPunchDateTime] = useState('')
  const [punchReason, setPunchReason] = useState('')
  const [editTimesModal, setEditTimesModal] = useState(null) // { employee }
  const [editCheckIn, setEditCheckIn] = useState('')
  const [editCheckOut, setEditCheckOut] = useState('')

  // Calendar states
  const [activeTab, setActiveTab] = useState('today')
  const [selectedMonth, setSelectedMonth] = useState(toYearMonth(new Date())) // YYYY-MM
  const [calendarSubTab, setCalendarSubTab] = useState('grid')
  const [detailDate, setDetailDate] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [rosterSearch, setRosterSearch] = useState('')

  const { data: branchesData } = useQuery({
    queryKey: ['branches', 'active', 'salon'],
    queryFn: () => branchService.getBranches({ is_active: 'true', type: 'salon' }),
  })
  const branches = useMemo(
    () => (branchesData?.data || []).filter((b) => b.is_salon !== false),
    [branchesData?.data]
  )

  // Warehouse-only branches must not appear in attendance; reset if selection is invalid.
  useEffect(() => {
    if (branches.length === 0) return
    const currentValid = branches.some((b) => b.branch_id === branchId)
    if (!currentValid) {
      const userSalon = branches.find((b) => b.branch_id === user?.branchId)
      setBranchId(userSalon?.branch_id || branches[0].branch_id)
    }
  }, [branches, branchId, user?.branchId])

  const { data: machinesData, isLoading: machinesLoading, isFetched: machinesFetched } = useQuery({
    queryKey: ['machines', branchId],
    queryFn: () => machineService.list({ branch_id: branchId }),
    enabled: !!branchId,
  })
  const machines = machinesData?.data || []
  const defaultMachineNo = useMemo(
    () => machines.find((m) => m.is_active)?.machine_no || machines[0]?.machine_no || '',
    [machines]
  )

  const ensureMachineMutation = useMutation({
    mutationFn: () => machineService.ensureDefault({ branch_id: branchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines', branchId] })
    },
  })
  const ensuredBranchRef = useRef(null)

  useEffect(() => {
    ensuredBranchRef.current = null
  }, [branchId])

  useEffect(() => {
    if (!branchId || !machinesFetched || machinesLoading) return
    if (machines.length > 0) {
      ensuredBranchRef.current = branchId
      return
    }
    if (ensuredBranchRef.current === branchId || ensureMachineMutation.isPending) return
    ensuredBranchRef.current = branchId
    ensureMachineMutation.mutate()
  }, [branchId, machinesFetched, machinesLoading, machines.length, ensureMachineMutation.isPending])

  // Today's roster query
  const { data: rosterData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['attendance-today', branchId],
    queryFn: () => attendanceService.getTodayRoster({ branch_id: branchId }),
    enabled: !!branchId && activeTab === 'today',
    refetchInterval: activeTab === 'today' ? 60_000 : undefined,
  })
  const roster = useMemo(() => {
    const data = rosterData?.data
    if (!data) return data
    const shouldExcludeSelf = ['manager', 'cashier'].includes(user?.role)
    const isCashier = user?.role === 'cashier'
    return {
      ...data,
      employees: (data.employees || []).filter((emp) => {
        if (shouldExcludeSelf && emp.id === user?.id) return false
        if (isCashier && emp.role === 'manager') return false
        return true
      }),
    }
  }, [rosterData?.data, user?.id, user?.role])

  const filteredRosterEmployees = useMemo(() => {
    const list = roster?.employees || []
    const q = rosterSearch.trim().toLowerCase()
    if (!q) return list
    return list.filter((emp) =>
      emp.full_name?.toLowerCase().includes(q) || emp.employee_code?.toLowerCase().includes(q)
    )
  }, [roster?.employees, rosterSearch])

  // Monthly attendance query
  const { data: monthlyDataResponse, isLoading: monthlyLoading, refetch: refetchMonthly } = useQuery({
    queryKey: ['attendance-monthly', branchId, selectedMonth],
    queryFn: () => attendanceService.getMonthlyAttendance({ branch_id: branchId, month: selectedMonth }),
    enabled: !!branchId && activeTab === 'calendar',
  })
  const monthlyData = monthlyDataResponse?.data

  const employeesList = useMemo(() => {
    const list = monthlyData?.employees || []
    const shouldExcludeSelf = ['manager', 'cashier'].includes(user?.role)
    const isCashier = user?.role === 'cashier'
    return list.filter((emp) => {
      if (shouldExcludeSelf && emp.id === user?.id) return false
      if (isCashier && emp.role === 'manager') return false
      return true
    })
  }, [monthlyData?.employees, user?.id, user?.role])

  useEffect(() => {
    if (employeesList.length > 0) {
      const exists = employeesList.some((emp) => emp.employee_details_id === selectedEmployeeId)
      if (!exists) {
        setSelectedEmployeeId(employeesList[0].employee_details_id)
      }
    } else {
      setSelectedEmployeeId('')
    }
  }, [employeesList, selectedEmployeeId])

  // Date drilldown query
  const { data: detailRosterData, isLoading: detailRosterLoading } = useQuery({
    queryKey: ['attendance-detail', branchId, detailDate],
    queryFn: () => attendanceService.getTodayRoster({ branch_id: branchId, date: detailDate }),
    enabled: !!branchId && !!detailDate && showDetailModal,
  })
  const detailRoster = detailRosterData?.data

  const breakStartMutation = useMutation({
    mutationFn: (data) => attendanceService.startBreak(data),
    onSuccess: () => {
      toast.success('Break started')
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-detail'] })
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed'),
  })
  const breakEndMutation = useMutation({
    mutationFn: (data) => attendanceService.endBreak(data),
    onSuccess: () => {
      toast.success('Break ended')
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-detail'] })
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed'),
  })
  const markLeaveMutation = useMutation({
    mutationFn: (data) => attendanceService.markLeave(data),
    onSuccess: () => {
      toast.success('Marked on leave')
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-detail'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-monthly'] })
      setLeaveModal(null)
      setLeaveReason('')
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed'),
  })
  const punchMutation = useMutation({
    mutationFn: (data) => attendanceService.ingestPunch(data),
    onSuccess: (_d, vars) => {
      toast.success(vars.punch_type === 'in' ? 'Checked in' : 'Checked out')
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-detail'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-monthly'] })
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed'),
  })

  const handleBreak = async (emp, type) => {
    let machineNo = defaultMachineNo
    if (!machineNo && branchId) {
      try {
        const res = await machineService.ensureDefault({ branch_id: branchId })
        machineNo = res?.data?.machine_no
        queryClient.invalidateQueries({ queryKey: ['machines', branchId] })
      } catch {
        toast.error('Could not set up attendance machine for this branch')
        return
      }
    }
    if (!machineNo) {
      toast.error('Register a machine for this branch before marking breaks manually')
      return
    }
    const payload = {
      employee_code: emp.employee_code,
      machine_no: machineNo,
      reason: type === 'start' ? 'Break start (cashier)' : 'Break end (cashier)',
    }
    if (type === 'start') breakStartMutation.mutate(payload)
    else breakEndMutation.mutate(payload)
  }

  const getLocalDatetimeString = (date = new Date()) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
  }

  /** Shop date YYYY-MM-DD without UTC day-shift. */
  const getShopDateStr = () => {
    if (detailDate) return detailDate
    const raw = roster?.shop_date
    if (typeof raw === 'string' && raw.length >= 10) return raw.slice(0, 10)
    if (raw) {
      const d = new Date(raw)
      if (!Number.isNaN(d.getTime())) {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      }
    }
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  }

  /**
   * datetime-local value is already the wall-clock the user sees.
   * Send without timezone so backend treats it as IST (normalizePunchTime).
   */
  const toIstPunchPayload = (datetimeLocal) => {
    if (!datetimeLocal) return null
    return datetimeLocal.length === 16 ? `${datetimeLocal}:00` : datetimeLocal
  }

  const handlePunch = async (emp, punchType) => {
    let machineNo = defaultMachineNo
    if (!machineNo && branchId) {
      try {
        const res = await machineService.ensureDefault({ branch_id: branchId })
        machineNo = res?.data?.machine_no
        queryClient.invalidateQueries({ queryKey: ['machines', branchId] })
      } catch {
        toast.error('Could not set up attendance machine for this branch')
        return
      }
    }
    if (!machineNo) {
      toast.error('Register a machine for this branch before punching manually')
      return
    }
    setPunchModal({ employee: emp, type: punchType })
    setPunchDateTime(getLocalDatetimeString())
    setPunchReason(punchType === 'in' ? 'Manual check-in (cashier)' : 'Manual check-out (cashier)')
  }

  const submitPunch = () => {
    if (!punchModal) return
    const { employee, type } = punchModal
    const dateObj = new Date(punchDateTime)
    if (isNaN(dateObj.getTime())) {
      toast.error('Invalid date and time selected')
      return
    }

    punchMutation.mutate({
      ...(employee.employee_code
        ? { employee_code: employee.employee_code }
        : { employee_id: employee.id }),
      machine_no: defaultMachineNo,
      punch_time: dateObj.toISOString(),
      punch_type: type,
      source: 'manual',
      reason: punchReason || (type === 'in' ? 'Manual check-in (cashier)' : 'Manual check-out (cashier)'),
    }, {
      onSuccess: () => {
        setPunchModal(null)
      }
    })
  }

  const updateTimesMutation = useMutation({
    mutationFn: (data) => attendanceService.updateTimes(data),
    onSuccess: async () => {
      toast.success('Punch times updated successfully')
      await queryClient.invalidateQueries({ queryKey: ['attendance-today'] })
      await queryClient.invalidateQueries({ queryKey: ['attendance-detail'] })
      await queryClient.invalidateQueries({ queryKey: ['attendance-monthly'] })
      await queryClient.refetchQueries({ queryKey: ['attendance-today'] })
      setEditTimesModal(null)
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed to update punch times'),
  })

  const openEditTimesModal = (emp) => {
    setEditTimesModal(emp)
    // check_in/out from API are IST wall-clock (naive). Keep digits as-is for datetime-local.
    const toLocalInput = (iso) => {
      if (!iso) return ''
      const m = String(iso).match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/)
      return m ? `${m[1]}T${m[2]}` : ''
    }
    setEditCheckIn(toLocalInput(emp.check_in))
    setEditCheckOut(toLocalInput(emp.check_out))
  }

  const submitUpdateTimes = () => {
    if (!editTimesModal) return

    updateTimesMutation.mutate({
      employee_id: editTimesModal.employee_details_id || editTimesModal.id,
      attendance_date: getShopDateStr(),
      check_in: toIstPunchPayload(editCheckIn),
      check_out: editCheckOut ? toIstPunchPayload(editCheckOut) : null,
    })
  }

  const openLeaveModal = (emp) => {
    setLeaveModal(emp)
    setLeaveReason('')
  }
  const submitLeave = () => {
    const targetDate = detailDate || (roster?.shop_date ? new Date(roster.shop_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
    markLeaveMutation.mutate({
      employee_id: leaveModal.employee_details_id || leaveModal.id,
      shop_date: targetDate,
      reason: leaveReason || 'Marked by cashier',
      branch_id: branchId,
    })
  }

  // Calendar calculations
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
    
    // Prev Month Padding
    for (let i = startOfWeekDay - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i
      const mStr = String(monthNum === 1 ? 12 : monthNum - 1).padStart(2, '0')
      const yVal = monthNum === 1 ? year - 1 : year
      const dateStr = `${yVal}-${mStr}-${String(d).padStart(2, '0')}`
      cells.push({
        day: d,
        dateStr,
        isCurrentMonth: false,
      })
    }
    
    // Current Month Days
    for (let i = 1; i <= totalDays; i++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      cells.push({
        day: i,
        dateStr,
        isCurrentMonth: true,
      })
    }
    
    // Next Month Padding
    const remaining = 42 - cells.length
    for (let i = 1; i <= remaining; i++) {
      const mStr = String(monthNum === 12 ? 1 : monthNum + 1).padStart(2, '0')
      const yVal = monthNum === 12 ? year + 1 : year
      const dateStr = `${yVal}-${mStr}-${String(i).padStart(2, '0')}`
      cells.push({
        day: i,
        dateStr,
        isCurrentMonth: false,
      })
    }
    
    return cells
  }, [selectedMonth])

  const daysInMonth = useMemo(() => {
    if (!selectedMonth) return []
    const [year, monthNum] = selectedMonth.split('-').map(Number)
    const totalDays = new Date(year, monthNum, 0).getDate()
    const days = []
    for (let i = 1; i <= totalDays; i++) {
      days.push(i)
    }
    return days
  }, [selectedMonth])

  const filteredEmployees = useMemo(() => {
    if (!selectedEmployeeId) return []
    return employeesList.filter((emp) => emp.employee_details_id === selectedEmployeeId)
  }, [employeesList, selectedEmployeeId])

  const isSelectedDateToday = useMemo(() => {
    if (!detailDate) return false
    const todayStr = new Date().toISOString().split('T')[0]
    return detailDate === todayStr
  }, [detailDate])

  const getCompactStatusBadge = (status) => {
    switch (status) {
      case 'present':
        return <Badge variant="success" className="w-6 h-6 p-0 rounded-full flex items-center justify-center text-xs">P</Badge>
      case 'late':
        return <Badge className="w-6 h-6 p-0 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center text-xs">L</Badge>
      case 'half_day':
        return <Badge className="w-6 h-6 p-0 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white flex items-center justify-center text-xs">½</Badge>
      case 'absent':
        return <Badge variant="destructive" className="w-6 h-6 p-0 rounded-full flex items-center justify-center text-xs">A</Badge>
      case 'on_leave':
        return <Badge variant="secondary" className="w-6 h-6 p-0 rounded-full flex items-center justify-center text-xs">LV</Badge>
      default:
        return <span className="text-gray-300">—</span>
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Attendance Management</h1>
          <p className="text-sm text-muted-foreground font-medium">
            {activeTab === 'today' && roster?.branch?.name ? `${roster.branch.name} · ` : ''}
            {activeTab === 'today' && roster?.shop_date ? `Shop date ${new Date(roster.shop_date).toLocaleDateString('en-CA')}` : 'Track shifts, floor status, and calendars'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (activeTab === 'today' ? refetch() : refetchMonthly())}
          disabled={isFetching || monthlyLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching || monthlyLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-80 grid-cols-2">
          <TabsTrigger value="today" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Today's Roster
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Calendar View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-6">
          <Card>
            <CardContent className="pt-6 flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px] max-w-sm">
                <Label className="text-xs mb-1 block">Branch</Label>
                <SearchableSelect
                  options={branches.map((b) => ({ value: b.branch_id, label: b.name }))}
                  value={branchId}
                  onChange={setBranchId}
                  placeholder="Select branch"
                />
              </div>
              <div className="flex-1 min-w-[200px] max-w-sm">
                <Label className="text-xs mb-1 block">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Search employee name or code..."
                    className="pl-8"
                  />
                </div>
              </div>
              {!defaultMachineNo && branchId && (
                <p className="text-xs text-amber-600">
                  {ensureMachineMutation.isPending
                    ? 'Setting up attendance machine for this branch…'
                    : ensureMachineMutation.isError
                      ? 'Could not auto-create attendance machine. Ask an owner to register one under Machines.'
                      : null}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !roster || roster.employees.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  No employees assigned to this branch.
                </p>
              ) : filteredRosterEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  No employees match "{rosterSearch}".
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>In</TableHead>
                      <TableHead>Out</TableHead>
                      <TableHead>Break</TableHead>
                      <TableHead>Worked</TableHead>
                      <TableHead>Late</TableHead>
                      {canAct && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRosterEmployees.map((emp) => {
                      const meta = STATUS_META[emp.current_status] || STATUS_META.not_arrived
                      const Icon = meta.icon
                      return (
                        <TableRow key={emp.id}>
                          <TableCell>
                            <div className="font-medium">{emp.full_name}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {emp.employee_code}
                              {emp.shift_start && emp.shift_end && !emp.has_flexible_timing && (
                                <span className="ml-2">shift {emp.shift_start}–{emp.shift_end}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={meta.badge}>
                              <Icon className="h-3 w-3 mr-1 inline" />{meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{formatTimeStored(emp.check_in)}</TableCell>
                          <TableCell className="font-mono text-xs">{formatTimeStored(emp.check_out)}</TableCell>
                          <TableCell>{emp.total_break_minutes}m</TableCell>
                          <TableCell>{emp.working_hours != null ? `${emp.working_hours}h` : '—'}</TableCell>
                          <TableCell>
                            {getLateLabel(emp)
                              ? <span className="text-destructive font-medium">{getLateLabel(emp)}</span>
                              : '—'}
                          </TableCell>
                          {canAct && (
                            <TableCell className="text-right whitespace-nowrap space-x-2">
                              {emp.current_status === 'not_arrived' && (
                                <>
                                  <Button
                                    variant="outline" size="sm"
                                    onClick={() => handlePunch(emp, 'in')}
                                    disabled={punchMutation.isPending}
                                  >
                                    Check in
                                  </Button>
                                  <Button
                                    variant="ghost" size="sm"
                                    onClick={() => openLeaveModal(emp)}
                                  >
                                    Mark leave
                                  </Button>
                                </>
                              )}
                              {emp.current_status === 'on_floor' && (
                                <>
                                  <Button
                                    variant="outline" size="sm"
                                    onClick={() => handleBreak(emp, 'start')}
                                    disabled={breakStartMutation.isPending}
                                  >
                                    Start break
                                  </Button>
                                  <Button
                                    variant="outline" size="sm"
                                    onClick={() => handlePunch(emp, 'out')}
                                    disabled={punchMutation.isPending}
                                  >
                                    Check out
                                  </Button>
                                  <Button
                                    variant="ghost" size="sm"
                                    onClick={() => openEditTimesModal(emp)}
                                  >
                                    Edit Times
                                  </Button>
                                </>
                              )}
                              {emp.current_status === 'on_break' && (
                                <>
                                  <Button
                                    variant="outline" size="sm"
                                    onClick={() => handleBreak(emp, 'end')}
                                    disabled={breakEndMutation.isPending}
                                  >
                                    End break
                                  </Button>
                                  <Button
                                    variant="ghost" size="sm"
                                    onClick={() => openEditTimesModal(emp)}
                                  >
                                    Edit Times
                                  </Button>
                                </>
                              )}
                              {emp.current_status === 'checked_out' && (
                                <Button
                                  variant="outline" size="sm"
                                  onClick={() => openEditTimesModal(emp)}
                                >
                                  Edit Times
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <Card>
            <CardContent className="pt-6 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="min-w-[200px]">
                  <Label className="text-xs mb-1 block">Branch</Label>
                  <SearchableSelect
                    options={branches.map((b) => ({ value: b.branch_id, label: b.name }))}
                    value={branchId}
                    onChange={setBranchId}
                    placeholder="Select branch"
                  />
                </div>

                {branchId && employeesList.length > 0 && (
                  <div className="min-w-[200px]">
                    <Label className="text-xs mb-1 block">Employee</Label>
                    <SearchableSelect
                      options={employeesList.map((emp) => ({ value: emp.employee_details_id, label: emp.full_name }))}
                      value={selectedEmployeeId}
                      onChange={setSelectedEmployeeId}
                      placeholder="Select Employee"
                    />
                  </div>
                )}

                <div>
                  <Label className="text-xs mb-1 block">Month Navigation</Label>
                  <div className="flex items-center gap-2 h-10 border rounded-md px-1 bg-background">
                    <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-semibold text-sm px-2 min-w-[100px] text-center">
                      {formatMonthYear(selectedMonth)}
                    </span>
                    <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex border rounded-lg p-1 bg-muted">
                <button
                  onClick={() => setCalendarSubTab('grid')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    calendarSubTab === 'grid'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Calendar Grid
                </button>
                <button
                  onClick={() => setCalendarSubTab('sheet')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    calendarSubTab === 'sheet'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Monthly Sheet
                </button>
              </div>
            </CardContent>
          </Card>

          {!branchId ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Select a branch to view the calendar.
              </CardContent>
            </Card>
          ) : monthlyLoading ? (
            <Card>
              <CardContent className="py-20 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : (
            <>
              {calendarSubTab === 'grid' ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-7 gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="text-center font-semibold text-sm text-muted-foreground pb-2">
                          {day}
                        </div>
                      ))}

                      {calendarCells.map((cell, idx) => {
                        const dayAttendance = (monthlyData?.attendance || []).filter(
                          (a) => a.date === cell.dateStr
                        )
                        const presentCount = dayAttendance.filter(
                          (a) => ['present', 'late', 'half_day'].includes(a.status)
                        ).length
                        const absentCount = dayAttendance.filter((a) => a.status === 'absent').length
                        const leaveCount = dayAttendance.filter((a) => a.status === 'on_leave').length

                        const empRecord = selectedEmployeeId
                          ? (monthlyData?.attendance || []).find(
                              (a) => a.employee_id === selectedEmployeeId && a.date === cell.dateStr
                            )
                          : null

                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setDetailDate(cell.dateStr)
                              setShowDetailModal(true)
                            }}
                            className={`min-h-[100px] border rounded-lg p-2 transition-all flex flex-col justify-between cursor-pointer ${
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
                              {empRecord ? (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1">
                                    {getCompactStatusBadge(empRecord.status)}
                                    <span className="text-[9px] text-muted-foreground capitalize truncate max-w-[60px]">
                                      {empRecord.status.replace('_', ' ')}
                                    </span>
                                  </div>
                                  {empRecord.working_hours != null && (
                                    <span className="text-[8px] text-muted-foreground font-mono">
                                      {empRecord.working_hours}h
                                    </span>
                                  )}
                                </div>
                              ) : (
                                cell.isCurrentMonth && <span className="text-gray-300 text-xs">—</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6 overflow-hidden">
                    <div className="overflow-x-auto border rounded-lg max-w-full">
                      <table className="min-w-max w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b">
                            <th className="sticky left-0 bg-slate-50 z-20 px-4 py-3 text-left font-semibold border-r min-w-[150px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              Employee
                            </th>
                            {daysInMonth.map((day) => (
                              <th key={day} className="px-2 py-3 text-center font-semibold border-r w-10">
                                {day}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEmployees.length === 0 ? (
                            <tr>
                              <td colSpan={daysInMonth.length + 1} className="py-8 text-center text-muted-foreground">
                                No employees found.
                              </td>
                            </tr>
                          ) : (
                            filteredEmployees.map((emp) => (
                              <tr key={emp.id} className="border-b hover:bg-slate-50/50">
                                <td className="sticky left-0 bg-background z-10 px-4 py-2 border-r font-medium min-w-[150px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-b">
                                  <div>
                                    <div className="font-semibold">{emp.full_name}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">{emp.employee_code}</div>
                                  </div>
                                </td>
                                {daysInMonth.map((day) => {
                                  const [year, monthNum] = selectedMonth.split('-')
                                  const dateStr = `${year}-${monthNum}-${String(day).padStart(2, '0')}`
                                  const record = (monthlyData?.attendance || []).find(
                                    (a) => a.employee_id === emp.employee_details_id && a.date === dateStr
                                  )

                                  return (
                                    <td
                                      key={day}
                                      onClick={() => {
                                        setDetailDate(dateStr)
                                        setShowDetailModal(true)
                                      }}
                                      className="px-1 py-2 text-center border-r cursor-pointer hover:bg-slate-100/50 transition-colors"
                                    >
                                      <div className="flex justify-center">
                                        {record ? getCompactStatusBadge(record.status) : <span className="text-gray-300">—</span>}
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!leaveModal} onOpenChange={(o) => !o && setLeaveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark {leaveModal?.full_name} on leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The employee will be excluded from today's billing roster.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input
                id="reason"
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="Sick leave"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveModal(null)} disabled={markLeaveMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submitLeave} disabled={markLeaveMutation.isPending}>
              {markLeaveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Mark on leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!punchModal} onOpenChange={(o) => !o && setPunchModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Manual {punchModal?.type === 'in' ? 'Check In' : 'Check Out'} — {punchModal?.employee?.full_name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground pt-1">
              Defaults to current time. Modify the date/time picker if you need to specify a different time.
            </p>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="punch-time">Specific Date & Time</Label>
              <Input
                id="punch-time"
                type="datetime-local"
                value={punchDateTime}
                onChange={(e) => setPunchDateTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="punch-reason">Reason / Remarks</Label>
              <Input
                id="punch-reason"
                value={punchReason}
                onChange={(e) => setPunchReason(e.target.value)}
                placeholder="e.g. Forgot to punch, late arrival"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPunchModal(null)} disabled={punchMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submitPunch} disabled={punchMutation.isPending}>
              {punchMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Punch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTimesModal} onOpenChange={(o) => !o && setEditTimesModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Punch Times — {editTimesModal?.full_name}</DialogTitle>
            <p className="text-xs text-muted-foreground pt-1">
              Update the check-in or check-out times. Clear the check-out field and save to restore the employee back to active "on floor" status.
            </p>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="edit-checkin">Check In Time</Label>
              <Input
                id="edit-checkin"
                type="datetime-local"
                value={editCheckIn}
                onChange={(e) => setEditCheckIn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-checkout">Check Out Time</Label>
              <Input
                id="edit-checkout"
                type="datetime-local"
                value={editCheckOut}
                onChange={(e) => setEditCheckOut(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Leave check-out blank or clear it if you want to undo/clear the check-out.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTimesModal(null)} disabled={updateTimesMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submitUpdateTimes} disabled={updateTimesMutation.isPending}>
              {updateTimesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detailed Day Roster Dialog */}
      <Dialog open={showDetailModal} onOpenChange={(o) => !o && setShowDetailModal(false)}>
        <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Roster Detail: {detailDate ? new Date(detailDate + 'T00:00:00').toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long' }) : ''}
            </DialogTitle>
          </DialogHeader>

          {detailRosterLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !detailRoster || detailRoster.employees.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No roster records found for this day.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Break</TableHead>
                  <TableHead>Worked</TableHead>
                  <TableHead>Late</TableHead>
                  {canAct && isSelectedDateToday && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailRoster.employees.map((emp) => {
                  const meta = STATUS_META[emp.current_status] || STATUS_META.not_arrived
                  const Icon = meta.icon
                  return (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="font-medium">{emp.full_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {emp.employee_code}
                          {emp.shift_start && emp.shift_end && !emp.has_flexible_timing && (
                            <span className="ml-2">shift {emp.shift_start}–{emp.shift_end}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.badge}>
                          <Icon className="h-3 w-3 mr-1 inline" />{meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{formatTimeStored(emp.check_in)}</TableCell>
                      <TableCell className="font-mono text-xs">{formatTimeStored(emp.check_out)}</TableCell>
                      <TableCell>{emp.total_break_minutes}m</TableCell>
                      <TableCell>{emp.working_hours != null ? `${emp.working_hours}h` : '—'}</TableCell>
                      <TableCell>
                        {getLateLabel(emp)
                          ? <span className="text-destructive font-medium">{getLateLabel(emp)}</span>
                          : '—'}
                      </TableCell>
                      {canAct && isSelectedDateToday && (
                        <TableCell className="text-right whitespace-nowrap space-x-2">
                          {emp.current_status === 'not_arrived' && (
                            <>
                              <Button
                                variant="outline" size="sm"
                                onClick={() => handlePunch(emp, 'in')}
                                disabled={punchMutation.isPending}
                              >
                                Check in
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => openLeaveModal(emp)}
                              >
                                Mark leave
                              </Button>
                            </>
                          )}
                          {emp.current_status === 'on_floor' && (
                            <>
                              <Button
                                variant="outline" size="sm"
                                onClick={() => handleBreak(emp, 'start')}
                                disabled={breakStartMutation.isPending}
                              >
                                Start break
                              </Button>
                              <Button
                                variant="outline" size="sm"
                                onClick={() => handlePunch(emp, 'out')}
                                disabled={punchMutation.isPending}
                              >
                                Check out
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => openEditTimesModal(emp)}
                              >
                                Edit Times
                              </Button>
                            </>
                          )}
                          {emp.current_status === 'on_break' && (
                            <>
                              <Button
                                variant="outline" size="sm"
                                onClick={() => handleBreak(emp, 'end')}
                                disabled={breakEndMutation.isPending}
                              >
                                End break
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => openEditTimesModal(emp)}
                              >
                                Edit Times
                              </Button>
                            </>
                          )}
                          {emp.current_status === 'checked_out' && (
                            <Button
                              variant="outline" size="sm"
                              onClick={() => openEditTimesModal(emp)}
                            >
                              Edit Times
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
          <DialogFooter>
            <Button onClick={() => setShowDetailModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
