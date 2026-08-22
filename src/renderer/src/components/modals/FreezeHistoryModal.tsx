import { useEffect, useState } from 'react'
import { Icons } from '@/components/Icons'
import { FreezeHistory } from '@shared/types'
import { format, parseISO } from 'date-fns'

interface FreezeHistoryModalProps {
  membershipId: string
  onClose: () => void
}

export function FreezeHistoryModal({ membershipId, onClose }: FreezeHistoryModalProps): JSX.Element {
  const [history, setHistory] = useState<FreezeHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    const result = await window.electronAPI.membership.getFreezeHistory(membershipId)
    if (result.success && result.data) {
      setHistory(result.data)
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2 className="modal-title">Historial de Congelaciones</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <Icons.Close />
          </button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20 }}>Cargando...</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-secondary)' }}>
              No hay historial de congelaciones
            </div>
          ) : (
            <div>
              {history.map(h => (
                <div key={h.id} style={{
                  padding: 16,
                  marginBottom: 12,
                  backgroundColor: 'var(--color-surface-container-high)',
                  borderRadius: 12
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>Desde: {format(parseISO(h.frozenAt), 'dd/MM/yyyy')}</span>
                    {h.unfrozenAt && (
                      <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        Hasta: {format(parseISO(h.unfrozenAt), 'dd/MM/yyyy')}
                        {h.unfrozenBy === 'auto' && (
                          <span className="badge badge-info" style={{ fontSize: 10 }}>Automático</span>
                        )}
                      </span>
                    )}
                  </div>
                  {h.reason && (
                    <div style={{ fontSize: 13, marginBottom: 4 }}>
                      <strong>Motivo:</strong> {h.reason}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
                    {h.plannedDays && <span>Planeado: {h.plannedDays} días | </span>}
                    {h.actualDays !== null && h.actualDays !== undefined
                      ? <span>Real: {h.actualDays} días</span>
                      : <span>Estado: {h.unfrozenAt ? 'Descongelado' : 'En congelación'}</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
