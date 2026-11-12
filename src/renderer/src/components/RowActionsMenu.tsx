import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icons } from './Icons'

export interface RowAction {
  key: string
  label: string
  icon?: JSX.Element
  onClick: () => void
  danger?: boolean
}

const MENU_MAX_HEIGHT = 320

/**
 * Botón "⋯" que despliega las acciones secundarias de una fila. Se renderiza
 * en un portal con posición fija: dentro de `.table-container` (overflow-x)
 * un menú absoluto quedaría recortado.
 */
export function RowActionsMenu({ actions }: { actions: RowAction[] }): JSX.Element | null {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pos) return
    const close = (): void => setPos(null)
    const onMouseDown = (e: MouseEvent): void => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) close()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    // Posición fija: si algo se desplaza, el menú quedaría flotando fuera de su fila.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [pos])

  if (actions.length === 0) return null

  const toggle = (): void => {
    if (pos || !buttonRef.current) return setPos(null)
    const r = buttonRef.current.getBoundingClientRect()
    const right = window.innerWidth - r.right
    // Cerca del borde inferior, abre hacia arriba.
    setPos(
      r.bottom + MENU_MAX_HEIGHT > window.innerHeight
        ? { bottom: window.innerHeight - r.top + 4, right }
        : { top: r.bottom + 4, right },
    )
  }

  const regular = actions.filter((a) => !a.danger)
  const danger = actions.filter((a) => a.danger)
  const item = (a: RowAction): JSX.Element => (
    <button
      key={a.key}
      type="button"
      role="menuitem"
      className={`row-menu-item${a.danger ? ' danger' : ''}`}
      onClick={() => {
        setPos(null)
        a.onClick()
      }}
    >
      {a.icon}
      <span>{a.label}</span>
    </button>
  )

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-secondary btn-sm row-menu-trigger"
        onClick={toggle}
        aria-label="Más acciones"
        aria-haspopup="menu"
        aria-expanded={!!pos}
        title="Más acciones"
      >
        <Icons.More />
      </button>
      {pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="row-menu"
            style={{ ...pos, maxHeight: MENU_MAX_HEIGHT }}
          >
            {regular.map(item)}
            {regular.length > 0 && danger.length > 0 && <div className="row-menu-divider" />}
            {danger.map(item)}
          </div>,
          document.body,
        )}
    </>
  )
}
