import { useAppStore } from '@/store/appStore'

export function ConfirmDialog(): JSX.Element | null {
  const confirmDialog = useAppStore((state) => state.confirmDialog)
  const resolveConfirm = useAppStore((state) => state.resolveConfirm)

  if (!confirmDialog) return null

  const { title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', variant = 'info' } = confirmDialog

  const btnClass = variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary'

  return (
    <div className="modal-overlay" onClick={() => resolveConfirm(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, lineHeight: 1.6 }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => resolveConfirm(false)}>
            {cancelLabel}
          </button>
          <button type="button" className={btnClass} onClick={() => resolveConfirm(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
