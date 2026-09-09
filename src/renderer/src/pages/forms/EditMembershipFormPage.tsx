import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Client, Membership, MembershipPlan } from '@shared/types'
import { EditMembershipModal } from '@/components/modals/EditMembershipModal'
import { FormWindowShell } from '@/components/FormWindowShell'

export function EditMembershipFormPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const membershipId = searchParams.get('membershipId') || ''
  const clientId = searchParams.get('clientId') || ''

  const [membership, setMembership] = useState<Membership | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!membershipId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('Falta el identificador de la membresía')
      setLoading(false)
      return
    }
    Promise.all([
      window.electronAPI.membership.getById(membershipId),
      window.electronAPI.plans.getAll(false),
      clientId ? window.electronAPI.client.getById(clientId) : Promise.resolve({ success: false } as never)
    ])
      .then(async ([memRes, plansRes, clientRes]) => {
        if (memRes.success && memRes.data) setMembership(memRes.data)
        else setError(memRes.error || 'Membresía no encontrada')
        if (plansRes.success && plansRes.data) setPlans(plansRes.data)
        if (clientRes && (clientRes as { success: boolean; data?: Client }).success) {
          setClient((clientRes as { data: Client }).data)
        } else if (memRes.success && memRes.data) {
          // Fallback: cargar cliente desde membresía
          const cRes = await window.electronAPI.client.getById(memRes.data.clientId)
          if (cRes.success && cRes.data) setClient(cRes.data)
        }
      })
      .catch(() => setError('Error cargando membresía'))
      .finally(() => setLoading(false))
  }, [membershipId, clientId])

  if (loading) {
    return (
      <FormWindowShell title="Editar Membresía">
        <div className="spinner" style={{ margin: '48px auto' }} />
      </FormWindowShell>
    )
  }

  if (error || !membership || !client) {
    return (
      <FormWindowShell title="Editar Membresía">
        <p style={{ color: 'var(--color-error)' }}>{error || 'No se pudo cargar la membresía'}</p>
      </FormWindowShell>
    )
  }

  if (membership.status !== 'active' && membership.status !== 'scheduled') {
    return (
      <FormWindowShell title="Editar Membresía">
        <p style={{ color: 'var(--color-error)' }}>Solo se pueden editar membresías activas o programadas. Esta membresía está en estado: {membership.status}</p>
        <button className="btn btn-secondary" onClick={() => window.close()} style={{ marginTop: 16 }}>
          Cerrar
        </button>
      </FormWindowShell>
    )
  }

  return (
    <FormWindowShell title="Editar Membresía">
      <EditMembershipModal
        embedded
        membership={membership}
        client={client}
        plans={plans}
        onClose={() => window.close()}
        onSuccess={() => window.electronAPI.window.notifyFormSaved('editMembership', 'Membresía actualizada')}
      />
    </FormWindowShell>
  )
}
