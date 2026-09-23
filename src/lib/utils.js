import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function getYoutubeEmbedUrl(url) {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return `https://www.youtube.com/embed/${m[1]}`
  }
  return null
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date) {
  if (date == null || date === '') return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(date) {
  if (date == null || date === '') return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatTime(date) {
  if (date == null || date === '') return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** Bill dates are stored as IST (no timezone conversion). Show as-is using UTC components. */
export function formatDateStored(date) {
  if (date == null || date === '') return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

/** Bill date+time stored as IST. Show as-is using UTC components. */
export function formatDateTimeStored(date) {
  if (date == null || date === '') return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/**
 * Fuzzy match: query chars must appear in text in order (not necessarily consecutive).
 * e.g. "hircut" matches "Haircut", "fcail" matches "Facial"
 */
export function fuzzyMatch(text, query) {
  if (!query || !text) return !query
  const t = String(text).toLowerCase()
  const q = String(query).toLowerCase().trim()
  let i = 0
  for (let j = 0; j < t.length && i < q.length; j++) {
    if (t[j] === q[i]) i++
  }
  return i === q.length
}

/**
 * Fuzzy score for sorting: higher = better match.
 * Prefers consecutive runs and matches at word starts.
 */
export function fuzzyScore(text, query) {
  if (!query || !text) return 0
  const t = String(text).toLowerCase()
  const q = String(query).toLowerCase().trim()
  let score = 0
  let i = 0
  let consecutive = 0
  for (let j = 0; j < t.length && i < q.length; j++) {
    if (t[j] === q[i]) {
      i++
      consecutive++
      if (j === 0 || t[j - 1] === ' ' || t[j - 1] === '-') score += 3 // word start
      else score += 1
    } else {
      if (consecutive > 1) score += consecutive * 2 // bonus for consecutive run
      consecutive = 0
    }
  }
  if (consecutive > 1) score += consecutive * 2
  return i === q.length ? score : 0
}
