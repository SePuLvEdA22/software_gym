import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icons } from '@/components/Icons'

interface MonthPickerProps {
  value: string
  max?: string
  onChange: (value: string) => void
}

const MONTHS_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]
const MONTHS_LONG = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function parseMonthKey(value: string): { year: number; month: number } | null {
  const m = value.match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return { year, month }
}

function toKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function formatMonthLabel(value: string): string {
  const p = parseMonthKey(value)
  if (!p) return value
  const s = `${MONTHS_LONG[p.month - 1]} ${p.year}`
  return s
}

export function MonthPicker({ value, max, onChange }: MonthPickerProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const selected = useMemo(() => parseMonthKey(value), [value])
  const maxParsed = useMemo(() => (max ? parseMonthKey(max) : null), [max])
  const now = useMemo(() => new Date(), [])
  const [viewYear, setViewYear] = useState<number>(() => selected?.year ?? now.getFullYear())

  useEffect(() => {
    if (open && selected) setViewYear(selected.year)
  }, [open, selected])

  const close = useCallback(() => setOpen(false), [])

  const computePos = useCallback((): { top: number; left: number; width: number } | null => {
    const el = wrapRef.current
    const panel = panelRef.current
    if (!el || !panel) return null
    const rect = el.getBoundingClientRect()
    const panelH = panel.offsetHeight
    const margin = 8
    const width = Math.max(264, rect.width)
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))
    const spaceBelow = window.innerHeight - rect.bottom - margin
    const spaceAbove = rect.top - margin
    let top: number
    if (spaceBelow >= panelH) top = rect.bottom + margin
    else if (spaceAbove >= panelH) top = rect.top - margin - panelH
    else
      top = Math.max(margin, Math.min(rect.bottom + margin, window.innerHeight - panelH - margin))
    return { top, left, width }
  }, [])

  useEffect(() => {
    if (!open) return
    const compute = () => {
      const p = computePos()
      if (p) setPos(p)
    }
    compute()
    const raf = requestAnimationFrame(compute)
    window.addEventListener('scroll', compute, true)
    window.addEventListener('resize', compute)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', compute, true)
      window.removeEventListener('resize', compute)
    }
  }, [open, viewYear, computePos])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  const isDisabled = (month: number): boolean => {
    if (!maxParsed) return false
    if (viewYear > maxParsed.year) return true
    if (viewYear === maxParsed.year && month > maxParsed.month) return true
    return false
  }

  const pick = (month: number) => {
    onChange(toKey(viewYear, month))
    close()
  }

  const goThisMonth = () => {
    onChange(toKey(now.getFullYear(), now.getMonth() + 1))
    close()
  }

  const panelStyle: React.CSSProperties = pos
    ? { position: 'fixed', top: pos.top, left: pos.left, width: pos.width }
    : { position: 'fixed', top: 0, left: 0, visibility: 'hidden', pointerEvents: 'none' }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div
        className={`dp-trigger${open ? ' dp-trigger-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((v) => !v)
          }
        }}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={formatMonthLabel(value)}
        style={{ height: 38, borderRadius: 9999, minWidth: 168 }}
      >
        <Icons.Calendar className="dp-icon" />
        <span
          className="dp-input"
          style={{ display: 'flex', alignItems: 'center', fontSize: 13, whiteSpace: 'nowrap' }}
        >
          {formatMonthLabel(value)}
        </span>
        <Icons.ChevronDown className={`dp-caret${open ? ' dp-caret-open' : ''}`} />
      </div>

      {open &&
        createPortal(
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onMouseDown={(e) => {
              if (panelRef.current && !panelRef.current.contains(e.target as Node)) close()
            }}
          >
            <div
              ref={panelRef}
              className={`dp-panel${pos ? ' dp-panel-ready' : ''}`}
              style={panelStyle}
              role="dialog"
              aria-label="Selector de mes"
            >
              <div className="dp-year-stepper">
                <button
                  type="button"
                  className="dp-nav dp-nav-text"
                  onClick={() => setViewYear((y) => y - 10)}
                  title="−10 años"
                  tabIndex={-1}
                >
                  «
                </button>
                <button
                  type="button"
                  className="dp-nav"
                  onClick={() => setViewYear((y) => y - 1)}
                  title="Año anterior"
                  tabIndex={-1}
                >
                  <Icons.ChevronLeft />
                </button>
                <span className="dp-year-big">{viewYear}</span>
                <button
                  type="button"
                  className="dp-nav"
                  onClick={() => setViewYear((y) => y + 1)}
                  title="Año siguiente"
                  tabIndex={-1}
                  disabled={maxParsed !== null && viewYear >= maxParsed.year}
                  style={
                    maxParsed !== null && viewYear >= maxParsed.year ? { opacity: 0.3 } : undefined
                  }
                >
                  <Icons.ChevronRight />
                </button>
                <button
                  type="button"
                  className="dp-nav dp-nav-text"
                  onClick={() => setViewYear((y) => y + 10)}
                  title="+10 años"
                  tabIndex={-1}
                  disabled={maxParsed !== null && viewYear + 10 > maxParsed.year}
                  style={
                    maxParsed !== null && viewYear + 10 > maxParsed.year
                      ? { opacity: 0.3 }
                      : undefined
                  }
                >
                  »
                </button>
              </div>
              <div className="dp-months-grid">
                {MONTHS_SHORT.map((label, i) => {
                  const month = i + 1
                  const disabled = isDisabled(month)
                  const isSelected = selected?.year === viewYear && selected?.month === month
                  const isCurrent = now.getFullYear() === viewYear && now.getMonth() + 1 === month
                  return (
                    <button
                      key={label}
                      type="button"
                      className={[
                        'dp-month-cell',
                        disabled ? 'dp-month-cell-disabled' : '',
                        isCurrent ? 'dp-month-cell-current' : '',
                        isSelected && !disabled ? 'dp-month-cell-active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      disabled={disabled}
                      onClick={() => pick(month)}
                      tabIndex={-1}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <div className="dp-footer">
                <button type="button" className="dp-quick" onClick={goThisMonth} tabIndex={-1}>
                  Este mes
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
