import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { User, UserRole, ChangeLog } from '../../../shared/types'
import { Icons } from '@/components/Icons'
import { Pagination } from '@/components/Pagination'
import { format, parseISO } from 'date-fns'

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  reception: 'Recepción',
  trainer: 'Entrenador',
  accounting: 'Contabilidad'
}

const roleColors: Record<UserRole, string> = {
  admin: 'var(--color-primary)',
  reception: 'var(--color-success)',
  trainer: 'var(--color-info)',
  accounting: 'var(--color-warning)'
}

interface PermissionDef {
  id: string
  label: string
}

interface PermissionGroup {
  label: string
  permissions: PermissionDef[]
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: 'Panel Principal',
    permissions: [
      { id: 'dashboard.view', label: 'Ver dashboard' },
    ],
  },
  {
    label: 'Clientes',
    permissions: [
      { id: 'clients.view', label: 'Ver clientes' },
      { id: 'clients.create', label: 'Crear clientes' },
      { id: 'clients.edit', label: 'Editar clientes' },
      { id: 'clients.delete', label: 'Eliminar clientes' },
    ],
  },
  {
    label: 'Pagos',
    permissions: [
      { id: 'payments.view', label: 'Ver pagos' },
      { id: 'payments.create', label: 'Registrar pagos' },
    ],
  },
  {
    label: 'Membresías',
    permissions: [
      { id: 'memberships.view', label: 'Ver membresías' },
      { id: 'memberships.create', label: 'Crear membresías' },
      { id: 'memberships.freeze', label: 'Congelar/Descongelar' },
    ],
  },
  {
    label: 'Inventario',
    permissions: [
      { id: 'inventory.view', label: 'Ver inventario' },
      { id: 'inventory.create', label: 'Agregar productos' },
      { id: 'inventory.edit', label: 'Editar productos' },
      { id: 'inventory.delete', label: 'Eliminar productos' },
    ],
  },
  {
    label: 'Seguimiento',
    permissions: [
      { id: 'tracking.view', label: 'Ver seguimiento' },
      { id: 'tracking.edit', label: 'Editar medidas/objetivos' },
    ],
  },
  {
    label: 'Reportes',
    permissions: [
      { id: 'reports.view', label: 'Ver reportes' },
      { id: 'reports.export', label: 'Exportar datos' },
    ],
  },
  {
    label: 'Notificaciones',
    permissions: [
      { id: 'messages.view', label: 'Ver mensajes' },
      { id: 'messages.send', label: 'Enviar mensajes' },
      { id: 'whatsapp.view', label: 'Ver historial WhatsApp' },
    ],
  },
  {
    label: 'Historial de Accesos',
    permissions: [
      { id: 'logs.view', label: 'Ver historial' },
    ],
  },
  {
    label: 'Configuración',
    permissions: [
      { id: 'settings.view', label: 'Ver configuración' },
      { id: 'settings.edit', label: 'Editar configuración' },
    ],
  },
  {
    label: 'Usuarios',
    permissions: [
      { id: 'users.view', label: 'Ver usuarios' },
      { id: 'users.create', label: 'Crear usuarios' },
      { id: 'users.edit', label: 'Editar usuarios' },
      { id: 'users.delete', label: 'Eliminar usuarios' },
    ],
  },
  {
    label: 'Puerta',
    permissions: [
      { id: 'door.open', label: 'Abrir puerta' },
      { id: 'door.configure', label: 'Configurar puerta' },
    ],
  },
]

function getAllPermissionIds(): string[] {
  return PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.id))
}

interface UserFormProps {
  user?: User | null
  onClose: () => void
  onSave: () => void
}

function UserForm({ user, onClose, onSave }: UserFormProps): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const [form, setForm] = useState({
    username: user?.username || '',
    fullName: user?.fullName || '',
    password: '',
    confirmPassword: '',
    role: (user?.role || 'reception') as UserRole,
    permissions: user?.permissions || [],
    isActive: user?.isActive ?? true
  })
  const [loading, setLoading] = useState(false)

  const togglePermission = (permId: string) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }))
  }

  const selectGroup = (group: PermissionGroup, select: boolean) => {
    const groupIds = group.permissions.map(p => p.id)
    setForm(prev => ({
      ...prev,
      permissions: select
        ? [...new Set([...prev.permissions, ...groupIds])]
        : prev.permissions.filter(p => !groupIds.includes(p))
    }))
  }

  const selectAll = () => {
    setForm(prev => ({ ...prev, permissions: getAllPermissionIds() }))
  }

  const deselectAll = () => {
    setForm(prev => ({ ...prev, permissions: [] }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.username || !form.fullName) {
      showToast('error', 'Nombre de usuario y nombre completo son requeridos')
      return
    }
    if (!user && !form.password) {
      showToast('error', 'La contraseña es requerida')
      return
    }
    if (form.password && form.password !== form.confirmPassword) {
      showToast('error', 'Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      if (user) {
        const result = await window.electronAPI.user.update(user.id, {
          username: form.username,
          fullName: form.fullName,
          role: form.role,
          permissions: form.permissions,
          isActive: form.isActive,
          ...(form.password ? { password: form.password } : {})
        })
        if (result.success) {
          showToast('success', 'Usuario actualizado exitosamente')
          onSave()
        } else {
          showToast('error', result.error || 'Error al actualizar usuario')
        }
      } else {
        const result = await window.electronAPI.user.create({
          username: form.username,
          fullName: form.fullName,
          password: form.password,
          role: form.role,
          permissions: form.permissions
        })
        if (result.success) {
          showToast('success', 'Usuario creado exitosamente')
          onSave()
        } else {
          showToast('error', result.error || 'Error al crear usuario')
        }
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <div>
              <h2 className="modal-title" style={{ margin: 0 }}>{user ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
            </div>
            <button type="button" className="modal-close" onClick={onClose}><Icons.Close /></button>
          </div>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nombre de Usuario *</label>
                <input type="text" className="form-input" value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="ej: jperez" required />
              </div>
              <div className="form-group">
                <label className="form-label">Nombre Completo *</label>
                <input type="text" className="form-input" value={form.fullName}
                  onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
                  placeholder="Nombre del usuario" required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Contraseña {user ? '(dejar vacío para mantener)' : '*'}</label>
                <input type="password" className="form-input" value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder={user ? 'Nueva contraseña' : 'Contraseña'} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar Contraseña</label>
                <input type="password" className="form-input" value={form.confirmPassword}
                  onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="Repetir contraseña" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Rol *</label>
                <select className="form-select" value={form.role}
                  onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}>
                  <option value="admin">Administrador</option>
                  <option value="reception">Recepción</option>
                  <option value="trainer">Entrenador</option>
                  <option value="accounting">Contabilidad</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Estado</label>
                <select className="form-select" value={form.isActive ? 'active' : 'inactive'}
                  onChange={e => setForm(p => ({ ...p, isActive: e.target.value === 'active' }))}>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>
            </div>

            {/* Permissions Section */}
            <div style={{ marginTop: 24, borderTop: '1px solid var(--color-surface-container-high)', paddingTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 15, marginBottom: 0 }}>Permisos</label>
                  <p style={{ fontSize: 12, color: 'var(--color-secondary)', margin: '4px 0 0' }}>
                    Seleccione los permisos que tendrá este usuario
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

              <div style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {PERMISSION_GROUPS.map((group, gi) => (
                    <div key={group.label}>
                      {gi > 0 && <div style={{ height: 1, backgroundColor: 'var(--color-surface-container-high)', margin: '4px 0' }} />}
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '6px 8px', marginBottom: 4,
                          borderRadius: 8, cursor: 'pointer', userSelect: 'none',
                          backgroundColor: 'var(--color-surface-container-low)'
                        }}
                        onClick={() => selectGroup(group, !group.permissions.every(p => form.permissions.includes(p.id)))}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)' }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)' }}
                      >
                        <input
                          type="checkbox"
                          checked={group.permissions.every(p => form.permissions.includes(p.id))}
                          readOnly
                          style={{ accentColor: 'var(--color-primary-container)' }}
                        />
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{group.label}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 28 }}>
                        {group.permissions.map(perm => {
                          const isChecked = form.permissions.includes(perm.id)
                          return (
                            <label key={perm.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                cursor: 'pointer', padding: '5px 8px',
                                borderRadius: 6, userSelect: 'none'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container-high)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
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
                <div style={{
                  marginTop: 12, padding: '8px 12px',
                  backgroundColor: 'var(--color-surface-container-high)',
                  borderRadius: 8,
                  fontSize: 12, color: 'var(--color-secondary)'
                }}>
                  {form.permissions.length} permiso{form.permissions.length !== 1 ? 's' : ''} seleccionado{form.permissions.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : user ? 'Actualizar' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function UsersPage(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const confirm = useAppStore((state) => state.confirm)
  const [users, setUsers] = useState<User[]>([])
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [tab, setTab] = useState<'users' | 'logs'>('users')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [logPage, setLogPage] = useState(1)
  const [logTotalPages, setLogTotalPages] = useState(1)
  const [pageSize] = useState(50)

  const loadUsers = async () => {
    const result = await window.electronAPI.user.getAll({ page, pageSize })
    if (result.success && result.data) {
      setUsers(result.data.data)
      setTotalPages(result.data.totalPages)
    }
  }

  const loadLogs = async () => {
    const result = await window.electronAPI.user.getChangeLogs({ page: logPage, pageSize })
    if (result.success && result.data) {
      setChangeLogs(result.data.data)
      setLogTotalPages(result.data.totalPages)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [page])

  useEffect(() => {
    loadLogs()
  }, [logPage])

  useEffect(() => {
    loadUsers()
    loadLogs()
  }, [])

  const handleDelete = async (user: User) => {
    const ok = await confirm({
      title: 'Eliminar Usuario',
      message: `¿Está seguro de eliminar a "${user.fullName}"?`,
      variant: 'danger',
      confirmLabel: 'Eliminar'
    })
    if (!ok) return
    const result = await window.electronAPI.user.delete(user.id)
    if (result.success) {
      showToast('success', 'Usuario eliminado')
      loadUsers()
    } else {
      showToast('error', result.error || 'Error al eliminar')
    }
  }

  const actionLabels: Record<string, string> = {
    create: 'Creación',
    update: 'Actualización',
    delete: 'Eliminación'
  }

  const tableLabels: Record<string, string> = {
    clients: 'Clientes',
    users: 'Usuarios',
    membership_plans: 'Planes',
    promotions: 'Promociones',
    memberships: 'Membresías'
  }

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2>Gestión de Usuarios</h2>
        <button className="btn btn-primary" style={{ marginTop: 12, paddingBottom: 12 }} onClick={() => { setEditingUser(null); setShowForm(true) }}>
          <Icons.Plus /> Nuevo Usuario
        </button>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
        <button className={`btn ${tab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '8px 0 0 8px' }}
          onClick={() => setTab('users')}>Usuarios</button>
        <button className={`btn ${tab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '0 8px 8px 0' }}
          onClick={() => { setTab('logs'); setLogPage(1); loadLogs() }}>Historial de Cambios</button>
      </div>

      {tab === 'users' && (
        <>
          <div className="search-box" style={{ marginBottom: 16 }}>
            <Icons.Search />
            <input type="text" placeholder="Buscar usuario por nombre o username..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="card">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Último Acceso</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => !search || u.fullName.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase())).map(user => (
                    <tr key={user.id}>
                    <td style={{ fontFamily: 'monospace' }}>{user.username}</td>
                    <td>{user.fullName}</td>
                    <td>
                      <span className="badge" style={{
                        background: roleColors[user.role] + '22',
                        color: roleColors[user.role],
                        border: `1px solid ${roleColors[user.role]}44`
                      }}>
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td>
                      {user.isActive
                        ? <span className="badge badge-success">Activo</span>
                        : <span className="badge badge-error">Inactivo</span>}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
                      {user.lastLogin ? format(parseISO(user.lastLogin), 'dd/MM/yyyy HH:mm') : 'Nunca'}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-sm btn-secondary"
                          onClick={() => { setEditingUser(user); setShowForm(true) }}
                          title="Editar">
                          <Icons.Edit />
                        </button>
                        {user.id !== 'user_admin' && (
                          <button className="btn btn-sm btn-secondary"
                            style={{ color: 'var(--color-error)' }}
                            onClick={() => handleDelete(user)}
                            title="Eliminar">
                            <Icons.Trash />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} size="sm" />
        </div>
      </>
      )}

      {tab === 'logs' && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Tabla</th>
                  <th>Acción</th>
                  <th>ID Registro</th>
                </tr>
              </thead>
              <tbody>
                {changeLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: 13 }}>{format(parseISO(log.timestamp), 'dd/MM/yyyy HH:mm')}</td>
                    <td>{log.userName}</td>
                    <td>{tableLabels[log.tableName] || log.tableName}</td>
                    <td>
                      <span className={`badge ${log.action === 'create' ? 'badge-success' : log.action === 'delete' ? 'badge-error' : 'badge-default'}`}>
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-secondary)' }}>
                      {log.recordId ? log.recordId.substring(0, 12) + '...' : '-'}
                    </td>
                  </tr>
                ))}
                {changeLogs.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-secondary)', padding: 24 }}>
                    No hay cambios registrados aún
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={logPage} totalPages={logTotalPages} onPageChange={setLogPage} size="sm" />
        </div>
      )}

      {showForm && (
        <UserForm
          user={editingUser}
          onClose={() => { setShowForm(false); setEditingUser(null) }}
          onSave={() => { setShowForm(false); setEditingUser(null); loadUsers(); setLogPage(1); loadLogs() }}
        />
      )}
    </div>
  )
}
