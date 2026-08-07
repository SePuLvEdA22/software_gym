import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icons } from '@/components/Icons'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  placeholder?: string
  clearable?: boolean
  className?: string
  id?: string
}

const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** Convierte 'yyyy-MM-dd' (o ISO) a Date local sin riesgo de desplazamiento UTC */
function parseLocalDate(value: string): Date | null {
  if (!value) return null
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const [, y, mo, d] = m.map(Number)
  if (y < 1 || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return new Date(y, mo - 1, d)
}

function toKey(date: Date | null): string {
  if (!date || isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDisplay(date: Date | null): string {
  if (!date || isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Fecha de hoy en formato 'yyyy-MM-dd' usando hora LOCAL (evita el salto de día de UTC) */
export function todayLocalKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder,
  clearable = true,
  className,
  id
}: DatePickerProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'days' | 'months'>('days')
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const selected = useMemo(() => parseLocalDate(value), [value])
  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t }, [])
  const minDate = useMemo(() => (min ? parseLocalDate(min) : null), [min])
  const maxDate = useMemo(() => (max ? parseLocalDate(max) : null), [max])

  // Mes visible en el panel: el del valor seleccionado, o el actual si no hay valor
  const [viewDate, setViewDate] = useState<Date>(() => selected ?? today)

  const openPanel = useCallback(() => {
    setViewDate(selected ?? today)
    setMode('days')
    setOpen(true)
  }, [selected, today])

  const closePanel = useCallback(() => {
    setOpen(false)
    setMode('days')
  }, [])

  /** Posiciona el panel midiendo su altura REAL y lo mantiene dentro del viewport */
  const computePanelPos = useCallback((): { top: number; left: number; width: number } | null => {
    const el = wrapRef.current
    const panel = panelRef.current
    if (!el || !panel) return null
    const rect = el.getBoundingClientRect()
    const panelH = panel.offsetHeight
    const margin = 8
    const width = Math.max(300, rect.width)
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))
    let top: number
    const spaceBelow = window.innerHeight - rect.bottom - margin
    const spaceAbove = rect.top - margin
    if (spaceBelow >= panelH) {
      // Abre hacia abajo si hay espacio
      top = rect.bottom + margin
    } else if (spaceAbove >= panelH) {
      // Si no, abre hacia arriba (el panel cabe completo)
      top = rect.top - margin - panelH
    } else {
      // Sin espacio en ningún lado: abre hacia abajo y se recorta al borde
      top = Math.max(margin, Math.min(rect.bottom + margin, window.innerHeight - panelH - margin))
    }
    return { top, left, width }
  }, [])

  // Recalcula la posición al abrir y al cambiar de modo (la altura del panel cambia)
  useEffect(() => {
    if (!open) return
    const compute = () => {
      const p = computePanelPos()
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
  }, [open, mode, computePanelPos])

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closePanel])

  const handleSelect = (day: Date) => {
    onChange(toKey(day))
    closePanel()
  }

  const goPrevMonth = () => setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  const goNextMonth = () => setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  const goPrevYear = () => setViewDate(prev => new Date(prev.getFullYear() - 1, prev.getMonth(), 1))
  const goNextYear = () => setViewDate(prev => new Date(prev.getFullYear() + 1, prev.getMonth(), 1))
  const goPrevDecade = () => setViewDate(prev => new Date(prev.getFullYear() - 10, prev.getMonth(), 1))
  const goNextDecade = () => setViewDate(prev => new Date(prev.getFullYear() + 10, prev.getMonth(), 1))

  const toggleMode = () => setMode(prev => (prev === 'days' ? 'months' : 'days'))

  const pickMonth = (monthIndex: number) => {
    setViewDate(new Date(viewDate.getFullYear(), monthIndex, 1))
    setMode('days')
  }

  // Celdas de los 12 meses: deshabilitados si el mes completo queda fuera de min/max
  const monthCells = useMemo(() => {
    const year = viewDate.getFullYear()
    return Array.from({ length: 12 }, (_, m) => {
      const monthStart = new Date(year, m, 1)
      const monthEnd = new Date(year, m + 1, 0)
      return {
        month: m,
        disabled:
          (minDate !== null && monthEnd < minDate) ||
          (maxDate !== null && monthStart > maxDate),
        isCurrent: monthStart.getFullYear() === today.getFullYear() && m === today.getMonth(),
        isViewed: m === viewDate.getMonth()
      }
    })
  }, [viewDate, today, minDate, maxDate])

  // Celdas del mes: semana inicia en lunes (convención de América Latina)
  const cells = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const first = new Date(year, month, 1)
    // Desplazamiento a lunes (getDay: 0=domingo)
    const offset = (first.getDay() + 6) % 7
    const start = new Date(year, month, 1 - offset)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      return {
        date: d,
        inMonth: d.getMonth() === month,
        disabled:
          (minDate !== null && d < minDate) ||
          (maxDate !== null && d > maxDate),
        isSelected: selected !== null && isSameDay(d, selected),
        isToday: isSameDay(d, today)
      }
    })
  }, [viewDate, selected, today, minDate, maxDate])

  const panelStyle: React.CSSProperties = pos
    ? { position: 'fixed', top: pos.top, left: pos.left, width: pos.width }
    : { position: 'fixed', top: 0, left: 0, visibility: 'hidden', pointerEvents: 'none' }

  const displayText = value ? formatDisplay(selected) : ''

  return (
    <div className="dp" ref={wrapRef} style={{ position: 'relative' }}>
      <div
        className={`dp-trigger${open ? ' dp-trigger-open' : ''}${className ? ` ${className}` : ''}`}
        onClick={openPanel}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPanel()
          }
        }}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icons.Calendar className="dp-icon" />
        <input
          id={id}
          className="dp-input"
          type="text"
          readOnly
          value={displayText}
          placeholder={placeholder || 'Seleccionar fecha'}
          onFocus={openPanel}
        />
        {value && clearable ? (
          <button
            type="button"
            className="dp-clear"
            tabIndex={-1}
            onClick={e => {
              e.stopPropagation()
              onChange('')
            }}
            title="Limpiar fecha"
          >
            <Icons.X />
          </button>
        ) : (
          <Icons.ChevronDown className={`dp-caret${open ? ' dp-caret-open' : ''}`} />
        )}
      </div>

      {open &&
        createPortal(
          <div
            className="dp-overlay"
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onMouseDown={e => {
              if (panelRef.current && !panelRef.current.contains(e.target as Node)) closePanel()
            }}
          >
            <div
              ref={panelRef}
              className={`dp-panel${pos ? ' dp-panel-ready' : ''}`}
              style={panelStyle}
              role="dialog"
              aria-label="Selector de fecha"
            >
              <div className="dp-header">
                {mode === 'days' ? (
                  <button type="button" className="dp-nav" onClick={goPrevMonth} title="Mes anterior" tabIndex={-1}>
                    <Icons.ChevronLeft />
                  </button>
                ) : (
                  <button type="button" className="dp-nav" onClick={goPrevYear} title="Año anterior" tabIndex={-1}>
                    <Icons.ChevronLeft />
                  </button>
                )}
                <button
                  type="button"
                  className="dp-title-btn"
                  onClick={toggleMode}
                  title={mode === 'days' ? 'Cambiar mes y año' : 'Ver días'}
                  tabIndex={-1}
                >
                  <span className="dp-month">{mode === 'days' ? MONTHS[viewDate.getMonth()] : viewDate.getFullYear()}</span>
                  <span className="dp-year">
                    {mode === 'days' ? viewDate.getFullYear() : 'Seleccionar mes'}
                  </span>
                  <Icons.ChevronDown className={`dp-title-caret${mode === 'months' ? ' dp-title-caret-open' : ''}`} />
                </button>
                {mode === 'days' ? (
                  <button type="button" className="dp-nav" onClick={goNextMonth} title="Mes siguiente" tabIndex={-1}>
                    <Icons.ChevronRight />
                  </button>
                ) : (
                  <button type="button" className="dp-nav" onClick={goNextYear} title="Año siguiente" tabIndex={-1}>
                    <Icons.ChevronRight />
                  </button>
                )}
              </div>

              {mode === 'months' && (
                <div className="dp-month-picker">
                  <div className="dp-year-stepper">
                    <button type="button" className="dp-nav dp-nav-text" onClick={goPrevDecade} title="−10 años" tabIndex={-1}>
                      «
                    </button>
                    <button type="button" className="dp-nav" onClick={goPrevYear} title="Año anterior" tabIndex={-1}>
                      <Icons.ChevronLeft />
                    </button>
                    <span className="dp-year-big">{viewDate.getFullYear()}</span>
                    <button type="button" className="dp-nav" onClick={goNextYear} title="Año siguiente" tabIndex={-1}>
                      <Icons.ChevronRight />
                    </button>
                    <button type="button" className="dp-nav dp-nav-text" onClick={goNextDecade} title="+10 años" tabIndex={-1}>
                      »
                    </button>
                  </div>
                  <div className="dp-months-grid">
                    {monthCells.map((cell) => (
                      <button
                        key={cell.month}
                        type="button"
                        className={[
                          'dp-month-cell',
                          cell.disabled ? 'dp-month-cell-disabled' : '',
                          cell.isCurrent ? 'dp-month-cell-current' : '',
                          cell.isViewed && !cell.disabled ? 'dp-month-cell-active' : ''
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        disabled={cell.disabled}
                        onClick={() => pickMonth(cell.month)}
                        tabIndex={-1}
                      >
                        {MONTHS_SHORT[cell.month]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="dp-weekdays">
                {WEEKDAYS_SHORT.map((w, i) => (
                  <span key={i} className="dp-weekday">{w}</span>
                ))}
              </div>

              <div className="dp-grid">
                {cells.map((cell, i) => {
                  const isSelectedDay = cell.isSelected && cell.inMonth
                  return (
                    <button
                      key={i}
                      type="button"
                      className={[
                        'dp-day',
                        cell.inMonth ? '' : 'dp-day-out',
                        cell.disabled ? 'dp-day-disabled' : '',
                        cell.isToday ? 'dp-day-today' : '',
                        isSelectedDay ? 'dp-day-selected' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      disabled={cell.disabled}
                      onClick={() => handleSelect(cell.date)}
                      tabIndex={-1}
                    >
                      {cell.date.getDate()}
                    </button>
                  )
                })}
              </div>

              <div className="dp-footer">
                <button
                  type="button"
                  className="dp-quick"
                  onClick={() => handleSelect(today)}
                  disabled={(minDate !== null && today < minDate) || (maxDate !== null && today > maxDate)}
                  tabIndex={-1}
                >
                  Hoy
                </button>
                {value && clearable && (
                  <button
                    type="button"
                    className="dp-quick dp-quick-clear"
                    onClick={() => {
                      onChange('')
                      closePanel()
                    }}
                    tabIndex={-1}
                  >
                    Borrar
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
