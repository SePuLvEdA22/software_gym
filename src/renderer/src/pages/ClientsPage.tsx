import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { Client, Gender, ClientStatus, EmergencyContact, ClientAttendanceStats as ClientAttendanceStatsType } from '../../../shared/types'
import { format, parseISO } from 'date-fns'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(value)
}

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

interface ClientFormProps {
  client?: Client | null
  onClose: () => void
  onSave: (client: Omit<Client, 'id' | 'registrationDate'>) => void
}

function ClientForm({ client, onClose, onSave }: ClientFormProps): JSX.Element {
  const [formData, setFormData] = useState({
    fullName: client?.fullName || '',
    documentId: client?.documentId || '',
    birthDate: client?.birthDate ? format(parseISO(client.birthDate), 'yyyy-MM-dd') : '',
    gender: (client?.gender || 'not_specified') as Gender,
    phone: client?.phone || '',
    email: client?.email || '',
    address: client?.address || '',
    photo: client?.photo || null,
    accessCode: client?.accessCode || '',
    status: (client?.status || 'inactive') as ClientStatus,
    emergencyContact: {
      name: client?.emergencyContact.name || '',
      phone: client?.emergencyContact.phone || '',
      relationship: client?.emergencyContact.relationship || '',
      notes: client?.emergencyContact.notes || ''
    }
  })

  const generateCode = async () => {
    const result = await window.electronAPI.client.generateCode()
    if (result.success && result.data) {
      const newCode = result.data as string
      setFormData(prev => ({ ...prev, accessCode: newCode }))
    }
  }

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

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    
    const submitData: Omit<Client, 'id' | 'registrationDate'> = {
      ...formData,
      birthDate: formData.birthDate ? parseISO(formData.birthDate).toISOString() : new Date().toISOString()
    }
    
    onSave(submitData)
  }

  const updateEmergencyContact = (field: keyof EmergencyContact, value: string) => {
    setFormData(prev => ({
      ...prev,
      emergencyContact: { ...prev.emergencyContact, [field]: value }
    }))
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2 className="modal-title">{client ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
            <button type="button" className="modal-close" onClick={onClose}>
              <Icons.Close />
            </button>
          </div>
          
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28, marginBottom: 28 }}>
              <div>
                <div 
                  className="photo-upload" 
                  onClick={() => document.getElementById('photo-upload')?.click()}
                >
                  {formData.photo ? (
                    <img src={`data:image/jpeg;base64,${formData.photo}`} alt="Client" />
                  ) : (
                    <div className="photo-upload-placeholder">
                      <Icons.Camera />
                      <span>Click para agregar foto</span>
                    </div>
                  )}
                </div>
                <input 
                  id="photo-upload" 
                  type="file" 
                  accept="image/*" 
                  style={{ display: 'none' }}
                  onChange={handlePhotoChange}
                />
              </div>
              
              <div style={{ flex: 1 }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nombre Completo *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formData.fullName}
                      onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                      required
                      placeholder="Ingrese nombre completo"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Documento de Identidad</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formData.documentId}
                      onChange={(e) => setFormData(prev => ({ ...prev, documentId: e.target.value }))}
                      placeholder="Número de documento"
                    />
                  </div>
                </div>
                
                <div className="form-row">
                   <div className="form-group">
                    <label className="form-label">Código de Acceso (1-20 dígitos)</label>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={formData.accessCode}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 20)
                          setFormData(prev => ({ ...prev, accessCode: value }))
                        }}
                        placeholder="Ingrese código numérico"
                        maxLength={20}
                        style={{ fontFamily: 'monospace' }}
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={generateCode}
                        title="Generar código aleatorio de 6 dígitos"
                      >
                        <Icons.Refresh />
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select 
                      className="form-select"
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as ClientStatus }))}
                    >
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                      <option value="suspended">Suspendido</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="divider" />
            
            <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 600 }}>Información Personal</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha de Nacimiento</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={formData.birthDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Género</label>
                <select 
                  className="form-select"
                  value={formData.gender}
                  onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as Gender }))}
                >
                  <option value="not_specified">No especificado</option>
                  <option value="male">Masculino</option>
                  <option value="female">Femenino</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input 
                  type="tel" 
                  className={`form-input ${fieldErrors.phone ? 'form-input-error' : ''}`} 
                  value={formData.phone}
                  onChange={(e) => { setFormData(prev => ({ ...prev, phone: e.target.value })); setFieldErrors(prev => ({ ...prev, phone: '' })) }}
                  placeholder="Número de teléfono"
                />
                {fieldErrors.phone && <span className="form-error">{fieldErrors.phone}</span>}
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <input 
                  type="email" 
                  className={`form-input ${fieldErrors.email ? 'form-input-error' : ''}`} 
                  value={formData.email}
                  onChange={(e) => { setFormData(prev => ({ ...prev, email: e.target.value })); setFieldErrors(prev => ({ ...prev, email: '' })) }}
                  placeholder="correo@ejemplo.com"
                />
                {fieldErrors.email && <span className="form-error">{fieldErrors.email}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Dirección</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Dirección completa"
                />
              </div>
            </div>
            
            <div className="divider" />
            
            <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icons.Bell />
              Contacto de Emergencia
            </h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.emergencyContact.name}
                  onChange={(e) => updateEmergencyContact('name', e.target.value)}
                  placeholder="Nombre del contacto"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input 
                  type="tel" 
                  className="form-input" 
                  value={formData.emergencyContact.phone}
                  onChange={(e) => updateEmergencyContact('phone', e.target.value)}
                  placeholder="Número de emergencia"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Relación</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.emergencyContact.relationship}
                  onChange={(e) => updateEmergencyContact('relationship', e.target.value)}
                  placeholder="Ej: Familiar, Amigo"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Observaciones Importantes</label>
              <textarea 
                className="form-textarea"
                value={formData.emergencyContact.notes}
                onChange={(e) => updateEmergencyContact('notes', e.target.value)}
                placeholder="Alergias, condiciones médicas, etc."
                rows={3}
              />
            </div>
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {client ? 'Guardar Cambios' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
  const { clients, setClients, addClient, updateClientInState, removeClient, triggerNewClientModal, setTriggerNewClientModal, showToast, confirm } = useAppStore()
  const [showForm, setShowForm] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<ClientStatus | 'all'>('all')
  const [debtorsMap, setDebtorsMap] = useState<{ [clientId: string]: number }>({})
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [statsClient, setStatsClient] = useState<Client | null>(null)

  const loadClients = async () => {
    const result = await window.electronAPI.client.getAll()
    if (result.success && result.data) {
      setClients(result.data)
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
  }, [])

  useEffect(() => {
    if (triggerNewClientModal) {
      setSelectedClient(null)
      setShowForm(true)
      setTriggerNewClientModal(false)
    }
  }, [triggerNewClientModal, setTriggerNewClientModal])

  const handleSave = async (clientData: Omit<Client, 'id' | 'registrationDate'>) => {
    let result
    if (selectedClient) {
      result = await window.electronAPI.client.update(selectedClient.id, clientData)
      if (result.success && result.data) {
        updateClientInState(result.data)
      }
    } else {
      result = await window.electronAPI.client.create(clientData)
      if (result.success && result.data) {
        addClient(result.data)
      }
    }
    if (!result?.success) {
      showToast('error', result?.error ?? 'Error al guardar el cliente', 'Error')
      return
    }
    setShowForm(false)
    setSelectedClient(null)
    loadClients()
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: 'Eliminar cliente', message: '¿Está seguro de eliminar este cliente?', variant: 'danger', confirmLabel: 'Eliminar' })
    if (!ok) return
    await window.electronAPI.client.delete(id)
    removeClient(id)
    loadClients()
  }

  const handleEdit = (client: Client) => {
    setSelectedClient(client)
    setShowForm(true)
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

  const filteredClients = clients.filter(c => {
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus
    const matchesSearch = !searchQuery || 
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.documentId.includes(searchQuery) ||
      c.accessCode.includes(searchQuery)
    return matchesStatus && matchesSearch
  })

  const handleNewClient = () => {
    setSelectedClient(null)
    setShowForm(true)
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
            onChange={(e) => setFilterStatus(e.target.value as ClientStatus | 'all')}
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
        {filteredClients.length === 0 ? (
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
                {filteredClients.map((client) => (
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

      {showForm && (
        <ClientForm 
          client={selectedClient}
          onClose={() => {
            setShowForm(false)
            setSelectedClient(null)
          }}
          onSave={handleSave}
        />
      )}

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
