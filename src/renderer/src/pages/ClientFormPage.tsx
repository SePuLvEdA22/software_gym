import { useState, useEffect } from 'react'
import { Icons } from '@/components/Icons'
import { CameraCapture } from '@/components/CameraCapture'
import { DatePicker, todayLocalKey } from '@/components/DatePicker'
import { Client, Gender, ClientStatus, EmergencyContact } from '../../../shared/types'
import { format, parseISO } from 'date-fns'

function calculateAge(birthDate: string): number | null {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function getClientIdFromUrl(): string | null {
  const hash = window.location.hash
  const match = hash.match(/[?&]id=([^&]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export function ClientFormPage(): JSX.Element {
  const clientId = getClientIdFromUrl()
  const isEditing = !!clientId
  const [, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    fullName: '',
    documentId: '',
    birthDate: '',
    gender: 'not_specified' as Gender,
    phone: '',
    email: '',
    address: '',
    photo: null as string | null,
    accessCode: '',
    status: 'inactive' as ClientStatus,
    notes: '',
    emergencyContact: {
      name: '',
      phone: '',
      relationship: '',
      notes: ''
    }
  })

  useEffect(() => {
    if (clientId) {
      loadClient(clientId)
    }
  }, [clientId])

  const loadClient = async (id: string) => {
    const result = await window.electronAPI.client.getById(id)
    if (result.success && result.data) {
      const c = result.data
      setClient(c)
      setFormData({
        fullName: c.fullName || '',
        documentId: c.documentId || '',
        birthDate: c.birthDate ? format(parseISO(c.birthDate), 'yyyy-MM-dd') : '',
        gender: (c.gender || 'not_specified') as Gender,
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        photo: c.photo || null,
        accessCode: c.accessCode || '',
        status: (c.status || 'inactive') as ClientStatus,
        notes: '',
        emergencyContact: {
          name: c.emergencyContact?.name || '',
          phone: c.emergencyContact?.phone || '',
          relationship: c.emergencyContact?.relationship || '',
          notes: c.emergencyContact?.notes || ''
        }
      })
    }
    setLoading(false)
  }

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [showCamera, setShowCamera] = useState(false)

  const age = calculateAge(formData.birthDate)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const base64 = (ev.target?.result as string).split(',')[1]
        setFormData(prev => ({ ...prev, photo: base64 }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCameraCapture = (base64: string) => {
    setFormData(prev => ({ ...prev, photo: base64 }))
    setShowCamera(false)
  }

  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, photo: null }))
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (formData.phone && !/^\+?[\d\s\-()]{7,20}$/.test(formData.phone)) {
      errors.phone = 'El teléfono no es válido'
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'El email no es válido'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setSaving(true)

    // Nota: el documento de identidad ya no se edita desde el formulario (el input
    // fue reemplazado por el teléfono); formData.documentId se conserva para no
    // borrar el documento de clientes existentes al editarlos.
    const submitData: Omit<Client, 'id' | 'registrationDate'> = {
      ...formData,
      birthDate: formData.birthDate ? parseISO(formData.birthDate).toISOString() : new Date().toISOString()
    }

    try {
      let result
      if (isEditing && clientId) {
        result = await window.electronAPI.client.update(clientId, submitData)
      } else {
        result = await window.electronAPI.client.create(submitData)
      }

      if (result.success) {
        await window.electronAPI.window.notifyClientFormSaved()
        window.close()
      } else {
        setFieldErrors({ fullName: result.error || 'Error al guardar' })
      }
    } catch {
      setFieldErrors({ fullName: 'Error al guardar' })
    }
    setSaving(false)
  }

  const updateEmergencyContact = (field: keyof EmergencyContact, value: string) => {
    setFormData(prev => ({
      ...prev,
      emergencyContact: { ...prev.emergencyContact, [field]: value }
    }))
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', backgroundColor: 'var(--color-bg)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, margin: '0 auto',
            border: '4px solid rgba(255,107,0,0.2)',
            borderTopColor: 'var(--color-primary-container)', borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ marginTop: 16, color: 'var(--color-secondary)' }}>Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      backgroundColor: 'var(--color-bg)', color: 'var(--color-on-surface)'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: '1px solid var(--color-surface-container-high)',
        backgroundColor: 'var(--color-surface-container-low)'
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          {isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
        </h2>
        <button className="btn btn-secondary" onClick={() => window.close()}>
          Cancelar
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28, marginBottom: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div
                className="photo-upload"
                onClick={() => document.getElementById('photo-upload')?.click()}
                title="Click para subir foto desde archivos"
              >
                {formData.photo ? (
                  <img src={`data:image/jpeg;base64,${formData.photo}`} alt="Client" />
                ) : (
                  <div className="photo-upload-placeholder">
                    <Icons.Camera />
                    <span>Agregar foto</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn btn-sm btn-secondary"
                  onClick={() => document.getElementById('photo-upload')?.click()}
                  title="Subir foto desde archivos">
                  <Icons.Upload />
                </button>
                <button type="button" className="btn btn-sm btn-secondary"
                  onClick={() => setShowCamera(true)}
                  title="Tomar foto con la cámara">
                  <Icons.Camera />
                </button>
                {formData.photo && (
                  <button type="button" className="btn btn-sm btn-secondary"
                    onClick={handleRemovePhoto} title="Eliminar foto"
                    style={{ color: 'var(--color-error)' }}>
                    <Icons.Trash />
                  </button>
                )}
              </div>
              <input id="photo-upload" type="file" accept="image/*"
                style={{ display: 'none' }} onChange={handlePhotoChange} />
              {showCamera && (
                <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nombre Completo *</label>
                  <input type="text" className="form-input"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    required placeholder="Ingrese nombre completo" />
                  {fieldErrors.fullName && <span className="form-error">{fieldErrors.fullName}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input type="tel"
                    className={`form-input ${fieldErrors.phone ? 'form-input-error' : ''}`}
                    value={formData.phone}
                    onChange={(e) => { setFormData(prev => ({ ...prev, phone: e.target.value })); setFieldErrors(prev => ({ ...prev, phone: '' })) }}
                    placeholder="Número de teléfono" />
                  {fieldErrors.phone && <span className="form-error">{fieldErrors.phone}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Código de Acceso</label>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <input type="text" className="form-input"
                      value={formData.accessCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 20)
                        setFormData(prev => ({ ...prev, accessCode: value }))
                      }}
                      placeholder="Ingrese código numérico" maxLength={20}
                      style={{ fontFamily: 'monospace' }} required />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>
                    El cliente usará este código para ingresar al gimnasio. Máximo 20 dígitos.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="divider" />

          <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 600 }}>Información Personal</h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fecha de Nacimiento</label>
              <DatePicker
                value={formData.birthDate}
                onChange={(v) => setFormData(prev => ({ ...prev, birthDate: v }))}
                max={todayLocalKey()}
                placeholder="Seleccionar fecha de nacimiento"
              />
              {age !== null && (
                <div style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 4 }}>
                  Edad: <strong>{age} años</strong>
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Género</label>
              <select className="form-select"
                value={formData.gender}
                onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as Gender }))}>
                <option value="not_specified">No especificado</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <input type="email"
                className={`form-input ${fieldErrors.email ? 'form-input-error' : ''}`}
                value={formData.email}
                onChange={(e) => { setFormData(prev => ({ ...prev, email: e.target.value })); setFieldErrors(prev => ({ ...prev, email: '' })) }}
                placeholder="correo@ejemplo.com" />
              {fieldErrors.email && <span className="form-error">{fieldErrors.email}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Dirección</label>
              <input type="text" className="form-input"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Dirección completa" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea className="form-input"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Notas u observaciones del cliente" rows={3}
              style={{ resize: 'vertical' }} />
          </div>

          <div className="divider" />

          <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Bell />
            Contacto de Emergencia
          </h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input type="text" className="form-input"
                value={formData.emergencyContact.name}
                onChange={(e) => updateEmergencyContact('name', e.target.value)}
                placeholder="Nombre del contacto" />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input type="tel" className="form-input"
                value={formData.emergencyContact.phone}
                onChange={(e) => updateEmergencyContact('phone', e.target.value)}
                placeholder="Número de emergencia" />
            </div>
            <div className="form-group">
              <label className="form-label">Relación</label>
              <input type="text" className="form-input"
                value={formData.emergencyContact.relationship}
                onChange={(e) => updateEmergencyContact('relationship', e.target.value)}
                placeholder="Ej: Familiar, Amigo" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observaciones Importantes</label>
            <textarea className="form-textarea"
              value={formData.emergencyContact.notes}
              onChange={(e) => updateEmergencyContact('notes', e.target.value)}
              placeholder="Alergias, condiciones médicas, etc." rows={3} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--color-surface-container-high)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => window.close()}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { user-select: none; }
      `}</style>
    </div>
  )
}
