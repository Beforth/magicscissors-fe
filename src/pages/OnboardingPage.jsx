import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Scissors, Users, Clock, Check, ArrowRight } from 'lucide-react'
import { authService } from '@/services/auth.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const ONBOARDING_SKIP_KEY = 'onboardingSkipped'

export const onboardingSteps = (p) => [
  { key: 'branches', icon: Building2, title: 'Add your first branch', text: 'Name, address and opening hours of your salon.', to: '/branches/new', done: p.branches > 0 },
  { key: 'services', icon: Scissors, title: 'Add services', text: 'What you sell: haircut, colour, facial... with prices.', to: '/services/new', done: p.services > 0 },
  { key: 'staff', icon: Users, title: 'Add your team', text: 'Managers, cashiers and stylists with their login.', to: '/staff/new', done: p.staff > 0 },
  { key: 'shifts', icon: Clock, title: 'Create shifts', text: 'Working hours, late rules and fines for attendance.', to: '/shifts', done: p.shifts > 0 },
]

function OnboardingPage() {
  const navigate = useNavigate()
  const firstPending = useRef(null)
  const { data, isLoading } = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => authService.onboarding().then((r) => r.data),
    staleTime: 0,
  })

  const steps = data ? onboardingSteps(data) : []
  const doneCount = steps.filter((s) => s.done).length
  const firstPendingKey = steps.find((s) => !s.done)?.key

  useEffect(() => {
    firstPending.current?.focus()
  }, [firstPendingKey])

  // 1-4 jump straight to a step.
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return
      const step = steps[Number(e.key) - 1]
      if (step) navigate(step.to)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [steps, navigate])

  const skip = () => {
    try {
      localStorage.setItem(ONBOARDING_SKIP_KEY, '1')
    } catch {
      /* storage unavailable */
    }
    navigate('/dashboard/owner')
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Welcome! Let's set up your salon</CardTitle>
          <CardDescription>
            {isLoading ? 'Checking what is already set up...' : `${doneCount} of ${steps.length} steps done. Press 1-4 to jump to a step.`}
          </CardDescription>
          {!isLoading && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}>
              <div className="h-full bg-primary transition-all" style={{ width: `${steps.length ? (doneCount / steps.length) * 100 : 0}%` }} />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((s, i) => {
            const Icon = s.icon
            const isFirst = s.key === firstPendingKey
            return (
              <Link
                key={s.key}
                to={s.to}
                ref={isFirst ? firstPending : undefined}
                className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-4 sm:p-4"
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${s.done ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary'}`}>
                  {s.done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {i + 1}. {s.title}
                  </span>
                  <span className="block text-sm text-muted-foreground">{s.done ? 'Done - you can add more any time' : s.text}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            )
          })}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={skip}>
              Skip for now
            </Button>
            {doneCount === steps.length && steps.length > 0 && <Button onClick={() => navigate('/dashboard/owner')}>Go to dashboard</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default OnboardingPage
