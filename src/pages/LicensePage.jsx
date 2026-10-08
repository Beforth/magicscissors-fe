import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { licenseService } from '@/services/license.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const STATUS_TEXT = {
  valid: ['Licensed', 'success'],
  grace: ['Expired – grace period', 'warning'],
  expired: ['Expired', 'danger'],
  missing: ['No licence installed', 'danger'],
  invalid: ['Invalid licence', 'danger'],
  wrong_device: ['Licence is for another device', 'danger'],
  clock_tampered: ['System date is wrong', 'danger'],
  no_device_id: ['Device id missing', 'danger'],
}

export default function LicensePage() {
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const { data, isLoading, isError } = useQuery({ queryKey: ['license'], queryFn: licenseService.getStatus, retry: 0 })
  const s = data?.data

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(s.fingerprint)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { toast.error('Select the id and copy it manually') }
  }

  const activate = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await licenseService.activate(text.trim())
      toast.success('Licence activated')
      setText('')
      await queryClient.invalidateQueries({ queryKey: ['license'] })
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not activate the licence')
    } finally { setBusy(false) }
  }

  const [label, tone] = STATUS_TEXT[s?.status] || ['Unknown', 'danger']
  const ok = s?.allowed

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {ok ? <ShieldCheck className="h-5 w-5 text-success" /> : <ShieldAlert className="h-5 w-5 text-destructive" />}
            Licence
          </CardTitle>
          <CardDescription>This installation is licensed to one device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {isError && <p className="text-sm text-destructive">Cannot reach the server.</p>}
          {s && !s.enforced && <p className="text-sm text-muted-foreground">Licensing is not enabled on this server.</p>}
          {s?.enforced && (
            <>
              <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">Status</dt>
                <dd className={`font-semibold ${tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-destructive'}`}>{label}</dd>
                {s.customer && (<><dt className="text-muted-foreground">Licensed to</dt><dd>{s.customer}</dd></>)}
                {s.expires_at && (<><dt className="text-muted-foreground">Valid until</dt><dd>{new Date(s.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}{s.days_left != null && s.days_left >= 0 ? ` (${s.days_left} days left)` : ''}</dd></>)}
                <dt className="text-muted-foreground">Device id</dt>
                <dd className="flex items-center gap-2 font-mono text-[13px]">
                  {s.fingerprint || '—'}
                  {s.fingerprint && (
                    <button type="button" onClick={copy} aria-label="Copy device id" className="rounded p-1 text-muted-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50 outline-none">
                      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    </button>
                  )}
                </dd>
              </dl>

              <form onSubmit={activate} className="space-y-2">
                <label htmlFor="lic" className="text-sm font-medium">{ok ? 'Renew licence' : 'Enter licence'}</label>
                <textarea
                  id="lic"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  spellCheck={false}
                  placeholder="Paste the licence text from your vendor (starts with MSC1.)"
                  className="w-full rounded-md border border-input bg-background p-2 font-mono text-xs outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/15"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">To get or renew a licence, send the device id above to your vendor.</p>
                  <Button type="submit" loading={busy} disabled={!text.trim()}><KeyRound className="h-4 w-4" /> Activate</Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
      <p className="text-center text-sm"><Link className="text-primary hover:underline" to="/">Back to the app</Link></p>
    </div>
  )
}
