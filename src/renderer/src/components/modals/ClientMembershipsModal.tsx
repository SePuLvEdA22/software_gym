import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/store/appStore'
import { useFormSaved } from '@/hooks/useFormSaved'
import { Icons } from '@/components/Icons'
import { PaymentHistoryModal } from '@/components/modals/PaymentHistoryModal'
import { FreezeHistoryModal } from '@/components/modals/FreezeHistoryModal'
import { RoutinesModal } from '@/components/modals/RoutinesModal'
import { RowActionsMenu, RowAction } from '@/components/RowActionsMenu'
import { getMembershipStatusBadge } from '@/components/StatusBadges'
import { Client, Membership, ClientDebt } from '@shared/types'
import { hasPermission } from '@shared/permissions'
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
  const confirm = useAppStore((state) => state.confirm)

  const [memberships, setMemberships] = useState<Membership[]>([])
  const [debts, setDebts] = useState<ClientDebt[]>([])
  const [loading, setLoading] = useState(true)
  const [canViewPayments, setCanViewPayments] = useState(false)
  const [canDelete, setCanDelete] = useState(false)

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
    } else if (!result.success) {
      showToast('error', result.error || 'No se pudieron cargar las membresías', 'Error')
    }
    const debtResult = await window.electronAPI.client.getDebt(client.id)
    if (debtResult.success && debtResult.data) {
      setDebts(debtResult.data)
    }
    setLoading(false)
  }, [client.id])

  useEffect(() => {
    loadData()
    window.electronAPI.auth
      .checkSession()
      .then((r) => {
        if (r.success && r.data) {
          setCanViewPayments(hasPermission(r.data, 'payments.view'))
          setCanDelete(hasPermission(r.data, 'memberships.delete'))
        }
      })
      .catch(() => {})
  }, [loadData])

  useFormSaved('renew', () => loadData())
  useFormSaved('freeze', () => loadData())
  useFormSaved('abono', () => loadData())
  useFormSaved('editMembership', () => loadData())

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

  const handleDelete = async (membership: Membership) => {
    const ok = await confirm({
      title: 'Eliminar membresía',
      message: `¿Eliminar la membresía "${membership.planName}"? También se eliminarán sus pagos e historial de congelamiento. Esta acción no se puede deshacer.`,
      variant: 'danger',
      confirmLabel: 'Eliminar',
    })
    if (!ok) return
    const result = await window.electronAPI.membership.delete(membership.id)
    if (result.success) {
      showToast('success', 'Membresía eliminada', 'Listo')
      loadData()
    } else {
      showToast('error', result.error || 'No se pudo eliminar la membresía', 'Error')
    }
  }

  /**
   * Una acción principal visible con texto (la más urgente) y el resto en el
   * menú "⋯": antes eran hasta 7 botones de solo ícono por fila.
   */
  const rowActions = (
    membership: Membership,
    debt: ClientDebt | undefined,
  ): { primary: RowAction | null; menu: RowAction[] } => {
    const hasDebt = !!debt && debt.balance > 0
    const all: RowAction[] = []
    if (membership.status === 'frozen')
      all.push({
        key: 'unfreeze',
        label: 'Descongelar',
        icon: <Icons.Play />,
        onClick: () => handleUnfreeze(membership.id),
      })
    if (hasDebt)
      all.push({
        key: 'abono',
        label: 'Registrar abono',
        icon: <Icons.Plus />,
        onClick: () =>
          window.electronAPI.window.openForm('abono', {
            clientId: client.id,
            membershipId: membership.id,
          }),
      })
    if (membership.status === 'active' || membership.status === 'scheduled')
      all.push({
        key: 'edit',
        label: 'Editar membresía',
        icon: <Icons.Edit />,
        onClick: () =>
          window.electronAPI.window.openForm('editMembership', {
            membershipId: membership.id,
            clientId: client.id,
          }),
      })
    if (membership.status === 'active')
      all.push({
        key: 'freeze',
        label: 'Congelar',
        icon: <Icons.Snowflake />,
        onClick: () => handleFreezeClick(membership),
      })
    if (canViewPayments)
      all.push({
        key: 'payments',
        label: 'Ver pagos',
        icon: <Icons.Search />,
        onClick: () => {
          setSelectedMembershipForPayments(membership.id)
          setShowPaymentHistoryModal(true)
        },
      })
    if (membership.status === 'frozen')
      all.push({
        key: 'freezeHistory',
        label: 'Historial de congelaciones',
        icon: <Icons.Clock />,
        onClick: () => {
          setSelectedMembershipForHistory(membership.id)
          setShowFreezeHistoryModal(true)
        },
      })
    if (canDelete)
      all.push({
        key: 'delete',
        label: 'Eliminar membresía',
        icon: <Icons.Trash />,
        danger: true,
        onClick: () => handleDelete(membership),
      })

    // Descongelar tiene prioridad sobre el abono: sin descongelar no puede entrenar.
    const primary =
      all.find((a) => a.key === 'unfreeze') || all.find((a) => a.key === 'abono') || null
    return {
      primary: primary && { ...primary, label: primary.key === 'abono' ? 'Abono' : primary.label },
      menu: all.filter((a) => a !== primary),
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
              className="btn btn-primary btn-sm"
              onClick={handleRenew}
              style={{ minHeight: 36 }}
              title={
                activeMembership
                  ? 'Agregar membresía encolada (se activará al vencer la actual)'
                  : 'Renovar'
              }
            >
              <Icons.Plus />
              {activeMembership ? 'Agregar' : 'Renovar'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowRoutinesModal(true)}
              style={{ minHeight: 36 }}
            >
              Rutina
            </button>
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
                    <th style={{ width: 200, textAlign: 'right' }}>Acciones</th>
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
                          <div
                            style={{
                              display: 'flex',
                              gap: 6,
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                            }}
                          >
                            {(() => {
                              const { primary, menu } = rowActions(membership, debt)
                              return (
                                <>
                                  {primary && (
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={primary.onClick}
                                      style={{ minHeight: 36 }}
                                    >
                                      {primary.icon}
                                      {primary.label}
                                    </button>
                                  )}
                                  <RowActionsMenu actions={menu} />
                                </>
                              )
                            })()}
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
