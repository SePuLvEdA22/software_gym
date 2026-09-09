import { useEffect, useState, useCallback } from 'react'
import { useFormSaved } from '@/hooks/useFormSaved'
import { usePersistentState } from '@/hooks/usePersistentState'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { Pagination } from '@/components/Pagination'
import { ClientMembershipsModal } from '@/components/modals/ClientMembershipsModal'
import { PulseDot, statusBadge } from '@/components/StatusBadges'
import { Client, ClientStatus } from '../../../shared/types'
import { formatCurrency } from '@/utils/format'

export function ClientsPage(): JSX.Element {
  const { clients, setClients, removeClient, plans, setPlans, showToast, confirm } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = usePersistentState<ClientStatus | 'all'>(
    'bodyfitgym-clients-status',
    'all',
  )
  // 'recent' ordena por fecha de registro DESC: los clientes recién creados salen de primero.
  // Se persiste en localStorage (igual que el tema) para que sobreviva al cierre/reinicio.
  const [sortBy, setSortBy] = useState<'name' | 'recent'>(() => {
    try {
      return localStorage.getItem('bodyfitgym-clients-sort') === 'recent' ? 'recent' : 'name'
    } catch {
      return 'name'
    }
  })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pageSize] = useState(50)
  const [debtorsMap, setDebtorsMap] = useState<{ [clientId: string]: number }>({})

  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showMembershipsModal, setShowMembershipsModal] = useState(false)

  const loadClients = useCallback(async () => {
    const statusParam = filterStatus === 'all' ? undefined : filterStatus
    const result = await window.electronAPI.client.getAll({
      status: statusParam,
      page,
      pageSize,
      sortBy,
    })
    if (result.success && result.data) {
      setClients(result.data.data)
      setTotalPages(result.data.totalPages)
    }
  }, [filterStatus, page, pageSize, sortBy, setClients])

  const loadDebtors = useCallback(async () => {
    try {
      const result = await window.electronAPI.client.getDebtors()
      if (result.success && result.data) {
        const map: { [clientId: string]: number } = {}
        for (const d of result.data) {
          map[d.clientId] = d.balance
        }
        setDebtorsMap(map)
      }
    } catch (e) {
      console.error('Error loading debtors:', e)
    }
  }, [])

  const loadPlans = useCallback(async () => {
    const result = await window.electronAPI.plans.getAll()
    if (result.success && result.data) {
      setPlans(result.data)
    }
  }, [setPlans])

  useEffect(() => {
    loadClients()
    loadDebtors()
  }, [loadClients, loadDebtors])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  // Handle client renew from URL params (kiosk redirect)
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const clientId = searchParams.get('clientId')
    const action = searchParams.get('action')

    if (clientId && action === 'renew') {
      // Clear URL params immediately to prevent re-trigger
      setSearchParams({}, { replace: true })
      window.electronAPI.window.openForm('renew', { clientId })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const unsubscribe = window.electronAPI.clientForm.onSaved(() => {
      loadClients()
      loadDebtors()
      loadPlans()
    })
    return unsubscribe
  }, [loadClients, loadDebtors, loadPlans])

  // Recargar cuando las acciones (renovar/congelar/abono) guardan en su propia ventana
  const handleFormSaved = (message?: string) => {
    if (message) showToast('success', message)
    loadClients()
    loadDebtors()
  }
  useFormSaved('renew', handleFormSaved)
  useFormSaved('freeze', handleFormSaved)
  useFormSaved('abono', handleFormSaved)
  useFormSaved('editMembership', handleFormSaved)

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client)
    setShowMembershipsModal(true)
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

  const handleEdit = (client: Client) => {
    window.electronAPI.window.openClientForm(client.id)
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Eliminar cliente',
      message: '¿Está seguro de eliminar este cliente?',
      variant: 'danger',
      confirmLabel: 'Eliminar',
    })
    if (!ok) return
    await window.electronAPI.client.delete(id)
    removeClient(id)
    if (selectedClient?.id === id) {
      setSelectedClient(null)
      setShowMembershipsModal(false)
    }
    loadClients()
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }

  const handleExportCsv = async () => {
    if (window.electronAPI?.system?.exportCsv) {
      const result = await window.electronAPI.system.exportCsv('clients')
      if (result.success) showToast('success', `Exportado: ${result.data}`, 'Exportado')
    }
  }

  const handleFilterChange = (status: ClientStatus | 'all') => {
    setFilterStatus(status)
    setPage(1)
  }

  const handleSortToggle = () => {
    setSortBy((prev) => {
      const next = prev === 'recent' ? 'name' : 'recent'
      try {
        localStorage.setItem('bodyfitgym-clients-sort', next)
      } catch {
        /* storage no disponible: solo afecta a la sesión actual */
      }
      return next
    })
    setPage(1)
  }

  const filterPills: { label: string; value: ClientStatus | 'all' }[] = [
    { label: 'Todos', value: 'all' },
    { label: 'Activos', value: 'active' },
    { label: 'Vencidos', value: 'expired' },
    { label: 'Inactivos', value: 'inactive' },
    { label: 'Suspendidos', value: 'suspended' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
      >
        <h1 className="headline-md">Directorio de Miembros</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={handleNewClient}>
            <Icons.Plus />
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div
        className="glass-panel"
        style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div className="search-box" style={{ flex: 1, minWidth: 200, maxWidth: 400 }}>
          <Icons.Search />
          <input
            type="text"
            placeholder="Buscar por nombre, documento o código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {filterPills.map((pill) => (
            <button
              key={pill.value}
              className={`filter-pill${filterStatus === pill.value ? ' active' : ''}`}
              onClick={() => handleFilterChange(pill.value)}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Separador visual + orden por recientes (independiente de los filtros de estado) */}
        <div style={{ width: 1, height: 24, backgroundColor: 'var(--color-outline-variant)' }} />
        <button
          className={`filter-pill${sortBy === 'recent' ? ' active' : ''}`}
          onClick={handleSortToggle}
          title="Ordenar por fecha de registro: los clientes recién creados salen de primero"
        >
          <Icons.Clock />
          Recientes
        </button>

        <button className="btn btn-secondary" onClick={handleSearch} style={{ flexShrink: 0 }}>
          <Icons.Search />
          Buscar
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleExportCsv}
          title="Exportar CSV"
          style={{ flexShrink: 0 }}
        >
          <Icons.Download />
        </button>
      </div>

      {/* Client Table */}
      <div className="bento-card" style={{ padding: 0, overflow: 'hidden' }}>
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
                  <th>Miembro</th>
                  <th>Documento</th>
                  <th>Código</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => handleClientSelect(client)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor:
                        selectedClient?.id === client.id ? 'rgba(255, 107, 0, 0.08)' : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (selectedClient?.id !== client.id) {
                        e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedClient?.id !== client.id) {
                        e.currentTarget.style.backgroundColor = ''
                      }
                    }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="avatar-initials">
                          {client.photo ? (
                            <img
                              src={`data:image/jpeg;base64,${client.photo}`}
                              alt={client.fullName}
                            />
                          ) : (
                            client.fullName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="body-lg" style={{ fontWeight: 600 }}>
                            {client.fullName}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                            {client.email || 'Sin correo'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{client.documentId || '-'}</td>
                    <td>
                      <span className="chip">{client.accessCode}</span>
                    </td>
                    <td>{client.phone || '-'}</td>
                    <td>
                      {statusBadge(client.status)}
                      {debtorsMap[client.id] && (
                        <span className="status-badge status-badge-error" style={{ marginLeft: 8 }}>
                          <PulseDot />
                          Deuda: {formatCurrency(debtorsMap[client.id])}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="icon-btn"
                          onClick={() =>
                            window.electronAPI.window.openForm('stats', { clientId: client.id })
                          }
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

      {/* Plans Display */}
      {plans.length > 0 && (
        <div className="bento-card">
          <div className="card-header">
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Planes Disponibles</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-4" style={{ gap: 20 }}>
              {plans.map((plan) => (
                <div key={plan.id} className="metric-card" style={{ cursor: 'pointer' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <h4 style={{ fontWeight: 600 }}>{plan.name}</h4>
                    <span className="chip">{plan.durationDays}d</span>
                  </div>
                  <div className="metric-card-value">{formatCurrency(plan.price)}</div>
                  <div className="metric-card-label" style={{ marginBottom: 0 }}>
                    {plan.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showMembershipsModal && selectedClient && (
        <ClientMembershipsModal
          client={selectedClient}
          onClose={() => setShowMembershipsModal(false)}
        />
      )}
    </div>
  )
}
