import { useEffect, useState } from 'react'
import { useFormSaved } from '@/hooks/useFormSaved'
import { useAppStore } from '@/store/appStore'
import { User, UserRole, ChangeLog } from '../../../shared/types'
import { Icons } from '@/components/Icons'
import { Pagination } from '@/components/Pagination'
import { DatePicker, todayLocalKey } from '@/components/DatePicker'
import { format, parseISO, subDays } from 'date-fns'

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
  delete: 'Eliminación',
  login: 'Inicio de sesión'
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

function parseLocalKey(key: string): Date | null {
  if (!key) return null
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const [, y, mo, d] = m.map(Number)
  if (y < 1 || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return new Date(y, mo - 1, d)
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
  const [logFrom, setLogFrom] = useState('')
  const [logTo, setLogTo] = useState('')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const loadUsers = async () => {
    const result = await window.electronAPI.user.getAll({ page, pageSize })
    if (result.success && result.data) {
      setUsers(result.data.data)
      setTotalPages(result.data.totalPages)
    }
  }

  const loadLogs = async () => {
    const from = logFrom || undefined
    const to = logTo || undefined
    const result = await window.electronAPI.user.getChangeLogs({
      page: logPage,
      pageSize,
      action: logAction || undefined,
      from,
      to
    })
    if (result.success && result.data) {
      setChangeLogs(result.data.data)
      setLogTotalPages(result.data.totalPages)
    }
  }

  const handleLogFromChange = (value: string) => {
    setLogFrom(value)
    setLogPage(1)
  }
  const handleLogToChange = (value: string) => {
    setLogTo(value)
    setLogPage(1)
  }
  const handleDatePreset = (preset: 'today' | '7d' | '30d' | 'all') => {
    if (preset === 'all') {
      setLogFrom('')
      setLogTo('')
    } else if (preset === 'today') {
      const today = todayLocalKey()
      setLogFrom(today)
      setLogTo(today)
    } else if (preset === '7d') {
      const todayKey = todayLocalKey()
      const todayDate = parseLocalKey(todayKey)!
      const fromDate = subDays(todayDate, 6)
      const fromKey = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`
      setLogFrom(fromKey)
      setLogTo(todayKey)
    } else if (preset === '30d') {
      const todayKey = todayLocalKey()
      const todayDate = parseLocalKey(todayKey)!
      const fromDate = subDays(todayDate, 29)
      const fromKey = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`
      setLogFrom(fromKey)
      setLogTo(todayKey)
    }
    setLogPage(1)
  }
  const clearDateFilter = () => {
    setLogFrom('')
    setLogTo('')
    setLogPage(1)
  }

  const todayKeyForFilter = todayLocalKey()
  const sevenFromKey = (() => {
    const d = parseLocalKey(todayKeyForFilter)
    if (!d) return ''
    const f = subDays(d, 6)
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
  })()
  const thirtyFromKey = (() => {
    const d = parseLocalKey(todayKeyForFilter)
    if (!d) return ''
    const f = subDays(d, 29)
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
  })()
  const isAllActive = !logFrom && !logTo
  const isTodayActive = logFrom === todayKeyForFilter && logTo === todayKeyForFilter
  const is7dActive = logFrom === sevenFromKey && logTo === todayKeyForFilter
  const is30dActive = logFrom === thirtyFromKey && logTo === todayKeyForFilter

  useEffect(() => {
    loadUsers()
  }, [page])

  useEffect(() => {
    loadLogs()
  }, [logPage, logAction, logFrom, logTo])

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
          {/* Filtros historial — sección separada con liquid glass */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 14,
            margin: '16px 16px 20px',
            padding: 16,
            borderRadius: 12,
            background: 'color-mix(in srgb, var(--color-surface-container) 62%, transparent)',
            backdropFilter: 'blur(18px) saturate(1.35)',
            WebkitBackdropFilter: 'blur(18px) saturate(1.35)',
            border: '1px solid color-mix(in srgb, var(--color-outline-variant) 18%, transparent)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.06)'
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className="form-select"
                style={{ maxWidth: 180 }}
                value={logAction}
                onChange={(e) => { setLogAction(e.target.value); setLogPage(1) }}
              >
                <option value="">Todas las acciones</option>
                <option value="create">Creación</option>
                <option value="update">Actualización</option>
                <option value="delete">Eliminación</option>
                <option value="login">Inicio de sesión</option>
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
            {/* Filtro por días — presets + rango con DatePicker */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--color-secondary)', marginRight: 4, whiteSpace: 'nowrap' }}>Filtrar por días:</span>
                <button
                  className={`filter-pill${isAllActive ? ' active' : ''}`}
                  onClick={() => handleDatePreset('all')}
                  title="Mostrar todo el historial"
                >
                  Todos
                </button>
                <button
                  className={`filter-pill${isTodayActive ? ' active' : ''}`}
                  onClick={() => handleDatePreset('today')}
                >
                  Hoy
                </button>
                <button
                  className={`filter-pill${is7dActive ? ' active' : ''}`}
                  onClick={() => handleDatePreset('7d')}
                  title="Últimos 7 días incluyendo hoy"
                >
                  Últimos 7 días
                </button>
                <button
                  className={`filter-pill${is30dActive ? ' active' : ''}`}
                  onClick={() => handleDatePreset('30d')}
                  title="Últimos 30 días incluyendo hoy"
                >
                  Últimos 30 días
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flex: 1, minWidth: 280 }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <DatePicker value={logFrom} onChange={handleLogFromChange} placeholder="Desde" max={logTo || undefined} clearable />
                </div>
                <span style={{ color: 'var(--color-secondary)', fontSize: 14 }}>—</span>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <DatePicker value={logTo} onChange={handleLogToChange} placeholder="Hasta" min={logFrom || undefined} clearable />
                </div>
                {(logFrom || logTo) && (
                  <button className="btn btn-sm btn-secondary" onClick={clearDateFilter} title="Limpiar filtro de fechas">
                    <Icons.X /> Limpiar
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="table-container" style={{ margin: '0 16px 16px' }}>
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
  // Contexto humano de la fila: dueño de la membresía cuando aplica
  const contextClient = ((after?.clientName ?? before?.clientName) as string | undefined) || null

  let rows: Array<{ field: string; from?: unknown; to?: unknown }> = []
  if (log.action === 'update' && before && after) {
    rows = [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter(k => k !== 'clientName')
      .filter(k => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null))
      .map(k => ({ field: k, from: before[k], to: after[k] }))
  } else if ((log.action === 'create' || log.action === 'login') && after) {
    rows = Object.entries(after).filter(([k]) => k !== 'clientName').map(([field, to]) => ({ field, to }))
  } else if (log.action === 'delete' && before) {
    rows = Object.entries(before).filter(([k]) => k !== 'clientName').map(([field, from]) => ({ field, from }))
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
          <span className={`badge ${log.action === 'create' ? 'badge-success' : log.action === 'delete' ? 'badge-error' : log.action === 'login' ? 'badge-info' : 'badge-default'}`}>
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
            {contextClient && (
              <p style={{ margin: '0 0 10px', fontSize: 13 }}>
                <strong>Cliente:</strong> {contextClient}
              </p>
            )}
            {rows.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-secondary)' }}>Sin detalle disponible</p>
            ) : (
              <div>
                <p className="label-md" style={{ margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11 }}>
                  {log.action === 'create' ? 'Datos creados'
                    : log.action === 'delete' ? 'Datos eliminados'
                    : log.action === 'login' ? 'Registro de acceso'
                    : 'Cambios realizados'}
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
