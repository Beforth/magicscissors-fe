import { useQuery } from '@tanstack/react-query'
import {
  Loader2,
  RefreshCw,
  Coffee,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { rotationQueueService } from '@/services/rotationQueue.service'

const STATUS = {
  available: { label: 'Ready', tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  held: { label: 'In cart', tone: 'bg-violet-100 text-violet-700 border-violet-200' },
  busy: { label: 'Busy', tone: 'bg-orange-100 text-orange-700 border-orange-200' },
  on_break: { label: 'Break', tone: 'bg-amber-100 text-amber-700 border-amber-200' },
}

function formatCheckIn(checkIn) {
  if (!checkIn) return null
  return new Date(checkIn).toLocaleTimeString('en-IN', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function StatusBadge({ displayStatus }) {
  const cfg = STATUS[displayStatus] || STATUS.available
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.tone}`}>
      {cfg.label}
    </span>
  )
}

function QueueRow({ row, highlight = false, hideMeta = false }) {
  const displayStatus = row.display_status || row.status
  const skipped =
    row.status === 'available'
    && displayStatus !== 'available'
    && displayStatus !== 'held'

  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
        highlight
          ? 'bg-emerald-50 border border-emerald-300 shadow-sm ring-1 ring-emerald-100'
          : skipped
            ? 'bg-gray-50 opacity-60 border border-gray-100'
            : 'border border-gray-200 bg-white'
      }`}
    >
      {/* Rank circle */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          highlight ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
        }`}
      >
        {row.rank}
      </div>

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm text-gray-900 truncate">{row.full_name}</span>
          {highlight && (
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-4 shrink-0">
              Next
            </Badge>
          )}
        </div>
        {!hideMeta && (
          <div className="text-[11px] text-gray-400 flex flex-wrap gap-x-2 items-center mt-0.5">
            {row.check_in_at && (
              <span className="inline-flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                Waiting {formatCheckIn(row.check_in_at)}
              </span>
            )}
            {row.skill_names?.length > 0 && (
              <span className="truncate">{row.skill_names.join(' · ')}</span>
            )}
          </div>
        )}
      </div>

      <StatusBadge displayStatus={displayStatus} />
    </div>
  )
}

/**
 * Check-in order rotation queue for billing.
 *
 * accordion={true}  — compact card above Cart.
 *   Always shows: header + subtitle + next-up person row.
 *   Toggle expands: remaining queue rows + summary pill row.
 *
 * accordion={false} (default) — original full inline panel.
 */
export default function EmployeeRotationPanel({
  branchId,
  serviceId,
  serviceName,
  heldEmployeeIds = [],
  compact = false,
  accordion = false,
  accordionOpen = false,
  onAccordionToggle = () => {},
  floatExpand = false,
  bare = false,
  hideMeta = false,
}) {
  const heldKey = heldEmployeeIds.join(',')

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['rotation-queue', branchId, serviceId || null, heldKey],
    queryFn: async () => {
      const res = await rotationQueueService.getQueue({ branchId, heldEmployeeIds })
      return res?.data?.data || res?.data || res
    },
    enabled: !!branchId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  if (!branchId) return null

  const board = data || {}
  const queue = board.queue || []
  const summary = board.summary || {}
  const nextUp = board.next_up
  const readyCount = summary.available ?? 0
  const visibleLimit = compact ? 5 : 8

  /* ── ACCORDION MODE ─────────────────────────────────────── */
  if (accordion) {
    return (
      <div className={`rounded-lg border border-border bg-card shadow-sm ${floatExpand ? 'relative h-full' : 'overflow-hidden'}`}>

        {/* ── Header row ── */}
        <div className="flex items-center gap-2 px-3.5 pt-3 pb-1">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-sm text-foreground flex-1">Check-in queue</span>

          {/* Ready count pill */}
          {!isLoading && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
              {readyCount} ready
            </span>
          )}

          {/* Toggle chevron */}
          <button
            type="button"
            onClick={onAccordionToggle}
            className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted transition-colors shrink-0"
            title={accordionOpen ? 'Collapse queue' : 'Expand queue'}
          >
            {accordionOpen
              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            }
          </button>
        </div>

        {/* ── Subtitle ── */}
        <div className="px-3.5 pb-2">
          <p className="text-[11px] text-muted-foreground">
            {serviceId
              ? <>For <span className="font-medium text-foreground">{serviceName || 'service'}</span> · check-in order</>
              : 'Staff order by arrival · first checked in is first up'
            }
          </p>
        </div>

        {/* ── Always-visible: next-up row ── */}
        <div className="px-3 pb-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading queue…
            </div>
          ) : nextUp ? (
            <QueueRow row={nextUp} highlight hideMeta={hideMeta || floatExpand} />
          ) : queue.length > 0 ? (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              No one matches this service's skills — assign manually.
            </div>
          ) : (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-1">
              <Coffee className="h-3.5 w-3.5" />
              No checked-in staff yet.
            </div>
          )}
        </div>

        {/* ── Expanded: rest of queue + summary + refresh ── */}
        {accordionOpen && (
          <div className={`border-t border-border px-3 py-2.5 space-y-2 ${floatExpand ? 'absolute left-0 right-0 top-full z-20 bg-card shadow-lg border border-border rounded-b-lg max-h-[20rem] overflow-y-auto' : 'bg-muted/30'}`}>

            {/* Rest of queue (skip the nextUp row already shown) */}
            {queue.length > 1 && (
              <div className="space-y-1.5">
                {queue
                  .filter((r) => r.employee_id !== nextUp?.employee_id)
                  .slice(0, visibleLimit - 1)
                  .map((row) => (
                    <QueueRow key={row.employee_id} row={row} hideMeta={hideMeta || floatExpand} />
                  ))
                }
                {queue.length > visibleLimit && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    +{queue.length - visibleLimit} more
                  </p>
                )}
              </div>
            )}

            {/* Summary pills row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                <span className="font-medium text-emerald-700">
                  {readyCount} ready
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {summary.busy ?? 0} busy
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {summary.on_break ?? 0} on break
                </span>
                {(summary.held ?? 0) > 0 && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-violet-600">{summary.held} in cart</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); refetch() }}
                disabled={isFetching}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {dataUpdatedAt > 0 && (
              <p className="text-[10px] text-muted-foreground/60 text-right">
                Updated{' '}
                {new Date(dataUpdatedAt).toLocaleTimeString('en-IN', {
                  timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
                })}
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  /* ── ORIGINAL INLINE MODE ───────────────────────────────── */
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading rotation queue…
      </div>
    )
  }

  return (
    <div className={`${bare ? (compact ? 'p-3' : 'p-4') : `rounded-lg border bg-card ${compact ? 'p-3' : 'p-4'}`} space-y-3`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Check-in queue
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {serviceId ? (
              <>
                For <span className="font-medium text-foreground">{serviceName || 'service'}</span>
                {' '}· check-in order
              </>
            ) : (
              'Staff order by arrival today — first checked in is first up'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 mt-0.5"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          Ready: <strong>{readyCount}</strong>
        </span>
        {(summary.held ?? 0) > 0 && (
          <span className="text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
            In cart: <strong>{summary.held}</strong>
          </span>
        )}
        <span className="text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
          Busy: <strong>{summary.busy ?? 0}</strong>
        </span>
        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          Break: <strong>{summary.on_break ?? 0}</strong>
        </span>
      </div>

      {serviceId && !nextUp && queue.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          No one in queue matches this service's skills — assign manually or wait.
        </div>
      )}

      {queue.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            {serviceId ? 'Full queue (check-in order)' : 'On floor today'}
          </div>
          {queue.slice(0, visibleLimit).map((row) => (
            <QueueRow
              key={row.employee_id}
              row={row}
              highlight={serviceId ? row.employee_id === nextUp?.employee_id : row.is_next}
              hideMeta={hideMeta}
            />
          ))}
          {queue.length > visibleLimit && (
            <p className="text-[10px] text-muted-foreground text-center">
              +{queue.length - visibleLimit} more
            </p>
          )}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground text-center py-2 flex items-center justify-center gap-1">
          <Coffee className="h-3.5 w-3.5" />
          No checked-in staff on the queue yet.
        </div>
      )}

      {dataUpdatedAt > 0 && (
        <p className="text-[10px] text-muted-foreground text-right">
          Updated{' '}
          {new Date(dataUpdatedAt).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
          })}
        </p>
      )}
    </div>
  )
}
