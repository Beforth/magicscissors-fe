import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ShieldCheck } from 'lucide-react'
import { attendanceService } from '@/services/attendance.service'
import { branchService } from '@/services/branch.service'

const ALLOWED = ['owner', 'developer', 'manager', 'cashier']

/**
 * Keep this open on a tablet or the counter PC. Staff type the code when punching, which proves they are
 * physically at the salon (a faked GPS position cannot know it). It changes every 30 seconds.
 */
export default function CounterCodePage() {
  const user = useSelector((s) => s.auth.user)
  const isGlobal = ['owner', 'developer'].includes(user?.role)
  const [branchId, setBranchId] = useState(user?.branchId || '')
  const [now, setNow] = useState(Date.now())

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: isGlobal,
  })
  const branches = branchesData?.data || []
  const activeBranch = branchId || branches[0]?.branch_id || ''

  const { data, dataUpdatedAt, isError, error } = useQuery({
    queryKey: ['presence-code', activeBranch],
    queryFn: () => attendanceService.getPresenceCode(activeBranch),
    enabled: !!activeBranch,
    refetchInterval: 4000,
    staleTime: 0,
    retry: 1,
  })

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  if (!ALLOWED.includes(user?.role)) {
    return <p className="p-6 text-sm text-muted-foreground">Only the owner, managers and cashiers can show the counter code.</p>
  }

  const code = data?.data?.code
  const step = data?.data?.step_seconds || 30
  const remaining = data ? Math.max(0, data.data.expires_in_s - (now - dataUpdatedAt) / 1000) : 0
  const shown = code ? `${code.slice(0, 3)} ${code.slice(3)}` : '--- ---'
  const branchName = isGlobal ? branches.find((b) => b.branch_id === activeBranch)?.name : user?.branch?.name

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-6 text-center">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" /> Attendance code{branchName ? ` · ${branchName}` : ''}
      </div>

      {isGlobal && branches.length > 1 && (
        <select
          aria-label="Branch"
          value={activeBranch}
          onChange={(e) => setBranchId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/15"
        >
          {branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.name}</option>)}
        </select>
      )}

      {isError ? (
        <p className="text-sm text-destructive">{error?.response?.data?.error?.message || 'Could not load the code. Check the connection.'}</p>
      ) : !data ? (
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      ) : (
        <>
          <p
            aria-live="polite"
            aria-label={`Code ${code}`}
            className="select-all font-mono text-7xl font-bold tracking-[0.15em] text-foreground sm:text-8xl"
          >
            {shown}
          </p>
          <div className="w-full max-w-xs" role="progressbar" aria-valuemin={0} aria-valuemax={step} aria-valuenow={Math.round(remaining)} aria-label="Time until the code changes">
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-linear" style={{ width: `${(remaining / step) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Changes in {Math.ceil(remaining)} s</p>
          </div>
        </>
      )}

      <p className="max-w-sm text-sm text-muted-foreground">
        Staff type this code when they check in or out on their phone. Keep this screen where only people inside the salon can see it.
      </p>
      <Link to="/attendance" className="text-sm text-primary underline">Back to attendance</Link>
    </div>
  )
}
