import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { MembershipType } from '@shared/types'
import { FormWindowShell } from '@/components/FormWindowShell'
import { Icons } from '@/components/Icons'
import { toErrorMessage } from '../../../../shared/errors'

export function PlanFormPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const planId = searchParams.get('id')
  const isEditing = !!planId
  const showToast = useAppStore((state) => state.showToast)

  const [form, setForm] = useState({
    name: '',
    type: 'monthly' as MembershipType,
    price: 0,
    durationDays: 30,
    description: ''
  })
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!planId) return
    window.electronAPI.plans
      .getById(planId)
      .then((result) => {
        if (result.success && result.data) {
          const p = result.data
          setForm({
            name: p.name || '',
            type: p.type || 'monthly',
            price: p.price || 0,
            durationDays: p.durationDays || 30,
            description: p.description || ''
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [planId])

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.name || form.price <= 0 || form.durationDays <= 0) {
      showToast('warning', 'Completa todos los campos obligatorios', 'Validación')
      return
    }
    setSaving(true)
    const successMessage = isEditing ? 'Plan actualizado correctamente' : 'Plan creado correctamente'
    try {
      const result =
        isEditing && planId
          ? await window.electronAPI.plans.update(planId, form)
          : await window.electronAPI.plans.create(form)
      if (result.success) {
        showToast('success', successMessage, 'Guardado')
        await window.electronAPI.window.notifyFormSaved('plan', successMessage)
      } else {
        showToast('error', result.error || 'Error al guardar plan', 'Error')
      }
    } catch (e) {
      showToast('error', toErrorMessage(e, 'Error al guardar plan'), 'Error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <FormWindowShell title={isEditing ? 'Editar Plan' : 'Nuevo Plan'}>
        <div className="spinner" style={{ margin: '48px auto' }} />
      </FormWindowShell>
    )
  }

  return (
    <FormWindowShell title={isEditing ? 'Editar Plan' : 'Nuevo Plan'}>
      <div className="form-group">
        <label className="form-label">Nombre *</label>
        <input
          className="form-input"
          value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Ej: Premium Mensual"
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <select
            className="form-select"
            value={form.type}
            onChange={(e) => handleChange('type', e.target.value)}
          >
            <option value="daily">Diario</option>
            <option value="weekly">Semanal</option>
            <option value="biweekly">15 Días</option>
            <option value="monthly">Mensual</option>
            <option value="quarterly">Trimestral</option>
            <option value="semiannual">Semestral</option>
            <option value="annual">Anual</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Duración (días) *</label>
          <input
            type="number"
            className="form-input"
            value={form.durationDays || ''}
            onChange={(e) => {
              const raw = e.target.value.replace(/^0+(?=\d)/, '')
              handleChange('durationDays', raw === '' ? 0 : Number(raw))
            }}
            min={1}
            placeholder="Ej: 30"
          />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Precio *</label>
        <input
          type="number"
          className="form-input"
          value={form.price || ''}
          onChange={(e) => {
            const raw = e.target.value.replace(/^0+(?=\d)/, '')
            handleChange('price', raw === '' ? 0 : Number(raw))
          }}
          min={0}
          placeholder="Ej: 50000"
        />
      </div>
      <div className="form-group">
        <label className="form-label">Descripción</label>
        <textarea
          className="form-textarea"
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={2}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--color-surface-container-high)' }}>
        <button className="btn btn-secondary" onClick={() => window.close()}>
          Cancelar
        </button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
          <Icons.Check />
          {saving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear'}
        </button>
      </div>
    </FormWindowShell>
  )
}
