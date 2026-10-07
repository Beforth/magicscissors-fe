import { NavLink, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Activity, CalendarDays, ClipboardList, FilePlus2, Home, Menu, Receipt } from 'lucide-react'
import { useSidebar } from '@/contexts/SidebarContext'
import { cn } from '@/lib/utils'

const getItems = (role) => {
  if (role === 'employee') {
    return [
      { label: 'Home',       to: '/dashboard/employee',                   icon: Home,       end: true },
      { label: 'Attendance', to: '/my-attendance',                        icon: CalendarDays },
      { label: 'Punch',      to: '/dashboard/employee#attendance-punch',  icon: Activity,   primary: true },
    ]
  }
  if (role === 'cashier') {
    return [
      { label: 'Home',     to: '/dashboard/cashier', icon: Home,       end: true },
      { label: 'New bill', to: '/bills/new',          icon: FilePlus2 },
      { label: 'Bills',    to: '/bills',              icon: Receipt },
    ]
  }
  if (role === 'manager') {
    return [
      { label: 'Home',       to: '/dashboard/manager', icon: Home,        end: true },
      { label: 'Attendance', to: '/attendance',         icon: CalendarDays },
      { label: 'New bill',   to: '/bills/new',          icon: FilePlus2 },
    ]
  }
  return [
    { label: 'Home',       to: '/dashboard/owner', icon: Home,        end: true },
    { label: 'Reports',    to: '/reports',          icon: ClipboardList },
    { label: 'Attendance', to: '/attendance',       icon: CalendarDays },
  ]
}

export default function MobileBottomNav() {
  const { user } = useSelector((state) => state.auth)
  const { mobileOpen, openMobile } = useSidebar()
  const location = useLocation()
  const items = getItems(user?.role)
  const isPunchActive = location.pathname === '/dashboard/employee' && location.hash === '#attendance-punch'

  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="border-t border-white/70 bg-white/85 backdrop-blur-2xl pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_rgba(14,134,212,0.06)]">
        <div
          className="mx-auto grid h-16 max-w-xl items-center px-3"
          style={{ gridTemplateColumns: `repeat(${items.length + 1}, 1fr)` }}
        >
          {items.map(({ label, to, icon: Icon, end, primary }) => {
            const isPunch = primary && label === 'Punch'
            const active = isPunch
              ? isPunchActive
              : !isPunchActive && !mobileOpen && (
                  end
                    ? location.pathname === to
                    : location.pathname.startsWith(to)
                )

            return (
              <NavLink
                key={label}
                to={to}
                end={end}
                aria-label={isPunch ? 'Go to check in or check out' : label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors relative',
                  active
                    ? 'text-blue-600 font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                {/* Elevated icon container with smooth translate-y animation */}
                <span
                  className={cn(
                    'flex items-center justify-center rounded-2xl transition-all duration-300 ease-out',
                    active
                      ? '-translate-y-2 h-11 w-11 bg-blue-600 text-white shadow-lg shadow-blue-500/35 border-2 border-white'
                      : 'translate-y-0 h-8 w-8 text-slate-500 hover:bg-white/60'
                  )}
                >
                  <Icon className={cn('transition-all duration-300', active ? 'h-5 w-5' : 'h-[18px] w-[18px]')} aria-hidden="true" />
                </span>

                <span
                  className={cn(
                    'transition-all duration-300 text-center leading-none',
                    active ? 'font-bold text-blue-600 translate-y-0' : 'text-slate-500'
                  )}
                >
                  {label}
                </span>

                {/* Active indicator dot */}
                {active && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-600 transition-all duration-300" />
                )}
              </NavLink>
            )
          })}

          {/* More button */}
          <button
            type="button"
            onClick={openMobile}
            aria-label="Open full navigation menu"
            aria-current={mobileOpen ? 'page' : undefined}
            className={cn(
              'flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl',
              mobileOpen
                ? 'text-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <span
              className={cn(
                'flex items-center justify-center rounded-2xl transition-all duration-300 ease-out',
                mobileOpen
                  ? '-translate-y-2 h-11 w-11 bg-blue-600 text-white shadow-lg shadow-blue-500/35 border-2 border-white'
                  : 'translate-y-0 h-8 w-8 text-slate-500 hover:bg-white/60'
              )}
            >
              <Menu className={cn('transition-all duration-300', mobileOpen ? 'h-5 w-5' : 'h-[18px] w-[18px]')} aria-hidden="true" />
            </span>
            <span
              className={cn(
                'transition-all duration-300 text-center leading-none',
                mobileOpen ? 'font-bold text-blue-600 translate-y-0' : 'text-slate-500'
              )}
            >
              More
            </span>
            {mobileOpen && (
              <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-600 transition-all duration-300" />
            )}
          </button>
        </div>
      </div>
    </nav>
  )
}
