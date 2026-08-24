import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { toErrorMessage } from '../../../../shared/errors'

export function GymSettingsForm(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [gymForm, setGymForm] = useState({ name: '', address: '', phone: '', welcomeMessage: '' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadGymSettings = async () => {
    try {
      const result = await window.electronAPI.gym.getSettings()
      if (result.success && result.data) {
        setGymForm(result.data)
      }
    } catch (e) { console.error('Error loading gym settings:', e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    loadGymSettings()
  }, [])

  const handleSave = async () => {
    if (!gymForm.name.trim()) {
      showToast('warning', 'El nombre del gimnasio es obligatorio', 'Validación')
      return
    }
    setSaving(true)
    try {
      const result = await window.electronAPI.gym.saveSettings(gymForm)
      if (result.success) {
        showToast('success', 'Información del gimnasio guardada', 'Guardado')
      } else {
        showToast('error', result.error || 'Error al guardar', 'Error')
      }
    } catch (e) {
      showToast('error', toErrorMessage(e, 'Error al guardar'), 'Error')
    } finally { setSaving(false) }
  }

  if (loading) {
    return <div className="spinner" style={{ margin: '24px auto' }} />
  }

  return (
    <div className="card-body" style={{ padding: 0 }}>
      <div className="form-group">
        <label className="form-label">Nombre del Gimnasio *</label>
        <input
          type="text"
          className="form-input"
          value={gymForm.name}
          onChange={(e) => setGymForm(prev => ({ ...prev, name: e.target.value }))}
          placeholder="BODYFITGYM"
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Dirección</label>
          <input
            type="text"
            className="form-input"
            value={gymForm.address}
            onChange={(e) => setGymForm(prev => ({ ...prev, address: e.target.value }))}
            placeholder="AV 4 CALLE 4 Y 5 MOLINOS DEL NORTE"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Teléfono</label>
          <input
            type="text"
            className="form-input"
            value={gymForm.phone}
            onChange={(e) => setGymForm(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="3124962338"
          />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Mensaje de Bienvenida</label>
        <input
          type="text"
          className="form-input"
          value={gymForm.welcomeMessage}
          onChange={(e) => setGymForm(prev => ({ ...prev, welcomeMessage: e.target.value }))}
          placeholder="Bienvenido, nos complace que seas parte de nuestro equipo."
        />
        <p className="body-lg" style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>
          Se muestra en la pantalla de check-in del kiosco
        </p>
      </div>
      <div style={{ marginTop: 24 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Icons.Check />
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  )
}
