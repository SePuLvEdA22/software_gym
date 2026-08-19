import { ClientStatus, Membership } from '@shared/types'
import { parseISO, differenceInDays } from 'date-fns'

export function PulseDot() {
  return (
    <span
      className="pulse-dot"
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: 'currentColor',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  )
}

export const statusBadge = (status: ClientStatus) => {
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

export function getMembershipStatusBadge(membership: Membership) {
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
