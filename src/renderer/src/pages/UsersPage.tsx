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

const actionLabels: Record<string, string> = {
  create: 'Creación',
  update: 'Actualización',
  delete: 'Eliminación'
}

const tableLabels: Record<string, string> = {
  clients: 'Clientes',
  users: 'Usuarios',
  memberships: 'Membresías',
  membership_plans: 'Planes',
  promotions: 'Promociones'
}

const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  fullName: 'Nombre',
  username: 'Usuario',
  role: 'Rol',
  permissions: 'Permisos',
  isActive: 'Activo',
  lastLogin: 'Último acceso',
  status: 'Estado',
  clientId: 'Cliente',
  planId: 'Plan',
  planName: 'Plan',
  startDate: 'Inicio',
  endDate: 'Fin',
  amount: 'Valor',
  method: 'Método',
  discount: 'Descuento',
  notes: 'Notas',
  reason: 'Motivo',
  plannedDays: 'Días planeados',
  documentId: 'Documento',
  phone: 'Teléfono',
  email: 'Email',
  address: 'Dirección',
  accessCode: 'Código de acceso',
  birthDate: 'Fecha nacimiento',
  gender: 'Género',
  price: 'Precio',
  durationDays: 'Duración (días)',
  type: 'Tipo',
  description: 'Descripción'
}

function labelFor(field: string): string {
  return FIELD_LABELS[field] || field
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  const s = String(value)
  // Fechas ISO → formato legible
  if (/^\d{4}-\d{2}-\d{2}T\d{2}/.test(s)) {
    try { return format(parseISO(s), 'dd/MM/yyyy HH:mm') } catch { /* no es fecha */ }
  }
  return s
}

function parseSnapshot(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
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
  const [logAction, setLogAction] = useState('')
  const [logSearch, setLogSearch] = useState('')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const loadUsers = async () => {
    const result = await window.electronAPI.user.getAll({ page, pageSize })
    if (result.success && result.data) {
      setUsers(result.data.data)
      setTotalPages(result.data.totalPages)
    }
  }

  const loadLogs = async () => {
    const result = await window.electronAPI.user.getChangeLogs({
      page: logPage,
      pageSize,
      action: logAction || undefined
    })
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
  }, [logPage, logAction])

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
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '16px 16px 0' }}>
            <select
              className="form-select"
              style={{ maxWidth: 180 }}
              value={logAction}
              onChange={(e) => setLogAction(e.target.value)}
            >
              <option value="">Todas las acciones</option>
              <option value="create">Creación</option>
              <option value="update">Actualización</option>
              <option value="delete">Eliminación</option>
            </select>
            <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
              <Icons.Search />
              <input
                type="text"
                placeholder="Buscar por usuario..."
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Tabla</th>
                  <th>Acción</th>
                  <th>ID Registro</th>
                </tr>
              </thead>
              <tbody>
                {changeLogs
                  .filter(l => !logSearch || (l.userName || '').toLowerCase().includes(logSearch.toLowerCase()))
                  .map(log => {
                    const expanded = expandedLogId === log.id
                    return (
                      <LogRow
                        key={log.id}
                        log={log}
                        expanded={expanded}
                        onToggle={() => setExpandedLogId(expanded ? null : log.id)}
                      />
                    )
                  })}
                {changeLogs.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-secondary)', padding: 24 }}>
                    No hay cambios registrados aún
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={logPage} totalPages={logTotalPages} onPageChange={(p) => { setExpandedLogId(null); setLogPage(p) }} size="sm" />
        </div>
      )}
    </div>
  )
}

interface LogRowProps {
  log: ChangeLog
  expanded: boolean
  onToggle: () => void
}

function LogRow({ log, expanded, onToggle }: LogRowProps): JSX.Element {
  const before = parseSnapshot(log.oldValues)
  const after = parseSnapshot(log.newValues)

  let rows: Array<{ field: string; from?: unknown; to?: unknown }> = []
  if (log.action === 'update' && before && after) {
    rows = [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter(k => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null))
      .map(k => ({ field: k, from: before[k], to: after[k] }))
  } else if (log.action === 'create' && after) {
    rows = Object.entries(after).map(([field, to]) => ({ field, to }))
  } else if (log.action === 'delete' && before) {
    rows = Object.entries(before).map(([field, from]) => ({ field, from }))
  }

  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td>
          <span
            style={{
              display: 'inline-block',
              transition: 'transform 0.15s',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              color: 'var(--color-secondary)'
            }}
          >
            <Icons.ChevronRight />
          </span>
        </td>
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
      {expanded && (
        <tr>
          <td colSpan={6} style={{ backgroundColor: 'var(--color-surface-container-low)', padding: '16px 24px' }}>
            {rows.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-secondary)' }}>Sin detalle disponible</p>
            ) : (
              <div>
                <p className="label-md" style={{ margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11 }}>
                  {log.action === 'create' ? 'Datos creados' : log.action === 'delete' ? 'Datos eliminados' : 'Cambios realizados'}
                </p>
                <table style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '4px 12px 4px 0', color: 'var(--color-secondary)', fontWeight: 600 }}>Campo</th>
                      {log.action === 'update' && <th style={{ textAlign: 'left', padding: '4px 12px', color: 'var(--color-secondary)', fontWeight: 600 }}>Antes</th>}
                      <th style={{ textAlign: 'left', padding: '4px 0 4px 12px', color: 'var(--color-secondary)', fontWeight: 600 }}>
                        {log.action === 'update' ? 'Después' : 'Valor'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.field}>
                        <td style={{ padding: '3px 12px 3px 0', fontWeight: 500 }}>{labelFor(r.field)}</td>
                        {log.action === 'update' && (
                          <td style={{ padding: '3px 12px', color: 'var(--color-error)' }}>{formatValue(r.from)}</td>
                        )}
                        <td style={{ padding: '3px 0 3px 12px', color: log.action === 'update' ? 'var(--color-success)' : undefined }}>
                          {formatValue(log.action === 'update' ? r.to : (r.to ?? r.from))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
