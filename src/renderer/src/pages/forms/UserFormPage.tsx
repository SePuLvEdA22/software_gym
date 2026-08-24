import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { UserRole } from '@shared/types'
import {
  PERMISSION_GROUPS,
  ROLE_DEFAULT_PERMISSIONS,
  ALL_PERMISSIONS,
  type PermissionGroup,
} from '@shared/permissions'
import { FormWindowShell } from '@/components/FormWindowShell'
import { toErrorMessage } from '../../../../shared/errors'

export function UserFormPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const userId = searchParams.get('id')
  const isEditing = !!userId
  const showToast = useAppStore((state) => state.showToast)

  const [form, setForm] = useState({
    username: '',
    fullName: '',
    password: '',
    confirmPassword: '',
    role: 'reception' as UserRole,
    permissions: [] as string[],
    isActive: true
  })
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) return
    window.electronAPI.user
      .getById(userId)
      .then((result) => {
        if (result.success && result.data) {
          const u = result.data
          setForm({
            username: u.username || '',
            fullName: u.fullName || '',
            password: '',
            confirmPassword: '',
            role: u.role || 'reception',
            permissions: u.permissions || [],
            isActive: u.isActive ?? true
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const togglePermission = (permId: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter((p) => p !== permId)
        : [...prev.permissions, permId]
    }))
  }

  const selectGroup = (group: PermissionGroup, select: boolean) => {
    const groupIds = group.permissions.map((p) => p.id)
    setForm((prev) => ({
      ...prev,
      permissions: select
        ? [...new Set([...prev.permissions, ...groupIds])]
        : prev.permissions.filter((p) => !groupIds.includes(p))
    }))
  }

  const selectAll = () => {
    setForm((prev) => ({ ...prev, permissions: [...ALL_PERMISSIONS] }))
  }

  const deselectAll = () => {
    setForm((prev) => ({ ...prev, permissions: [] }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.username || !form.fullName) {
      showToast('error', 'Nombre de usuario y nombre completo son requeridos')
      return
    }
    if (!isEditing && !form.password) {
      showToast('error', 'La contraseña es requerida')
      return
    }
    if (form.password && form.password !== form.confirmPassword) {
      showToast('error', 'Las contraseñas no coinciden')
      return
    }
    setSaving(true)
    try {
      let result
      if (isEditing && userId) {
        result = await window.electronAPI.user.update(userId, {
          username: form.username,
          fullName: form.fullName,
          role: form.role,
          permissions: form.permissions,
          isActive: form.isActive,
          ...(form.password ? { password: form.password } : {})
        })
      } else {
        result = await window.electronAPI.user.create({
          username: form.username,
          fullName: form.fullName,
          password: form.password,
          role: form.role,
          permissions: form.permissions
        })
      }
      if (result.success) {
        showToast('success', isEditing ? 'Usuario actualizado exitosamente' : 'Usuario creado exitosamente')
        await window.electronAPI.window.notifyFormSaved(
          'user',
          isEditing ? 'Usuario actualizado exitosamente' : 'Usuario creado exitosamente'
        )
      } else {
        showToast('error', result.error || 'Error al guardar usuario')
      }
    } catch (err) {
      showToast('error', toErrorMessage(err, 'Error de conexión'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <FormWindowShell title={isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}>
        <div className="spinner" style={{ margin: '48px auto' }} />
      </FormWindowShell>
    )
  }

  return (
    <FormWindowShell title={isEditing ? 'Editar Usuario' : 'Nuevo Usuario'} subtitle="Permisos granulares por rol">
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Nombre de Usuario *</label>
            <input
              type="text"
              className="form-input"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              placeholder="ej: jperez"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Nombre Completo *</label>
            <input
              type="text"
              className="form-input"
              value={form.fullName}
              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
              placeholder="Nombre del usuario"
              required
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              Contraseña {isEditing ? '(dejar vacío para mantener)' : '*'}
            </label>
            <input
              type="password"
              className="form-input"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              placeholder={isEditing ? 'Nueva contraseña' : 'Contraseña'}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirmar Contraseña</label>
            <input
              type="password"
              className="form-input"
              value={form.confirmPassword}
              onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
              placeholder="Repetir contraseña"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Rol *</label>
            <select
              className="form-select"
              value={form.role}
              onChange={(e) => {
                const role = e.target.value as UserRole
                setForm((p) => ({
                  ...p,
                  role,
                  // En creación, al cambiar de rol se sugieren los permisos
                  // típicos de ese rol (editables). En edición no se tocan.
                  permissions: isEditing ? p.permissions : [...ROLE_DEFAULT_PERMISSIONS[role]]
                }))
              }}
            >
              <option value="admin">Administrador</option>
              <option value="reception">Recepción</option>
              <option value="trainer">Entrenador</option>
              <option value="accounting">Contabilidad</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Estado</label>
            <select
              className="form-select"
              value={form.isActive ? 'active' : 'inactive'}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.value === 'active' }))}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
        </div>

        {/* Permissions Section */}
        <div style={{ marginTop: 24, borderTop: '1px solid var(--color-surface-container-high)', paddingTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <label className="form-label" style={{ fontSize: 15, marginBottom: 0 }}>
                Permisos
              </label>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)', margin: '4px 0 0' }}>
                {form.role === 'admin'
                  ? 'El administrador tiene acceso total a todas las secciones.'
                  : 'Seleccione los permisos que tendrá este usuario'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-sm btn-secondary" onClick={selectAll}>
                Seleccionar Todo
              </button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={deselectAll}>
                Limpiar
              </button>
            </div>
          </div>

          <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: 4 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {PERMISSION_GROUPS.map((group, gi) => (
                <div key={group.label}>
                  {gi > 0 && <div style={{ height: 1, backgroundColor: 'var(--color-surface-container-high)', margin: '4px 0' }} />}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 8px',
                      marginBottom: 4,
                      borderRadius: 8,
                      cursor: 'pointer',
                      userSelect: 'none',
                      backgroundColor: 'var(--color-surface-container-low)'
                    }}
                    onClick={() => selectGroup(group, !group.permissions.every((p) => form.permissions.includes(p.id)))}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={group.permissions.every((p) => form.permissions.includes(p.id))}
                      readOnly
                      style={{ accentColor: 'var(--color-primary-container)' }}
                    />
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{group.label}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 28 }}>
                    {group.permissions.map((perm) => {
                      const isChecked = form.permissions.includes(perm.id)
                      return (
                        <label
                          key={perm.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            cursor: 'pointer',
                            padding: '5px 8px',
                            borderRadius: 6,
                            userSelect: 'none'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--color-surface-container-high)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(perm.id)}
                            style={{ accentColor: 'var(--color-primary-container)' }}
                          />
                          <span style={{ fontSize: 13, color: 'var(--color-on-surface-variant)' }}>
                            {perm.label}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {form.permissions.length > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: '8px 12px',
                backgroundColor: 'var(--color-surface-container-high)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--color-secondary)'
              }}
            >
              {form.permissions.length} permiso{form.permissions.length !== 1 ? 's' : ''} seleccionado
              {form.permissions.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--color-surface-container-high)' }}>
          <button type="button" className="btn btn-secondary" onClick={() => window.close()}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear Usuario'}
          </button>
        </div>
      </form>
    </FormWindowShell>
  )
}
