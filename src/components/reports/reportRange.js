// Date presets for the reports, in IST calendar days (YYYY-MM-DD strings).
const DAY = 86400000

export function istTodayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

const toDate = (s) => new Date(`${s}T00:00:00Z`)
const fmt = (d) => d.toISOString().slice(0, 10)
export const addDays = (s, n) => fmt(new Date(toDate(s).getTime() + n * DAY))

export function rangeFor(preset, today = istTodayStr()) {
  const d = toDate(today)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) }
    case '7d':
      return { from: addDays(today, -6), to: today }
    case '30d':
      return { from: addDays(today, -29), to: today }
    case '90d':
      return { from: addDays(today, -89), to: today }
    case 'month':
      return { from: fmt(new Date(Date.UTC(y, m, 1))), to: today }
    case 'last-month':
      return { from: fmt(new Date(Date.UTC(y, m - 1, 1))), to: fmt(new Date(Date.UTC(y, m, 0))) }
    case 'year':
      return { from: fmt(new Date(Date.UTC(y, 0, 1))), to: today }
    default:
      return null
  }
}

export const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: '90d', label: '90 days' },
]

/** Which preset (if any) a from/to pair equals, so the pill can show as selected. */
export function presetOf(from, to, today = istTodayStr()) {
  return PRESETS.find((p) => {
    const r = rangeFor(p.id, today)
    return r.from === from && r.to === to
  })?.id || null
}

export function rangeLabel(from, to) {
  const f = (s) => toDate(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return from === to ? f(from) : `${f(from)} – ${f(to)}`
}
