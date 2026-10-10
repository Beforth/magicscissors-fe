import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { billService } from '@/services/bill.service'
import { branchService } from '@/services/branch.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Kbd } from '@/components/ui/kbd'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatCurrency, formatDateTimeStored } from '@/lib/utils'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/export-utils'
import { printThermalReceipt } from '@/components/ThermalReceipt'
import { istTodayStr, rangeFor, presetOf } from '@/components/reports/reportRange'
import {
  Armchair, Check, ChevronDown, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, Loader2, MoreHorizontal,
  Pencil, Play, Plus, Printer, Receipt, Search, Trash2, UserPlus, X, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import CompleteBillModal from '@/components/modals/CompleteBillModal'
import StartServiceModal from '@/components/modals/StartServiceModal'
import ConfirmDialog from '@/components/modals/ConfirmDialog'

const STATUS_TABS = [
  { value: '', label: 'All', key: '1' },
  { value: 'pending', label: 'Pending', key: '2' },
  { value: 'completed', label: 'Completed', key: '3' },
  { value: 'cancelled', label: 'Cancelled', key: '4' },
]
const STATUS_STYLE = {
  completed: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  partial: 'bg-amber-100 text-amber-700',
  draft: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-rose-100 text-rose-700',
}
const DATE_CHIPS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: '7 days' },
  { id: 'month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
]
const PAYMENT_MODES = [['', 'Any payment'], ['cash', 'Cash'], ['card', 'Card'], ['upi', 'UPI'], ['online', 'Online'], ['other', 'Other']]
const SORTS = [
  ['bill_date_desc', 'Newest first'],
  ['bill_date_asc', 'Oldest first'],
  ['total_amount_desc', 'Amount: high to low'],
  ['total_amount_asc', 'Amount: low to high'],
]

const useDebounced = (value, ms = 250) => {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function StatusPill({ status }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[status] || STATUS_STYLE.draft}`}>{status}</span>
}

function IconBtn({ label, onClick, children, tone = '' }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tone}`}
    >
      {children}
    </button>
  )
}

function BillsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useSelector((s) => s.auth)
  const isOwner = user?.role === 'owner' || user?.role === 'developer'
  const canEdit = ['owner', 'manager', 'developer'].includes(user?.role)
  const [params, setParams] = useSearchParams()

  // ---- All filters live in the address bar: Back from a bill returns to exactly this view ----
  const view = params.get('view') === 'pending-services' ? 'pending-services' : 'bills'
  const status = params.get('status') || ''
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  const mode = params.get('mode') || ''
  const branch = params.get('branch') || ''
  const sort = params.get('sort') || 'bill_date_desc'
  const page = Math.max(1, parseInt(params.get('page') || '1', 10))
  const [searchText, setSearchText] = useState(params.get('q') || '')
  const search = useDebounced(searchText.trim())
  const setP = useCallback(
    (patch, resetPage = true) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          Object.entries({ ...patch, ...(resetPage ? { page: '' } : {}) }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
          return next
        },
        { replace: true }
      )
    },
    [setParams]
  )
  useEffect(() => {
    if (search !== (params.get('q') || '')) setP({ q: search })
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const [sortBy, sortOrder] = [sort.replace(/_(asc|desc)$/, ''), sort.endsWith('_asc') ? 'asc' : 'desc']
  const today = istTodayStr()
  const activeChip = presetOf(from, to, today)
  const hasFilters = !!(from || to || mode || branch || search || status)

  const [sel, setSel] = useState(0)
  const [completeModal, setCompleteModal] = useState({ open: false, bill: null })
  const [startItem, setStartItem] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(null)
  const [confirmComplete, setConfirmComplete] = useState(null)
  const searchRef = useRef(null)
  const listRef = useRef(null)

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches({ is_active: 'true' }),
    enabled: isOwner,
  })
  const branches = (branchesData?.data || []).filter((b) => b.is_salon !== false)

  const billsParams = {
    page, limit: 20, search: search || undefined, status: status || undefined, start_date: from || undefined, end_date: to || undefined,
    payment_mode: mode || undefined, branch_id: branch || undefined, sort_by: sortBy, sort_order: sortOrder,
  }
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['bills', billsParams],
    queryFn: () => billService.getBills(billsParams),
    enabled: view === 'bills',
    placeholderData: (prev) => prev,
  })
  const bills = data?.data || []
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 }
  const summary = data?.meta?.summary

  const pendingParams = { page, limit: 20, search: search || undefined, branch_id: branch || undefined }
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-services', pendingParams],
    queryFn: () => billService.getPendingServices(pendingParams),
    placeholderData: (prev) => prev,
  })
  const pendingItems = pendingData?.data || []
  const pendingPagination = pendingData?.pagination || { page: 1, total_pages: 1, total: 0 }

  const rows = view === 'bills' ? bills : pendingItems
  const totalPages = view === 'bills' ? pagination.totalPages : pendingPagination.total_pages
  useEffect(() => setSel(0), [view, page, status, from, to, mode, branch, search, sort, data, pendingData])

  const cancelMutation = useMutation({
    mutationFn: (id) => billService.cancelBill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chairs'] })
      toast.success('Bill cancelled')
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Could not cancel the bill'),
  })
  const completeItemMutation = useMutation({
    mutationFn: ({ billId, itemId, employeeIds }) => billService.completeBillItem(billId, itemId, { employee_ids: employeeIds }),
    onSuccess: () => toast.success('Service completed'),
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed to complete service'),
  })

  const openComplete = async (bill) => {
    try {
      const full = await billService.getBillById(bill.bill_id)
      setCompleteModal({ open: true, bill: full.data })
    } catch {
      toast.error('Failed to load bill details')
    }
  }
  const printBill = async (bill) => {
    try {
      const full = await billService.getBillById(bill.bill_id)
      printThermalReceipt(full.data)
    } catch {
      navigate(`/bills/${bill.bill_id}`)
    }
  }
  const exportRows = (list) =>
    list.map((b) => ({
      bill_number: b.bill_number, customer: b.customer?.customer_name, branch: b.branch?.branch_name, date: b.bill_date?.slice(0, 10),
      items: b.items_count, payment: (b.payment_modes || []).join(' + '), subtotal: b.subtotal, discount: b.discount_amount, total: b.total_amount, status: b.status,
    }))
  const exportAll = async (kind) => {
    try {
      const res = await billService.getBills({ ...billsParams, page: 1, limit: 1000 })
      const list = exportRows(res.data || [])
      if (!list.length) return toast.info('Nothing to export')
      if (kind === 'csv') exportToCSV(list, 'bills')
      else if (kind === 'xlsx') exportToExcel(list, 'bills', { title: 'Bills' })
      else exportToPDF(list, 'bills', { title: 'Bills', summaryCards: [{ label: 'Bills', value: String(list.length) }, { label: 'Total', value: formatCurrency(list.reduce((n, b) => n + (b.total || 0), 0)) }] })
    } catch {
      toast.error('Export failed')
    }
  }

  // ---- Keyboard: / search, j k move, Enter open, e edit, c complete, p print, x cancel, 1-4 status, t today ----
  const kb = useRef({})
  kb.current = { rows, sel, view, totalPages, page, canEdit, openComplete, printBill, setP }
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key
      const typing = /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable
      if (document.querySelector('[role=dialog]')) return
      const h = kb.current
      if (typing) {
        if (e.target === searchRef.current && k === 'Escape') {
          setSearchText('')
          searchRef.current.blur()
        } else if (e.target === searchRef.current && k === 'ArrowDown') {
          e.preventDefault()
          searchRef.current.blur()
          listRef.current?.focus()
        }
        return
      }
      const row = h.rows[h.sel]
      const stop = () => {
        e.preventDefault()
        e.stopPropagation()
      }
      if (k === '/') { stop(); searchRef.current?.focus(); searchRef.current?.select() }
      else if (k === 'j' || k === 'ArrowDown') { stop(); setSel((i) => Math.min(h.rows.length - 1, i + 1)) }
      else if (k === 'k' || k === 'ArrowUp') { stop(); setSel((i) => Math.max(0, i - 1)) }
      else if (k === 'Home') { stop(); setSel(0) }
      else if (k === 'End') { stop(); setSel(Math.max(0, h.rows.length - 1)) }
      else if (k === 'ArrowRight' || k === 'PageDown') { if (h.page < h.totalPages) { stop(); h.setP({ page: String(h.page + 1) }, false) } }
      else if (k === 'ArrowLeft' || k === 'PageUp') { if (h.page > 1) { stop(); h.setP({ page: String(h.page - 1) }, false) } }
      else if (k === 'b') { stop(); h.setP({ view: '' }) }
      else if (k === 's') { stop(); h.setP({ view: 'pending-services' }) }
      else if (h.view === 'bills' && ['1', '2', '3', '4'].includes(k)) { stop(); h.setP({ status: STATUS_TABS[Number(k) - 1].value }) }
      else if (h.view === 'bills' && k === 't') { stop(); const r = rangeFor('today'); h.setP({ from: r.from, to: r.to }) }
      else if (row && k === 'Enter') {
        stop()
        if (h.view === 'bills') navigate(`/bills/${row.bill_id}`)
        else if (row.status === 'pending') setStartItem(row)
        else setConfirmComplete(row)
      } else if (row && h.view === 'bills') {
        if (k === 'e' && h.canEdit && row.status !== 'cancelled') { stop(); navigate(`/bills/${row.bill_id}/edit`) }
        else if (k === 'c' && (row.status === 'pending' || row.status === 'partial')) { stop(); h.openComplete(row) }
        else if (k === 'p') { stop(); h.printBill(row) }
        else if ((k === 'x' || k === 'Delete') && row.status !== 'cancelled') { stop(); setConfirmCancel(row) }
      } else if (row && h.view === 'pending-services') {
        if (k === 'a' && row.status === 'in_progress') { stop(); setStartItem(row) }
        else if (k === 'c' && row.status === 'in_progress') { stop(); setConfirmComplete(row) }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [navigate])
  useEffect(() => {
    listRef.current?.querySelector(`[data-row="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const pendingCount = pendingPagination.total || 0
  const countOf = (value) => (summary ? (value === '' ? summary.count : summary.by_status?.[value]?.count ?? 0) : null)
  const clearAll = () => {
    setSearchText('')
    setParams(new URLSearchParams(view === 'bills' ? '' : 'view=pending-services'), { replace: true })
  }

  const billRow = (b, i) => {
    const on = i === sel
    return (
      <tr
        key={b.bill_id}
        data-row={i}
        onClick={() => { setSel(i); navigate(`/bills/${b.bill_id}`) }}
        className={`group cursor-pointer border-t transition-colors ${on ? 'bg-primary/5 shadow-[inset_3px_0_0_hsl(var(--primary))]' : 'hover:bg-muted/40'} ${b.status === 'cancelled' ? 'opacity-60' : ''}`}
      >
        <td className="px-3 py-2.5">
          <div className="font-mono text-sm font-medium">{b.bill_number}</div>
          {b.book_number && <div className="text-xs text-muted-foreground">Book {b.book_number}</div>}
        </td>
        <td className="px-3 py-2.5">
          <div className="font-medium">{b.customer?.customer_name}</div>
          <div className="text-xs text-muted-foreground">{b.customer?.phone_masked}</div>
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-sm text-muted-foreground">{formatDateTimeStored(b.bill_date)}</td>
        {isOwner && <td className="px-3 py-2.5 text-sm text-muted-foreground">{b.branch?.branch_name}</td>}
        <td className="px-3 py-2.5 text-right text-sm tabular-nums text-muted-foreground">{b.items_count}</td>
        <td className="px-3 py-2.5 text-sm capitalize text-muted-foreground">
          {(b.payment_modes || []).join(' + ') || '—'}
          {b.chair && <span className="ml-2 inline-flex items-center gap-0.5 text-xs"><Armchair className="h-3 w-3" />{b.chair.chair_number}</span>}
        </td>
        <td className="px-3 py-2.5 text-right">
          <div className="font-semibold tabular-nums">{formatCurrency(b.total_amount)}</div>
          {b.discount_amount > 0 && <div className="text-xs text-muted-foreground">−{formatCurrency(b.discount_amount)} off</div>}
        </td>
        <td className="px-3 py-2.5"><StatusPill status={b.status} /></td>
        <td className="px-2 py-2.5">
          <div className={`flex justify-end gap-0.5 transition-opacity ${on ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
            {(b.status === 'pending' || b.status === 'partial') && <IconBtn label="Complete & collect payment (c)" onClick={() => openComplete(b)} tone="hover:text-emerald-600"><Check className="h-4 w-4" /></IconBtn>}
            {canEdit && b.status !== 'cancelled' && <IconBtn label="Edit bill (e)" onClick={() => navigate(`/bills/${b.bill_id}/edit`)}><Pencil className="h-4 w-4" /></IconBtn>}
            <IconBtn label="Print receipt (p)" onClick={() => printBill(b)}><Printer className="h-4 w-4" /></IconBtn>
            {b.status !== 'cancelled' && <IconBtn label={b.status === 'pending' ? 'Cancel bill (x)' : 'Delete bill (x)'} onClick={() => setConfirmCancel(b)} tone="hover:text-rose-600">{b.status === 'pending' ? <XCircle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}</IconBtn>}
          </div>
        </td>
      </tr>
    )
  }

  const billCard = (b, i) => (
    <div key={b.bill_id} data-row={i} onClick={() => navigate(`/bills/${b.bill_id}`)} className="rounded-xl border bg-card p-3 active:bg-muted/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{b.customer?.customer_name}</p>
          <p className="font-mono text-xs text-muted-foreground">{b.bill_number}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{formatCurrency(b.total_amount)}</p>
          <StatusPill status={b.status} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatDateTimeStored(b.bill_date)} · {b.items_count} item{b.items_count === 1 ? '' : 's'}{b.payment_modes?.length ? ` · ${b.payment_modes.join(' + ')}` : ''}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" onClick={(e) => e.stopPropagation()} className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent" aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/bills/${b.bill_id}`)}><Receipt className="mr-2 h-4 w-4" />View</DropdownMenuItem>
            {(b.status === 'pending' || b.status === 'partial') && <DropdownMenuItem onClick={() => openComplete(b)}><Check className="mr-2 h-4 w-4" />Complete</DropdownMenuItem>}
            {canEdit && b.status !== 'cancelled' && <DropdownMenuItem onClick={() => navigate(`/bills/${b.bill_id}/edit`)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => printBill(b)}><Printer className="mr-2 h-4 w-4" />Print</DropdownMenuItem>
            {b.status !== 'cancelled' && <DropdownMenuItem className="text-rose-600" onClick={() => setConfirmCancel(b)}><XCircle className="mr-2 h-4 w-4" />{b.status === 'pending' ? 'Cancel' : 'Delete'}</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  const pendingRow = (it, i) => {
    const on = i === sel
    const started = it.status === 'in_progress'
    return (
      <tr key={it.item_id} data-row={i} onClick={() => setSel(i)} onDoubleClick={() => navigate(`/bills/${it.bill_id}`)} className={`group border-t ${on ? 'bg-primary/5 shadow-[inset_3px_0_0_hsl(var(--primary))]' : 'hover:bg-muted/40'}`}>
        <td className="px-3 py-2.5 font-mono text-sm">
          <button type="button" className="hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/bills/${it.bill_id}`) }}>{it.bill_number}</button>
        </td>
        <td className="px-3 py-2.5 font-medium">{it.customer_name || '—'}</td>
        <td className="px-3 py-2.5">
          <div className="font-medium">{it.item_name}</div>
          {(it.employees || []).length > 0 && <div className="text-xs text-muted-foreground">by {it.employees.map((e) => e.full_name).join(', ')}</div>}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-sm text-muted-foreground">{it.bill_date ? new Date(it.bill_date).toLocaleDateString('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short' }) : '—'}</td>
        {isOwner && <td className="px-3 py-2.5 text-sm text-muted-foreground">{it.branch_name}</td>}
        <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(it.total_price)}</td>
        <td className="px-3 py-2.5">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${started ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>{started ? 'Started' : 'Pending'}</span>
        </td>
        <td className="px-3 py-2.5 text-right">
          <div className="flex justify-end gap-1.5">
            {started ? (
              <>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setStartItem(it) }}><UserPlus className="mr-1 h-3.5 w-3.5" />Employee</Button>
                <Button size="sm" variant="success" onClick={(e) => { e.stopPropagation(); setConfirmComplete(it) }}><Check className="mr-1 h-3.5 w-3.5" />Complete</Button>
              </>
            ) : (
              <Button size="sm" onClick={(e) => { e.stopPropagation(); setStartItem(it) }}><Play className="mr-1 h-3.5 w-3.5" />Start</Button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'
  const loading = view === 'bills' ? isLoading : pendingLoading

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <p className="text-sm text-gray-500">Find, open and fix bills quickly. Press <Kbd>?</Kbd> for shortcuts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view === 'bills' && bills.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export<ChevronDown className="ml-1 h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportAll('csv')}><FileText className="mr-2 h-4 w-4" />CSV (all matching)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAll('xlsx')}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAll('pdf')}><FileText className="mr-2 h-4 w-4" />Print / PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate('/bills/new?type=previous')}><Plus className="mr-1.5 h-4 w-4" />Previous bill</Button>
          <Button size="sm" onClick={() => navigate('/bills/new?type=current')}><Plus className="mr-1.5 h-4 w-4" />New bill<Kbd className="ml-2 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground">n</Kbd></Button>
        </div>
      </div>

      {/* View switch + summary */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5" role="tablist" aria-label="View">
          <button role="tab" aria-selected={view === 'bills'} onClick={() => setP({ view: '' })} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${view === 'bills' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Receipt className="h-4 w-4" />Bills <Kbd className="hidden sm:inline-flex">b</Kbd>
          </button>
          <button role="tab" aria-selected={view === 'pending-services'} onClick={() => setP({ view: 'pending-services' })} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${view === 'pending-services' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Play className="h-4 w-4" />Pending services
            {pendingCount > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">{pendingCount}</span>}
            <Kbd className="hidden sm:inline-flex">s</Kbd>
          </button>
        </div>
        {view === 'bills' && summary && (
          <div className="flex gap-4 text-sm">
            <span><b className="tabular-nums">{summary.count}</b> <span className="text-muted-foreground">bills</span></span>
            <span><b className="tabular-nums text-emerald-600">{formatCurrency(summary.revenue)}</b> <span className="text-muted-foreground">collected</span></span>
            {summary.pending_amount > 0 && <span><b className="tabular-nums text-amber-600">{formatCurrency(summary.pending_amount)}</b> <span className="text-muted-foreground">unpaid</span></span>}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-2.5 rounded-xl border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input ref={searchRef} value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder={view === 'bills' ? 'Search bill no., book no., customer name or code…' : 'Search bill, customer or service…'} className="h-9 pl-9 pr-16" />
            {searchText ? (
              <button type="button" aria-label="Clear search" onClick={() => setSearchText('')} className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded hover:bg-accent"><X className="h-3.5 w-3.5" /></button>
            ) : (
              <Kbd className="absolute right-2 top-1/2 -translate-y-1/2">/</Kbd>
            )}
          </div>
          {isOwner && branches.length > 1 && (
            <select aria-label="Branch" value={branch} onChange={(e) => setP({ branch: e.target.value })} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.name}</option>)}
            </select>
          )}
          {view === 'bills' && (
            <>
              <select aria-label="Payment" value={mode} onChange={(e) => setP({ mode: e.target.value })} className="h-9 rounded-md border bg-background px-2 text-sm">
                {PAYMENT_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select aria-label="Sort" value={sort} onChange={(e) => setP({ sort: e.target.value === 'bill_date_desc' ? '' : e.target.value })} className="h-9 rounded-md border bg-background px-2 text-sm">
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </>
          )}
          {hasFilters && <Button variant="ghost" size="sm" onClick={clearAll}><X className="mr-1 h-4 w-4" />Clear</Button>}
        </div>
        {view === 'bills' && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
              {STATUS_TABS.map((t) => {
                const n = countOf(t.value)
                const on = status === t.value
                return (
                  <button key={t.label} type="button" aria-pressed={on} onClick={() => setP({ status: t.value })} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent'}`}>
                    {t.label}
                    {n != null && <span className={`rounded-full px-1.5 tabular-nums ${on ? 'bg-primary-foreground/20' : 'bg-muted'}`}>{n}</span>}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {DATE_CHIPS.map((c) => (
                <button key={c.id} type="button" aria-pressed={activeChip === c.id} onClick={() => { const r = rangeFor(c.id, today); setP({ from: r.from, to: r.to }) }} className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${activeChip === c.id ? 'border-primary bg-primary/10 text-primary' : 'bg-background text-muted-foreground hover:bg-accent'}`}>{c.label}</button>
              ))}
              <input type="date" aria-label="From date" value={from} max={to || today} onChange={(e) => setP({ from: e.target.value })} className="h-7 rounded-md border bg-background px-1.5 text-xs" />
              <span className="text-xs text-muted-foreground">to</span>
              <input type="date" aria-label="To date" value={to} min={from} max={today} onChange={(e) => setP({ to: e.target.value })} className="h-7 rounded-md border bg-background px-1.5 text-xs" />
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div ref={listRef} tabIndex={-1} className="rounded-xl border bg-card outline-none" aria-label="Results">
        {loading && rows.length === 0 ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
        ) : error && view === 'bills' ? (
          <div className="py-16 text-center text-rose-600">Could not load bills. Try again.</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-medium">{view === 'bills' ? (hasFilters ? 'No bills match these filters' : 'No bills yet') : 'Nothing waiting'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{view === 'bills' ? (hasFilters ? 'Try a wider date range or clear the filters.' : 'Press n to create the first bill.') : 'Paid services nobody has started yet will show up here.'}</p>
            {hasFilters && <Button variant="outline" size="sm" className="mt-3" onClick={clearAll}>Clear filters</Button>}
          </div>
        ) : (
          <>
            <div className={`hidden overflow-x-auto md:block ${isFetching ? 'opacity-70 transition-opacity' : ''}`}>
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  {view === 'bills' ? (
                    <tr>
                      <th className={th}>Bill</th><th className={th}>Customer</th><th className={th}>Date</th>
                      {isOwner && <th className={th}>Branch</th>}
                      <th className={`${th} text-right`}>Items</th><th className={th}>Paid by</th><th className={`${th} text-right`}>Amount</th><th className={th}>Status</th><th className={th} />
                    </tr>
                  ) : (
                    <tr>
                      <th className={th}>Bill</th><th className={th}>Customer</th><th className={th}>Service</th><th className={th}>Billed</th>
                      {isOwner && <th className={th}>Branch</th>}
                      <th className={`${th} text-right`}>Amount</th><th className={th}>Status</th><th className={`${th} text-right`}>Action</th>
                    </tr>
                  )}
                </thead>
                <tbody>{view === 'bills' ? bills.map(billRow) : pendingItems.map(pendingRow)}</tbody>
                {view === 'bills' && (
                  <tfoot className="border-t bg-muted/30 text-sm font-semibold">
                    <tr>
                      <td className="px-3 py-2" colSpan={isOwner ? 6 : 5}>This page · {bills.length} bills</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(bills.filter((b) => b.status !== 'cancelled').reduce((n, b) => n + b.total_amount, 0))}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div className="space-y-2 p-2 md:hidden">
              {view === 'bills' ? bills.map(billCard) : pendingItems.map((it, i) => (
                <div key={it.item_id} data-row={i} className="rounded-xl border bg-card p-3">
                  <div className="flex justify-between gap-2"><div><p className="font-medium">{it.item_name}</p><p className="text-xs text-muted-foreground">{it.customer_name} · {it.bill_number}</p></div><span className="text-sm font-semibold">{formatCurrency(it.total_price)}</span></div>
                  {(it.employees || []).length > 0 && <p className="mt-1 text-xs text-muted-foreground">by {it.employees.map((e) => e.full_name).join(', ')}</p>}
                  <div className="mt-2 flex justify-end gap-1.5">
                    {it.status === 'in_progress' ? (<><Button size="sm" variant="outline" onClick={() => setStartItem(it)}>+ Employee</Button><Button size="sm" variant="success" onClick={() => setConfirmComplete(it)}>Complete</Button></>) : (<Button size="sm" onClick={() => setStartItem(it)}>Start</Button>)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-3 py-2 text-sm">
            <span className="text-muted-foreground">Page {page} of {totalPages} · {view === 'bills' ? pagination.total : pendingPagination.total} total</span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setP({ page: String(page - 1) }, false)}><ChevronLeft className="mr-1 h-4 w-4" />Prev <Kbd className="ml-1">←</Kbd></Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setP({ page: String(page + 1) }, false)}>Next <Kbd className="mx-1">→</Kbd><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard hints */}
      <div className="hidden flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground lg:flex">
        <span><Kbd>/</Kbd> search</span>
        <span><Kbd>j</Kbd><Kbd>k</Kbd> or <Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
        <span><Kbd>Enter</Kbd> {view === 'bills' ? 'open' : 'start / complete'}</span>
        {view === 'bills' ? (
          <>
            {canEdit && <span><Kbd>e</Kbd> edit</span>}
            <span><Kbd>c</Kbd> complete</span>
            <span><Kbd>p</Kbd> print</span>
            <span><Kbd>x</Kbd> cancel</span>
            <span><Kbd>1</Kbd>–<Kbd>4</Kbd> status</span>
            <span><Kbd>t</Kbd> today</span>
          </>
        ) : (
          <>
            <span><Kbd>a</Kbd> add employee</span>
            <span><Kbd>c</Kbd> complete</span>
          </>
        )}
        <span><Kbd>←</Kbd><Kbd>→</Kbd> pages</span>
        <span><Kbd>b</Kbd> bills · <Kbd>s</Kbd> pending services</span>
      </div>

      <CompleteBillModal open={completeModal.open} onOpenChange={(o) => setCompleteModal((m) => ({ ...m, open: o }))} bill={completeModal.bill} />
      <StartServiceModal open={!!startItem} onOpenChange={(o) => !o && setStartItem(null)} item={startItem} />

      <ConfirmDialog
        open={!!confirmCancel}
        onOpenChange={(o) => !o && setConfirmCancel(null)}
        title={confirmCancel?.status === 'pending' ? 'Cancel bill' : 'Delete bill'}
        description={`${confirmCancel?.status === 'pending' ? 'Cancel' : 'Delete'} bill ${confirmCancel?.bill_number}? This cannot be undone.`}
        confirmLabel={confirmCancel?.status === 'pending' ? 'Cancel bill' : 'Delete'}
        variant="destructive"
        loading={cancelMutation.isPending}
        onConfirm={() => {
          cancelMutation.mutate(confirmCancel.bill_id)
          setConfirmCancel(null)
        }}
      />
      <ConfirmDialog
        open={!!confirmComplete}
        onOpenChange={(o) => !o && setConfirmComplete(null)}
        title="Complete service"
        description={`Mark "${confirmComplete?.item_name}" as completed?`}
        confirmLabel="Complete"
        autoFocusConfirm
        loading={completeItemMutation.isPending}
        onConfirm={() => {
          completeItemMutation.mutate({ billId: confirmComplete.bill_id, itemId: confirmComplete.item_id, employeeIds: (confirmComplete.employees || []).map((e) => e.employee_id) })
          setConfirmComplete(null)
        }}
      />
    </div>
  )
}

export default BillsPage
