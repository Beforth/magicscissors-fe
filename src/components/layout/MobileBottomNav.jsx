import { NavLink, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { CalendarDays, ClipboardList, FilePlus2, Home, Menu, Receipt } from 'lucide-react'
import { useSidebar } from '@/contexts/SidebarContext'
import { cn } from '@/lib/utils'

const getItems = (role) => {
  if (role === 'employee') {
    return [
      { label: 'Home',       to: '/dashboard/employee',                   icon: Home,       end: true },
      { label: 'Attendance', to: '/my-attendance',                        icon: CalendarDays },
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
      <div className="border-t bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
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
                  'flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors relative',
                  active
                    ? 'text-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {/* Elevated icon container with smooth translate-y animation */}
                <span
                  className={cn(
                    'flex items-center justify-center rounded-full transition-all duration-200',
                    active
                      ? 'h-8 w-14 bg-primary/10 text-primary'
                      : 'h-8 w-14 text-muted-foreground'
                  )}
                >
                  <Icon className={cn('transition-all duration-300', active ? 'h-5 w-5' : 'h-5 w-5')} aria-hidden="true" />
                </span>

                <span
                  className={cn(
                    'transition-all duration-300 text-center leading-none',
                    active ? 'font-bold text-primary translate-y-0' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </span>
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
              'flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md',
              mobileOpen
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span
              className={cn(
                'flex items-center justify-center rounded-full transition-all duration-200',
                mobileOpen
                  ? 'h-8 w-14 bg-primary/10 text-primary'
                  : 'h-8 w-14 text-muted-foreground'
              )}
            >
              <Menu className={cn('transition-all duration-300', mobileOpen ? 'h-5 w-5' : 'h-5 w-5')} aria-hidden="true" />
            </span>
            <span
              className={cn(
                'transition-all duration-300 text-center leading-none',
                mobileOpen ? 'font-bold text-primary translate-y-0' : 'text-muted-foreground'
              )}
            >
              More
            </span>
          </button>
        </div>
      </div>
    </nav>
  )
}
