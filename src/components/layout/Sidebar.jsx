import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { logout } from '@/store/slices/authSlice'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/contexts/SidebarContext'
import { CURRENT_VERSION } from '@/data/versionHistory'
import {
  LayoutDashboard,
  IndianRupee,
  Users,
  Receipt,
  Scissors,
  Package,
  Warehouse,
  BarChart3,
  Building2,
  ShoppingBag,
  ArrowRightLeft,
  UserCog,
  Calculator,
  ChevronDown,
  BoxesIcon,
  TrendingUp,
  BookOpen,
  Wallet,
  Landmark,
  PiggyBank,
  Truck,
  PackagePlus,
  Smartphone,
  Wrench,
  Activity,
  Cpu,
  CalendarCheck,
  Printer,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  UserCheck,
  Clock,
  MapPin,
  LogOut,
} from 'lucide-react'

export const getNavItemsByRole = (role) => {
  const allNavItems = [
    { title: 'Dashboard', href: '/dashboard/owner',    icon: LayoutDashboard, roles: ['owner', 'developer'] },
    { title: 'Dashboard', href: '/dashboard/manager',  icon: LayoutDashboard, roles: ['manager'] },
    { title: 'Dashboard', href: '/dashboard/cashier',  icon: LayoutDashboard, roles: ['cashier'] },
    { title: 'Dashboard', href: '/dashboard/employee', icon: LayoutDashboard, roles: ['employee'] },
    { title: 'Customers',        href: '/customers',        icon: Users,       roles: ['owner','developer','manager','cashier'] },
    { title: 'Billing',          href: '/bills',            icon: Receipt,     roles: ['owner','developer','manager','cashier'] },
    { title: 'Employee Status',  href: '/employee-status',  icon: UserCheck,   roles: ['owner','developer','manager','cashier'] },
    { title: 'Tokens',           href: '/tokens',           icon: PackagePlus, roles: ['owner','developer','manager','cashier'] },
    {
      title: 'Catalog', icon: BookOpen,
      roles: ['owner','developer','manager','cashier'],
      children: [
        { title: 'Services',  href: '/services',  icon: Scissors  },
        { title: 'Packages',  href: '/packages',  icon: Package   },
        { title: 'Skills',    href: '/skills',    icon: Activity  },
      ],
    },
    {
      title: 'Inventory', icon: BoxesIcon,
      roles: ['owner','developer','manager','cashier'],
      children: [
        { title: 'SKUs',             href: '/skus',               icon: BoxesIcon       },
        { title: 'Products',         href: '/products',           icon: ShoppingBag     },
        { title: 'Warehouses',       href: '/warehouses',         icon: Warehouse       },
        { title: 'Stock Levels',     href: '/inventory',          icon: Warehouse       },
        { title: 'Stock Transfers',  href: '/inventory/transfers',icon: ArrowRightLeft  },
        { title: 'Suppliers',        href: '/suppliers',          icon: Truck           },
        { title: 'Purchase Batches', href: '/purchase-batches',   icon: PackagePlus     },
        { title: 'Print Barcodes',   href: '/barcode-print',      icon: Printer         },
      ],
    },
    { title: 'Maintenance',      href: '/maintenance',      icon: Wrench,    roles: ['owner','developer','manager','cashier','employee'] },
    { title: 'Reports',          href: '/reports',          icon: BarChart3, roles: ['owner','developer','manager'] },
    {
      title: 'Finance', icon: Landmark,
      roles: ['owner','developer','manager','cashier'],
      children: [
        { title: 'Savings Pots',   href: '/savings-pots',          icon: PiggyBank  },
        { title: 'Cash Drawer',    href: '/cash-reconciliation',    icon: Calculator },
        { title: 'Expenses',       href: '/expenses',              icon: Wallet     },
        { title: 'UPI Accounts',   href: '/upi-accounts',          icon: Smartphone },
      ],
    },
    { title: 'Staff',            href: '/staff',            icon: UserCog,       roles: ['owner','developer','manager','cashier'] },
    { title: 'Shift',            href: '/shifts',           icon: Clock,         roles: ['owner','developer','manager'] },
    { title: 'Attendance',       href: '/attendance',       icon: CalendarCheck, roles: ['owner','developer','manager','cashier'] },
    { title: 'My Attendance',    href: '/my-attendance',    icon: MapPin,        roles: ['employee','manager','cashier'] },
    { title: 'Staff Performance',href: '/staff-performance',icon: TrendingUp,    roles: ['owner','developer','manager','cashier'] },
    { title: 'Payroll',          href: '/payroll',          icon: IndianRupee,   roles: ['owner'] },
    { title: 'Branches',         href: '/branches',         icon: Building2,     roles: ['owner','developer'] },
    { title: 'Jobs',             href: '/jobs',             icon: Activity,      roles: ['owner','developer'] },
    { title: 'Machines',         href: '/machines',         icon: Cpu,           roles: ['owner','developer'] },
    { title: 'Docs',             href: '/docs',             icon: BookOpen,      roles: ['owner','developer','manager','cashier','employee'] },
  ]
  return allNavItems.filter((item) => item.roles.includes(role))
}

// ── Nav leaf item ─────────────────────────────────────────────────────────────
function NavItemLeaf({ href, icon: Icon, title, collapsed }) {
  return (
    <NavLink
      to={href}
      title={collapsed ? title : undefined}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active-text))] font-semibold shadow-sm'
            : 'text-muted-foreground hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-foreground',
          collapsed && 'justify-center px-2.5'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn(
            'h-[18px] w-[18px] flex-shrink-0 transition-transform',
            isActive ? 'text-[hsl(var(--sidebar-active-text))]' : 'text-muted-foreground group-hover:text-primary group-hover:scale-105'
          )} />
          {!collapsed && <span className="truncate">{title}</span>}
          {isActive && !collapsed && (
            <span className="ml-auto h-2 w-2 rounded-full bg-primary shadow-xs  flex-shrink-0" />
          )}
        </>
      )}
    </NavLink>
  )
}

// Collapsed rail: the sub-menu is a fixed, portalled flyout so the scrolling <nav> can't clip it.
function CollapsedNavGroup({ item }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0, maxHeight: 400 })
  const triggerRef = useRef(null)
  const closeTimer = useRef(null)

  const show = () => {
    clearTimeout(closeTimer.current)
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) {
      const maxHeight = Math.max(160, window.innerHeight - 16)
      // Keep the whole menu on screen: slide it up if it would run past the bottom.
      const estimated = Math.min(maxHeight, 44 + item.children.length * 36)
      const top = Math.max(8, Math.min(r.top, window.innerHeight - estimated - 8))
      setPos({ left: r.right, top, maxHeight })
    }
    setOpen(true)
  }
  const hideSoon = () => {
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  return (
    <div onMouseEnter={show} onMouseLeave={hideSoon} onFocus={show} onBlur={hideSoon}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={item.title}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className="flex w-full cursor-pointer items-center justify-center rounded-lg px-2.5 py-2.5 text-muted-foreground transition-all hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
      </button>
      {open &&
        createPortal(
          <div
            className="fixed z-[70] pl-2"
            style={{ left: pos.left, top: pos.top }}
            onMouseEnter={show}
            onMouseLeave={hideSoon}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          >
            <div role="menu" className="min-w-[200px] overflow-y-auto rounded-md border bg-popover py-2 shadow-lg" style={{ maxHeight: pos.maxHeight }}>
              <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.title}</div>
              {item.children.map((child) => (
                <NavLink
                  key={child.href}
                  to={child.href}
                  end={child.href === '/inventory'}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-accent font-semibold text-primary'
                        : 'text-muted-foreground hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-foreground'
                    )
                  }
                >
                  <child.icon className="h-4 w-4 flex-shrink-0" />
                  {child.title}
                </NavLink>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

// ── Nav group ─────────────────────────────────────────────────────────────────
function NavGroup({ item, collapsed, expandedGroups, toggleGroup }) {
  const isExpanded = expandedGroups[item.title]

  if (collapsed) {
    return <CollapsedNavGroup item={item} />
  }

  return (
    <div>
      <button
        onClick={() => toggleGroup(item.title)}
        className="group flex items-center w-full gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg text-muted-foreground hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-foreground transition-all"
      >
        <item.icon className="h-[18px] w-[18px] flex-shrink-0 text-muted-foreground group-hover:text-primary group-hover:scale-105 transition-transform" />
        <span className="flex-1 text-left truncate">{item.title}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-200 text-muted-foreground/60',
            isExpanded && 'rotate-180'
          )}
        />
      </button>
      {isExpanded && (
        <div className="ml-4 mt-0.5 pl-3 border-l-2 border-border space-y-0.5 py-0.5">
          {item.children.map((child) => (
            <NavLink
              key={child.href}
              to={child.href}
              end={child.href === '/inventory'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-md transition-all',
                  isActive
                    ? 'bg-accent text-accent-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-foreground'
                )
              }
            >
              <child.icon className="h-3.5 w-3.5 flex-shrink-0" />
              {child.title}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sidebar Content ───────────────────────────────────────────────────────────
function SidebarContent({ collapsed, expandedGroups, toggleGroup, navItems, user, onLogout, onToggleCollapse }) {
  const initials = user?.fullName
    ? user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))]">
      {/* Brand Logo */}
      <div className={cn(
        'flex items-center h-20 flex-shrink-0 px-5 border-b border-white/60',
        collapsed && 'justify-center px-2'
      )}>
        {(() => {
          // On desktop the logo doubles as the collapse button: hover swaps it for the panel icon.
          const mark = onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? 'Expand sidebar  ( [ )' : 'Collapse sidebar  ( [ )'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="group/logo relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-white outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Scissors className="h-5 w-5 transition-opacity group-hover/logo:opacity-0 group-focus-visible/logo:opacity-0" />
              {collapsed ? (
                <PanelLeftOpen className="absolute h-5 w-5 opacity-0 transition-opacity group-hover/logo:opacity-100 group-focus-visible/logo:opacity-100" />
              ) : (
                <PanelLeftClose className="absolute h-5 w-5 opacity-0 transition-opacity group-hover/logo:opacity-100 group-focus-visible/logo:opacity-100" />
              )}
            </button>
          ) : (
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
              <Scissors className="h-5 w-5 text-white" />
            </div>
          )
          return collapsed ? (
            mark
          ) : (
            <div className="flex items-center gap-3">
              {mark}
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-tight text-primary">Magic Scissor</span>
                <span className="-mt-0.5 text-[10px] font-medium text-muted-foreground">Salon Management · {CURRENT_VERSION}</span>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto sidebar-scroll space-y-1">
        {navItems.map((item) =>
          item.children ? (
            <NavGroup
              key={item.title}
              item={item}
              collapsed={collapsed}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
            />
          ) : (
            <NavItemLeaf
              key={item.href}
              href={item.href}
              icon={item.icon}
              title={item.title}
              collapsed={collapsed}
            />
          )
        )}
      </nav>

      {/* User profile footer */}
      <div className={cn(
        'flex-shrink-0 border-t border-white/40 p-3.5',
        collapsed && 'p-2'
      )}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2" title={user?.fullName || 'User'}>
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {initials}
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-card border">
            <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground truncate">{user?.fullName || 'User'}</p>
              <p className="text-[11px] text-muted-foreground capitalize truncate">{user?.role || 'Staff'}</p>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────
function Sidebar() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)
  const location = useLocation()
  const { collapsed, toggle, mobileOpen, closeMobile } = useSidebar()
  const navItems = getNavItemsByRole(user?.role || 'employee')

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const isCatalogPath   = ['/services','/packages','/skills'].some(p => location.pathname.startsWith(p))
  const isInventoryPath = ['/inventory','/products','/skus','/warehouses','/suppliers','/purchase-batches','/barcode-print'].some(p => location.pathname.startsWith(p))
  const isFinancePath   = ['/savings-pots','/cash-reconciliation','/expenses','/upi-accounts','/bank-deposits'].some(p => location.pathname.startsWith(p))

  const [expandedGroups, setExpandedGroups] = useState({
    ...(isCatalogPath   ? { Catalog: true }   : {}),
    ...(isInventoryPath ? { Inventory: true }  : {}),
    ...(isFinancePath   ? { Finance: true }    : {}),
  })

  useEffect(() => { closeMobile() }, [location.pathname, closeMobile])

  const toggleGroup = (title) =>
    setExpandedGroups((prev) => ({ ...prev, [title]: !prev[title] }))

  const sharedProps = { expandedGroups, toggleGroup, navItems, user, onLogout: handleLogout }

  return (
    <>
      {/* Mobile drawer */}
      <div className={cn('fixed inset-0 z-50 md:hidden', mobileOpen ? 'pointer-events-auto' : 'pointer-events-none')}>
        <div
          className={cn('absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300', mobileOpen ? 'opacity-100' : 'opacity-0')}
          onClick={closeMobile}
        />
        <aside className={cn('relative flex flex-col w-72 max-w-[82vw] h-full shadow-2xl transition-transform duration-300 ease-in-out', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
          <button onClick={closeMobile} className="absolute top-4 right-3 z-10 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--sidebar-hover-bg))] transition-colors">
            <X className="h-4 w-4" />
          </button>
          <SidebarContent collapsed={false} {...sharedProps} />
        </aside>
      </div>

      {/* Desktop sidebar */}
      <aside className={cn('hidden md:flex md:flex-col md:fixed md:inset-y-0 transition-[width] duration-200 ease-in-out z-30', collapsed ? 'md:w-16' : 'md:w-64')}>
        <SidebarContent collapsed={collapsed} onToggleCollapse={toggle} {...sharedProps} />

        {/* Collapse toggle */}
        <div className="flex-shrink-0 border-t border-[hsl(var(--sidebar-border))]">
          <button
            onClick={toggle}
            className={cn('flex items-center w-full px-3 py-2.5 text-muted-foreground hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-foreground transition-colors', collapsed ? 'justify-center' : 'gap-2')}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <PanelLeftOpen className="h-4 w-4" />
              : <><PanelLeftClose className="h-4 w-4" /><span className="text-xs font-semibold">Collapse</span></>
            }
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
