import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { Client, Membership, MembershipPlan, PaymentMethod, FreezeHistory, Payment, ClientDebt } from '../../../shared/types'
import { formatCurrency } from '@/utils/format'
import { format, parseISO, differenceInDays, addDays } from 'date-fns'

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
  onClose: () => void
  onSuccess: () => void
}

function RenewModal({ client, activeMembership, plans, onClose, onSuccess }: RenewModalProps): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [amount, setAmount] = useState<number>(0)
  const [discount, setDiscount] = useState<number>(0)
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [promoInfo, setPromoInfo] = useState<{ price: number; discount: number; promotionName: string | null } | null>(null)

  const selectedPlanData = plans.find(p => p.id === selectedPlan)

  useEffect(() => {
    if (selectedPlanData) {
      setAmount(selectedPlanData.price)
      setDiscount(0)
      setPromoInfo(null)
      loadEffectivePrice(selectedPlanData.id)
    }
  }, [selectedPlanData])

  const loadEffectivePrice = async (planId: string) => {
    try {
      const result = await window.electronAPI.promotion.getEffectivePrice(planId)
      if (result.success && result.data) {
        setPromoInfo(result.data)
        if (result.data.promotionName) {
          setAmount(result.data.price)
          setDiscount(result.data.discount)
        }
      }
    } catch (e) { console.error('Error loading promo info:', e) }
  }

   const handleRenew = async () => {
      if (!selectedPlan) return
      
      setLoading(true)
      
      try {
        const pendingBalance = selectedPlanData ? (selectedPlanData.price - discount) - amount : 0
        const notes = [
          discount > 0 ? `Descuento aplicado: ${promoInfo?.promotionName || '$' + discount.toLocaleString('es-CO')}` : '',
          pendingBalance > 0 ? `Pago parcial. Saldo pendiente: $${pendingBalance.toLocaleString('es-CO')}` : ''
        ].filter(Boolean).join(' | ') || undefined

        const startDateIso = startDate ? parseISO(startDate).toISOString() : undefined
        
        const result = await window.electronAPI.membership.createWithPayment(
          client.id,
          selectedPlan,
          amount,
          paymentMethod,
          startDateIso,
          notes,
          discount > 0 ? discount : undefined
        )
        
         if (result.success && result.data?.membership) {
           showToast('success', 'Membresía renovada exitosamente', 'Éxito')
           onSuccess()
           onClose()
         } else {
           showToast(
             'warning',
             (result.data as any)?.error || result.error || 'No se pudo crear la membresía',
             'No se puede renovar'
           )
         }
       } catch (error: any) {
         showToast('error', error?.message || 'Error desconocido', 'Error')
       } finally {
        setLoading(false)
      }
   }

  const getEndDate = () => {
    if (!selectedPlanData || !startDate) return null
    
    const start = startDate ? parseISO(startDate) : new Date()
    const end = addDays(start, selectedPlanData.durationDays)
    return format(end, 'dd/MM/yyyy')
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">Renovar Membresía</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <Icons.Close />
          </button>
        </div>
        
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
                type="date" 
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
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
                  setDiscount(val ? Number(val) : 0)
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
                    setAmount(val ? Number(val) : 0)
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
            {loading ? 'Procesando...' : 'Confirmar Renovación'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface FreezeModalProps {
  membership: Membership
  onClose: () => void
  onSuccess: () => void
}

function FreezeModal({ membership, onClose, onSuccess }: FreezeModalProps): JSX.Element {
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

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Congelar Membresía</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <Icons.Close />
          </button>
        </div>
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
              onChange={(e) => setPlannedDays(e.target.value ? Number(e.target.value) : '')}
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
      </div>
    </div>
  )
}

interface FreezeHistoryModalProps {
  membershipId: string
  onClose: () => void
}

function FreezeHistoryModal({ membershipId, onClose }: FreezeHistoryModalProps): JSX.Element {
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
                      <span style={{ fontWeight: 600 }}>Hasta: {format(parseISO(h.unfrozenAt), 'dd/MM/yyyy')}</span>
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

interface AbonoModalProps {
  client: Client
  membership: Membership
  balance: number
  onClose: () => void
  onSuccess: () => void
}

function AbonoModal({ client, membership, balance, onClose, onSuccess }: AbonoModalProps): JSX.Element {
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

interface PaymentHistoryModalProps {
  membershipId: string
  onClose: () => void
}

function PaymentHistoryModal({ membershipId, onClose }: PaymentHistoryModalProps): JSX.Element {
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

export function MembershipsPage(): JSX.Element {
  const { clients, setClients, plans, setPlans, showToast } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [showFreezeModal, setShowFreezeModal] = useState(false)
  const [showFreezeHistoryModal, setShowFreezeHistoryModal] = useState(false)
  const [selectedMembershipForFreeze, setSelectedMembershipForFreeze] = useState<Membership | null>(null)
  const [selectedMembershipForHistory, setSelectedMembershipForHistory] = useState<string | null>(null)
  const [showAbonoModal, setShowAbonoModal] = useState(false)
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false)
  const [selectedMembershipForAbono, setSelectedMembershipForAbono] = useState<{ membership: Membership; balance: number } | null>(null)
  const [selectedMembershipForPayments, setSelectedMembershipForPayments] = useState<string | null>(null)
  const [clientDebts, setClientDebts] = useState<ClientDebt[]>([])
  const [clientMemberships, setClientMemberships] = useState<Membership[]>([])
  const [activeTab, setActiveTab] = useState<'active' | 'all'>('active')

  const loadPlans = async () => {
    const result = await window.electronAPI.plans.getAll()
    if (result.success && result.data) {
      setPlans(result.data)
    }
  }

  const loadClients = async () => {
    const result = await window.electronAPI.client.getAll({ page: 1, pageSize: 1000 })
    if (result.success && result.data) {
      setClients(result.data.data)
    }
  }

  useEffect(() => {
    loadPlans()
    loadClients()
  }, [])

  const filteredClients = clients.filter(c => {
    const matchesSearch = !searchQuery || 
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.documentId.includes(searchQuery) ||
      c.accessCode.includes(searchQuery)
    
    if (activeTab === 'active') {
      return matchesSearch && (c.status === 'active')
    }
    return matchesSearch
  })

  const handleClientSelect = async (client: Client) => {
    setSelectedClient(client)
    const result = await window.electronAPI.membership.getByClient(client.id)
    if (result.success && result.data) {
      setClientMemberships(result.data)
    }
    const debtResult = await window.electronAPI.client.getDebt(client.id)
    if (debtResult.success && debtResult.data) {
      setClientDebts(debtResult.data)
    }
  }

  const handleRenew = (client: Client) => {
    setSelectedClient(client)
    setShowRenewModal(true)
  }

   const handleFreezeClick = (membership: Membership) => {
      setSelectedMembershipForFreeze(membership)
      setShowFreezeModal(true)
    }

   const handleUnfreeze = async (membershipId: string) => {
     const result = await window.electronAPI.membership.unfreeze(membershipId)
     if (result.success && result.data) {
       showToast('success', 'Membresía descongelada. La fecha de vencimiento ha sido extendida.', 'Listo')
       if (selectedClient) {
         handleClientSelect(selectedClient)
       }
     } else {
       showToast('error', result.error || 'No se pudo descongelar la membresía', 'Error')
     }
   }

   const getStatusBadge = (membership: Membership) => {
     if (membership.status === 'frozen') {
       return <span className="badge badge-warning">Congelado</span>
     }
     
     const now = new Date()
     const endDate = parseISO(membership.endDate)
     const daysLeft = differenceInDays(endDate, now)

     if (membership.status === 'expired' || daysLeft < 0) {
       return <span className="badge badge-error">Vencido</span>
     }
     if (daysLeft <= 7) {
       return <span className="badge badge-warning">Por vencer ({daysLeft}d)</span>
     }
     return <span className="badge badge-success">Activo ({daysLeft}d)</span>
   }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        gap: 16
      }}>
        <div className="tabs">
          <div 
            className={`tab ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Activos
          </div>
          <div 
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Todos
          </div>
        </div>
        <input 
          type="text" 
          className="search-input"
          placeholder="Buscar cliente..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ maxWidth: 300 }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Clientes</h3>
          </div>
          <div className="card-body" style={{ padding: 0, maxHeight: 600, overflowY: 'auto' }}>
            {filteredClients.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Icons.Users />
                </div>
                <p>No hay clientes para mostrar</p>
              </div>
            ) : (
              <div style={{ padding: 8 }}>
                {filteredClients.map(client => (
                  <div 
                    key={client.id}
                    onClick={() => handleClientSelect(client)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 14,
                      padding: 14,
                      borderRadius: 8,
                      cursor: 'pointer',
                      backgroundColor: selectedClient?.id === client.id 
                        ? 'rgba(255, 107, 0, 0.1)' 
                        : 'transparent',
                      border: selectedClient?.id === client.id 
                        ? '1px solid var(--color-primary-container)'
                        : '1px solid transparent',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedClient?.id !== client.id) {
                        e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedClient?.id !== client.id) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="avatar">
                        {client.photo ? (
                          <img src={`data:image/jpeg;base64,${client.photo}`} alt={client.fullName} />
                        ) : (
                          client.fullName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{client.fullName}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                          Código: {client.accessCode}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {client.status === 'active' 
                        ? <span className="badge badge-success">Activo</span>
                        : client.status === 'expired'
                          ? <span className="badge badge-error">Vencido</span>
                          : <span className="badge badge-default">{client.status}</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Historial de Membresías</h3>
            {selectedClient && (
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => handleRenew(selectedClient)}
                disabled={clientMemberships.some(m => m.status === 'active')}
                title={clientMemberships.some(m => m.status === 'active') ? 'El cliente ya tiene una membresía activa' : 'Renovar membresía'}
              >
                <Icons.Plus />
                Renovar
              </button>
            )}
          </div>
          <div className="card-body" style={{ padding: 0, maxHeight: 600, overflowY: 'auto' }}>
            {!selectedClient ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Icons.Membership />
                </div>
                <p>Seleccione un cliente para ver sus membresías</p>
              </div>
             ) : clientMemberships.length === 0 ? (
               <div className="empty-state">
                 <div className="empty-state-icon">
                   <Icons.Membership />
                 </div>
                 <p>Este cliente no tiene membresías registradas</p>
               </div>
             ) : (
                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Plan</th>
                        <th>Inicio</th>
                        <th>Vence</th>
                        <th>Estado</th>
                        <th>Saldo</th>
                        <th style={{ width: 160 }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientMemberships.map(membership => {
                        const debt = clientDebts.find(d => d.membershipId === membership.id)
                        return (
                        <tr key={membership.id}>
                          <td style={{ fontWeight: 500 }}>{membership.planName}</td>
                          <td>{format(parseISO(membership.startDate), 'dd/MM/yyyy')}</td>
                          <td>{format(parseISO(membership.endDate), 'dd/MM/yyyy')}</td>
                          <td>{getStatusBadge(membership)}</td>
                          <td>
                            {debt && debt.balance > 0 ? (
                              <span className="badge badge-error">${debt.balance.toLocaleString('es-CO')}</span>
                            ) : (
                              <span style={{ color: 'var(--color-secondary)', fontSize: 12 }}>Al día</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                             {membership.status === 'active' && (
                                 <button
                                   className="btn btn-secondary btn-sm"
                                   onClick={() => handleFreezeClick(membership)}
                                   title="Congelar membresía"
                                   style={{ minWidth: 36, minHeight: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                 >
                                   <Icons.Snowflake />
                                 </button>
                             )}
                             {membership.status === 'frozen' && (
                                 <button
                                   className="btn btn-primary btn-sm"
                                   onClick={() => handleUnfreeze(membership.id)}
                                   title="Descongelar membresía"
                                   style={{ minWidth: 36, minHeight: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                 >
                                   <Icons.Play />
                                 </button>
                             )}
                             {debt && debt.balance > 0 && (
                               <button
                                 className="btn btn-primary btn-sm"
                                 onClick={() => {
                                   setSelectedMembershipForAbono({ membership, balance: debt.balance })
                                   setShowAbonoModal(true)
                                 }}
                                 title="Registrar abono"
                                 style={{ minWidth: 36, minHeight: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                               >
                                 <Icons.Plus />
                               </button>
                             )}
                             <button
                               className="btn btn-secondary btn-sm"
                               onClick={() => {
                                 setSelectedMembershipForPayments(membership.id)
                                 setShowPaymentHistoryModal(true)
                               }}
                               title="Ver pagos"
                               style={{ minWidth: 36, minHeight: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                             >
                               <Icons.Search />
                             </button>
                             {membership.status === 'frozen' && (
                                 <button
                                   className="btn btn-secondary btn-sm"
                                   onClick={() => {
                                     setSelectedMembershipForHistory(membership.id)
                                     setShowFreezeHistoryModal(true)
                                   }}
                                   title="Historial de congelaciones"
                                   style={{ minWidth: 36, minHeight: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                 >
                                   <Icons.Clock />
                                 </button>
                             )}
                            </div>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
             )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Planes Disponibles</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            {plans.map(plan => (
              <div 
                key={plan.id} 
                className="kpi-card"
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ fontWeight: 600 }}>{plan.name}</h4>
                  <span className="badge badge-primary">{plan.durationDays}d</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-primary-container)' }}>
                  {formatCurrency(plan.price)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                  {plan.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

        {showRenewModal && selectedClient && (
          <RenewModal
            client={selectedClient}
            activeMembership={clientMemberships.find(m => m.status === 'active' || m.status === 'frozen') || null}
            plans={plans}
            onClose={() => {
              setShowRenewModal(false)
              setSelectedClient(null)
            }}
            onSuccess={() => {
              loadClients()
              if (selectedClient) {
                handleClientSelect(selectedClient)
              }
            }}
          />
        )}

        {showFreezeModal && selectedMembershipForFreeze && (
          <FreezeModal
            membership={selectedMembershipForFreeze}
            onClose={() => {
              setShowFreezeModal(false)
              setSelectedMembershipForFreeze(null)
            }}
            onSuccess={() => {
              loadClients()
              if (selectedClient) {
                handleClientSelect(selectedClient)
              }
            }}
          />
        )}

        {showFreezeHistoryModal && selectedMembershipForHistory && (
          <FreezeHistoryModal
            membershipId={selectedMembershipForHistory}
            onClose={() => {
              setShowFreezeHistoryModal(false)
              setSelectedMembershipForHistory(null)
            }}
          />
        )}

        {showAbonoModal && selectedMembershipForAbono && (
          <AbonoModal
            client={selectedClient!}
            membership={selectedMembershipForAbono.membership}
            balance={selectedMembershipForAbono.balance}
            onClose={() => {
              setShowAbonoModal(false)
              setSelectedMembershipForAbono(null)
            }}
            onSuccess={() => {
              loadClients()
              if (selectedClient) {
                handleClientSelect(selectedClient)
              }
            }}
          />
        )}

        {showPaymentHistoryModal && selectedMembershipForPayments && (
          <PaymentHistoryModal
            membershipId={selectedMembershipForPayments}
            onClose={() => {
              setShowPaymentHistoryModal(false)
              setSelectedMembershipForPayments(null)
            }}
          />
        )}
    </div>
  )
}
