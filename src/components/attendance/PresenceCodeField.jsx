import { KeyRound } from 'lucide-react'

/** 6-digit code shown on the salon's own screen. Renders nothing unless the owner switched the rule on. */
export default function PresenceCodeField({ required, value, onChange, disabled }) {
  if (!required) return null
  return (
    <div className="rounded-lg border bg-card p-3">
      <label htmlFor="presence-code" className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="h-4 w-4 text-primary" />
        Code from the counter screen
      </label>
      <input
        id="presence-code"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        disabled={disabled}
        placeholder="------"
        aria-describedby="presence-code-help"
        className="mt-2 h-12 w-full rounded-md border border-input bg-background text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/15 disabled:opacity-50"
      />
      <p id="presence-code-help" className="mt-1 text-xs text-muted-foreground">
        Ask at the counter or look at the screen. The code changes every 30 seconds.
      </p>
    </div>
  )
}
