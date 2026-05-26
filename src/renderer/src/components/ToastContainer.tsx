import { useAppStore, Toast, ToastType } from '@/store/appStore'
import { Icons } from './Icons'

function getToastIcon(type: ToastType): JSX.Element {
  switch (type) {
    case 'success':
      return <Icons.Check style={{ color: 'var(--color-success)' }} />
    case 'error':
      return <Icons.X style={{ color: 'var(--color-error)' }} />
    case 'warning':
      return <Icons.Calendar style={{ color: 'var(--color-warning)' }} />
    case 'info':
    default:
      return <Icons.Bell style={{ color: 'var(--color-primary-container)' }} />
  }
}

function getToastBorder(type: ToastType): string {
  switch (type) {
    case 'success':
      return 'var(--color-success)'
    case 'error':
      return 'var(--color-error)'
    case 'warning':
      return 'var(--color-warning)'
    case 'info':
    default:
      return 'var(--color-primary-container)'
  }
}

function ToastItem({ toast }: { toast: Toast }): JSX.Element {
  const removeToast = useAppStore((state) => state.removeToast)

  return (
    <div
      className="toast"
      style={{
        borderLeft: `4px solid ${getToastBorder(toast.type)}`
      }}
    >
      <div style={{ flexShrink: 0, width: 24, height: 24 }}>
        {getToastIcon(toast.type)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <div style={{ 
            fontWeight: 600, 
            fontSize: 14,
            marginBottom: 4,
            color: 'var(--color-on-surface)'
          }}>
            {toast.title}
          </div>
        )}
        <div style={{ 
          fontSize: 13, 
          lineHeight: 1.5,
          color: 'var(--color-secondary)',
          whiteSpace: 'pre-line'
        }}>
          {toast.message}
        </div>
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          marginLeft: 8,
          opacity: 0.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.5'
        }}
      >
        <Icons.Close style={{ width: 16, height: 16 }} />
      </button>
    </div>
  )
}

export function ToastContainer(): JSX.Element {
  const toasts = useAppStore((state) => state.toasts)

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
