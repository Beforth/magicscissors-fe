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
import { buildRulesPayload } from '@/lib/shiftRules'
import RosterGrid from '@/components/shifts/RosterGrid'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const initialShiftForm = {
  name: '',
  start_time: '',
  end_time: '',
  color_code: '#6366f1',
  grace_period: '5',
  half_day_late_after_min: '',
  half_day_min_hours: '',
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
  const [tiers, setTiers] = useState([])
  const [saving, setSaving] = useState(false)
  const { user } = useSelector((s) => s.auth)
  const canEditRules = user?.role === 'owner'

  useEffect(() => {
    if (shift) {
      setForm({
        name: shift.name || '',
        start_time: shift.start_time || '',
        end_time: shift.end_time || '',
        color_code: shift.color_code || '#6366f1',
        grace_period: String(shift.grace_period ?? 5),
        half_day_late_after_min: shift.half_day_late_after_min == null ? '' : String(shift.half_day_late_after_min),
        half_day_min_hours: shift.half_day_min_hours == null ? '' : String(shift.half_day_min_hours),
      })
      setTiers((shift.late_tiers || []).map((t) => (
        t.deduct_hours == null && t.deduct_amount != null
          ? { after_min: String(t.after_min), kind: 'amount', value: String(t.deduct_amount) }
          : { after_min: String(t.after_min), kind: 'hours', value: String(t.deduct_hours ?? '') }
      )))
    } else {
      setForm(initialShiftForm)
      setTiers([])
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

    let rules = {}
    if (canEditRules) {
      const built = buildRulesPayload({
        grace,
        tiers: tiers.map((t) => ({
          after_min: t.after_min,
          deduct_hours: t.kind === 'hours' ? t.value : '',
          deduct_amount: t.kind === 'amount' ? t.value : '',
        })),
        halfDayLateAfterMin: form.half_day_late_after_min,
        halfDayMinHours: form.half_day_min_hours,
      })
      if (!built.ok) { toast.error(built.error); return }
      rules = built.value
    }
    const base = Object.fromEntries(Object.entries(form).filter(([k]) => !k.startsWith('half_day')))
    const payload = { ...base, grace_period: grace, ...rules }

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
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          {canEditRules ? (
            <>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Late fine rules</h4>
                {tiers.map((t, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`tier_after_${i}`} className="text-xs">Late by (min) ≥</Label>
                      <Input
                        id={`tier_after_${i}`}
                        type="number"
                        min="1"
                        value={t.after_min}
                        onChange={(e) => setTiers((rows) => rows.map((r, j) => (j === i ? { ...r, after_min: e.target.value } : r)))}
                      />
                    </div>
                    <div className="w-36 space-y-1">
                      <Label htmlFor={`tier_kind_${i}`} className="text-xs">Fine type</Label>
                      <select
                        id={`tier_kind_${i}`}
                        value={t.kind}
                        onChange={(e) => setTiers((rows) => rows.map((r, j) => (j === i ? { ...r, kind: e.target.value } : r)))}
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/15"
                      >
                        <option value="amount">₹ Amount</option>
                        <option value="hours">Hours of pay</option>
                      </select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`tier_deduct_${i}`} className="text-xs">
                        {t.kind === 'amount' ? 'Deduct (₹)' : 'Deduct (hours)'}
                      </Label>
                      <Input
                        id={`tier_deduct_${i}`}
                        type="number"
                        min="0"
                        step={t.kind === 'amount' ? '1' : '0.25'}
                        placeholder={t.kind === 'amount' ? 'e.g. 100' : 'e.g. 1'}
                        value={t.value}
                        onChange={(e) => setTiers((rows) => rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 p-0 text-red-400 hover:text-red-600"
                      onClick={() => setTiers((rows) => rows.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTiers((rows) => [...rows, { after_min: '', kind: 'amount', value: '' }])}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add tier
                </Button>
                <p className="text-xs text-muted-foreground">
                  Applies after the grace period; the highest tier reached is used. A ₹ amount is deducted from salary as-is; hours are deducted at the employee's hourly rate. Leave empty for no late fine.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Half day</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="half_day_late_after_min" className="text-xs">Half day if late by more than (min)</Label>
                    <Input
                      id="half_day_late_after_min"
                      type="number"
                      min="0"
                      value={form.half_day_late_after_min}
                      onChange={(e) => setForm((f) => ({ ...f, half_day_late_after_min: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="half_day_min_hours" className="text-xs">Half day if worked less than (hours)</Label>
                    <Input
                      id="half_day_min_hours"
                      type="number"
                      min="0"
                      step="0.25"
                      value={form.half_day_min_hours}
                      onChange={(e) => setForm((f) => ({ ...f, half_day_min_hours: e.target.value }))}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Leave blank to turn a rule off</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Late and half-day rules can be changed by the owner</p>
          )}
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
  const isOwner = user?.role === 'owner'
  const userBranchId = user?.branchId || user?.branch_id || user?.branch?.branch_id || user?.branch?.id || ''
  const [selectedBranchId, setSelectedBranchId] = useState(userBranchId)

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

  const effectiveBranchId = isOwnerDev ? selectedBranchId : userBranchId

  const toggleMutation = useMutation({
    mutationFn: (id) => shiftService.toggleActive(id),
    onSuccess: () => {
      toast.success('Shift toggled')
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to toggle shift'),
  })

  const openAddModal = () => { setEditingShift(null); setModalOpen(true) }
  const openEditModal = (shift) => { setEditingShift(shift); setModalOpen(true) }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shifts</h1>
          <p className="text-gray-500">Manage shift definitions and employee assignments</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
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
              {isOwner && (
                <Button size="sm" onClick={openAddModal}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Shift
                </Button>
              )}
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
                              {isOwner && (
                                <>
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
                                </>
                              )}
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

        <TabsContent value="schedule" className="space-y-4">
          {isOwnerDev && (
            <div className="max-w-xs">
              <Label className="mb-1 block text-xs">Branch</Label>
              <SearchableSelect
                options={branches.map((b) => ({ value: b.branch_id, label: b.name }))}
                value={selectedBranchId}
                onChange={setSelectedBranchId}
                placeholder="All branches"
              />
            </div>
          )}
          <RosterGrid branchId={effectiveBranchId} />
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
