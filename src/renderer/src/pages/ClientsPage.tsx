import { useEffect, useState, useCallback, useRef } from 'react'
import { useFormSaved } from '@/hooks/useFormSaved'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { Pagination } from '@/components/Pagination'
import { FreezeHistoryModal } from '@/components/modals/FreezeHistoryModal'
import { PaymentHistoryModal } from '@/components/modals/PaymentHistoryModal'
import { RoutinesModal } from '@/components/modals/RoutinesModal'
import { Client, ClientStatus, Membership, ClientDebt } from '../../../shared/types'
import { formatCurrency } from '@/utils/format'
import { format, parseISO, differenceInDays } from 'date-fns'

function PulseDot() {
  return (
    <span
      className="pulse-dot"
      style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block', flexShrink: 0 }}
    />
  )
}

const statusBadge = (status: ClientStatus) => {
  switch (status) {
    case 'active':
      return (
        <span className="status-badge status-badge-success">
          <PulseDot />
          Activo
        </span>
      )
    case 'expired':
      return (
        <span className="status-badge status-badge-error">
          <PulseDot />
          Vencido
        </span>
      )
    case 'inactive':
      return (
        <span className="status-badge status-badge-info">
          <PulseDot />
          Inactivo
        </span>
      )
    case 'suspended':
      return (
        <span className="status-badge status-badge-warning">
          <PulseDot />
          Suspendido
        </span>
      )
  }
}

function getMembershipStatusBadge(membership: Membership) {
  if (membership.status === 'frozen') {
    return (
      <span className="status-badge status-badge-warning">
        <PulseDot />
        Congelado
      </span>
    )
  }

  const now = new Date()
  const endDate = parseISO(membership.endDate)
  const daysLeft = differenceInDays(endDate, now)

  if (membership.status === 'expired' || daysLeft < 0) {
    return (
      <span className="status-badge status-badge-error">
        <PulseDot />
        Vencido
      </span>
    )
  }
  if (daysLeft <= 7) {
    return (
      <span className="status-badge status-badge-warning">
        <PulseDot />
        Por vencer ({daysLeft}d)
      </span>
    )
  }
  return (
    <span className="status-badge status-badge-success">
      <PulseDot />
      Activo ({daysLeft}d)
    </span>
  )
}

export function ClientsPage(): JSX.Element {
  const { clients, setClients, removeClient, plans, setPlans, showToast, confirm } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<ClientStatus | 'all'>('all')
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
  const [clientMemberships, setClientMemberships] = useState<Membership[]>([])
  const [clientDebts, setClientDebts] = useState<ClientDebt[]>([])

  const [showFreezeHistoryModal, setShowFreezeHistoryModal] = useState(false)
  const [selectedMembershipForHistory, setSelectedMembershipForHistory] = useState<string | null>(null)
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false)
  const [selectedMembershipForPayments, setSelectedMembershipForPayments] = useState<string | null>(null)
  const [showRoutinesModal, setShowRoutinesModal] = useState(false)
  const [routineClient, setRoutineClient] = useState<Client | null>(null)

  const loadClients = useCallback(async () => {
    const statusParam = filterStatus === 'all' ? undefined : filterStatus
    const result = await window.electronAPI.client.getAll({ status: statusParam, page, pageSize, sortBy })
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
    } catch (e) { console.error('Error loading debtors:', e) }
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

  // Ref para refrescar el detalle del cliente seleccionado tras guardar
  const selectedClientRef = useRef(selectedClient)
  useEffect(() => {
    selectedClientRef.current = selectedClient
  }, [selectedClient])

  // Recargar cuando las acciones (renovar/congelar/abono) guardan en su propia ventana
  const handleFormSaved = (message?: string) => {
    if (message) showToast('success', message)
    loadClients()
    loadDebtors()
    const sel = selectedClientRef.current
    if (sel) handleClientSelect(sel)
  }
  useFormSaved('renew', handleFormSaved)
  useFormSaved('freeze', handleFormSaved)
  useFormSaved('abono', handleFormSaved)

  const handleClientSelect = async (client: Client) => {
    setSelectedClient(client)
    const result = await window.electronAPI.membership.getByClient(client.id)
    if (result.success && result.data) {
      setClientMemberships(result.data)
    }
    const debtResult = await window.electronAPI.client.getDebt(client.id)
    if (debtResult.success && debtResult.data) {
      setClientDebts(debtResult.data)
    }
  }

  // const refreshSelectedClient = async () => {
  //   if (selectedClient) {
  //     await handleClientSelect(selectedClient)
  //   }
  // }

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
    const ok = await confirm({ title: 'Eliminar cliente', message: '¿Está seguro de eliminar este cliente?', variant: 'danger', confirmLabel: 'Eliminar' })
    if (!ok) return
    await window.electronAPI.client.delete(id)
    removeClient(id)
    if (selectedClient?.id === id) {
      setSelectedClient(null)
      setClientMemberships([])
      setClientDebts([])
    }
    loadClients()
  }

  const handleRenew = (client: Client) => {
    setSelectedClient(client)
    window.electronAPI.window.openForm('renew', { clientId: client.id })
  }

  const handleFreezeClick = (membership: Membership) => {
    window.electronAPI.window.openForm('freeze', {
      membershipId: membership.id,
      clientId: selectedClient?.id || ''
    })
  }

  const handleUnfreeze = async (membershipId: string) => {
    const result = await window.electronAPI.membership.unfreeze(membershipId)
    if (result.success && result.data) {
      showToast('success', 'Membresía descongelada. La fecha de vencimiento ha sido extendida.', 'Listo')
      if (selectedClient) {
        handleClientSelect(selectedClient)
      }
    } else {
      showToast('error', result.error || 'No se pudo descongelar la membresía', 'Error')
    }
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
    setSortBy(prev => {
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

  const handleNewMembership = () => {
    if (selectedClient) handleRenew(selectedClient)
  }

  const activeMembership = selectedClient
    ? clientMemberships.find(m => m.status === 'active' || m.status === 'frozen') || null
    : null

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 className="headline-md">Directorio de Miembros</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={handleNewMembership}
            disabled={!selectedClient}
            title={selectedClient
              ? `Nueva membresía para ${selectedClient.fullName}`
              : 'Seleccione un cliente para crear una membresía'}
          >
            <Icons.Membership />
            Nueva Membresía
          </button>
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

        <button className="btn btn-secondary" onClick={handleExportCsv} title="Exportar CSV" style={{ flexShrink: 0 }}>
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
                      backgroundColor: selectedClient?.id === client.id
                        ? 'rgba(255, 107, 0, 0.08)'
                        : undefined
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
                            <img src={`data:image/jpeg;base64,${client.photo}`} alt={client.fullName} />
                          ) : (
                            client.fullName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="body-lg" style={{ fontWeight: 600 }}>{client.fullName}</div>
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
                          onClick={() => window.electronAPI.window.openForm('stats', { clientId: client.id })}
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

      {/* Membership Detail Panel */}
      {selectedClient && (
        <div className="bento-card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="avatar-initials" style={{ width: 40, height: 40, fontSize: 16 }}>
                {selectedClient.photo ? (
                  <img src={`data:image/jpeg;base64,${selectedClient.photo}`} alt={selectedClient.fullName} />
                ) : (
                  selectedClient.fullName.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{selectedClient.fullName}</h3>
                <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                  Código: {selectedClient.accessCode} {selectedClient.documentId ? `| Doc: ${selectedClient.documentId}` : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  const result = await window.electronAPI.whatsapp.sendExpiryReminderToClient(selectedClient.id)
                  if (result.success && result.data?.success) {
                    showToast('success', `Recordatorio enviado a ${result.data.message}`, 'Enviado')
                  } else {
                    showToast('warning', result.data?.message || 'No se pudo enviar recordatorio. Verifica que el cliente tenga membresía activa o vencida recientemente.', 'Info')
                  }
                }}
                title="Enviar recordatorio WhatsApp"
                style={{ minWidth: 36, minHeight: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icons.Bell />
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setRoutineClient(selectedClient)
                  setShowRoutinesModal(true)
                }}
                title="Editar rutina de entrenamiento"
                style={{ minWidth: 36, minHeight: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icons.Dumbbell />
              </button>
              {statusBadge(selectedClient.status)}
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {clientMemberships.length > 0 ? (
              <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Inicio</th>
                      <th>Vence</th>
                      <th>Estado</th>
                      <th>Saldo</th>
                      <th style={{ width: 200 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientMemberships.map(membership => {
                      const debt = clientDebts.find(d => d.membershipId === membership.id)
                      return (
                        <tr key={membership.id}>
                          <td style={{ fontWeight: 500 }}>{membership.planName}</td>
                          <td>{format(parseISO(membership.startDate), 'dd/MM/yyyy')}</td>
                          <td>{format(parseISO(membership.endDate), 'dd/MM/yyyy')}</td>
                          <td>{getMembershipStatusBadge(membership)}</td>
                          <td>
                            {debt && debt.balance > 0 ? (
                              <span className="status-badge status-badge-error">
                                <PulseDot />
                                ${debt.balance.toLocaleString('es-CO')}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-secondary)', fontSize: 12 }}>Al día</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              {!activeMembership && (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleRenew(selectedClient)}
                                  title="Nueva membresía"
                                >
                                  <Icons.Plus />
                                  Renovar
                                </button>
                              )}
                              {membership.status === 'active' && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleFreezeClick(membership)}
                                  title="Congelar membresía"
                                  style={{ minWidth: 36, minHeight: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Icons.Snowflake />
                                </button>
                              )}
                              {membership.status === 'frozen' && (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleUnfreeze(membership.id)}
                                  title="Descongelar membresía"
                                  style={{ minWidth: 36, minHeight: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Icons.Play />
                                </button>
                              )}
                              {debt && debt.balance > 0 && (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => window.electronAPI.window.openForm('abono', {
                                    clientId: selectedClient.id,
                                    membershipId: membership.id
                                  })}
                                  title="Registrar abono"
                                  style={{ minWidth: 36, minHeight: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Icons.Plus />
                                </button>
                              )}
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setSelectedMembershipForPayments(membership.id)
                                  setShowPaymentHistoryModal(true)
                                }}
                                title="Ver pagos"
                                style={{ minWidth: 36, minHeight: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <Icons.Search />
                              </button>
                              {(membership.status === 'frozen') && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    setSelectedMembershipForHistory(membership.id)
                                    setShowFreezeHistoryModal(true)
                                  }}
                                  title="Historial de congelaciones"
                                  style={{ minWidth: 36, minHeight: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Icons.Clock />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-state-icon">
                  <Icons.Membership />
                </div>
                <p>Este cliente no tiene membresías registradas</p>
                <button
                  className="btn btn-primary"
                  onClick={() => handleRenew(selectedClient)}
                  style={{ marginTop: 8 }}
                >
                  <Icons.Plus />
                  Crear Membresía
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plans Display */}
      {plans.length > 0 && (
        <div className="bento-card">
          <div className="card-header">
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Planes Disponibles</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-4" style={{ gap: 20 }}>
              {plans.map(plan => (
                <div key={plan.id} className="metric-card" style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontWeight: 600 }}>{plan.name}</h4>
                    <span className="chip">{plan.durationDays}d</span>
                  </div>
                  <div className="metric-card-value">
                    {formatCurrency(plan.price)}
                  </div>
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
      {showFreezeHistoryModal && selectedMembershipForHistory && (
        <FreezeHistoryModal
          membershipId={selectedMembershipForHistory}
          onClose={() => {
            setShowFreezeHistoryModal(false)
            setSelectedMembershipForHistory(null)
          }}
        />
      )}

      {showPaymentHistoryModal && selectedMembershipForPayments && (
        <PaymentHistoryModal
          membershipId={selectedMembershipForPayments}
          onClose={() => {
            setShowPaymentHistoryModal(false)
            setSelectedMembershipForPayments(null)
          }}
        />
      )}

      {showRoutinesModal && routineClient && (
        <RoutinesModal
          client={routineClient}
          onClose={() => {
            setShowRoutinesModal(false)
            setRoutineClient(null)
          }}
        />
      )}
    </div>
  )
}
