import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { Client, Membership, MembershipPlan, MembershipStatus } from '@shared/types'
import { DatePicker } from '@/components/DatePicker'
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
  { value: 'frozen', label: 'Congelada' }
]

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
  onSuccess
}: EditMembershipModalProps): JSX.Element {
  const showToast = useAppStore((s) => s.showToast)
  const [planId, setPlanId] = useState(membership.planId)
  const [startKey, setStartKey] = useState(toDateKey(membership.startDate))
  const [endKey, setEndKey] = useState(toDateKey(membership.endDate))
  const [status, setStatus] = useState<MembershipStatus>(membership.status)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [autoCalculated, setAutoCalculated] = useState(false)

  const selectedPlan = plans.find((p) => p.id === planId)

  // Si cambia el plan, recalcular vencimiento desde startKey (como en creación)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!selectedPlan || selectedPlan.id === membership.planId) return
    if (!startKey) return
    const start = new Date(startKey + 'T00:00:00')
    if (isNaN(start.getTime())) return
    const newEnd = endOfDay(addDays(startOfDay(start), Math.max(1, selectedPlan.durationDays) - 1))
    setEndKey(toDateKey(formatISO(newEnd)))
    setAutoCalculated(true)
  }, [planId, membership.planId, startKey, selectedPlan])

  // Si cambia startDate manualmente, también recalcular si el usuario no ha tocado end manualmente
  const handleStartChange = (v: string) => {
    setStartKey(v)
    if (selectedPlan && v) {
      const start = new Date(v + 'T00:00:00')
      if (!isNaN(start.getTime())) {
        const newEnd = endOfDay(addDays(startOfDay(start), Math.max(1, selectedPlan.durationDays) - 1))
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
      const payload: { planId?: string; startDate?: string; endDate?: string; status?: string; reason?: string } = {}
      if (planId !== membership.planId) payload.planId = planId
      if (startKey !== toDateKey(membership.startDate)) payload.startDate = isoFromKey(startKey, membership.startDate)
      if (endKey !== toDateKey(membership.endDate)) payload.endDate = isoFromKey(endKey, membership.endDate)
      if (status !== membership.status) payload.status = status
      if (reason.trim()) payload.reason = reason.trim()

      if (Object.keys(payload).length === 0 || (Object.keys(payload).length === 1 && payload.reason)) {
        showToast('warning', 'No hay cambios para guardar', 'Validación')
        setSaving(false)
        return
      }

      const result = await window.electronAPI.membership.update(membership.id, payload)
      if (result.success && result.data) {
        showToast('success', 'Membresía actualizada', 'Guardado')
        onSuccess()
        onClose()
      } else {
        showToast('error', result.error || 'No se pudo actualizar la membresía', 'Error')
      }
    } catch (e) {
      showToast('error', toErrorMessage(e, 'Error al actualizar'), 'Error')
    } finally {
      setSaving(false)
    }
  }

  const content = (
    <>
      <div className="modal-body">
        <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="avatar" style={{ width: 48, height: 48, fontSize: 18, flexShrink: 0 }}>
            {client.photo ? <img src={`data:image/jpeg;base64,${client.photo}`} alt={client.fullName} /> : client.fullName.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{client.fullName}</div>
            <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
              Membresía: {membership.planName} • {format(parseISO(membership.startDate), 'dd/MM/yyyy')} - {format(parseISO(membership.endDate), 'dd/MM/yyyy')} • {membership.status}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Plan *</label>
          <select className="form-select" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">Seleccione un plan</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} - {p.durationDays} días
              </option>
            ))}
          </select>
          {selectedPlan && <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>Duración del plan: {selectedPlan.durationDays} días</div>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Inicio *</label>
            <DatePicker value={startKey} onChange={handleStartChange} placeholder="Fecha de inicio" />
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
            {autoCalculated && <div style={{ fontSize: 11, color: 'var(--color-primary)', marginTop: 2 }}>Calculado automáticamente por el plan</div>}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Estado</label>
          <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value as MembershipStatus)}>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: 'var(--color-secondary)', marginTop: 4 }}>Si lo dejas en Automático el sistema recalcula por fecha, pero aquí puedes forzarlo.</div>
        </div>

        <div className="form-group">
          <label className="form-label">Motivo de la corrección (para auditoría)</label>
          <textarea className="form-textarea" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Ej: duración mal digitada, se corrige de 30 a 15 días" />
          <div style={{ fontSize: 11, color: 'var(--color-secondary)', marginTop: 4 }}>Se guarda en el historial con tu nombre de usuario.</div>
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !planId || !startKey || !endKey}>
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
