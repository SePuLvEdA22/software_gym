import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { Client, Membership, MembershipPlan, MembershipStatus, Payment, PaymentMethod } from '@shared/types'
import { DatePicker } from '@/components/DatePicker'
import { formatCurrency } from '@/utils/format'
import { format, parseISO, formatISO } from 'date-fns'
import { addDays, startOfDay, endOfDay } from 'date-fns'
import { toErrorMessage } from '../../../../shared/errors'

interface EditMembershipModalProps {
  membership: Membership
  client: Client
  plans: MembershipPlan[]
  embedded?: boolean
  onClose: () => void
  onSuccess: () => void
}

const statusOptions: { value: MembershipStatus; label: string }[] = [
  { value: 'active', label: 'Activa' },
  { value: 'scheduled', label: 'Programada' },
  { value: 'expired', label: 'Vencida' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'frozen', label: 'Congelada' },
]

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

function toDateKey(iso: string): string {
  return iso.slice(0, 10)
}

function isoFromKey(key: string, fallbackIso: string): string {
  if (!key) return fallbackIso
  const d = new Date(key + 'T00:00:00')
  if (isNaN(d.getTime())) return fallbackIso
  // Usar formatISO local (como hace createMembership) para evitar desplazamiento UTC
  return formatISO(d)
}

export function EditMembershipModal({
  membership,
  client,
  plans,
  embedded = false,
  onClose,
  onSuccess,
}: EditMembershipModalProps): JSX.Element {
  const showToast = useAppStore((s) => s.showToast)
  const [planId, setPlanId] = useState(membership.planId)
  const [startKey, setStartKey] = useState(toDateKey(membership.startDate))
  const [endKey, setEndKey] = useState(toDateKey(membership.endDate))
  const [status, setStatus] = useState<MembershipStatus>(membership.status)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [autoCalculated, setAutoCalculated] = useState(false)
  const [linkedPayments, setLinkedPayments] = useState<Payment[]>([])
  const [linkedMethods, setLinkedMethods] = useState<{ id: string; method: PaymentMethod }[]>([])
  const [blindMode, setBlindMode] = useState(false)
  const [paymentsError, setPaymentsError] = useState<string | null>(null)
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')

  const selectedPlan = plans.find((p) => p.id === planId)
  const currentPlan = plans.find((p) => p.id === membership.planId)
  const planChanged = planId !== membership.planId && !!selectedPlan
  const priceDiff =
    planChanged && currentPlan && selectedPlan ? selectedPlan.price - currentPlan.price : null
  // Solo se permite editar el método aquí cuando hay un único pago ligado;
  // con varios pagos (cuotas/abonos) se edita desde el historial de pagos.
  // En modo ciego (sin payments.view) se usa la vista mínima id+método,
  // sin montos ni fechas, para roles con payments.edit_method.
  const singlePayment: { id: string; method: PaymentMethod } | null =
    !blindMode && linkedPayments.length === 1
      ? linkedPayments[0]
      : blindMode && linkedMethods.length === 1
        ? linkedMethods[0]
        : null
  const linkedCount = blindMode ? linkedMethods.length : linkedPayments.length
  const methodChanged =
    !!singlePayment && !!paymentMethod && paymentMethod !== singlePayment.method

  // Cargar pagos ligados para mostrar/editar el método de pago.
  // Intenta la vista completa (payments.view) y cae a la mínima
  // (payments.edit_method, ciega a montos) si no hay permiso de ver.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const result = await window.electronAPI.payment.getByMembership(membership.id)
        if (cancelled) return
        if (result.success && result.data) {
          setLinkedPayments(result.data)
          if (result.data.length === 1) setPaymentMethod(result.data[0].method)
          return
        }
        const minimal = await window.electronAPI.payment.getMethodsByMembership(membership.id)
        if (cancelled) return
        if (minimal.success && minimal.data) {
          setBlindMode(true)
          setLinkedMethods(minimal.data)
          if (minimal.data.length === 1) setPaymentMethod(minimal.data[0].method)
        } else {
          setPaymentsError(minimal.error || result.error || 'No se pudieron cargar los pagos')
        }
      } catch {
        if (!cancelled) setPaymentsError('No se pudieron cargar los pagos')
      } finally {
        if (!cancelled) setPaymentsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // Solo al montar / cambiar de membresía.
  }, [membership.id])

  // Snapshot de las fechas originales: permite restaurar el vencimiento exacto
  // (p. ej. extendido por congelamiento o personalizado) cuando el usuario
  // revierte al plan original sin haber movido la fecha de inicio.
  const originalStartKeyRef = useRef(toDateKey(membership.startDate))
  const originalEndKeyRef = useRef(toDateKey(membership.endDate))
  const prevPlanIdRef = useRef(membership.planId)

  // Si cambia el plan, recalcular vencimiento desde startKey (como en creación).
  // Si se revierte al plan original, restaurar el vencimiento original exacto
  // (opción A) salvo que el inicio haya cambiado, en cuyo caso se recalcula
  // con la duración del plan original. El guard por prevPlanId evita recalcular
  // en el montaje y por cambios de startKey (ya cubiertos por handleStartChange).
  useEffect(() => {
    if (planId === prevPlanIdRef.current) return
    prevPlanIdRef.current = planId
    if (!startKey) return
    const start = new Date(startKey + 'T00:00:00')
    if (isNaN(start.getTime())) return
    // Reversión al plan original: restaurar fecha exacta si el inicio no se movió.
    if (planId === membership.planId) {
      if (startKey === originalStartKeyRef.current) {
        setEndKey(originalEndKeyRef.current)
      } else if (currentPlan) {
        const newEnd = endOfDay(
          addDays(startOfDay(start), Math.max(1, currentPlan.durationDays) - 1),
        )
        setEndKey(toDateKey(formatISO(newEnd)))
      } else {
        return
      }
      setAutoCalculated(true)
      return
    }
    const targetPlan = plans.find((p) => p.id === planId)
    if (!targetPlan) return
    const newEnd = endOfDay(addDays(startOfDay(start), Math.max(1, targetPlan.durationDays) - 1))
    setEndKey(toDateKey(formatISO(newEnd)))
    setAutoCalculated(true)
    // Solo reaccionar al cambio de plan iniciado por el usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId])

  // Si cambia startDate manualmente, también recalcular si el usuario no ha tocado end manualmente
  const handleStartChange = (v: string) => {
    setStartKey(v)
    if (selectedPlan && v) {
      const start = new Date(v + 'T00:00:00')
      if (!isNaN(start.getTime())) {
        const newEnd = endOfDay(
          addDays(startOfDay(start), Math.max(1, selectedPlan.durationDays) - 1),
        )
        setEndKey(toDateKey(formatISO(newEnd)))
        setAutoCalculated(true)
      }
    }
  }

  const handleSave = async () => {
    if (!planId) {
      showToast('warning', 'Selecciona un plan', 'Validación')
      return
    }
    if (!startKey || !endKey) {
      showToast('warning', 'Fechas de inicio y vencimiento son obligatorias', 'Validación')
      return
    }
    const start = new Date(startKey + 'T00:00:00')
    const end = new Date(endKey + 'T00:00:00')
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      showToast('warning', 'Rango de fechas inválido', 'Validación')
      return
    }
    setSaving(true)
    try {
      const payload: {
        planId?: string
        startDate?: string
        endDate?: string
        status?: string
        reason?: string
      } = {}
      if (planId !== membership.planId) payload.planId = planId
      if (startKey !== toDateKey(membership.startDate))
        payload.startDate = isoFromKey(startKey, membership.startDate)
      if (endKey !== toDateKey(membership.endDate))
        payload.endDate = isoFromKey(endKey, membership.endDate)
      if (status !== membership.status) payload.status = status
      if (reason.trim()) payload.reason = reason.trim()

      const hasMembershipChanges =
        Object.keys(payload).length > 0 &&
        !(Object.keys(payload).length === 1 && payload.reason)

      if (!hasMembershipChanges && !methodChanged) {
        showToast('warning', 'No hay cambios para guardar', 'Validación')
        setSaving(false)
        return
      }

      if (hasMembershipChanges) {
        const result = await window.electronAPI.membership.update(membership.id, payload)
        if (result.success && result.data) {
          if (result.paymentAdjusted) {
            showToast(
              'success',
              `Membresía actualizada. Pago ajustado: ${formatCurrency(result.paymentAdjusted.oldAmount)} → ${formatCurrency(result.paymentAdjusted.newAmount)}`,
              'Guardado',
            )
          } else {
            showToast('success', 'Membresía actualizada', 'Guardado')
          }
          if (result.paymentWarning) {
            showToast('warning', result.paymentWarning, 'Revisar pagos')
          }
        } else {
          showToast('error', result.error || 'No se pudo actualizar la membresía', 'Error')
          return
        }
      }

      if (methodChanged && singlePayment && paymentMethod) {
        const methodResult = await window.electronAPI.payment.updateMethod(
          singlePayment.id,
          paymentMethod,
        )
        if (methodResult.success) {
          showToast(
            'success',
            `Método de pago actualizado a ${getMethodLabel(paymentMethod)}`,
            'Guardado',
          )
        } else {
          showToast(
            'error',
            methodResult.error || 'No se pudo actualizar el método de pago',
            'Error',
          )
          return
        }
      }

      onSuccess()
      onClose()
    } catch (e) {
      showToast('error', toErrorMessage(e, 'Error al actualizar'), 'Error')
    } finally {
      setSaving(false)
    }
  }

  const content = (
    <>
      <div className="modal-body">
        <div
          className="card"
          style={{ padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}
        >
          <div className="avatar" style={{ width: 48, height: 48, fontSize: 18, flexShrink: 0 }}>
            {client.photo ? (
              <img src={`data:image/jpeg;base64,${client.photo}`} alt={client.fullName} />
            ) : (
              client.fullName.charAt(0).toUpperCase()
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{client.fullName}</div>
            <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
              Membresía: {membership.planName} •{' '}
              {format(parseISO(membership.startDate), 'dd/MM/yyyy')} -{' '}
              {format(parseISO(membership.endDate), 'dd/MM/yyyy')} • {membership.status}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Plan *</label>
          <select
            className="form-select"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
          >
            <option value="">Seleccione un plan</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} - {formatCurrency(p.price)} - {p.durationDays} días
              </option>
            ))}
          </select>
          {selectedPlan && (
            <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>
              Duración del plan: {selectedPlan.durationDays} días • Valor:{' '}
              {formatCurrency(selectedPlan.price)}
            </div>
          )}
          {planChanged && priceDiff !== null && (
            <div
              className="alert alert-warning"
              style={{ marginTop: 8, marginBottom: 0, padding: '8px 12px' }}
            >
              <Icons.Bell />
              <div>
                <strong>
                  {currentPlan
                    ? `${formatCurrency(currentPlan.price)} → ${formatCurrency(selectedPlan!.price)}`
                    : `Nuevo valor: ${formatCurrency(selectedPlan!.price)}`}
                  {priceDiff !== 0 && (
                    <>
                      {' '}
                      ({priceDiff > 0 ? '+' : ''}
                      {formatCurrency(priceDiff)})
                    </>
                  )}
                </strong>
                <div style={{ fontSize: 12 }}>
                  El pago ligado se ajustará automáticamente al nuevo valor al guardar.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Inicio *</label>
            <DatePicker
              value={startKey}
              onChange={handleStartChange}
              placeholder="Fecha de inicio"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Vencimiento *</label>
            <DatePicker
              value={endKey}
              onChange={(v) => {
                setEndKey(v)
                setAutoCalculated(false)
              }}
              min={startKey || undefined}
              placeholder="Fecha de vencimiento"
            />
            {autoCalculated && (
              <div style={{ fontSize: 11, color: 'var(--color-primary)', marginTop: 2 }}>
                Calculado automáticamente por el plan
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Estado</label>
          <select
            className="form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as MembershipStatus)}
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: 'var(--color-secondary)', marginTop: 4 }}>
            Si lo dejas en Automático el sistema recalcula por fecha, pero aquí puedes forzarlo.
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Método de pago</label>
          {paymentsLoading ? (
            <select className="form-select" disabled value="">
              <option value="">Cargando pagos...</option>
            </select>
          ) : paymentsError ? (
            <div style={{ fontSize: 12, color: 'var(--color-error)' }}>{paymentsError}</div>
          ) : singlePayment ? (
            <>
              <select
                className="form-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                {methodOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {!blindMode && 'amount' in singlePayment && 'date' in singlePayment ? (
                <div style={{ fontSize: 11, color: 'var(--color-secondary)', marginTop: 4 }}>
                  Pago de {formatCurrency((singlePayment as Payment).amount)} •{' '}
                  {format(parseISO((singlePayment as Payment).date), 'dd/MM/yyyy')}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--color-secondary)', marginTop: 4 }}>
                  Pago ligado (montos ocultos por tu rol)
                </div>
              )}
            </>
          ) : linkedCount > 1 ? (
            <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
              Esta membresía tiene {linkedCount} pagos ligados
              {!blindMode && ` (${linkedPayments.map((p) => getMethodLabel(p.method)).join(', ')})`}.
              Modifica el método de cada pago desde el historial de pagos.
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
              Esta membresía no tiene pagos ligados.
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Motivo de la corrección (para auditoría)</label>
          <textarea
            className="form-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Ej: duración mal digitada, se corrige de 30 a 15 días"
          />
          <div style={{ fontSize: 11, color: 'var(--color-secondary)', marginTop: 4 }}>
            Se guarda en el historial con tu nombre de usuario.
          </div>
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || !planId || !startKey || !endKey}
        >
          <Icons.Check />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </>
  )

  if (embedded) return content

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">Editar Membresía</h2>
          <button className="modal-close" onClick={onClose}>
            <Icons.Close />
          </button>
        </div>
        {content}
      </div>
    </div>
  )
}
