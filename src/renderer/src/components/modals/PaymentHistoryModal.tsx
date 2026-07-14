import { useEffect, useState } from 'react'
import { Icons } from '@/components/Icons'
import { Payment } from '../../../shared/types'
import { formatCurrency } from '@/utils/format'
import { format, parseISO } from 'date-fns'

interface PaymentHistoryModalProps {
  membershipId: string
  onClose: () => void
}

export function PaymentHistoryModal({ membershipId, onClose }: PaymentHistoryModalProps): JSX.Element {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPayments()
  }, [])

  const loadPayments = async () => {
    const result = await window.electronAPI.payment.getByMembership(membershipId)
    if (result.success && result.data) {
      setPayments(result.data)
    }
    setLoading(false)
  }

  if (!payments || payments.length === 0) {
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 500 }}>
          <div className="modal-header">
            <h2 className="modal-title">Historial de Pagos</h2>
            <button type="button" className="modal-close" onClick={onClose}><Icons.Close /></button>
          </div>
          <div className="modal-body">
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20 }}>Cargando...</div>
            ) : (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-secondary)' }}>
                No hay pagos registrados para esta membresía
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

  const totalPagado = payments.reduce((sum, p) => sum + p.amount, 0)
  const totalDescuento = payments.reduce((sum, p) => sum + (p.discount || 0), 0)

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2 className="modal-title">Historial de Pagos</h2>
          <button type="button" className="modal-close" onClick={onClose}><Icons.Close /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div className="kpi-card" style={{ flex: 1, padding: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>Total Pagado</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-success)' }}>{formatCurrency(totalPagado)}</div>
            </div>
            <div className="kpi-card" style={{ flex: 1, padding: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>Descuentos</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-warning)' }}>{formatCurrency(totalDescuento)}</div>
            </div>
            <div className="kpi-card" style={{ flex: 1, padding: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>Pagos</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{payments.length}</div>
            </div>
          </div>

          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Método</th>
                  <th>Desc.</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{format(parseISO(p.date), 'dd/MM/yyyy')}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(p.amount)}</td>
                    <td>{p.method}</td>
                    <td>{p.discount ? formatCurrency(p.discount) : '-'}</td>
                    <td style={{ fontSize: 12, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
