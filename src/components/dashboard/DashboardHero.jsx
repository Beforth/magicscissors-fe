import { useNavigate } from 'react-router-dom'
import { Plus, Users, BarChart3 } from 'lucide-react'

const greeting = () => {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date())) % 24
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

const QUICK = [
  { title: 'New bill', detail: 'Start a transaction', path: '/bills/new', icon: Plus, accent: 'bg-primary text-primary-foreground' },
  { title: 'Customers', detail: 'Find or add one', path: '/customers', icon: Users, accent: 'bg-emerald-100 text-emerald-700' },
  { title: 'Reports', detail: 'Dig into the numbers', path: '/reports', icon: BarChart3, accent: 'bg-amber-100 text-amber-700' },
]

/** Greeting banner with the three everyday shortcuts, shared by the owner and manager dashboards. */
export default function DashboardHero({ name, subtitle, tag }) {
  const navigate = useNavigate()
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })
  return (
    <div className="glass-panel relative overflow-hidden rounded-3xl p-5 sm:p-7">
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {today}
            {tag ? ` · ${tag}` : ''}
          </p>
          <h1 className="mt-1 text-2xl font-black leading-tight tracking-tight text-slate-800 sm:text-3xl">
            {greeting()}, <span className="text-blue-700">{name}</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:gap-2.5" aria-label="Quick actions">
          {QUICK.map(({ title, detail, path, icon: Icon, accent }) => (
            <button
              key={title}
              type="button"
              onClick={() => navigate(path)}
              className="group flex min-w-0 flex-col items-center gap-1.5 rounded-2xl glass-card px-2 py-3 text-center sm:min-w-[10.5rem] sm:flex-row sm:gap-3 sm:px-4 sm:text-left transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0"
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${accent}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-slate-800 sm:text-sm">{title}</span>
                <span className="hidden truncate text-xs font-medium text-slate-400 sm:block">{detail}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
