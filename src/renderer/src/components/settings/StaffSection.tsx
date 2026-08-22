import { useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'

export function StaffSection(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [adminUser, setAdminUser] = useState({
    username: 'admin',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const handleSaveAdmin = async () => {
    if (!adminUser.currentPassword) {
      showToast('warning', 'Ingresa tu contraseña actual', 'Validación')
      return
    }
    if (adminUser.newPassword && adminUser.newPassword !== adminUser.confirmPassword) {
      showToast('warning', 'Las contraseñas nuevas no coinciden', 'Verificación')
      return
    }
    const result = await window.electronAPI.system.updateAdmin({
      username: adminUser.username,
      currentPassword: adminUser.currentPassword,
      newPassword: adminUser.newPassword || undefined
    })
    if (result.success) {
      showToast('success', 'Configuración de administrador guardada correctamente', 'Guardado')
      setAdminUser(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }))
    } else {
      showToast('error', result.error || 'Error al guardar', 'Error')
    }
  }

  return (
    <div className="card" style={{ border: 'none', background: 'transparent', padding: 0 }}>
      <div className="card-header" style={{ padding: '0 0 20px', background: 'transparent' }}>
        <h2 className="headline-md" style={{ margin: 0 }}>Personal y Roles</h2>
        <p className="body-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0 0' }}>
          Administre las credenciales de administradores y control de acceso
        </p>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Nombre de Usuario</label>
            <input 
              type="text" 
              className="form-input"
              value={adminUser.username}
              onChange={(e) => setAdminUser(prev => ({ ...prev, username: e.target.value }))}
            />
          </div>
        </div>

        <div style={{ margin: '20px 0', borderTop: '1px solid var(--color-border)', opacity: 0.3 }} />
        <h3 className="headline-md" style={{ fontSize: 16, marginBottom: 16 }}>Cambiar Contraseña</h3>
        <div className="form-row-3">
          <div className="form-group">
            <label className="form-label">Contraseña Actual</label>
            <input 
              type="password" 
              className="form-input"
              value={adminUser.currentPassword}
              onChange={(e) => setAdminUser(prev => ({ ...prev, currentPassword: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Nueva Contraseña</label>
            <input 
              type="password" 
              className="form-input"
              value={adminUser.newPassword}
              onChange={(e) => setAdminUser(prev => ({ ...prev, newPassword: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirmar Contraseña</label>
            <input 
              type="password" 
              className="form-input"
              value={adminUser.confirmPassword}
              onChange={(e) => setAdminUser(prev => ({ ...prev, confirmPassword: e.target.value }))}
            />
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <button className="btn btn-primary" onClick={handleSaveAdmin}>
            <Icons.Check />
            Actualizar Usuario
          </button>
        </div>
      </div>
    </div>
  )
}
