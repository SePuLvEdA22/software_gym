import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { FormWindowShell } from '@/components/FormWindowShell'

export function TemplateFormPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const templateId = searchParams.get('id')
  const isEditing = !!templateId
  const showToast = useAppStore((state) => state.showToast)

  const [form, setForm] = useState({
    name: '',
    type: 'whatsapp' as 'email' | 'whatsapp',
    subject: '',
    content: '',
    variables: ''
  })
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!templateId) return
    window.electronAPI.messageTemplates
      .getById(templateId)
      .then((result: any) => {
        if (result.success && result.data) {
          const t = result.data
          setForm({
            name: t.name || '',
            type: t.type || 'whatsapp',
            subject: t.subject || '',
            content: t.content || '',
            variables: (t.variables || []).join(', ')
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [templateId])

  const handleSave = async () => {
    if (!form.name || !form.content) {
      showToast('error', 'Nombre y contenido son requeridos')
      return
    }
    setSaving(true)
    const vars = form.variables
      ? form.variables
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : []
    try {
      const r =
        isEditing && templateId
          ? await window.electronAPI.messageTemplates.update(templateId, { ...form, variables: vars })
          : await window.electronAPI.messageTemplates.create({ ...form, variables: vars })
      if (r.success) {
        showToast('success', isEditing ? 'Plantilla actualizada' : 'Plantilla creada')
        await window.electronAPI.window.notifyFormSaved(
          'template',
          isEditing ? 'Plantilla actualizada' : 'Plantilla creada'
        )
      } else {
        showToast('error', r.error || 'Error al guardar la plantilla')
      }
    } catch (err: any) {
      showToast('error', err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <FormWindowShell title={isEditing ? 'Editar Plantilla' : 'Nueva Plantilla'}>
        <div className="spinner" style={{ margin: '48px auto' }} />
      </FormWindowShell>
    )
  }

  return (
    <FormWindowShell title={isEditing ? 'Editar Plantilla' : 'Nueva Plantilla'}>
      <div className="form-group">
        <label className="form-label">Nombre *</label>
        <input
          type="text"
          className="form-input"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="Ej: Promoción Julio"
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <select
            className="form-select"
            value={form.type}
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as 'email' | 'whatsapp' }))}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Correo Electrónico</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Asunto {form.type === 'email' ? '*' : '(opcional)'}</label>
          <input
            type="text"
            className="form-input"
            value={form.subject}
            onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
            placeholder={form.type === 'email' ? 'Asunto del correo' : 'No aplica para WhatsApp'}
          />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Contenido *</label>
        <textarea
          className="form-input"
          value={form.content}
          onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
          rows={6}
          style={{ resize: 'vertical', fontFamily: 'monospace' }}
          placeholder="Ej: Hola {{nombre}}, tenemos una promoción especial..."
        />
        <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>
          Variables disponibles: {'{nombre}'}, {'{documento}'}, {'{telefono}'}, {'{plan}'}, {'{vencimiento}'}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Variables (separadas por coma)</label>
        <input
          type="text"
          className="form-input"
          value={form.variables}
          onChange={(e) => setForm((p) => ({ ...p, variables: e.target.value }))}
          placeholder="nombre, plan, vencimiento"
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--color-surface-container-high)' }}>
        <button className="btn btn-secondary" onClick={() => window.close()}>
          Cancelar
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear Plantilla'}
        </button>
      </div>
    </FormWindowShell>
  )
}
