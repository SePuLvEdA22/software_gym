import { ReactNode } from 'react'

interface FormWindowShellProps {
  title: string
  subtitle?: string
  children: ReactNode
}

/**
 * Marco de las ventanas-formulario independientes (usuario, producto, plan,
 * renovación, etc.). Header fijo con título + botón Cancelar y cuerpo con
 * scroll: al redimensionar la ventana o usarla en pantallas pequeñas, el
 * contenido nunca se desborda.
 */
export function FormWindowShell({ title, subtitle, children }: FormWindowShellProps): JSX.Element {
  return (
    <div className="form-window">
      <div className="form-window-header">
        <div style={{ minWidth: 0 }}>
          <h2 className="form-window-title">{title}</h2>
          {subtitle && <div className="form-window-subtitle">{subtitle}</div>}
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => window.close()}>
          Cancelar
        </button>
      </div>
      <div className="form-window-body">{children}</div>
    </div>
  )
}
