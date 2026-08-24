import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { FitnessGoal } from '@shared/types'
import { FormWindowShell } from '@/components/FormWindowShell'
import { DatePicker, todayLocalKey } from '@/components/DatePicker'
import { toErrorMessage } from '../../../../shared/errors'

export function GoalFormPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const clientId = searchParams.get('clientId') || ''
  const showToast = useAppStore((state) => state.showToast)

  const [form, setForm] = useState({
    goal: 'lose_weight' as FitnessGoal,
    startDate: new Date().toISOString().split('T')[0],
    targetDate: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const r = await window.electronAPI.bodyTracking.saveGoal(clientId, form)
      if (r.success) {
        showToast('success', 'Objetivo guardado')
        await window.electronAPI.window.notifyFormSaved('goal', 'Objetivo guardado')
      } else {
        showToast('error', r.error || 'Error al guardar el objetivo')
      }
    } catch (err) {
      showToast('error', toErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormWindowShell title="Nuevo Objetivo" subtitle="Defina la meta del cliente">
      <div className="form-group">
        <label className="form-label">Objetivo</label>
        <select
          className="form-select"
          value={form.goal}
          onChange={(e) => setForm((p) => ({ ...p, goal: e.target.value as FitnessGoal }))}
        >
          <option value="lose_weight">Bajar de Peso</option>
          <option value="gain_muscle">Ganar Masa Muscular</option>
          <option value="define">Definir</option>
          <option value="maintain">Mantener</option>
        </select>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Fecha Inicio</label>
          <DatePicker
            value={form.startDate}
            onChange={(v) => setForm((p) => ({ ...p, startDate: v }))}
            max={todayLocalKey()}
            placeholder="Inicio del objetivo"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Fecha Objetivo</label>
          <DatePicker
            value={form.targetDate}
            onChange={(v) => setForm((p) => ({ ...p, targetDate: v }))}
            min={form.startDate || undefined}
            placeholder="Fecha meta"
          />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Notas</label>
        <textarea
          className="form-input"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          rows={2}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--color-surface-container-high)' }}>
        <button className="btn btn-secondary" onClick={() => window.close()}>
          Cancelar
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar Objetivo'}
        </button>
      </div>
    </FormWindowShell>
  )
}
