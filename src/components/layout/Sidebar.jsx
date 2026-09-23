import { useState, useEffect } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/contexts/SidebarContext'
import { CURRENT_VERSION } from '@/data/versionHistory'
import {
  LayoutDashboard,
  Users,
  Receipt,
  Scissors,
  Package,
  Warehouse,
  BarChart3,
  Settings,
  Building2,
  ShoppingBag,
  ArrowRightLeft,
  UserCog,
  Calculator,
  ChevronDown,
  BoxesIcon,
  TrendingUp,
  BookOpen,
  Armchair,
  Wallet,
  Landmark,
  PiggyBank,
  ArrowUpFromLine,
  Truck,
  PackagePlus,
  Smartphone,
  Wrench,
  Activity,
  Cpu,
  CalendarCheck,
  Printer,
  Building,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  UserCheck,
  Clock,
} from 'lucide-react'

const getNavItemsByRole = (role) => {
  const allNavItems = [
    {
      title: 'Dashboard',
      href: '/dashboard/owner',
      icon: LayoutDashboard,
      roles: ['owner', 'developer'],
    },
    {
      title: 'Dashboard',
      href: '/dashboard/manager',
      icon: LayoutDashboard,
      roles: ['manager'],
    },
    {
      title: 'Dashboard',
      href: '/dashboard/cashier',
      icon: LayoutDashboard,
      roles: ['cashier'],
    },
    {
      title: 'Dashboard',
      href: '/dashboard/employee',
      icon: LayoutDashboard,
      roles: ['employee'],
    },
    {
      title: 'Customers',
      href: '/customers',
      icon: Users,
      roles: ['owner', 'developer', 'manager', 'cashier'],
    },
    {
      title: 'Salon Floor',
      href: '/chairs',
      icon: Armchair,
      roles: ['owner', 'developer', 'manager', 'cashier'],
    },
    {
      title: 'Billing',
      href: '/bills',
      icon: Receipt,
      roles: ['owner', 'developer', 'manager', 'cashier'],
    },
    {
      title: 'Employee Status',
      href: '/employee-status',
      icon: UserCheck,
      roles: ['owner', 'developer', 'manager', 'cashier'],
    },
    {
      title: 'Tokens',
      href: '/tokens',
      icon: PackagePlus,
      roles: ['owner', 'developer', 'manager', 'cashier'],
    },
    {
      title: 'Catalog',
      icon: BookOpen,
      roles: ['owner', 'developer', 'manager', 'cashier'],
      children: [
        { title: 'Services', href: '/services', icon: Scissors },
        { title: 'Packages', href: '/packages', icon: Package },
        { title: 'Skills', href: '/skills', icon: Activity },
      ],
    },
    {
      title: 'Inventory',
      icon: BoxesIcon,
      roles: ['owner', 'developer', 'manager', 'cashier'],
      children: [
        {
          title: 'SKUs',
          href: '/skus',
          icon: BoxesIcon,
        },
        {
          title: 'Products',
          href: '/products',
          icon: ShoppingBag,
        },
        {
          title: 'Warehouses',
          href: '/warehouses',
          icon: Warehouse,
        },
        {
          title: 'Stock Levels',
          href: '/inventory',
          icon: Warehouse,
        },
        {
          title: 'Stock Transfers',
          href: '/inventory/transfers',
          icon: ArrowRightLeft,
        },
        { title: 'Suppliers', href: '/suppliers', icon: Truck },
        { title: 'Purchase Batches', href: '/purchase-batches', icon: PackagePlus },
        { title: 'Print Barcodes', href: '/barcode-print', icon: Printer },
      ],
    },
    {
      title: 'Maintenance',
      href: '/maintenance',
      icon: Wrench,
      roles: ['owner', 'developer', 'manager', 'cashier', 'employee'],
    },
    {
      title: 'Reports',
      href: '/reports',
      icon: BarChart3,
      roles: ['owner', 'developer', 'manager'],
    },
    {
      title: 'Finance',
      icon: Landmark,
      roles: ['owner', 'developer', 'manager', 'cashier'],
      children: [
        { title: 'Savings Pots', href: '/savings-pots', icon: PiggyBank },
        { title: 'Cash Drawer', href: '/cash-reconciliation', icon: Calculator },
        { title: 'Expenses', href: '/expenses', icon: Wallet },
        { title: 'UPI Accounts', href: '/upi-accounts', icon: Smartphone },
      ],
    },
    {
      title: 'Staff',
      href: '/staff',
      icon: UserCog,
      roles: ['owner', 'developer', 'manager', 'cashier'],
    },
    {
      title: 'Shift',
      href: '/shifts',
      icon: Clock,
      roles: ['owner', 'developer', 'manager'],
    },
    {
      title: 'Attendance',
      href: '/attendance',
      icon: CalendarCheck,
      roles: ['owner', 'developer', 'manager', 'cashier'],
    },
    {
      title: 'Staff Performance',
      href: '/staff-performance',
      icon: TrendingUp,
      roles: ['owner', 'developer', 'manager', 'cashier'],
    },
    {
      title: 'Branches',
      href: '/branches',
      icon: Building2,
      roles: ['owner', 'developer'],
    },
    {
      title: 'Settings',
      href: '/settings',
      icon: Settings,
      roles: ['owner', 'developer'],
    },
    {
      title: 'Jobs',
      href: '/jobs',
      icon: Activity,
      roles: ['owner', 'developer'],
    },
    {
      title: 'Machines',
      href: '/machines',
      icon: Cpu,
      roles: ['owner', 'developer'],
    },
    {
      title: 'Docs',
      href: '/docs',
      icon: BookOpen,
      roles: ['owner', 'developer', 'manager', 'cashier', 'employee'],
    },
  ]

  return allNavItems.filter((item) => item.roles.includes(role))
}

function SidebarContent({ collapsed, expandedGroups, toggleGroup, navItems, user }) {
  return (
    <div className="flex flex-col flex-grow bg-white overflow-y-auto overflow-x-hidden">
      {/* Logo */}
      <div className="flex items-center h-16 flex-shrink-0 px-3 border-b">
        {collapsed ? (
          <div className="w-10 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto">
            <Scissors className="w-5 h-5 text-white" />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-gray-900">Salon ERP</span>
              <Link to="/version-history" className="text-xs text-gray-400 hover:text-primary transition-colors -mt-1">
                {CURRENT_VERSION}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) =>
          item.children ? (
            collapsed ? (
              // Collapsed: show only parent icon, first child as link on click
              <div key={item.title} className="relative group/nav">
                <div
                  className="flex items-center justify-center w-full px-2 py-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
                  title={item.title}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                </div>
                {/* Tooltip flyout on hover */}
                <div className="absolute left-full top-0 ml-2 hidden group-hover/nav:block z-50">
                  <div className="bg-white border rounded-lg shadow-lg py-2 min-w-[160px]">
                    <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">{item.title}</div>
                    {item.children.map((child) => (
                      <NavLink
                        key={child.href}
                        to={child.href}
                        end={child.href === '/inventory'}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center px-3 py-1.5 text-sm transition-colors',
                            isActive
                              ? 'bg-primary/10 text-primary'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          )
                        }
                      >
                        <child.icon className="mr-2 h-4 w-4 flex-shrink-0" />
                        {child.title}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div key={item.title}>
                <button
                  onClick={() => toggleGroup(item.title)}
                  className="group flex items-center w-full px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  {item.title}
                  <ChevronDown
                    className={cn(
                      'ml-auto h-4 w-4 transition-transform',
                      expandedGroups[item.title] && 'rotate-180'
                    )}
                  />
                </button>
                {expandedGroups[item.title] && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.href}
                        to={child.href}
                        end={child.href === '/inventory'}
                        className={({ isActive }) =>
                          cn(
                            'group flex items-center px-3 py-1.5 text-sm rounded-md transition-colors',
                            isActive
                              ? 'bg-primary/10 text-primary'
                              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                          )
                        }
                      >
                        <child.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                        {child.title}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          ) : collapsed ? (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-center px-2 py-2 rounded-md transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )
              }
              title={item.title}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
            </NavLink>
          ) : (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
              {item.title}
            </NavLink>
          )
        )}
      </nav>

      {/* User info at bottom */}
      <div className="flex-shrink-0 flex border-t border-gray-200 p-3">
        {collapsed ? (
          <div className="mx-auto" title={user?.fullName || 'User'}>
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-primary font-semibold">
                {user?.fullName?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center w-full">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-primary font-semibold">
                  {user?.fullName?.charAt(0) || 'U'}
                </span>
              </div>
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.fullName || 'User'}
              </p>
              <p className="text-xs text-gray-500 capitalize truncate">
                {user?.role || 'Role'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Sidebar() {
  const { user } = useSelector((state) => state.auth)
  const location = useLocation()
  const { collapsed, toggle, mobileOpen, closeMobile } = useSidebar()
  const navItems = getNavItemsByRole(user?.role || 'employee')

  // Auto-expand groups if current path matches
  const isCatalogPath = location.pathname.startsWith('/services') || location.pathname.startsWith('/packages') || location.pathname.startsWith('/skills')
  const isInventoryPath = location.pathname.startsWith('/inventory') || location.pathname.startsWith('/products') || location.pathname.startsWith('/skus') || location.pathname.startsWith('/warehouses') || location.pathname.startsWith('/suppliers') || location.pathname.startsWith('/purchase-batches') || location.pathname.startsWith('/barcode-print')
  const isFinancePath = location.pathname.startsWith('/savings-pots') || location.pathname.startsWith('/counter-withdrawals') || location.pathname.startsWith('/cash-reconciliation') || location.pathname.startsWith('/expenses') || location.pathname.startsWith('/upi-accounts') || location.pathname.startsWith('/bank-deposits')
  const [expandedGroups, setExpandedGroups] = useState({
    ...(isCatalogPath ? { Catalog: true } : {}),
    ...(isInventoryPath ? { Inventory: true } : {}),
    ...(isFinancePath ? { Finance: true } : {}),
  })

  // Auto-close mobile drawer on route change
  useEffect(() => {
    closeMobile()
  }, [location.pathname, closeMobile])

  const toggleGroup = (title) => {
    setExpandedGroups((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  const sharedProps = { expandedGroups, toggleGroup, navItems, user }

  return (
    <>
      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-50 md:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            'absolute inset-0 bg-gray-600/75 transition-opacity duration-300',
            mobileOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={closeMobile}
        />

        {/* Drawer panel */}
        <aside
          className={cn(
            'relative flex flex-col w-72 max-w-[80vw] h-full bg-white border-r border-gray-200 shadow-xl transition-transform duration-300 ease-in-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Close button */}
          <button
            onClick={closeMobile}
            className="absolute top-4 right-3 p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <SidebarContent collapsed={false} {...sharedProps} />
        </aside>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex md:flex-col md:fixed md:inset-y-0 transition-[width] duration-200 ease-in-out z-30 border-r border-gray-200',
          collapsed ? 'md:w-16' : 'md:w-64'
        )}
      >
        <SidebarContent collapsed={collapsed} {...sharedProps} />

        {/* Collapse toggle — desktop only */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white">
          <button
            onClick={toggle}
            className="flex items-center justify-center w-full px-3 py-2.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <PanelLeftClose className="h-5 w-5" />
                <span>Collapse</span>
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
