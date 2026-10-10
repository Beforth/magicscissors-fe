import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Scissors, Loader2, Eye, EyeOff } from 'lucide-react'
import { login } from '@/store/slices/authSlice'
import { authService } from '@/services/auth.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const schema = z
  .object({
    full_name: z.string().trim().min(1, 'Your name is required'),
    username: z
      .string()
      .trim()
      .min(3, 'At least 3 characters')
      .regex(/^[A-Za-z0-9._-]+$/, 'Use letters, numbers, . _ - only'),
    email: z.string().trim().email('Enter a valid email').or(z.literal('')),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Needs an uppercase letter, a lowercase letter and a number'),
    confirm_password: z.string(),
    branch_name: z.string().trim(),
    branch_code: z.string().trim(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

function Field({ id, label, error, hint, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function SetupPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { full_name: '', username: '', email: '', password: '', confirm_password: '', branch_name: '', branch_code: '' },
  })

  // Setup is only available on an empty system; otherwise go to the normal sign-in.
  useEffect(() => {
    let cancelled = false
    authService
      .setupStatus()
      .then((res) => {
        if (cancelled) return
        if (res?.data?.needs_setup) setChecking(false)
        else navigate('/login', { replace: true })
      })
      .catch(() => {
        if (!cancelled) navigate('/login', { replace: true })
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  useEffect(() => {
    if (!checking) setFocus('full_name')
  }, [checking, setFocus])

  const onSubmit = async (values) => {
    setSubmitting(true)
    try {
      const { confirm_password, ...payload } = values
      await authService.setup(payload)
      const result = await dispatch(login({ username: values.username, password: values.password }))
      if (login.fulfilled.match(result)) {
        toast.success('Welcome! Your salon is ready to set up.')
        navigate('/dashboard/owner', { replace: true })
      } else {
        toast.success('Owner account created. Please sign in.')
        navigate('/login', { replace: true })
      }
    } catch (err) {
      const e = err.response?.data?.error
      if (e?.code === 'SETUP_COMPLETE') {
        toast.error(e.message)
        navigate('/login', { replace: true })
      } else {
        toast.error(e?.message || 'Could not complete setup')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E8F8FE] px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
              <Scissors className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Set up your Salon ERP</CardTitle>
          <CardDescription>Create the owner account. This screen appears only once, on a new system.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field id="full_name" label="Your name" error={errors.full_name?.message}>
              <Input id="full_name" autoComplete="name" {...register('full_name')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="username" label="Username" error={errors.username?.message}>
                <Input id="username" autoComplete="username" {...register('username')} />
              </Field>
              <Field id="email" label="Email (optional)" error={errors.email?.message}>
                <Input id="email" type="email" autoComplete="email" {...register('email')} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="password" label="Password" error={errors.password?.message}>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...register('password')} />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Field id="confirm_password" label="Confirm password" error={errors.confirm_password?.message}>
                <Input id="confirm_password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...register('confirm_password')} />
              </Field>
            </div>

            <div className="rounded-lg border p-4 space-y-4">
              <div>
                <p className="text-sm font-medium">First branch (optional)</p>
                <p className="text-xs text-muted-foreground">You can add or change branches later in Branches.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="branch_name" label="Branch name">
                  <Input id="branch_name" placeholder="Main Salon" {...register('branch_name')} />
                </Field>
                <Field id="branch_code" label="Branch code" hint="Short, e.g. MAIN">
                  <Input id="branch_code" placeholder="MAIN" {...register('branch_code')} />
                </Field>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create owner & continue'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default SetupPage
