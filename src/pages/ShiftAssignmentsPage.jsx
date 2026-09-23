import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useQuery } from '@tanstack/react-query'
import { shiftService } from '@/services/shift.service'
import { userService } from '@/services/user.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft } from 'lucide-react'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const employeeId = (u) => u.user_id || u.id

function ShiftAssignmentsPage() {
  const { date } = useParams()
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)
  const isOwnerDev = ['owner', 'developer'].includes(user?.role)
  const month = date ? date.slice(0, 7) : ''

  const { data: shiftsData } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => shiftService.getShifts(),
  })
  const shifts = shiftsData?.data || []

  const { data: assignmentsData } = useQuery({
    queryKey: ['shift-assignments', month],
    queryFn: () => shiftService.getAssignments({ month }),
    enabled: !!month,
  })
  const assignments = assignmentsData?.data || []

  const { data: allUsersData } = useQuery({
    queryKey: ['users', { role: 'employee,manager,cashier' }],
    queryFn: () => userService.getUsers({ role: 'employee,manager,cashier', limit: 500 }),
  })
  const employees = allUsersData?.data || []

  const dateAssignments = useMemo(
    () => assignments.filter((a) => a.shift_date === date),
    [assignments, date]
  )

  const dayLabel = date
    ? DAYS[new Date(date + 'T00:00:00').getDay()]
    : ''

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/shifts')} className="h-9 w-9">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Shift Assignments</h1>
          <p className="text-sm text-muted-foreground">
            {date} ({dayLabel})
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assignments for {date}</CardTitle>
        </CardHeader>
        <CardContent>
          {dateAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No shifts assigned for this date.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dateAssignments.map((a, i) => {
                  const shift = shifts.find((s) => s.id === a.shift_id)
                  const emp = employees.find((e) => employeeId(e) === a.employee_id)
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium text-sm">{emp?.full_name || a.employee_name || '-'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{emp?.employee_details?.employee_code || a.employee_code || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: shift?.color_code || '#6366f1' }} />
                          <span className="text-sm">{shift?.name || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {shift ? `${shift.start_time}–${shift.end_time}` : '-'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ShiftAssignmentsPage
