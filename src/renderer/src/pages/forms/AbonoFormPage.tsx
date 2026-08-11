import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Client, ClientDebt, Membership } from '@shared/types'
import { AbonoModal } from '@/components/modals/AbonoModal'
import { FormWindowShell } from '@/components/FormWindowShell'

export function AbonoFormPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const clientId = searchParams.get('clientId') || ''
  const membershipId = searchParams.get('membershipId') || ''

  const [client, setClient] = useState<Client | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId || !membershipId) {
      setLoading(false)
      return
    }
    Promise.all([
      window.electronAPI.client.getById(clientId),
      window.electronAPI.membership.getByClient(clientId),
      window.electronAPI.client.getDebt(clientId)
    ])
      .then(([clientResult, memResult, debtResult]) => {
        if (clientResult.success && clientResult.data) setClient(clientResult.data)
        if (memResult.success && memResult.data) {
          const found = (memResult.data as Membership[]).find((m) => m.id === membershipId)
          if (found) setMembership(found)
        }
        if (debtResult.success && debtResult.data) {
          const debt = (debtResult.data as ClientDebt[]).find((d) => d.membershipId === membershipId)
          if (debt) setBalance(debt.balance)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId, membershipId])

  if (loading) {
    return (
      <FormWindowShell title="Registrar Abono">
        <div className="spinner" style={{ margin: '48px auto' }} />
      </FormWindowShell>
    )
  }

  if (!client || !membership) {
    return (
      <FormWindowShell title="Registrar Abono">
        <p style={{ color: 'var(--color-secondary)' }}>No se encontró la membresía seleccionada.</p>
      </FormWindowShell>
    )
  }

  return (
    <FormWindowShell title="Registrar Abono">
      <AbonoModal
        embedded
        client={client}
        membership={membership}
        balance={balance}
        onClose={() => window.close()}
        onSuccess={() =>
          window.electronAPI.window.notifyFormSaved('abono', 'Abono registrado exitosamente')
        }
      />
    </FormWindowShell>
  )
}
