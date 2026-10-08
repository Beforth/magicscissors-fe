import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { describeDay } from '@/lib/attendanceDay'
import { cn } from '@/lib/utils'

const TONES = {
  ok: { box: 'bg-success/10 border-success/20', icon: CheckCircle2, color: 'text-success' },
  warn: { box: 'bg-warning/10 border-warning/25', icon: AlertTriangle, color: 'text-warning' },
  bad: { box: 'bg-destructive/10 border-destructive/20', icon: XCircle, color: 'text-destructive' },
  muted: { box: 'bg-secondary/60', icon: Info, color: 'text-muted-foreground' },
}

/** Shift + late + penalty verdict for one attendance record (or today's `today` block). */
export default function DayVerdict({ record, className }) {
  const verdict = describeDay(record)
  if (!verdict) return null
  const tone = TONES[verdict.tone]
  const Icon = tone.icon
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border p-3', tone.box, className)}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', tone.color)} />
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-foreground">{verdict.title}</p>
        <p className="text-xs text-muted-foreground">{verdict.detail}</p>
        {record.shift && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Shift: {record.shift.name} · {record.shift.start_time}–{record.shift.end_time}
          </p>
        )}
      </div>
    </div>
  )
}
