import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, RefreshCw, Clock, CheckCircle2, XCircle, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { formatDateTimeStored } from '@/lib/utils'
import { jobRunService } from '@/services/jobRun.service'

const STATUS_BADGE = {
  running: 'default',
  succeeded: 'success',
  failed: 'destructive',
  skipped: 'secondary',
}

const STATUS_ICON = {
  running: Clock,
  succeeded: CheckCircle2,
  failed: XCircle,
  skipped: SkipForward,
}

function formatDuration(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

function summaryPreview(summary) {
  if (!summary || typeof summary !== 'object') return '—'
  const entries = Object.entries(summary)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
  return entries.length ? entries.join(' · ') : '—'
}

export default function JobsPage() {
  const [statusTab, setStatusTab] = useState('all')
  const [jobName, setJobName] = useState('all')
  const [page, setPage] = useState(1)
  const [detailId, setDetailId] = useState(null)
  const pageSize = 50

  const queryParams = {
    page,
    page_size: pageSize,
    ...(statusTab !== 'all' ? { status: statusTab } : {}),
    ...(jobName !== 'all' ? { job_name: jobName } : {}),
  }

  const { data: runsData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['jobRuns', queryParams],
    queryFn: () => jobRunService.list(queryParams),
    refetchInterval: 30_000,
  })

  const { data: namesData } = useQuery({
    queryKey: ['jobNames'],
    queryFn: () => jobRunService.listNames(),
  })

  const { data: scheduledData } = useQuery({
    queryKey: ['scheduledJobs'],
    queryFn: () => jobRunService.listScheduled(),
    refetchInterval: 60_000,
  })

  const { data: detailData } = useQuery({
    queryKey: ['jobRun', detailId],
    queryFn: () => jobRunService.getById(detailId),
    enabled: !!detailId,
  })

  const runs = runsData?.data || []
  const pagination = runsData?.pagination
  const names = namesData?.data?.names || []
  const scheduled = scheduledData?.data?.scheduled || []
  const detail = detailData?.data

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Jobs</h1>
          <p className="text-sm text-muted-foreground">Scheduler execution history. Records kept for 30 days.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Currently scheduled jobs */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Currently scheduled</h2>
          {scheduled.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs scheduled.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {scheduled.map((s) => (
                <Badge key={s.branchId} variant="secondary" className="font-mono text-xs">
                  branch {s.branchId.slice(0, 8)} · close {s.closeTime} · cron "{s.cronExpr}"
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs mb-1 block">Job</Label>
            <SearchableSelect
              options={[{ value: 'all', label: 'All jobs' }, ...names.map(n => ({ value: n, label: n }))]}
              value={jobName}
              onChange={(v) => { setJobName(v); setPage(1) }}
              placeholder="All jobs"
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Status</Label>
            <Tabs value={statusTab} onValueChange={(v) => { setStatusTab(v); setPage(1) }}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="succeeded">Succeeded</TabsTrigger>
                <TabsTrigger value="failed">Failed</TabsTrigger>
                <TabsTrigger value="running">Running</TabsTrigger>
                <TabsTrigger value="skipped">Skipped</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Run history table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No job runs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => {
                  const Icon = STATUS_ICON[r.status] || Clock
                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setDetailId(r.id)}
                    >
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {formatDateTimeStored(r.startedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.jobName}</div>
                        {r.jobKey && <div className="text-xs text-muted-foreground font-mono">{r.jobKey}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{r.triggeredBy}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[r.status] || 'default'} className="capitalize">
                          <Icon className="h-3 w-3 mr-1 inline" />
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDuration(r.durationMs)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                        {r.status === 'failed' ? (
                          <span className="text-destructive">{r.errorMessage || 'failed'}</span>
                        ) : (
                          summaryPreview(r.summary)
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.total_pages} · {pagination.total} total
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.total_pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.jobName || 'Job run'}</DialogTitle>
            <DialogDescription>
              {detail?.jobKey && <span className="font-mono text-xs">{detail.jobKey}</span>}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <Badge variant={STATUS_BADGE[detail.status] || 'default'} className="capitalize mt-1">
                    {detail.status}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Trigger</div>
                  <Badge variant="outline" className="capitalize mt-1">{detail.triggeredBy}</Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Started</div>
                  <div className="font-mono text-xs">{formatDateTimeStored(detail.startedAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Finished</div>
                  <div className="font-mono text-xs">
                    {detail.finishedAt ? formatDateTimeStored(detail.finishedAt) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Duration</div>
                  <div>{formatDuration(detail.durationMs)}</div>
                </div>
              </div>

              {detail.summary && Object.keys(detail.summary).length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Summary</div>
                  <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
                    {JSON.stringify(detail.summary, null, 2)}
                  </pre>
                </div>
              )}

              {detail.errorMessage && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Error</div>
                  <pre className="bg-destructive/10 text-destructive rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                    {detail.errorMessage}
                    {detail.errorStack && `\n\n${detail.errorStack}`}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
