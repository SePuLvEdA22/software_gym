import { useEffect, useState } from 'react'
import { Icons } from '@/components/Icons'
import { useAppStore } from '@/store/appStore'
import { Payment, PaymentMethod } from '@shared/types'
import { hasAnyPermission } from '@shared/permissions'
import { formatCurrency } from '@/utils/format'
import { format, parseISO } from 'date-fns'

interface PaymentHistoryModalProps {
  membershipId: string
  onClose: () => void
}

const methodOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
]

function getMethodLabel(method: string): string {
  return methodOptions.find((m) => m.value === method)?.label ?? method
}

export function PaymentHistoryModal({ membershipId, onClose }: PaymentHistoryModalProps): JSX.Element {
  const showToast = useAppStore((s) => s.showToast)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMethod, setEditMethod] = useState<PaymentMethod>('cash')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [canEditMethod, setCanEditMethod] = useState(false)

  const loadPayments = async () => {
    const result = await window.electronAPI.payment.getByMembership(membershipId)
    if (result.success && result.data) {
      setPayments(result.data)
    } else {
      showToast('error', result.error || 'No se pudieron cargar los pagos', 'Error')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPayments()
    window.electronAPI.auth
      .checkSession()
      .then((r) => {
        if (r.success && r.data) {
          setCanEditMethod(hasAnyPermission(r.data, ['payments.edit_method', 'payments.create']))
        }
      })
      .catch(() => {})
  }, [])

  const startEditing = (payment: Payment) => {
    setEditingId(payment.id)
    setEditMethod(payment.method)
  }

  const cancelEditing = () => {
    setEditingId(null)
  }

  const saveMethod = async (payment: Payment) => {
    if (editMethod === payment.method) {
      setEditingId(null)
      return
    }
    setSavingId(payment.id)
    try {
      const result = await window.electronAPI.payment.updateMethod(payment.id, editMethod)
      if (result.success && result.data) {
        setPayments((prev) => prev.map((p) => (p.id === payment.id ? result.data as Payment : p)))
        setEditingId(null)
        showToast('success', `Método actualizado a ${getMethodLabel(editMethod)}`, 'Guardado')
      } else {
        showToast('error', result.error || 'No se pudo actualizar el método de pago', 'Error')
      }
    } catch {
      showToast('error', 'No se pudo actualizar el método de pago', 'Error')
    } finally {
      setSavingId(null)
    }
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
      <div className="modal modal-lg" style={{ maxWidth: 720 }}>
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
                  <th style={{ width: 96 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{format(parseISO(p.date), 'dd/MM/yyyy')}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(p.amount)}</td>
                    <td>
                      {editingId === p.id ? (
                        <select
                          className="form-select"
                          value={editMethod}
                          onChange={(e) => setEditMethod(e.target.value as PaymentMethod)}
                          disabled={savingId === p.id}
                          style={{ minWidth: 130 }}
                        >
                          {methodOptions.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        getMethodLabel(p.method)
                      )}
                    </td>
                    <td>{p.discount ? formatCurrency(p.discount) : '-'}</td>
                    <td style={{ fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notes || '-'}</td>
                    <td>
                      {editingId === p.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => saveMethod(p)}
                            disabled={savingId === p.id}
                            title="Guardar método"
                            style={{ minWidth: 32, minHeight: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Icons.Check />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={cancelEditing}
                            disabled={savingId === p.id}
                            title="Cancelar"
                            style={{ minWidth: 32, minHeight: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Icons.Close />
                          </button>
                        </div>
                      ) : canEditMethod ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => startEditing(p)}
                          title="Modificar método de pago"
                          style={{ minWidth: 32, minHeight: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Icons.Edit />
                        </button>
                      ) : (
                        <span style={{ color: 'var(--color-secondary)', fontSize: 12 }}>—</span>
                      )}
                    </td>
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
