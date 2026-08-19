import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/store/appStore'
import { useFormSaved } from '@/hooks/useFormSaved'
import { Icons } from '@/components/Icons'
import { PaymentHistoryModal } from '@/components/modals/PaymentHistoryModal'
import { FreezeHistoryModal } from '@/components/modals/FreezeHistoryModal'
import { RoutinesModal } from '@/components/modals/RoutinesModal'
import { getMembershipStatusBadge, statusBadge } from '@/components/StatusBadges'
import { Client, Membership, ClientDebt } from '@shared/types'
import { format, parseISO } from 'date-fns'

interface ClientMembershipsModalProps {
  client: Client
  onClose: () => void
}

export function ClientMembershipsModal({
  client,
  onClose,
}: ClientMembershipsModalProps): JSX.Element {
  const showToast = useAppStore((state) => state.showToast)

  const [memberships, setMemberships] = useState<Membership[]>([])
  const [debts, setDebts] = useState<ClientDebt[]>([])
  const [loading, setLoading] = useState(true)

  const [showFreezeHistoryModal, setShowFreezeHistoryModal] = useState(false)
  const [selectedMembershipForHistory, setSelectedMembershipForHistory] = useState<string | null>(
    null,
  )
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false)
  const [selectedMembershipForPayments, setSelectedMembershipForPayments] = useState<string | null>(
    null,
  )
  const [showRoutinesModal, setShowRoutinesModal] = useState(false)

  const loadData = useCallback(async () => {
    const result = await window.electronAPI.membership.getByClient(client.id)
    if (result.success && result.data) {
      setMemberships(result.data)
    }
    const debtResult = await window.electronAPI.client.getDebt(client.id)
    if (debtResult.success && debtResult.data) {
      setDebts(debtResult.data)
    }
    setLoading(false)
  }, [client.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  useFormSaved('renew', () => loadData())
  useFormSaved('freeze', () => loadData())
  useFormSaved('abono', () => loadData())

  const handleRenew = () => {
    window.electronAPI.window.openForm('renew', { clientId: client.id })
  }

  const handleFreezeClick = (membership: Membership) => {
    window.electronAPI.window.openForm('freeze', {
      membershipId: membership.id,
      clientId: client.id,
    })
  }

  const handleUnfreeze = async (membershipId: string) => {
    const result = await window.electronAPI.membership.unfreeze(membershipId)
    if (result.success && result.data) {
      showToast(
        'success',
        'Membresía descongelada. La fecha de vencimiento ha sido extendida.',
        'Listo',
      )
      loadData()
    } else {
      showToast('error', result.error || 'No se pudo descongelar la membresía', 'Error')
    }
  }

  const activeMembership =
    memberships.find((m) => m.status === 'active' || m.status === 'frozen') || null

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div
          className="modal-header"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="avatar-initials" style={{ width: 40, height: 40, fontSize: 16 }}>
              {client.photo ? (
                <img src={`data:image/jpeg;base64,${client.photo}`} alt={client.fullName} />
              ) : (
                client.fullName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="modal-title" style={{ margin: 0 }}>
                {client.fullName}
              </h2>
              <div style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                Código: {client.accessCode} {client.documentId ? `| Doc: ${client.documentId}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                const result = await window.electronAPI.whatsapp.sendExpiryReminderToClient(
                  client.id,
                )
                if (result.success && result.data?.success) {
                  showToast('success', `Recordatorio enviado a ${result.data.message}`, 'Enviado')
                } else {
                  showToast(
                    'warning',
                    result.data?.message ||
                      'No se pudo enviar recordatorio. Verifica que el cliente tenga membresía activa o vencida recientemente.',
                    'Info',
                  )
                }
              }}
              title="Enviar recordatorio WhatsApp"
              style={{
                minWidth: 36,
                minHeight: 36,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icons.Bell />
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowRoutinesModal(true)}
              title="Editar rutina de entrenamiento"
              style={{
                minWidth: 36,
                minHeight: 36,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icons.Dumbbell />
            </button>
            {statusBadge(client.status)}
            <button type="button" className="modal-close" onClick={onClose}>
              <Icons.Close />
            </button>
          </div>
        </div>

        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20 }}>Cargando...</div>
          ) : memberships.length > 0 ? (
            <div className="table-container" style={{ border: 'none' }}>
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
                  {memberships.map((membership) => {
                    const debt = debts.find((d) => d.membershipId === membership.id)
                    return (
                      <tr key={membership.id}>
                        <td style={{ fontWeight: 500 }}>{membership.planName}</td>
                        <td>{format(parseISO(membership.startDate), 'dd/MM/yyyy')}</td>
                        <td>{format(parseISO(membership.endDate), 'dd/MM/yyyy')}</td>
                        <td>{getMembershipStatusBadge(membership)}</td>
                        <td>
                          {debt && debt.balance > 0 ? (
                            <span className="status-badge status-badge-error">
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  backgroundColor: 'currentColor',
                                  display: 'inline-block',
                                  flexShrink: 0,
                                }}
                              />
                              ${debt.balance.toLocaleString('es-CO')}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-secondary)', fontSize: 12 }}>
                              Al día
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {!activeMembership && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={handleRenew}
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
                                style={{
                                  minWidth: 36,
                                  minHeight: 36,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Icons.Snowflake />
                              </button>
                            )}
                            {membership.status === 'frozen' && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleUnfreeze(membership.id)}
                                title="Descongelar membresía"
                                style={{
                                  minWidth: 36,
                                  minHeight: 36,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Icons.Play />
                              </button>
                            )}
                            {debt && debt.balance > 0 && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() =>
                                  window.electronAPI.window.openForm('abono', {
                                    clientId: client.id,
                                    membershipId: membership.id,
                                  })
                                }
                                title="Registrar abono"
                                style={{
                                  minWidth: 36,
                                  minHeight: 36,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
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
                              style={{
                                minWidth: 36,
                                minHeight: 36,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Icons.Search />
                            </button>
                            {membership.status === 'frozen' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setSelectedMembershipForHistory(membership.id)
                                  setShowFreezeHistoryModal(true)
                                }}
                                title="Historial de congelaciones"
                                style={{
                                  minWidth: 36,
                                  minHeight: 36,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
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
              <button className="btn btn-primary" onClick={handleRenew} style={{ marginTop: 8 }}>
                <Icons.Plus />
                Crear Membresía
              </button>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>

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

      {showRoutinesModal && (
        <RoutinesModal
          client={client}
          onClose={() => {
            setShowRoutinesModal(false)
          }}
        />
      )}
    </div>
  )
}
