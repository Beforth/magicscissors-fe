import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Search, X, ChevronDown } from 'lucide-react'

const DROPDOWN_MAX_HEIGHT = 220
const DROPDOWN_GAP = 4

/**
 * Searchable select dropdown. Menu renders in a portal so it is not clipped by
 * overflow containers (tables, cards, etc.).
 */
export function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className,
  compact = false,
  triggerClassName,
  formatOption,
  portalTarget = document.body,
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [menuStyle, setMenuStyle] = useState(null)
  const containerRef = useRef(null)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  const selectedOption = options.find((o) => o.value === value)

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const updateMenuPosition = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const upward = spaceBelow < DROPDOWN_MAX_HEIGHT + 48 && spaceAbove > spaceBelow

    const width = Math.max(rect.width, compact ? 220 : 240)

    if (portalTarget === null) {
      setMenuStyle({
        position: 'absolute',
        left: 0,
        width,
        minWidth: width,
        zIndex: 9999,
        pointerEvents: 'auto',
        ...(upward
          ? { bottom: `calc(100% + ${DROPDOWN_GAP}px)` }
          : { top: `calc(100% + ${DROPDOWN_GAP}px)` }),
      })
    } else {
      // pointerEvents: auto — Radix Dialog sets pointer-events:none on body;
      // without this, a body-portaled menu is visible but not clickable.
      setMenuStyle({
        position: 'fixed',
        left: rect.left,
        width,
        minWidth: width,
        zIndex: 9999,
        pointerEvents: 'auto',
        ...(upward
          ? { bottom: window.innerHeight - rect.top + DROPDOWN_GAP }
          : { top: rect.bottom + DROPDOWN_GAP }),
      })
    }
  }, [compact, portalTarget])

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return undefined

    const onScrollOrResize = () => updateMenuPosition()
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)

    return () => {
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    const handler = (e) => {
      if (
        containerRef.current?.contains(e.target) ||
        dropdownRef.current?.contains(e.target)
      ) {
        return
      }
      setOpen(false)
      setSearch('')
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (val) => {
    onChange(val)
    setOpen(false)
    setSearch('')
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange('')
    setSearch('')
  }

  const handleTriggerClick = () => {
    if (disabled) return
    setOpen((prev) => {
      const next = !prev
      if (next) {
        setTimeout(() => inputRef.current?.focus(), 0)
      } else {
        setSearch('')
      }
      return next
    })
  }

  const dropdown = open && menuStyle && (
    <div
      ref={dropdownRef}
      data-searchable-select-dropdown=""
      style={menuStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="rounded-md border border-input bg-background shadow-lg pointer-events-auto"
    >
      <div className={cn('flex items-center border-b', compact ? 'px-2 py-1.5' : 'px-3 py-2')}>
        <Search className={cn(compact ? 'h-3 w-3' : 'h-4 w-4', 'text-muted-foreground mr-2 shrink-0')} />
        <input
          ref={inputRef}
          type="text"
          className={cn(
            'flex-1 bg-transparent outline-none placeholder:text-muted-foreground',
            compact ? 'text-xs' : 'text-sm'
          )}
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div
        className="overflow-y-auto py-1"
        style={{ maxHeight: DROPDOWN_MAX_HEIGHT }}
      >
        {filtered.length === 0 ? (
          <div
            className={cn(
              'text-muted-foreground',
              compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
            )}
          >
            No results found
          </div>
        ) : (
          filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                'w-full text-left hover:bg-accent hover:text-accent-foreground cursor-pointer',
                compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm',
                option.value === value && 'bg-accent text-accent-foreground font-medium'
              )}
              onMouseDown={(e) => {
                // Select on mousedown so Radix Dialog focus/dismiss logic
                // cannot swallow the later click when the menu is portaled.
                e.preventDefault()
                handleSelect(option.value)
              }}
            >
              {formatOption ? formatOption(option) : option.label}
            </button>
          ))
        )}
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={handleTriggerClick}
        disabled={disabled}
        className={cn(
          compact
            ? 'flex h-6 w-full items-center justify-between rounded border border-input bg-background px-1 py-0 text-[11px] ring-offset-background'
            : 'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !selectedOption && 'text-muted-foreground',
          triggerClassName
        )}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <X
              className={cn(
                compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5',
                'text-muted-foreground hover:text-foreground cursor-pointer'
              )}
              onClick={handleClear}
            />
          )}
          <ChevronDown className={cn(compact ? 'h-3 w-3' : 'h-4 w-4', 'text-muted-foreground')} />
        </div>
      </button>

      {typeof document !== 'undefined' && dropdown && portalTarget
        ? createPortal(dropdown, portalTarget)
        : dropdown}
    </div>
  )
}
