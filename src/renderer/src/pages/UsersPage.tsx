import { useEffect, useState } from 'react'
import { useFormSaved } from '@/hooks/useFormSaved'
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

export function UsersPage(): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)
  const confirm = useAppStore((state) => state.confirm)
  const [users, setUsers] = useState<User[]>([])
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([])
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

  // Recargar listas cuando el formulario de usuario guarda en su propia ventana
  useFormSaved('user', (message) => {
    if (message) showToast('success', message)
    loadUsers()
    setLogPage(1)
    loadLogs()
  })

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
        <button className="btn btn-primary" style={{ marginTop: 12, paddingBottom: 12 }} onClick={() => window.electronAPI.window.openForm('user')}>
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
                          onClick={() => window.electronAPI.window.openForm('user', { id: user.id })}
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
    </div>
  )
}
