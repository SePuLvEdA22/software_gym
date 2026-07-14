import { useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { Client, Membership, PaymentMethod } from '../../../shared/types'
import { formatCurrency } from '@/utils/format'

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' }
]

interface AbonoModalProps {
  client: Client
  membership: Membership
  balance: number
  onClose: () => void
  onSuccess: () => void
}

export function AbonoModal({ client, membership, balance, onClose, onSuccess }: AbonoModalProps): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [amount, setAmount] = useState<number>(balance)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (amount <= 0) {
      showToast('warning', 'Ingrese un monto válido', 'Atención')
      return
    }
    setLoading(true)
    try {
      const result = await window.electronAPI.payment.record(
        client.id,
        amount,
        paymentMethod,
        `Abono membresía ${membership.planName}`,
        membership.id,
        notes || undefined
      )
      if (result.success) {
        showToast('success', 'Abono registrado exitosamente', 'Éxito')
        onSuccess()
        onClose()
      } else {
        showToast('error', result.error || 'No se pudo registrar el abono', 'Error')
      }
    } catch (error: any) {
      showToast('error', error?.message || 'Error desconocido', 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Registrar Abono</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <Icons.Close />
          </button>
        </div>
        <div className="modal-body">
          <div className="card" style={{ padding: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="avatar" style={{ width: 48, height: 48, fontSize: 18, flexShrink: 0 }}>
                {client.photo ? (
                  <img src={`data:image/jpeg;base64,${client.photo}`} alt={client.fullName} />
                ) : (
                  client.fullName.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{client.fullName}</div>
                <div style={{ fontSize: 13, color: 'var(--color-secondary)' }}>{membership.planName}</div>
              </div>
            </div>
          </div>

          <div className="alert alert-warning" style={{ marginBottom: 20 }}>
            <Icons.Bell />
            <div>
              <strong>Saldo Pendiente: {formatCurrency(balance)}</strong>
            </div>
          </div>

          <div className="form-row-2" style={{ marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">Monto a Abonar</label>
              <input
                type="text"
                inputMode="numeric"
                className="form-input"
                value={amount || ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '')
                  setAmount(val ? Number(val) : 0)
                }}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Método de Pago</label>
              <select
                className="form-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                {paymentMethods.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Notas (opcional)</label>
            <textarea
              className="form-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Abono parcial"
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={loading || amount <= 0}
          >
            {loading ? 'Registrando...' : 'Confirmar Abono'}
          </button>
        </div>
      </div>
    </div>
  )
}
