import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Icons } from '@/components/Icons'
import { Client, Membership, MembershipPlan, PaymentMethod } from '../../../shared/types'
import { format, parseISO, differenceInDays, addDays } from 'date-fns'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(value)
}

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' }
]

interface RenewModalProps {
  client: Client
  activeMembership: Membership | null
  plans: MembershipPlan[]
  onClose: () => void
  onSuccess: () => void
}

function RenewModal({ client, activeMembership, plans, onClose, onSuccess }: RenewModalProps): JSX.Element {
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [amount, setAmount] = useState<number>(0)
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)

  const selectedPlanData = plans.find(p => p.id === selectedPlan)

  useEffect(() => {
    if (selectedPlanData) {
      setAmount(selectedPlanData.price)
    }
  }, [selectedPlanData])

   const handleRenew = async () => {
     if (!selectedPlan) return
     
     setLoading(true)
     
     try {
       const membershipResult = await window.electronAPI.membership.create(
         client.id, 
         selectedPlan,
         startDate ? parseISO(startDate).toISOString() : undefined
       )
       
       if (membershipResult.success && membershipResult.data) {
         const paymentDesc = `Renovación membresía ${selectedPlanData?.name || ''}`
         await window.electronAPI.payment.record(
           client.id,
           amount,
           paymentMethod,
           paymentDesc,
           membershipResult.data.id
         )
         
         onSuccess()
         onClose()
       } else {
         alert(
           '⚠️ No se puede crear nueva membresía\n\n' +
           'Este cliente ya tiene una membresía activa o congelada.\n' +
           'Solo se permite una membresía activa/congelada por cliente.\n\n' +
           'Si desea renovar, primero debe descongelar o esperar a que venza la membresía actual.'
         )
       }
     } catch (error: any) {
       alert(`Error: ${error?.message || 'Error desconocido'}`)
     } finally {
       setLoading(false)
     }
   }

  const getEndDate = () => {
    if (!selectedPlanData || !startDate) return null
    
    const start = startDate ? parseISO(startDate) : new Date()
    const end = addDays(start, selectedPlanData.durationDays)
    return format(end, 'dd/MM/yyyy')
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Renovar Membresía</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <Icons.Close />
          </button>
        </div>
        
        <div className="modal-body">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 16,
            padding: 20,
            backgroundColor: 'var(--color-surface-container-high)',
            borderRadius: 12,
            marginBottom: 28
          }}>
            <div className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>
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

           {activeMembership && (
             <div className={`alert ${activeMembership.status === 'frozen' ? 'alert-warning' : 'alert-warning'}`} style={{ marginBottom: 28 }}>
               {activeMembership.status === 'frozen' ? <Icons.Snowflake /> : <Icons.Calendar />}
               <div>
                 <span style={{ fontWeight: 600 }}>
                   {activeMembership.status === 'frozen' ? 'Membresía Congelada: ' : 'Membresía actual: '}
                 </span>
                 {activeMembership.planName} - 
                 {activeMembership.status === 'frozen' 
                   ? ' (Fecha de vencimiento se extiende al descongelar)'
                   : ` Vence el ${format(parseISO(activeMembership.endDate), 'dd/MM/yyyy')}`
                 }
               </div>
             </div>
           )}

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Plan de Membresía</label>
            <select 
              className="form-select"
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              required
            >
              <option value="">Seleccione un plan</option>
              {plans.map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - {formatCurrency(plan.price)} ({plan.durationDays} días)
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fecha de Inicio</label>
              <input 
                type="date" 
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de Vencimiento</label>
              <input 
                type="text" 
                className="form-input"
                value={getEndDate() || '-'}
                disabled
                style={{ backgroundColor: 'var(--color-surface-container-low)' }}
              />
            </div>
          </div>

          <div className="divider" />

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Método de Pago</label>
              <select 
                className="form-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                {paymentMethods.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Monto</label>
              <input 
                type="number" 
                className="form-input"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleRenew}
            disabled={!selectedPlan || loading}
          >
            {loading ? 'Procesando...' : 'Confirmar Renovación'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function MembershipsPage(): JSX.Element {
  const { clients, setClients, plans, setPlans } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [clientMemberships, setClientMemberships] = useState<Membership[]>([])
  const [activeTab, setActiveTab] = useState<'active' | 'all'>('active')

  const loadPlans = async () => {
    const result = await window.electronAPI.plans.getAll()
    if (result.success && result.data) {
      setPlans(result.data)
    }
  }

  const loadClients = async () => {
    const result = await window.electronAPI.client.getAll()
    if (result.success && result.data) {
      setClients(result.data)
    }
  }

  useEffect(() => {
    loadPlans()
    loadClients()
  }, [])

  const filteredClients = clients.filter(c => {
    const matchesSearch = !searchQuery || 
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.documentId.includes(searchQuery) ||
      c.accessCode.includes(searchQuery)
    
    if (activeTab === 'active') {
      return matchesSearch && (c.status === 'active')
    }
    return matchesSearch
  })

  const handleClientSelect = async (client: Client) => {
    setSelectedClient(client)
    const result = await window.electronAPI.membership.getByClient(client.id)
    if (result.success && result.data) {
      setClientMemberships(result.data)
    }
  }

  const handleRenew = (client: Client) => {
    setSelectedClient(client)
    setShowRenewModal(true)
  }

   const handleFreeze = async (membershipId: string) => {
     const result = await window.electronAPI.membership.freeze(membershipId)
     if (result.success && result.data) {
       alert('Membresía congelada exitosamente')
       if (selectedClient) {
         handleClientSelect(selectedClient)
       }
     } else {
       alert(`Error al congelar membresía: ${result.error || 'No se pudo congelar'}`)
     }
   }

   const handleUnfreeze = async (membershipId: string) => {
     const result = await window.electronAPI.membership.unfreeze(membershipId)
     if (result.success && result.data) {
       alert('Membresía descongelada exitosamente\nLa fecha de vencimiento ha sido extendida.')
       if (selectedClient) {
         handleClientSelect(selectedClient)
       }
     } else {
       alert(`Error al descongelar membresía: ${result.error || 'No se pudo descongelar'}`)
     }
   }

   const getStatusBadge = (membership: Membership) => {
     if (membership.status === 'frozen') {
       return <span className="badge badge-warning">Congelado</span>
     }
     
     const now = new Date()
     const endDate = parseISO(membership.endDate)
     const daysLeft = differenceInDays(endDate, now)

     if (membership.status === 'expired' || daysLeft < 0) {
       return <span className="badge badge-error">Vencido</span>
     }
     if (daysLeft <= 7) {
       return <span className="badge badge-warning">Por vencer ({daysLeft}d)</span>
     }
     return <span className="badge badge-success">Activo ({daysLeft}d)</span>
   }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        gap: 16
      }}>
        <div className="tabs">
          <div 
            className={`tab ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Activos
          </div>
          <div 
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Todos
          </div>
        </div>
        <input 
          type="text" 
          className="search-input"
          placeholder="Buscar cliente..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ maxWidth: 300 }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Clientes</h3>
          </div>
          <div className="card-body" style={{ padding: 0, maxHeight: 600, overflowY: 'auto' }}>
            {filteredClients.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Icons.Users />
                </div>
                <p>No hay clientes para mostrar</p>
              </div>
            ) : (
              <div style={{ padding: 8 }}>
                {filteredClients.map(client => (
                  <div 
                    key={client.id}
                    onClick={() => handleClientSelect(client)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 14,
                      padding: 14,
                      borderRadius: 8,
                      cursor: 'pointer',
                      backgroundColor: selectedClient?.id === client.id 
                        ? 'rgba(255, 107, 0, 0.1)' 
                        : 'transparent',
                      border: selectedClient?.id === client.id 
                        ? '1px solid var(--color-primary-container)'
                        : '1px solid transparent',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedClient?.id !== client.id) {
                        e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedClient?.id !== client.id) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
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
                          Código: {client.accessCode}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {client.status === 'active' 
                        ? <span className="badge badge-success">Activo</span>
                        : client.status === 'expired'
                          ? <span className="badge badge-error">Vencido</span>
                          : <span className="badge badge-default">{client.status}</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Historial de Membresías</h3>
            {selectedClient && (
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => handleRenew(selectedClient)}
              >
                <Icons.Plus />
                Renovar
              </button>
            )}
          </div>
          <div className="card-body" style={{ padding: 0, maxHeight: 600, overflowY: 'auto' }}>
            {!selectedClient ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Icons.Membership />
                </div>
                <p>Seleccione un cliente para ver sus membresías</p>
              </div>
             ) : clientMemberships.length === 0 ? (
               <div className="empty-state">
                 <div className="empty-state-icon">
                   <Icons.Membership />
                 </div>
                 <p>Este cliente no tiene membresías registradas</p>
               </div>
             ) : (
               <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                 <table>
                   <thead>
                     <tr>
                       <th>Plan</th>
                       <th>Inicio</th>
                       <th>Vence</th>
                       <th>Estado</th>
                       <th style={{ width: 140 }}>Acciones</th>
                     </tr>
                   </thead>
                   <tbody>
                     {clientMemberships.map(membership => (
                       <tr key={membership.id}>
                         <td style={{ fontWeight: 500 }}>{membership.planName}</td>
                         <td>{format(parseISO(membership.startDate), 'dd/MM/yyyy')}</td>
                         <td>{format(parseISO(membership.endDate), 'dd/MM/yyyy')}</td>
                         <td>{getStatusBadge(membership)}</td>
                         <td>
                           {membership.status === 'active' && (
                             <button
                               className="btn btn-secondary btn-sm"
                               onClick={() => handleFreeze(membership.id)}
                               title="Congelar membresía"
                             >
                               <Icons.Snowflake />
                               Congelar
                             </button>
                           )}
                           {membership.status === 'frozen' && (
                             <button
                               className="btn btn-primary btn-sm"
                               onClick={() => handleUnfreeze(membership.id)}
                               title="Descongelar membresía"
                             >
                               <Icons.Play />
                               Descongelar
                             </button>
                           )}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Planes Disponibles</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            {plans.map(plan => (
              <div 
                key={plan.id} 
                className="kpi-card"
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ fontWeight: 600 }}>{plan.name}</h4>
                  <span className="badge badge-primary">{plan.durationDays}d</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-primary-container)' }}>
                  {formatCurrency(plan.price)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                  {plan.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

       {showRenewModal && selectedClient && (
         <RenewModal
           client={selectedClient}
           activeMembership={clientMemberships.find(m => m.status === 'active' || m.status === 'frozen') || null}
           plans={plans}
           onClose={() => {
             setShowRenewModal(false)
             setSelectedClient(null)
           }}
           onSuccess={() => {
             loadClients()
             if (selectedClient) {
               handleClientSelect(selectedClient)
             }
           }}
         />
       )}
    </div>
  )
}
