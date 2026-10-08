import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { logout } from '@/store/slices/authSlice'
import { notificationService } from '@/services/notification.service'
import { branchService } from '@/services/branch.service'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Bell,
  LogOut,
  User,
  Settings,
  ArrowRightLeft,
  Users,
  Building2,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Check,
  TrendingUp,
  Receipt,
} from 'lucide-react'
import EmployeeRotationPanel from '@/components/billing/EmployeeRotationPanel'

function usePageTitle() {
  const location = useLocation()
  const segments = location.pathname.replace(/^\//, '').split('/')
  const raw = segments[segments.length - 1] || 'Dashboard'
  return raw.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function Header({ onMenuClick }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useSelector((state) => state.auth)
  const [queueOpen, setQueueOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedBranchId, setSelectedBranchId] = useState(null)
  const pageTitle = usePageTitle()

  const queueBranchId = selectedBranchId || user?.branchId || null

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: true,
    staleTime: 5 * 60_000,
  })
  const branches = branchesData?.data || []
  const fallbackBranchId = branches[0]?.branch_id || null
  const effectiveBranchId = queueBranchId || fallbackBranchId

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.getNotifications({ limit: 20 }),
    refetchInterval: 30000,
  })

  const notifications = notificationsData?.data?.notifications || []
  const unreadCount = notificationsData?.data?.unread_count ?? 0

  const markReadMutation = useMutation({
    mutationFn: notificationService.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllReadMutation = useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const handleNotificationClick = (n) => {
    if (!n.is_read) markReadMutation.mutate(n.notification_id)
    if (n.reference_type === 'stock_transfer' && n.reference_id) navigate('/inventory/transfers')
  }

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const userInitials = user?.fullName
    ? user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-white/70 bg-white/75 backdrop-blur-xl px-4 sm:px-6 lg:px-8">
      {/* Branch indicator */}
      {user?.branch && (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white/75 px-3 py-1.5 rounded-2xl border border-white/80 shadow-2xs">
            <Building2 className="h-3.5 w-3.5 text-blue-500" />
            {user.branch.name}
          </span>
        </div>
      )}

      {/* Search Input (pill shape matching Offistant style) */}
      <div className="hidden md:flex flex-1 max-w-sm ml-2">
        <div className="flex items-center gap-2.5 w-full h-10 rounded-2xl bg-white/75 backdrop-blur-md border border-white/80 px-4 text-sm text-slate-500 shadow-2xs">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-400 font-medium">Search anything...</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Quick Filter & Branch Selector (hidden for employees) */}
        {user?.role !== 'employee' && (
          <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-2xl bg-white/75 backdrop-blur-md border border-white/80 text-slate-500 hover:text-slate-800 hover:bg-white shadow-2xs"
                title="Queue & Floor Filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-64 rounded-3xl bg-white/95 backdrop-blur-2xl border-white/80 shadow-2xl shadow-indigo-500/10 p-2"
            >
              <DropdownMenuLabel className="px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>Quick Filters</span>
                <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600" />
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-100" />

              {/* Branches if available */}
              {branches.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Branch Selection
                  </div>
                  {branches.map((b) => (
                    <DropdownMenuItem
                      key={b.branch_id}
                      onClick={() => {
                        setSelectedBranchId(b.branch_id)
                        setFilterOpen(false)
                      }}
                      className={`flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer ${
                        effectiveBranchId === b.branch_id ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-white/70'
                      }`}
                    >
                      <span className="truncate">{b.name}</span>
                      {effectiveBranchId === b.branch_id && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="bg-slate-100" />
                </>
              )}

              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Floor Quick Views
              </div>
              <DropdownMenuItem
                onClick={() => { navigate('/employee-status'); setFilterOpen(false) }}
                className="gap-2.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-blue-600 rounded-xl cursor-pointer"
              >
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span>Live Staff Status</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { navigate('/bills'); setFilterOpen(false) }}
                className="gap-2.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-blue-600 rounded-xl cursor-pointer"
              >
                <Receipt className="h-4 w-4 text-emerald-500" />
                <span>Billing Queue</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Check-in Queue */}
        <DropdownMenu open={queueOpen} onOpenChange={setQueueOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-2xl bg-white/75 backdrop-blur-md border border-white/80 text-slate-500 hover:text-slate-800 hover:bg-white shadow-2xs"
              title="Staff queue"
            >
              <Users className="h-4.5 w-4.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-80 max-h-[20rem] overflow-y-auto rounded-3xl bg-white/95 backdrop-blur-2xl border-white/80 shadow-2xl shadow-indigo-500/10 p-2"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {queueOpen && effectiveBranchId && (
              <EmployeeRotationPanel branchId={effectiveBranchId} compact bare hideMeta />
            )}
            {queueOpen && !effectiveBranchId && (
              <p className="px-4 py-5 text-sm text-slate-400 text-center">No branch assigned</p>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 rounded-2xl bg-white/75 backdrop-blur-md border border-white/80 text-slate-500 hover:text-slate-800 hover:bg-white shadow-2xs"
              title="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white shadow-xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-3xl bg-white/95 backdrop-blur-2xl border-white/80 shadow-2xl shadow-indigo-500/10 p-2">
            <DropdownMenuLabel className="flex items-center justify-between py-2 px-3">
              <span className="font-bold text-slate-800">Notifications</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                  onClick={() => markAllReadMutation.mutate()}
                >
                  Mark all read
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100" />
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-slate-300" />
                </div>
                <p className="text-xs text-slate-400">All caught up!</p>
              </div>
            ) : (
              notifications.slice(0, 8).map((n) => (
                <DropdownMenuItem
                  key={n.notification_id}
                  className={`flex flex-col items-start gap-0.5 cursor-pointer rounded-xl px-3 py-2 ${!n.is_read ? 'bg-blue-50/70' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex items-center gap-2 w-full">
                    {n.type?.includes('stock_transfer') && <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
                    {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
                    <span className="font-semibold text-xs text-slate-700 truncate">{n.title}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 line-clamp-2 pl-3.5">{n.message}</span>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem onClick={() => navigate('/inventory/transfers')} className="gap-2 px-3 py-2 text-slate-500 hover:text-blue-600 rounded-xl">
              <ArrowRightLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Stock transfers</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 gap-2.5 px-2 rounded-2xl bg-white/75 backdrop-blur-md border border-white/80 hover:bg-white shadow-2xs">
              <Avatar className="h-7 w-7 ring-2 ring-blue-500/20">
                <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden lg:block text-xs font-bold text-slate-700 max-w-[100px] truncate">
                {user?.fullName?.split(' ')[0]}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 rounded-3xl bg-white/95 backdrop-blur-2xl border-white/80 shadow-2xl shadow-indigo-500/10 p-2" align="end" forceMount>
            <DropdownMenuLabel className="font-normal px-3 py-2.5">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-blue-600 text-white text-sm font-bold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{user?.fullName}</p>
                  <p className="text-xs text-slate-400 truncate capitalize">{user?.role}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem onClick={() => navigate('/profile')} className="gap-2.5 px-3 py-2 text-slate-600 hover:text-blue-600 rounded-xl">
              <User className="h-4 w-4" />Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="gap-2.5 px-3 py-2 text-rose-500 focus:text-rose-600 focus:bg-rose-50 rounded-xl"
            >
              <LogOut className="h-4 w-4" />Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export default Header
