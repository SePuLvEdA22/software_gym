import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { Pagination } from '@/components/Pagination'
import { Client, ClientStatus, ClientAttendanceStats as ClientAttendanceStatsType } from '../../../shared/types'
import { formatCurrency } from '@/utils/format'
import { format, parseISO } from 'date-fns'

const statusBadge = (status: ClientStatus) => {
  switch (status) {
    case 'active':
      return <span className="badge badge-success">Activo</span>
    case 'expired':
      return <span className="badge badge-error">Vencido</span>
    case 'inactive':
      return <span className="badge badge-default">Inactivo</span>
    case 'suspended':
      return <span className="badge badge-warning">Suspendido</span>
  }
}

function AttendanceStatsModal({ client, onClose }: { client: Client; onClose: () => void }): JSX.Element {
  const [stats, setStats] = useState<ClientAttendanceStatsType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    const result = await window.electronAPI.client.getAttendanceStats(client.id)
    if (result.success && result.data) {
      setStats(result.data)
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 450 }}>
        <div className="modal-header">
          <h2 className="modal-title">Estadísticas de Asistencia</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <Icons.Close />
          </button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div className="avatar" style={{ width: 48, height: 48 }}>
              {client.photo ? (
                <img src={`data:image/jpeg;base64,${client.photo}`} alt={client.fullName} />
              ) : (
                client.fullName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{client.fullName}</div>
              <div style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
                Código: {client.accessCode}
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-secondary)' }}>
              Cargando estadísticas...
            </div>
          ) : stats ? (
            <div className="grid grid-2" style={{ gap: 16 }}>
              <div className="kpi-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 4 }}>Visitas Totales</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary-container)' }}>
                  {stats.totalVisits}
                </div>
              </div>
              <div className="kpi-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 4 }}>Visitas este Mes</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-success)' }}>
                  {stats.daysAttendedThisMonth}
                </div>
              </div>
              <div className="kpi-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 4 }}>Primera Visita</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {stats.firstVisit ? format(parseISO(stats.firstVisit), 'dd/MM/yyyy') : 'Sin visitas'}
                </div>
              </div>
              <div className="kpi-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 4 }}>Última Visita</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {stats.lastVisit ? format(parseISO(stats.lastVisit), 'dd/MM/yyyy') : 'Sin visitas'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-secondary)' }}>
              No se pudieron cargar las estadísticas
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

export function ClientsPage(): JSX.Element {
  const { clients, setClients, removeClient, triggerNewClientModal, setTriggerNewClientModal, showToast, confirm } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<ClientStatus | 'all'>('all')
  const [debtorsMap, setDebtorsMap] = useState<{ [clientId: string]: number }>({})
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [statsClient, setStatsClient] = useState<Client | null>(null)

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pageSize] = useState(50)

  const loadClients = async () => {
    const statusParam = filterStatus === 'all' ? undefined : filterStatus
    const result = await window.electronAPI.client.getAll({ status: statusParam, page, pageSize })
    if (result.success && result.data) {
      setClients(result.data.data)
      setTotalPages(result.data.totalPages)
    }
  }

  const loadDebtors = async () => {
    try {
      const result = await window.electronAPI.client.getDebtors()
      if (result.success && result.data) {
        const map: { [clientId: string]: number } = {}
        for (const d of result.data) {
          map[d.clientId] = d.balance
        }
        setDebtorsMap(map)
      }
    } catch (e) { console.error('Error loading debtors:', e) }
  }

  useEffect(() => {
    loadClients()
    loadDebtors()
  }, [page, filterStatus])

  useEffect(() => {
    if (triggerNewClientModal) {
      setTriggerNewClientModal(false)
      window.electronAPI.window.openClientForm()
    }
  }, [triggerNewClientModal, setTriggerNewClientModal])

  useEffect(() => {
    const unsubscribe = window.electronAPI.clientForm.onSaved(() => {
      loadClients()
      loadDebtors()
    })
    return unsubscribe
  }, [])

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: 'Eliminar cliente', message: '¿Está seguro de eliminar este cliente?', variant: 'danger', confirmLabel: 'Eliminar' })
    if (!ok) return
    await window.electronAPI.client.delete(id)
    removeClient(id)
    loadClients()
  }

  const handleEdit = (client: Client) => {
    window.electronAPI.window.openClientForm(client.id)
  }

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      const result = await window.electronAPI.client.search(searchQuery)
      if (result.success && result.data) {
        setClients(result.data)
      }
    } else {
      loadClients()
    }
  }

  const handleNewClient = () => {
    window.electronAPI.window.openClientForm()
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        gap: 16
      }}>
        <button className="btn btn-secondary" onClick={async () => {
          if (window.electronAPI?.system?.exportCsv) {
            const result = await window.electronAPI.system.exportCsv('clients')
            if (result.success) showToast('success', `Exportado: ${result.data}`, 'Exportado')
          }
        }} title="Exportar CSV">
          <Icons.Download />
        </button>
        <div style={{ display: 'flex', gap: 12, flex: 1 }}>
          <input 
            type="text" 
            className="search-input"
            placeholder="Buscar por nombre, documento o código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1, maxWidth: 400 }}
          />
          <select 
            className="form-select"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as ClientStatus | 'all')
              setPage(1)
            }}
            style={{ width: 150 }}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="expired">Vencidos</option>
            <option value="inactive">Inactivos</option>
            <option value="suspended">Suspendidos</option>
          </select>
          <button className="btn btn-secondary" onClick={handleSearch}>
            <Icons.Search />
            Buscar
          </button>
        </div>
        <button className="btn btn-primary" onClick={handleNewClient}>
          <Icons.Plus />
          Nuevo Cliente
        </button>
      </div>

      <div className="card" style={{ flex: 1 }}>
        {clients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Icons.Users />
            </div>
            <h3>No hay clientes registrados</h3>
            <p style={{ marginTop: 8, color: 'var(--color-secondary)' }}>
              Click en "Nuevo Cliente" para registrar el primero
            </p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Código</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="avatar">
                          {client.photo ? (
                            <img src={`data:image/jpeg;base64,${client.photo}`} alt={client.fullName} />
                          ) : (
                            client.fullName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{client.fullName}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                            {client.email || 'Sin correo'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{client.documentId || '-'}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      <span className="badge badge-default">{client.accessCode}</span>
                    </td>
                    <td>{client.phone || '-'}</td>
                    <td>
                      {statusBadge(client.status)}
                      {debtorsMap[client.id] && (
                        <span className="badge badge-error" style={{ marginLeft: 8 }}>
                          Deuda: {formatCurrency(debtorsMap[client.id])}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button 
                          className="icon-btn"
                          onClick={() => {
                            setStatsClient(client)
                            setShowStatsModal(true)
                          }}
                          title="Estadísticas"
                        >
                          <Icons.Clock />
                        </button>
                        <button 
                          className="icon-btn"
                          onClick={() => handleEdit(client)}
                          title="Editar"
                        >
                          <Icons.Edit />
                        </button>
                        <button 
                          className="icon-btn danger"
                          onClick={() => handleDelete(client.id)}
                          title="Eliminar"
                        >
                          <Icons.Trash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />

      {showStatsModal && statsClient && (
        <AttendanceStatsModal
          client={statsClient}
          onClose={() => {
            setShowStatsModal(false)
            setStatsClient(null)
          }}
        />
      )}
    </div>
  )
}
