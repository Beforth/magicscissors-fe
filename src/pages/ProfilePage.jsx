import { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  User,
  Shield,
  Mail,
  Phone,
  Building2,
  Key,
  Lock,
  CheckCircle2,
  Sparkles,
  LogOut,
  Calendar,
  Clock,
  Loader2,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react'
import { authService } from '@/services/auth.service'
import { logout } from '@/store/slices/authSlice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export default function ProfilePage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user: authUser } = useSelector((state) => state.auth)

  const { data: meData, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: authService.me,
    staleTime: 60_000,
  })

  const user = meData?.data || authUser || {}

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const changePasswordMutation = useMutation({
    mutationFn: (data) => authService.changePassword(data),
    onSuccess: () => {
      toast.success('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update password')
    },
  })

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    if (!currentPassword) {
      toast.error('Please enter your current password')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    changePasswordMutation.mutate({
      current_password: currentPassword,
      new_password: newPassword,
    })
  }

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const initials = user?.fullName
    ? user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="w-full space-y-6">
      {/* Header Banner */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 ring-4 ring-blue-500/20 shadow-md">
              <AvatarFallback className="bg-blue-600 text-white font-bold text-xl sm:text-2xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
                  {user.fullName || 'User Profile'}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Active
                </span>
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <span className="capitalize font-semibold text-slate-700">{user.role || 'Staff'}</span>
                {user.branch?.name && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-blue-500" />
                      {user.branch.name}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 shadow-2xs"
            >
              <LogOut className="h-4 w-4 mr-1.5" /> Log out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Grid: Details & Password Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Account Information */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-card rounded-3xl p-6 sm:p-7 space-y-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-white/60">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <User className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Account Information</h2>
                <p className="text-xs text-slate-400">Personal and salon assignment details</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-2xl bg-white/70 border border-white/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Full Name
                </span>
                <span className="text-sm font-bold text-slate-800">{user.fullName || '—'}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/70 border border-white/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Role & Access
                </span>
                <span className="text-sm font-bold text-blue-700 capitalize">{user.role || '—'}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/70 border border-white/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Email Address
                </span>
                <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {user.email || '—'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/70 border border-white/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Phone Number
                </span>
                <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {user.phone || '—'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/70 border border-white/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Assigned Branch
                </span>
                <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-blue-500" />
                  {user.branch?.name || 'All Branches (Owner)'}
                </span>
              </div>

              {user.biometric_id && (
                <div className="p-3.5 rounded-2xl bg-white/70 border border-white/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Biometric / Staff ID
                  </span>
                  <span className="text-sm font-bold text-slate-800">{user.biometric_id}</span>
                </div>
              )}
            </div>

            {/* Quick shortcuts for user */}
            <div className="pt-2 flex flex-wrap gap-2.5">
              {['employee', 'cashier', 'manager'].includes(user.role) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/my-attendance')}
                  className="rounded-2xl text-xs font-semibold bg-white/80 hover:bg-white text-slate-700 border-white/80 shadow-2xs"
                >
                  <Calendar className="h-3.5 w-3.5 mr-1.5 text-blue-600" /> View Attendance
                </Button>
              )}
              {['owner', 'developer', 'manager'].includes(user.role) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/employee-status')}
                  className="rounded-2xl text-xs font-semibold bg-white/80 hover:bg-white text-slate-700 border-white/80 shadow-2xs"
                >
                  <Clock className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> Floor Status
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Security / Change Password */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card rounded-3xl p-6 sm:p-7 space-y-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-white/60">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Key className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Security & Password</h2>
                <p className="text-xs text-slate-400">Update your account login password</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Current Password</Label>
                <div className="relative">
                  <Input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="rounded-2xl pr-10 bg-white/80 border-white/80"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">New Password</Label>
                <div className="relative">
                  <Input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="rounded-2xl pr-10 bg-white/80 border-white/80"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="rounded-2xl bg-white/80 border-white/80"
                />
              </div>

              <Button
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 h-11"
              >
                {changePasswordMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" /> Update Password
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
