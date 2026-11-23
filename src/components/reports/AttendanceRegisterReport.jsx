import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { toast } from 'sonner'
import { reportsService } from '@/services/reports.service'
import { Button } from '@/components/ui/button'
import { Empty, Panel, ReportError, ReportLoading } from './ReportKit'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const monthTitle = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** What a day shows in the check-in / check-out rows. A worked day shows the times; leave and absent show a letter. */
function cellText(day, which) {
  if (!day.kind) return ''
  if (day.kind === 'absent') return which === 'in' ? 'A' : ''
  if (day.kind === 'leave') return which === 'in' ? 'L' : ''
  return which === 'in' ? day.in || '' : day.out || ''
}

function printHtml({ data, people, branchName, perPage }) {
  const pages = []
  for (let i = 0; i < people.length; i += perPage) pages.push(people.slice(i, i + perPage))
  const head = (p) => `<div class="who"><b>${esc(p.name)}</b> <span>Biometric id : ${esc(p.biometric_id || '—')}</span>${p.employee_code ? `<span>Code : ${esc(p.employee_code)}</span>` : ''}<span class="tot">Present ${p.present} · Absent ${p.absent} · Leave ${p.leave}</span></div>`
  const table = (p) => {
    const th = p.days.map((d, i) => `<th class="${data.weekdays[i] === 0 ? 'sun' : ''}">${d.d}<small>${DOW[data.weekdays[i]]}</small></th>`).join('')
    const row = (label, which) => `<tr><th class="lab">${label}</th>${p.days.map((d, i) => `<td class="${data.weekdays[i] === 0 ? 'sun' : ''} ${d.kind === 'absent' ? 'abs' : ''}">${esc(cellText(d, which))}</td>`).join('')}</tr>`
    return `<table><thead><tr><th class="lab"></th>${th}</tr></thead><tbody>${row('Check in', 'in')}${row('Check out', 'out')}</tbody></table>`
  }
  const body = pages.map((pg) => `<section class="page"><h1>Attendance register — ${esc(monthTitle(data.month))} <small>${esc(branchName || 'All branches')}</small></h1>${pg.map((p) => `<div class="block">${head(p)}${table(p)}</div>`).join('')}<p class="foot">A = absent · L = leave · blank = no record · shaded columns are Sundays</p></section>`).join('')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Attendance register ${esc(data.month)}</title><style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  h1 { font-size: 13pt; margin: 0 0 6mm; border-bottom: 1.5px solid #111; padding-bottom: 2mm; }
  h1 small { font-weight: normal; font-size: 9pt; color: #444; margin-left: 8px; }
  .block { margin-bottom: 9mm; break-inside: avoid; }
  .who { font-size: 11pt; margin-bottom: 2mm; display: flex; gap: 14px; align-items: baseline; }
  .who span { font-size: 9.5pt; color: #333; }
  .who .tot { margin-left: auto; font-size: 8.5pt; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; border-top: 1.5px solid #111; border-bottom: 1.5px solid #111; }
  th, td { border: 0.5px solid #999; text-align: center; padding: 2.2mm 0; font-size: 7.5pt; }
  thead th { font-size: 8pt; border-bottom: 1.5px solid #111; padding: 1.2mm 0; }
  thead small { display: block; font-size: 5.5pt; font-weight: normal; color: #666; }
  th.lab { width: 17mm; text-align: right; padding-right: 2mm; font-weight: normal; font-size: 8.5pt; border-right: 1.5px solid #111; }
  .sun { background: #ececec; }
  .abs { color: #b00; font-weight: bold; }
  tbody td { height: 9mm; }
  .foot { font-size: 7.5pt; color: #555; margin: 2mm 0 0; }
  </style></head><body>${body}<script>window.onload=function(){window.print()}</script></body></html>`
}

/** Printable monthly register: one block per person, a column per date, check in and check out rows. */
export default function AttendanceRegisterReport({ to, branchId, branchName }) {
  const [month, setMonth] = useState(() => String(to || '').slice(0, 7))
  const [q, setQ] = useState('')
  const [perPage, setPerPage] = useState(2)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hub-attendance', 'register', month, branchId],
    queryFn: () => reportsService.hubAttendanceRegister({ month, branch_id: branchId || undefined }).then((r) => r.data),
    enabled: /^\d{4}-\d{2}$/.test(month),
  })
  const people = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const all = data?.people || []
    return needle ? all.filter((p) => `${p.name} ${p.employee_code || ''} ${p.biometric_id || ''}`.toLowerCase().includes(needle)) : all
  }, [data, q])

  const print = () => {
    const w = window.open('', '_blank')
    if (!w) { toast.error('Allow pop-ups to print'); return }
    w.document.write(printHtml({ data, people, branchName, perPage }))
    w.document.close()
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Monthly attendance register"
        subtitle="Every date of the month with each person's check in and check out. Print it on A4 landscape (choose 'Save as PDF' for a file)."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Month" className="h-8 rounded-md border bg-background px-2 text-xs" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code, biometric id" aria-label="Search" className="h-8 w-52 rounded-md border bg-background px-2 text-xs" />
            <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} aria-label="People per page" className="h-8 rounded-md border bg-background px-2 text-xs">
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} per page</option>)}
            </select>
            <Button size="sm" onClick={print} disabled={!data || people.length === 0}><Printer className="mr-2 h-4 w-4" />Print</Button>
          </div>
        }
      >
        {isLoading ? <ReportLoading /> : error ? <ReportError error={error} retry={refetch} /> : people.length === 0 ? <Empty>No staff to show.</Empty> : (
          <div className="space-y-6">
            {people.map((p) => (
              <div key={p.employee_id}>
                <div className="mb-1 flex flex-wrap items-baseline gap-x-4 text-sm">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-muted-foreground">Biometric id : {p.biometric_id || '—'}</span>
                  <span className="ml-auto text-xs text-muted-foreground">Present {p.present} · Absent {p.absent} · Leave {p.leave}</span>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[900px] table-fixed border-collapse text-center text-[11px]">
                    <thead>
                      <tr className="border-b-2">
                        <th className="w-20 border-r-2 px-2 py-1 text-right font-normal" />
                        {p.days.map((d, i) => (
                          <th key={d.d} className={`py-1 font-semibold ${data.weekdays[i] === 0 ? 'bg-muted' : ''}`}>{d.d}<div className="text-[9px] font-normal text-muted-foreground">{DOW[data.weekdays[i]]}</div></th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[['Check in', 'in'], ['Check out', 'out']].map(([label, which]) => (
                        <tr key={which} className="border-t">
                          <th className="border-r-2 px-2 py-2 text-right text-xs font-normal">{label}</th>
                          {p.days.map((d, i) => (
                            <td key={d.d} className={`py-2 tabular-nums ${data.weekdays[i] === 0 ? 'bg-muted' : ''} ${d.kind === 'absent' ? 'font-bold text-rose-600' : ''}`}>{cellText(d, which)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
