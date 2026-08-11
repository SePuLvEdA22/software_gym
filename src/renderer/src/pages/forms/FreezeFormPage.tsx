import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Membership } from '@shared/types'
import { FreezeModal } from '@/components/modals/FreezeModal'
import { FormWindowShell } from '@/components/FormWindowShell'

export function FreezeFormPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const membershipId = searchParams.get('membershipId') || ''
  const clientId = searchParams.get('clientId') || ''

  const [membership, setMembership] = useState<Membership | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!membershipId || !clientId) {
      setLoading(false)
      return
    }
    window.electronAPI.membership
      .getByClient(clientId)
      .then((result: any) => {
        if (result.success && result.data) {
          const found = (result.data as Membership[]).find((m) => m.id === membershipId)
          if (found) setMembership(found)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [membershipId, clientId])

  if (loading) {
    return (
      <FormWindowShell title="Congelar Membresía">
        <div className="spinner" style={{ margin: '48px auto' }} />
      </FormWindowShell>
    )
  }

  if (!membership) {
    return (
      <FormWindowShell title="Congelar Membresía">
        <p style={{ color: 'var(--color-secondary)' }}>No se encontró la membresía seleccionada.</p>
      </FormWindowShell>
    )
  }

  return (
    <FormWindowShell title="Congelar Membresía">
      <FreezeModal
        embedded
        membership={membership}
        onClose={() => window.close()}
        onSuccess={() =>
          window.electronAPI.window.notifyFormSaved('freeze', 'Membresía congelada exitosamente')
        }
      />
    </FormWindowShell>
  )
}
