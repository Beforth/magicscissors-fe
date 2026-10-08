import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Keyboard, LogOut, PanelLeft, Plus, User as UserIcon, Settings as SettingsIcon } from 'lucide-react'
import { logout } from '@/store/slices/authSlice'
import { useSidebar } from '@/contexts/SidebarContext'
import { getNavItemsByRole } from '@/components/layout/Sidebar'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'

export const OPEN_PALETTE_EVENT = 'app:open-palette'

// "g" then a letter jumps to a page (only when the role can see that page).
const GO_KEYS = {
  d: '/dashboard/',
  c: '/customers',
  b: '/bills',
  t: '/tokens',
  e: '/employee-status',
  s: '/staff',
  a: '/attendance',
  m: '/my-attendance',
  r: '/reports',
  p: '/products',
  i: '/inventory',
  x: '/expenses',
  y: '/payroll',
  h: '/shifts',
  v: '/services',
  k: '/maintenance',
}

// "n" opens the create screen of the section you are in (falls back to a new bill).
const NEW_ROUTES = [
  ['/bills', '/bills/new'],
  ['/services', '/services/new'],
  ['/products', '/products/new'],
  ['/staff', '/staff/new'],
  ['/branches', '/branches/new'],
  ['/purchase-batches', '/purchase-batches/new'],
  ['/warehouses', '/warehouses/new'],
]

const SHORTCUTS = [
  ['Open command palette (search pages & actions)', [['Ctrl', 'K']]],
  ['Focus the page search box', [['/']]],
  ['Show this help', [['?']]],
  ['Go to page', [['g'], ['then letter']]],
  ['New item in the current section', [['n']]],
  ['Collapse / expand sidebar', [['[']]],
  ['Submit the form you are typing in', [['Ctrl', 'Enter']]],
  ['Close dialogs, menus, palette', [['Esc']]],
]
const GO_HELP = [
  ['d', 'Dashboard'], ['c', 'Customers'], ['b', 'Billing'], ['t', 'Tokens'], ['e', 'Employee status'],
  ['s', 'Staff'], ['a', 'Attendance'], ['m', 'My attendance'], ['r', 'Reports'], ['p', 'Products'],
  ['i', 'Stock levels'], ['x', 'Expenses'], ['y', 'Payroll'], ['h', 'Shifts'], ['v', 'Services'], ['k', 'Maintenance'],
]

const isTypingTarget = (el) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

function flattenNav(items) {
  const out = []
  for (const item of items) {
    if (item.children) {
      item.children.forEach((c) => out.push({ ...c, group: item.title }))
    } else {
      out.push({ ...item, group: 'Pages' })
    }
  }
  return out
}

export default function CommandCenter() {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const { toggle } = useSidebar()
  const role = useSelector((s) => s.auth.user?.role)
  const [open, setOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const goPending = useRef(null)

  const pages = useMemo(() => (role ? flattenNav(getNavItemsByRole(role)) : []), [role])
  const allowed = useCallback((href) => pages.some((p) => p.href === href), [pages])

  const go = useCallback((href) => { setOpen(false); navigate(href) }, [navigate])

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_PALETTE_EVENT, onOpen)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      const key = e.key
      const mod = e.ctrlKey || e.metaKey

      if (mod && key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      if (mod && key === 'Enter') {
        const form = e.target instanceof Element ? e.target.closest('form') : null
        if (form) { e.preventDefault(); form.requestSubmit() }
        return
      }
      if (mod || e.altKey || e.defaultPrevented) return
      if (isTypingTarget(e.target)) return
      // Another dialog/menu owns the keyboard while it is open.
      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return

      if (goPending.current) {
        clearTimeout(goPending.current)
        goPending.current = null
        const target = GO_KEYS[key.toLowerCase()]
        if (target) {
          const page = target.endsWith('/')
            ? pages.find((p) => p.href?.startsWith(target))
            : pages.find((p) => p.href === target)
          if (page) { e.preventDefault(); navigate(page.href) }
        }
        return
      }

      if (key === 'g') {
        goPending.current = setTimeout(() => { goPending.current = null }, 900)
      } else if (key === '?') {
        e.preventDefault()
        setHelpOpen(true)
      } else if (key === '/') {
        e.preventDefault()
        const search = [...document.querySelectorAll('main input')].find(
          (el) => el.offsetParent !== null && !el.disabled &&
            (el.type === 'search' || /search|find|filter/i.test(el.placeholder || el.getAttribute('aria-label') || ''))
        )
        if (search) { search.focus(); search.select?.() } else setOpen(true)
      } else if (key === '[') {
        e.preventDefault()
        toggle()
      } else if (key === 'n') {
        const match = NEW_ROUTES.find(([base]) => location.pathname.startsWith(base))
        const dest = match ? match[1] : '/bills/new'
        if (allowed(match ? match[0] : '/bills')) { e.preventDefault(); navigate(dest) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pages, allowed, navigate, toggle, location.pathname])

  const grouped = useMemo(() => {
    const map = new Map()
    pages.forEach((p) => {
      if (!map.has(p.group)) map.set(p.group, [])
      map.get(p.group).push(p)
    })
    return [...map.entries()]
  }, [pages])

  const run = (fn) => () => { setOpen(false); fn() }

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages and actions…" />
        <CommandList>
          <CommandEmpty>Nothing matches that.</CommandEmpty>
          <CommandGroup heading="Actions">
            {allowed('/bills') && (
              <CommandItem value="action new bill create billing" onSelect={() => go('/bills/new')}>
                <Plus /> New bill <Kbd className="ml-auto">n</Kbd>
              </CommandItem>
            )}
            <CommandItem value="action profile account" onSelect={() => go('/profile')}>
              <UserIcon /> My profile
            </CommandItem>
            <CommandItem value="action settings preferences" onSelect={() => go('/settings')}>
              <SettingsIcon /> Settings
            </CommandItem>
            <CommandItem value="action toggle sidebar collapse" onSelect={run(toggle)}>
              <PanelLeft /> Toggle sidebar <Kbd className="ml-auto">[</Kbd>
            </CommandItem>
            <CommandItem value="action keyboard shortcuts help" onSelect={run(() => setHelpOpen(true))}>
              <Keyboard /> Keyboard shortcuts <Kbd className="ml-auto">?</Kbd>
            </CommandItem>
            <CommandItem value="action log out sign out" onSelect={run(() => { dispatch(logout()); navigate('/login') })}>
              <LogOut /> Log out
            </CommandItem>
          </CommandGroup>
          {grouped.map(([group, items]) => (
            <CommandGroup key={group} heading={group}>
              {items.map((p) => {
                const Icon = p.icon
                const hint = Object.entries(GO_KEYS).find(([, t]) => (t.endsWith('/') ? p.href.startsWith(t) : t === p.href))?.[0]
                return (
                  <CommandItem key={p.href} value={`${group} ${p.title} ${p.href}`} onSelect={() => go(p.href)}>
                    {Icon && <Icon />} {p.title}
                    {hint && <span className="ml-auto flex gap-1"><Kbd>g</Kbd><Kbd>{hint}</Kbd></span>}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))}
        </CommandList>
        <div className="flex items-center gap-3 border-t px-4 py-2 text-[11px] text-muted-foreground">
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> move</span>
          <span><Kbd>Enter</Kbd> open</span>
          <span><Kbd>Esc</Kbd> close</span>
        </div>
      </CommandDialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Single-key shortcuts work whenever you are not typing in a field.</DialogDescription>
          </DialogHeader>
          <ul className="grid gap-2">
            {SHORTCUTS.map(([label, combos]) => (
              <li key={label} className="flex items-center justify-between gap-4 text-[13px]">
                <span>{label}</span>
                <span className="flex items-center gap-1.5">
                  {combos.map((keys, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Go to (press g, then)</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
              {GO_HELP.map(([k, label]) => (
                <div key={k} className="flex items-center gap-2 text-[13px]"><Kbd>{k}</Kbd>{label}</div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
