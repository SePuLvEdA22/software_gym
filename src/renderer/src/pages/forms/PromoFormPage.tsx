import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { MembershipPlan } from '@shared/types'
import { FormWindowShell } from '@/components/FormWindowShell'
import { DatePicker } from '@/components/DatePicker'
import { Icons } from '@/components/Icons'

export function PromoFormPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const promoId = searchParams.get('id')
  const isEditing = !!promoId
  const showToast = useAppStore((state) => state.showToast)

  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [form, setForm] = useState({
    name: '',
    planId: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 0,
    startDate: '',
    endDate: ''
  })
  const [loading, setLoading] = useState(isEditing)

  useEffect(() => {
    window.electronAPI.plans.getAll(false).then((result: any) => {
      if (result.success && result.data) setPlans(result.data)
    }).catch(() => {})
    if (!promoId) return
    window.electronAPI.promotion
      .getById(promoId)
      .then((result: any) => {
        if (result.success && result.data) {
          const p = result.data
          setForm({
            name: p.name || '',
            planId: p.planId || '',
            discountType: p.discountType || 'percentage',
            discountValue: p.discountValue || 0,
            startDate: p.startDate ? p.startDate.split('T')[0] : '',
            endDate: p.endDate ? p.endDate.split('T')[0] : ''
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [promoId])

  const handleSubmit = async () => {
    if (!form.name || !form.planId || form.discountValue <= 0 || !form.startDate || !form.endDate) {
      showToast('warning', 'Completa todos los campos obligatorios', 'Validación')
      return
    }
    const data = {
      ...form,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString()
    }
    const successMessage = isEditing ? 'Promoción actualizada' : 'Promoción creada'
    try {
      const result =
        isEditing && promoId
          ? await window.electronAPI.promotion.update(promoId, data)
          : await window.electronAPI.promotion.create(data)
      if (result.success) {
        showToast('success', successMessage, 'Guardado')
        await window.electronAPI.window.notifyFormSaved('promo', successMessage)
      } else {
        showToast('error', result.error || 'Error al guardar promoción', 'Error')
      }
    } catch (e: any) {
      showToast('error', e.message || 'Error al guardar promoción', 'Error')
    }
  }

  if (loading) {
    return (
      <FormWindowShell title={isEditing ? 'Editar Promoción' : 'Nueva Promoción'}>
        <div className="spinner" style={{ margin: '48px auto' }} />
      </FormWindowShell>
    )
  }

  return (
    <FormWindowShell title={isEditing ? 'Editar Promoción' : 'Nueva Promoción'}>
      <div className="form-group">
        <label className="form-label">Nombre *</label>
        <input
          className="form-input"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Ej: Promoción Verano"
        />
      </div>
      <div className="form-group">
        <label className="form-label">Plan *</label>
        <select
          className="form-select"
          value={form.planId}
          onChange={(e) => setForm((prev) => ({ ...prev, planId: e.target.value }))}
        >
          <option value="">Seleccione un plan</option>
          {plans.filter((p) => p.isActive).map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} - ${plan.price.toLocaleString('es-CO')}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Tipo de Descuento</label>
          <select
            className="form-select"
            value={form.discountType}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, discountType: e.target.value as 'percentage' | 'fixed' }))
            }
          >
            <option value="percentage">Porcentaje (%)</option>
            <option value="fixed">Monto Fijo ($)</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Valor *</label>
          <input
            type="number"
            className="form-input"
            value={form.discountValue || ''}
            onChange={(e) => {
              const raw = e.target.value.replace(/^0+(?=\d)/, '')
              setForm((prev) => ({ ...prev, discountValue: raw === '' ? 0 : Number(raw) }))
            }}
            min={0}
            placeholder={form.discountType === 'percentage' ? 'Ej: 20' : 'Ej: 50000'}
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Fecha Inicio *</label>
          <DatePicker
            value={form.startDate}
            onChange={(v) => setForm((prev) => ({ ...prev, startDate: v }))}
            max={form.endDate || undefined}
            placeholder="Inicio de la promoción"
            clearable={false}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Fecha Fin *</label>
          <DatePicker
            value={form.endDate}
            onChange={(v) => setForm((prev) => ({ ...prev, endDate: v }))}
            min={form.startDate || undefined}
            placeholder="Fin de la promoción"
            clearable={false}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--color-surface-container-high)' }}>
        <button className="btn btn-secondary" onClick={() => window.close()}>
          Cancelar
        </button>
        <button className="btn btn-primary" onClick={handleSubmit}>
          <Icons.Check />
          {isEditing ? 'Actualizar' : 'Crear'}
        </button>
      </div>
    </FormWindowShell>
  )
}
