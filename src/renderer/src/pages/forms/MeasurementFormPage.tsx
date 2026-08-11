import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { FormWindowShell } from '@/components/FormWindowShell'
import { DatePicker, todayLocalKey } from '@/components/DatePicker'

const MEASUREMENT_FIELDS: [string, string][] = [
  ['weight', 'Peso (kg)'],
  ['height', 'Altura (cm)'],
  ['neck', 'Cuello (cm)'],
  ['shoulders', 'Hombros (cm)'],
  ['chest', 'Pecho (cm)'],
  ['leftArm', 'Brazo Izq (cm)'],
  ['rightArm', 'Brazo Der (cm)'],
  ['waist', 'Cintura (cm)'],
  ['hips', 'Cadera (cm)'],
  ['leftThigh', 'Pierna Izq (cm)'],
  ['rightThigh', 'Pierna Der (cm)'],
  ['leftCalf', 'Pantorrilla Izq (cm)'],
  ['rightCalf', 'Pantorrilla Der (cm)'],
  ['bodyFat', '% Grasa Corporal']
]

export function MeasurementFormPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const clientId = searchParams.get('clientId') || ''
  const showToast = useAppStore((state) => state.showToast)

  const [form, setForm] = useState<Record<string, string>>({
    date: new Date().toISOString().split('T')[0],
    weight: '',
    height: '',
    neck: '',
    shoulders: '',
    chest: '',
    leftArm: '',
    rightArm: '',
    waist: '',
    hips: '',
    leftThigh: '',
    rightThigh: '',
    leftCalf: '',
    rightCalf: '',
    bodyFat: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const data: any = { date: form.date, notes: form.notes }
    for (const [key] of MEASUREMENT_FIELDS) {
      const val = form[key]
      if (val !== '') data[key] = Number(val)
    }
    try {
      const r = await window.electronAPI.bodyTracking.saveMeasurement(clientId, data)
      if (r.success) {
        showToast('success', 'Medidas guardadas')
        await window.electronAPI.window.notifyFormSaved('measurement', 'Medidas guardadas')
      } else {
        showToast('error', r.error || 'Error al guardar las medidas')
      }
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormWindowShell title="Nuevas Medidas" subtitle="Registre las medidas corporales del cliente">
      <div className="form-group">
        <label className="form-label">Fecha</label>
        <DatePicker
          value={form.date}
          onChange={(v) => setForm((p) => ({ ...p, date: v }))}
          max={todayLocalKey()}
          placeholder="Fecha de la medición"
        />
      </div>
      <div className="grid grid-3" style={{ gap: 12 }}>
        {MEASUREMENT_FIELDS.map(([key, label]) => (
          <div className="form-group" key={key}>
            <label className="form-label">{label}</label>
            <input
              type="number"
              className="form-input"
              step="0.1"
              value={form[key]}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
            />
          </div>
        ))}
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
          {saving ? 'Guardando...' : 'Guardar Medidas'}
        </button>
      </div>
    </FormWindowShell>
  )
}
