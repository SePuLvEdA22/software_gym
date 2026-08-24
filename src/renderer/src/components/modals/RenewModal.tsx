import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { Client, Membership, MembershipPlan, PaymentMethod } from '@shared/types'
import { formatCurrency } from '@/utils/format'
import { format, parse, parseISO, addDays, isValid } from 'date-fns'
import { toErrorMessage } from '../../../../shared/errors'

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' }
]

interface RenewModalProps {
  client: Client
  activeMembership: Membership | null
  plans: MembershipPlan[]
  /** Cuando es true se omite el overlay/modal/header: útil dentro de ventanas-formulario. */
  embedded?: boolean
  /**
   * Usa los canales públicos del kiosco (kiosk:*), que no requieren sesión.
   * El panel de administración debe dejarlo en false (canales con permisos).
   */
  useKioskApi?: boolean
  onClose: () => void
  onSuccess: () => void
}

export function RenewModal({
  client,
  activeMembership,
  plans,
  embedded = false,
  useKioskApi = false,
  onClose,
  onSuccess
}: RenewModalProps): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [amount, setAmount] = useState<number>(0)
  const [discount, setDiscount] = useState<number>(0)
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'dd/MM/yyyy'))
  const [loading, setLoading] = useState(false)
  const [promoInfo, setPromoInfo] = useState<{ price: number; discount: number; promotionName: string | null } | null>(null)

  const selectedPlanData = plans.find(p => p.id === selectedPlan)

  const loadEffectivePrice = async (planId: string) => {
    try {
      const result = useKioskApi
        ? await window.electronAPI.kiosk.getEffectivePrice(planId)
        : await window.electronAPI.promotion.getEffectivePrice(planId)
      if (result.success && result.data) {
        setPromoInfo(result.data)
        if (result.data.promotionName) {
          setAmount(result.data.price)
          setDiscount(result.data.discount)
        }
      }
    } catch (e) { console.error('Error loading promo info:', e) }
  }
  useEffect(() => {
    if (selectedPlanData) {
      setAmount(selectedPlanData.price)
      setDiscount(0)
      setPromoInfo(null)
      loadEffectivePrice(selectedPlanData.id)
    }
  }, [selectedPlanData])


  const handleRenew = async () => {
    if (!selectedPlan) return
    setLoading(true)
    try {
      const pendingBalance = selectedPlanData ? (selectedPlanData.price - discount) - amount : 0
      const notes = [
        discount > 0 ? `Descuento aplicado: ${promoInfo?.promotionName || '$' + discount.toLocaleString('es-CO')}` : '',
        pendingBalance > 0 ? `Pago parcial. Saldo pendiente: $${pendingBalance.toLocaleString('es-CO')}` : ''
      ].filter(Boolean).join(' | ') || undefined

      const parsedStart = startDate ? parse(startDate, 'dd/MM/yyyy', new Date()) : null
      const startDateIso = parsedStart && isValid(parsedStart) ? parsedStart.toISOString() : undefined

      const result = useKioskApi
        ? await window.electronAPI.kiosk.createRenewal(
            client.id,
            selectedPlan,
            amount,
            paymentMethod,
            startDateIso,
            notes,
            discount > 0 ? discount : undefined
          )
        : await window.electronAPI.membership.createWithPayment(
            client.id,
            selectedPlan,
            amount,
            paymentMethod,
            startDateIso,
            notes,
            discount > 0 ? discount : undefined
          )

      if (result.success && result.data?.membership) {
        showToast('success', 'Membresía creada exitosamente', 'Éxito')
        onSuccess()
        onClose()
      } else {
        showToast(
          'warning',
          (result.data as { error?: string } | null)?.error || result.error || 'No se pudo crear la membresía',
          'Error'
        )
      }
    } catch (error) {
      showToast('error', toErrorMessage(error, 'Error desconocido'), 'Error')
    } finally {
      setLoading(false)
    }
  }

  const getEndDate = () => {
    if (!selectedPlanData || !startDate) return null
    const start = startDate ? parse(startDate, 'dd/MM/yyyy', new Date()) : new Date()
    if (!isValid(start)) return '-'
    // La membresía vence al final del ÚLTIMO día de su duración
    // (p. ej. 1 día comprado hoy vence hoy), igual que createMembership.
    const end = addDays(start, Math.max(1, selectedPlanData.durationDays) - 1)
    return format(end, 'dd/MM/yyyy')
  }

  const content = (
    <>
      <div className="modal-body">
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="avatar" style={{ width: 56, height: 56, fontSize: 20, flexShrink: 0 }}>
                {client.photo ? (
                  <img src={`data:image/jpeg;base64,${client.photo}`} alt={client.fullName} />
                ) : (
                  client.fullName.charAt(0).toUpperCase()
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.fullName}</div>
                <div style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
                  Código: {client.accessCode}
                </div>
              </div>
            </div>
          </div>

          {activeMembership && (
            <div className={`alert ${activeMembership.status === 'frozen' ? 'alert-warning' : 'alert-warning'}`} style={{ marginBottom: 20 }}>
              {activeMembership.status === 'frozen' ? <Icons.Snowflake /> : <Icons.Calendar />}
              <div>
                <span style={{ fontWeight: 600 }}>
                  {activeMembership.status === 'frozen' ? 'Membresía Congelada: ' : 'Membresía actual: '}
                </span>
                {activeMembership.planName} -
                {activeMembership.status === 'frozen'
                  ? ' (Fecha de vencimiento se extiende al descongelar)'
                  : ` Vence el ${format(parseISO(activeMembership.endDate), 'dd/MM/yyyy')}`
                }
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Plan de Membresía</label>
            <select
              className="form-select"
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              required
            >
              <option value="">Seleccione un plan</option>
              {plans.map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - {formatCurrency(plan.price)} ({plan.durationDays} días)
                </option>
              ))}
            </select>
          </div>

          <div className="form-row" style={{ marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">Fecha de Inicio</label>
              <input
                type="text"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="dd/mm/aaaa"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de Vencimiento</label>
              <input
                type="text"
                className="form-input"
                value={getEndDate() || '-'}
                disabled
                style={{ backgroundColor: 'var(--color-surface-container-low)' }}
              />
            </div>
          </div>

          <div className="divider" />

          {promoInfo?.promotionName && (
            <div className="alert alert-success" style={{ marginTop: 16, marginBottom: 16 }}>
              <Icons.Bell />
              <div>
                <span style={{ fontWeight: 600 }}>Promoción activa: </span>
                {promoInfo.promotionName} - Ahorras ${promoInfo.discount.toLocaleString('es-CO')}
              </div>
            </div>
          )}

          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Valor Membresía</label>
              <input
                type="text"
                className="form-input"
                value={selectedPlanData ? formatCurrency(selectedPlanData.price) : ''}
                disabled
                style={{ backgroundColor: 'var(--color-surface-container-low)', fontWeight: 600 }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Descuento</label>
              <input
                type="text"
                inputMode="numeric"
                className="form-input"
                value={discount || ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '')
                  const newDiscount = val ? Number(val) : 0
                  setDiscount(newDiscount)
                  // Re-clamp amount si excede el nuevo máximo por el descuento
                  if (selectedPlanData) {
                    const maxAllowed = Math.max(0, selectedPlanData.price - newDiscount)
                    setAmount(prev => Math.min(prev, maxAllowed))
                  }
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

          <div className="card" style={{ padding: 16, backgroundColor: 'var(--color-surface-container-high)', marginTop: 16 }}>
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Total a Pagar</label>
                <input
                  type="text"
                  className="form-input"
                  value={selectedPlanData ? formatCurrency(Math.max(0, selectedPlanData.price - discount)) : ''}
                  disabled
                  style={{ backgroundColor: 'var(--color-surface-container-low)', fontWeight: 600 }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Monto Pagado</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-input"
                  value={amount || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')
                    const numericVal = val ? Number(val) : 0
                    const maxAllowed = selectedPlanData ? Math.max(0, selectedPlanData.price - discount) : Infinity
                    setAmount(Math.min(numericVal, maxAllowed))
                  }}
                  placeholder="0"
                />
              </div>
            </div>
            {selectedPlanData && amount < (selectedPlanData.price - discount) && (
              <div className="alert alert-warning" style={{ marginTop: 8, marginBottom: 0, padding: '8px 12px' }}>
                <Icons.Bell />
                <div>
                  <strong>Saldo Pendiente: {formatCurrency((selectedPlanData.price - discount) - amount)}</strong>
                  <div style={{ fontSize: 12 }}>Este saldo quedará registrado como deuda del cliente</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRenew}
            disabled={!selectedPlan || loading}
          >
            {loading ? 'Procesando...' : 'Confirmar'}
          </button>
        </div>
    </>
  )

  if (embedded) {
    return content
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">Nueva Membresía</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <Icons.Close />
          </button>
        </div>
        {content}
      </div>
    </div>
  )
}
