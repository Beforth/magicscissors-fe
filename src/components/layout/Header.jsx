import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { logout } from '@/store/slices/authSlice'
import { notificationService } from '@/services/notification.service'
import { branchService } from '@/services/branch.service'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { usePwaInstall } from '@/lib/pwaInstall'
import { OPEN_PALETTE_EVENT } from './CommandCenter'
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
  Download,
} from 'lucide-react'
import EmployeeRotationPanel from '@/components/billing/EmployeeRotationPanel'

function usePageTitle() {
  const location = useLocation()
  const segments = location.pathname.replace(/^\//, '').split('/')
  const raw = segments[segments.length - 1] || 'Dashboard'
  return raw.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function Header({ onMenuClick }) {
  const pwa = usePwaInstall()
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
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-background/90 backdrop-blur-md px-4 sm:px-6 lg:px-8">
      {/* Branch indicator */}
      {user?.branch && (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
            <Building2 className="h-5 w-5" />
          </span>
          <span className="truncate text-[15px] font-semibold text-foreground">{user.branch.name}</span>
        </div>
      )}

      {/* Search / command palette trigger */}
      <div className="hidden md:flex flex-1 max-w-sm ml-2">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
          className="flex h-9 w-full items-center gap-2.5 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground outline-none transition-colors hover:border-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="text-[13px]">Search pages & actions…</span>
          <span className="ml-auto flex items-center gap-1"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
        </button>
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
                className="h-10 w-10 rounded-lg bg-background border text-muted-foreground hover:text-foreground hover:bg-secondary"
                title="Queue & Floor Filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-64 rounded-xl bg-popover border shadow-lg p-2"
            >
              <DropdownMenuLabel className="px-3 py-2 text-xs font-bold text-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Quick Filters</span>
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />

              {/* Branches if available */}
              {branches.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Branch Selection
                  </div>
                  {branches.map((b) => (
                    <DropdownMenuItem
                      key={b.branch_id}
                      onClick={() => {
                        setSelectedBranchId(b.branch_id)
                        setFilterOpen(false)
                      }}
                      className={`flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-md cursor-pointer ${
                        effectiveBranchId === b.branch_id ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      <span className="truncate">{b.name}</span>
                      {effectiveBranchId === b.branch_id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="bg-border" />
                </>
              )}

              <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Floor Quick Views
              </div>
              <DropdownMenuItem
                onClick={() => { navigate('/employee-status'); setFilterOpen(false) }}
                className="gap-2.5 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-primary rounded-md cursor-pointer"
              >
                <TrendingUp className="h-4 w-4 text-primary" />
                <span>Live Staff Status</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { navigate('/bills'); setFilterOpen(false) }}
                className="gap-2.5 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-primary rounded-md cursor-pointer"
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
              className="h-10 w-10 rounded-lg bg-background border text-muted-foreground hover:text-foreground hover:bg-secondary"
              title="Staff queue"
            >
              <Users className="h-4.5 w-4.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-80 max-h-[20rem] overflow-y-auto rounded-xl bg-popover border shadow-lg p-2"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {queueOpen && effectiveBranchId && (
              <EmployeeRotationPanel branchId={effectiveBranchId} compact bare hideMeta />
            )}
            {queueOpen && !effectiveBranchId && (
              <p className="px-4 py-5 text-sm text-muted-foreground text-center">No branch assigned</p>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 rounded-lg bg-background border text-muted-foreground hover:text-foreground hover:bg-secondary"
              title="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white shadow-xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-xl bg-popover border shadow-lg p-2">
            <DropdownMenuLabel className="flex items-center justify-between py-2 px-3">
              <span className="font-bold text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="text-xs font-semibold text-primary hover:text-primary transition-colors"
                  onClick={() => markAllReadMutation.mutate()}
                >
                  Mark all read
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Bell className="h-5 w-5 text-muted-foreground/60" />
                </div>
                <p className="text-xs text-muted-foreground">All caught up!</p>
              </div>
            ) : (
              notifications.slice(0, 8).map((n) => (
                <DropdownMenuItem
                  key={n.notification_id}
                  className={`flex flex-col items-start gap-0.5 cursor-pointer rounded-md px-3 py-2 ${!n.is_read ? 'bg-accent' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex items-center gap-2 w-full">
                    {n.type?.includes('stock_transfer') && <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                    <span className="font-semibold text-xs text-foreground truncate">{n.title}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground line-clamp-2 pl-3.5">{n.message}</span>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem onClick={() => navigate('/inventory/transfers')} className="gap-2 px-3 py-2 text-muted-foreground hover:text-primary rounded-md">
              <ArrowRightLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Stock transfers</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 gap-2.5 px-2 rounded-lg bg-background border hover:bg-secondary">
              <Avatar className="h-7 w-7 ring-2 ring-primary/20">
                <AvatarFallback className="bg-primary text-white text-xs font-bold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden lg:block text-xs font-bold text-foreground max-w-[100px] truncate">
                {user?.fullName?.split(' ')[0]}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 rounded-xl bg-popover border shadow-lg p-2" align="end" forceMount>
            <DropdownMenuLabel className="font-normal px-3 py-2.5">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-white text-sm font-bold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{user?.fullName}</p>
                  <p className="text-xs text-muted-foreground truncate capitalize">{user?.role}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem onClick={() => navigate('/profile')} className="gap-2.5 px-3 py-2 text-muted-foreground hover:text-primary rounded-md">
              <User className="h-4 w-4" />Profile
            </DropdownMenuItem>
            {!pwa.installed && (pwa.canPrompt || pwa.isIOS) && (
              <DropdownMenuItem
                onClick={() => (pwa.canPrompt ? pwa.install() : toast.info('Tap Share, then “Add to Home Screen”'))}
                className="gap-2.5 px-3 py-2 text-muted-foreground hover:text-primary rounded-md"
              >
                <Download className="h-4 w-4" />Install app
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="gap-2.5 px-3 py-2 text-rose-500 focus:text-rose-600 focus:bg-rose-50 rounded-md"
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
