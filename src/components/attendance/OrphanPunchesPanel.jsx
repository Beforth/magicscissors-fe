import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { attendanceService } from '@/services/attendance.service'

const REASON_LABEL = {
  unknown_machine: 'Machine not registered',
  unknown_employee: 'No matching employee',
  wrong_branch: 'Employee is in another branch',
  unknown_branch: 'Branch missing or inactive',
}

/**
 * Punches that reached the server but could not be matched to an employee are stored, yet count for nothing.
 * This shows what is missing (machines to add, employee codes to fix) and retries once it is fixed.
 * Owner/developer only; renders nothing when everything matched.
 */
export default function OrphanPunchesPanel() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const { data } = useQuery({
    queryKey: ['attendance-orphans'],
    queryFn: () => attendanceService.getOrphans({ limit: 20 }).then((r) => r.data),
    refetchInterval: 60000,
  })
  const retry = useMutation({
    mutationFn: () => attendanceService.reprocessOrphans().then((r) => r.data),
    onSuccess: (r) => {
      toast.success(`${r.resolved} punch${r.resolved === 1 ? '' : 'es'} matched${r.still_orphan ? `, ${r.still_orphan} still unmatched` : ''}${r.failed ? `, ${r.failed} failed` : ''}`)
      qc.invalidateQueries({ queryKey: ['attendance-orphans'] })
      qc.invalidateQueries({ queryKey: ['hub-attendance'] })
      qc.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (e) => toast.error(e?.response?.data?.error?.message || 'Could not retry matching'),
  })

  if (!data || data.total === 0) return null
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950" role="region" aria-label="Unmatched punches">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">{data.total.toLocaleString()} punch{data.total === 1 ? '' : 'es'} received but not counted as attendance</p>
            <p className="text-sm">
              {data.by_reason.map((r) => `${REASON_LABEL[r.reason] || r.reason}: ${r.count}`).join(' · ')}
              {data.first_punch ? ` · ${data.first_punch.slice(0, 10)} to ${data.last_punch.slice(0, 10)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>{open ? 'Hide details' : 'What is wrong?'}</Button>
          <Button size="sm" onClick={() => retry.mutate()} disabled={retry.isPending}>
            {retry.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            Retry matching
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-4 text-sm">
          {data.by_reason.map((r) => r.hint && (
            <p key={r.reason}><b>{REASON_LABEL[r.reason] || r.reason}:</b> {r.hint}</p>
          ))}
          {data.machines.length > 0 && (
            <div>
              <p className="mb-1 font-semibold">Machine numbers to register (Settings → Machines)</p>
              <ul className="flex flex-wrap gap-1.5">
                {data.machines.map((m) => (
                  <li key={`${m.machine_no}-${m.reason}`} className="rounded-full bg-white px-2.5 py-0.5 font-mono text-xs">{m.machine_no} <span className="text-amber-700">×{m.count}</span></li>
                ))}
              </ul>
            </div>
          )}
          {data.employee_codes.length > 0 && (
            <div>
              <p className="mb-1 font-semibold">Device user IDs with no matching employee code / biometric ID</p>
              <ul className="flex flex-wrap gap-1.5">
                {data.employee_codes.map((c) => (
                  <li key={`${c.employee_code}-${c.reason}`} className="rounded-full bg-white px-2.5 py-0.5 font-mono text-xs">{c.employee_code} <span className="text-amber-700">×{c.count}</span></li>
                ))}
              </ul>
              <p className="mt-1 text-xs">IDs must match exactly, including leading zeros (00000008 is not 8).</p>
            </div>
          )}
          <p className="text-xs">After fixing the setup, press <b>Retry matching</b>. Re-sending punches from the device server does not help, because Magic Scissors already holds them.</p>
        </div>
      )}
    </div>
  )
}
