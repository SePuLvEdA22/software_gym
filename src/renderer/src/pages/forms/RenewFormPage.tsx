import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Client, Membership, MembershipPlan } from '@shared/types'
import { RenewModal } from '@/components/modals/RenewModal'
import { FormWindowShell } from '@/components/FormWindowShell'

export function RenewFormPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const clientId = searchParams.get('clientId') || ''

  const [client, setClient] = useState<Client | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) {
      setLoading(false)
      return
    }
    Promise.all([
      window.electronAPI.client.getById(clientId),
      window.electronAPI.membership.getByClient(clientId),
      window.electronAPI.plans.getAll(true)
    ])
      .then(([clientResult, memResult, plansResult]) => {
        if (clientResult.success && clientResult.data) setClient(clientResult.data)
        if (memResult.success && memResult.data) setMemberships(memResult.data)
        if (plansResult.success && plansResult.data) setPlans(plansResult.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) {
    return (
      <FormWindowShell title="Nueva Membresía">
        <div className="spinner" style={{ margin: '48px auto' }} />
      </FormWindowShell>
    )
  }

  if (!client) {
    return (
      <FormWindowShell title="Nueva Membresía">
        <p style={{ color: 'var(--color-secondary)' }}>No se encontró el cliente seleccionado.</p>
      </FormWindowShell>
    )
  }

  const activeMembership =
    memberships.find((m) => m.status === 'active' || m.status === 'frozen') || null

  return (
    <FormWindowShell title="Nueva Membresía">
      <RenewModal
        embedded
        client={client}
        activeMembership={activeMembership}
        plans={plans}
        onClose={() => window.close()}
        onSuccess={() =>
          window.electronAPI.window.notifyFormSaved('renew', 'Membresía creada exitosamente')
        }
      />
    </FormWindowShell>
  )
}
