import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { licenseService } from '@/services/license.service'

/** Shown to everyone only when the licence is within 30 days of expiry or in grace; invisible otherwise. */
export default function LicenseBanner() {
  const { data } = useQuery({ queryKey: ['license'], queryFn: licenseService.getStatus, staleTime: 60 * 60_000, retry: 0 })
  const s = data?.data
  if (!s?.enforced || !s.allowed) return null
  const grace = s.status === 'grace'
  if (!grace && !(s.days_left != null && s.days_left <= 30)) return null
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-1.5 text-center text-xs text-foreground">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
      {grace
        ? `Licence expired. The app will stop in ${s.grace_left} day(s).`
        : `Licence expires in ${s.days_left} day(s).`}
      <Link to="/license" className="font-semibold text-primary underline">Renew</Link>
    </div>
  )
}
