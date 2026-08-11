import { useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { Membership } from '@shared/types'
import { format, parseISO } from 'date-fns'

interface FreezeModalProps {
  membership: Membership
  /** Cuando es true se omite el overlay/modal/header: útil dentro de ventanas-formulario. */
  embedded?: boolean
  onClose: () => void
  onSuccess: () => void
}

export function FreezeModal({
  membership,
  embedded = false,
  onClose,
  onSuccess
}: FreezeModalProps): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [reason, setReason] = useState('')
  const [plannedDays, setPlannedDays] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.membership.freeze(
        membership.id,
        reason || undefined,
        plannedDays || undefined
      )
      if (result.success) {
        showToast('success', 'Membresía congelada exitosamente', 'Listo')
        onSuccess()
        onClose()
      } else {
        showToast('error', result.error || 'No se pudo congelar la membresía', 'Error')
      }
    } catch (error: any) {
      showToast('error', error?.message || 'Error desconocido', 'Error')
    } finally {
      setLoading(false)
    }
  }

  const content = (
    <>
      <div className="modal-body">
          <div className="alert alert-info" style={{ marginBottom: 20 }}>
            <Icons.Snowflake />
            <div>
              <strong>{membership.planName}</strong> - Vence el {format(parseISO(membership.endDate), 'dd/MM/yyyy')}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Motivo de la congelación</label>
            <textarea
              className="form-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Vacaciones, médico, etc."
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Días planeados (opcional)</label>
            <input
              type="number"
              className="form-input"
              value={plannedDays}
              onChange={(e) => {
                const raw = e.target.value.replace(/^0+(?=\d)/, '')
                setPlannedDays(raw === '' ? '' : Number(raw))
              }}
              placeholder="Dejar vacío si es indefinido"
              min={1}
            />
            <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>
              Los días se registrarán para seguimiento. Al descongelar se extenderá la membresía automáticamente.
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Congelando...' : 'Confirmar Congelación'}
          </button>
        </div>
    </>
  )

  if (embedded) {
    return content
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Congelar Membresía</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <Icons.Close />
          </button>
        </div>
        {content}
      </div>
    </div>
  )
}
