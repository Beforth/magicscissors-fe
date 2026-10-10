import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowDownRight, ArrowUpRight, ChevronDown, Download, FileSpreadsheet, FileText, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/export-utils'

function cssColor(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v ? `hsl(${v})` : fallback
  } catch {
    return fallback
  }
}

export function useChartColors() {
  return useMemo(
    () => ({
      primary: cssColor('--primary', 'hsl(221 83% 53%)'),
      success: cssColor('--success', 'hsl(161 94% 30%)'),
      warning: cssColor('--warning', 'hsl(32 95% 44%)'),
      info: 'hsl(188 78% 41%)',
      destructive: cssColor('--destructive', 'hsl(347 77% 50%)'),
      muted: cssColor('--muted-foreground', 'hsl(215 16% 47%)'),
      border: cssColor('--border', 'hsl(214 32% 91%)'),
    }),
    []
  )
}

export const compact = (n) => new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
export const shortDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function Delta({ value, label = 'vs previous period' }) {
  if (value == null) return <span className="text-xs text-muted-foreground">no earlier data to compare</span>
  const flat = value === 0
  const up = value > 0
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${flat ? 'text-muted-foreground' : up ? 'text-emerald-600' : 'text-rose-600'}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value)}%<span className="ml-1 font-normal text-muted-foreground">{label}</span>
    </span>
  )
}

export function Kpi({ label, value, change, hint, tone = '' }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tabular-nums leading-none ${tone}`}>{value}</p>
      <div className="mt-2 min-h-[1rem]">{change !== undefined ? <Delta value={change} /> : hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}</div>
    </div>
  )
}

export function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl border bg-card p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Empty({ children = 'Nothing to show for this period.' }) {
  return <div className="grid min-h-[8rem] place-items-center px-4 text-center text-sm text-muted-foreground">{children}</div>
}

export function ShareBar({ value, max, className = 'bg-primary' }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div className={`h-full rounded-full transition-all duration-500 ${className}`} style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} />
    </div>
  )
}

export function ChartTip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-0.5 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">{format ? format(p.value, p.dataKey) : p.value}</span>
        </p>
      ))}
    </div>
  )
}

/** Sortable table. columns: { key, label, align?, render?(row), sortValue?(row), className? } */
export function DataTable({ columns, rows, rowKey, onRowClick, defaultSort, empty, footer, maxHeight = '28rem' }) {
  const [sort, setSort] = useState(defaultSort || null)
  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    const val = (r) => (col?.sortValue ? col.sortValue(r) : r[sort.key])
    return [...rows].sort((a, b) => {
      const x = val(a)
      const y = val(b)
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''))
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [rows, sort, columns])

  if (!rows.length) return <Empty>{empty}</Empty>
  const toggle = (key) => setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))

  return (
    <div className="overflow-auto rounded-lg border" style={{ maxHeight }}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:underline">
                  {c.label}
                  {sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={rowKey ? rowKey(r) : i}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(r) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={`border-t ${onRowClick ? 'cursor-pointer hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none' : ''}`}
            >
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c.className || ''}`}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot className="sticky bottom-0 bg-muted/80 font-semibold backdrop-blur">
            <tr>
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                  {footer[c.key] ?? ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

export function ExportMenu({ rows, filename, title, summary = [] }) {
  if (!rows || rows.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportToCSV(rows, filename)}>
          <FileText className="mr-2 h-4 w-4" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToExcel(rows, filename, { title })}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToPDF(rows, filename, { title, summaryCards: summary })}>
          <FileText className="mr-2 h-4 w-4" /> Print / PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ReportLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  )
}

export function ReportError({ error, retry }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
      <p className="font-semibold">This report could not be loaded.</p>
      <p className="mt-1">{error?.response?.data?.error?.message || error?.message || 'Please try again.'}</p>
      {retry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  )
}
