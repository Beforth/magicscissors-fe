import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { authService } from '@/services/auth.service'
import { ONBOARDING_SKIP_KEY, onboardingSteps } from '@/pages/OnboardingPage'
import DashboardHero from '@/components/dashboard/DashboardHero'
import InsightsPanel from '@/components/dashboard/InsightsPanel'
import LowStockAlertsCard from '@/components/dashboard/LowStockAlertsCard'

function OwnerDashboard() {
  const { user } = useSelector((state) => state.auth)
  const navigate = useNavigate()
  const [progress, setProgress] = useState(null)

  useEffect(() => {
    if (user && !['owner', 'developer'].includes(user.role)) {
      if (user.role === 'employee') navigate('/dashboard/employee', { replace: true })
      else if (user.role === 'manager') navigate('/dashboard/manager', { replace: true })
      else if (user.role === 'cashier') navigate('/dashboard/cashier', { replace: true })
      return
    }
    // A brand-new system (no branch yet) opens the guided setup once; afterwards a banner remains until it is complete.
    authService
      .onboarding()
      .then((res) => {
        const p = res.data
        setProgress(p)
        let skipped = false
        try {
          skipped = localStorage.getItem(ONBOARDING_SKIP_KEY) === '1'
        } catch {
          /* storage unavailable */
        }
        if (p.branches === 0 && !skipped) navigate('/onboarding', { replace: true })
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const steps = progress ? onboardingSteps(progress) : []

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      <DashboardHero name={user?.fullName?.split(' ')[0] || 'Owner'} subtitle="Here is how your salons are doing." />

      {steps.some((st) => !st.done) && (
        <Link
          to="/onboarding"
          className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>
            <span className="font-semibold">Finish setting up your salon</span>
            <span className="text-muted-foreground"> · {steps.filter((st) => st.done).length} of {steps.length} steps done</span>
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            Continue <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      )}

      <InsightsPanel allowBranchFilter />

      <LowStockAlertsCard maxItems={4} />
    </div>
  )
}

export default OwnerDashboard
