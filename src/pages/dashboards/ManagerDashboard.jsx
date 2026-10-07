import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  Clock,
  UserCheck,
  Plus,
  UserPlus,
  ArrowUpRight,
  Star,
  Sparkles,
} from 'lucide-react'
import LowStockAlertsCard from '@/components/dashboard/LowStockAlertsCard'

const statItems = [
  {
    name: 'Staff Present',
    value: '8/10',
    icon: UserCheck,
    description: '2 on leave',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 text-emerald-600',
    ring: 'border-emerald-100',
  },
  {
    name: "Today's Customers",
    value: '45',
    icon: Users,
    description: '3 new customers',
    color: 'text-blue-600',
    bg: 'bg-blue-50 text-blue-600',
    ring: 'border-blue-100',
  },
  {
    name: 'Pending Bills',
    value: '3',
    icon: Clock,
    description: 'In progress',
    color: 'text-amber-600',
    bg: 'bg-amber-50 text-amber-600',
    ring: 'border-amber-100',
  },
]

const topEmployees = [
  { name: 'Ramesh Kumar', services: 12, stars: 120 },
  { name: 'Suresh Patil', services: 10, stars: 100 },
  { name: 'Priya Sharma', services: 8, stars: 80 },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function ManagerDashboard() {
  const { user } = useSelector((state) => state.auth)
  const navigate = useNavigate()

  useEffect(() => {
    if (user && !['manager', 'developer'].includes(user.role)) {
      if (['owner'].includes(user.role)) navigate('/dashboard/owner', { replace: true })
      else if (user.role === 'employee') navigate('/dashboard/employee', { replace: true })
      else if (user.role === 'cashier') navigate('/dashboard/cashier', { replace: true })
    }
  }, [user, navigate])

  return (
    <div className="w-full space-y-5 sm:space-y-6">

      {/* ── Hero Banner ─────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 backdrop-blur-md px-3 py-1 mb-3 ring-1 ring-white/80 shadow-2xs">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              {user?.branch?.name || 'Branch'} · Manager
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 leading-tight tracking-tight">
            {getGreeting()},<br />
            <span className="text-blue-700">
              {user?.fullName?.split(' ')[0] || 'Manager'}
            </span>
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 font-medium">Here's your branch overview for today</p>
        </div>
      </div>

      {/* ── Quick Actions (styled as Offistant pill cards) ──────────────── */}
      <section aria-label="Quick actions">
        <div className="mb-3">
          <h2 className="text-sm font-bold text-slate-800">Quick actions</h2>
          <p className="text-xs text-slate-400">Common tasks for your branch</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { title: 'Create a bill', detail: 'Start a new transaction', icon: Plus, color: 'text-blue-600', bg: 'bg-blue-50', path: '/bills/new' },
            { title: 'Customers', detail: 'Find or add a customer', icon: UserPlus, color: 'text-pink-600', bg: 'bg-pink-50', path: '/customers' },
          ].map(({ title, detail, icon: Icon, color, bg, path }) => (
            <button
              key={title}
              type="button"
              onClick={() => navigate(path)}
              className="group flex min-h-[72px] items-center gap-4 rounded-3xl glass-card p-4 text-left transition-all hover:bg-white hover:scale-[1.01] hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.99]"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${bg} transition-transform group-hover:scale-105`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-slate-800">{title}</span>
                <span className="block truncate text-xs text-slate-400 font-medium">{detail}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          ))}
        </div>
      </section>

      {/* ── Stats Grid ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {statItems.map((stat) => (
          <div
            key={stat.name}
            className={`rounded-3xl glass-card p-5 flex flex-col gap-3 border ${stat.ring}`}
          >
            <div className="flex items-center justify-between">
              <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${stat.bg}`}>
                <stat.icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold text-slate-500 bg-white/80 px-2.5 py-1 rounded-full border border-white/80 shadow-2xs">
                Today
              </span>
            </div>
            <div>
              <p className={`text-3xl font-extrabold tabular-nums ${stat.color}`}>{stat.value}</p>
              <p className="text-sm font-bold text-slate-800 mt-1">{stat.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{stat.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Low Stock Alerts ─────────────────────────────────────────────── */}
      <div className="glass-card rounded-3xl p-5">
        <LowStockAlertsCard maxItems={3} />
      </div>

      {/* ── Top Performers ───────────────────────────────────────────────── */}
      <div className="rounded-3xl glass-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Star className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Top Performers Today</h2>
            <p className="text-xs text-slate-400">Staff performance ranking</p>
          </div>
        </div>
        <div className="space-y-2">
          {topEmployees.map((employee, index) => (
            <div
              key={employee.name}
              className="flex items-center gap-4 rounded-2xl bg-white/70 hover:bg-white border border-white/80 px-4 py-3 transition-colors shadow-2xs"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm flex-shrink-0 ${
                index === 0 ? 'bg-amber-100 text-amber-700' :
                index === 1 ? 'bg-slate-100 text-slate-700' :
                'bg-orange-100 text-orange-700'
              }`}>
                #{index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800 truncate">{employee.name}</p>
                <p className="text-xs text-slate-400 font-medium">
                  {employee.services} services · {employee.stars} pts
                </p>
              </div>
              {index === 0 && (
                <Star className="h-4 w-4 text-amber-500 fill-amber-500 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

export default ManagerDashboard
