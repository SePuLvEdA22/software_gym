import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RenewModal } from '@/components/modals/RenewModal'
import { ToastContainer } from '@/components/ToastContainer'
import { Icons } from '@/components/Icons'
import type { Client, Membership, MembershipPlan } from '@shared/types'

export function KioskRenewPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const clientId = searchParams.get('id')

  const [client, setClient] = useState<Client | null>(null)
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async (id: string) => {
    try {
      // Canal público del kiosco: esta ventana no tiene sesión de usuario.
      const result = await window.electronAPI.kiosk.getRenewalInfo(id)

      if (!result.success || !result.data) {
        setError(result.error || 'Cliente no encontrado')
        setLoading(false)
        return
      }

      setClient(result.data.client as Client)
      setPlans((result.data.plans || []) as MembershipPlan[])
      setActiveMembership((result.data.activeMembership || null) as Membership | null)
      setLoading(false)
    } catch (e) {
      setError('Error al cargar datos del cliente')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!clientId) {
      setError('No se especificó un cliente')
      setLoading(false)
      return
    }
    loadData(clientId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  const handleClose = () => {
    window.close()
  }

  const handleSuccess = () => {
    setTimeout(() => window.close(), 1500)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--color-bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ marginTop: 16, color: 'var(--color-secondary)' }}>Cargando...</p>
        </div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--color-bg)' }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Icons.Bell style={{ width: 48, height: 48, color: 'var(--color-error)', marginBottom: 16 }} />
          <h2 style={{ marginBottom: 8 }}>Error</h2>
          <p style={{ color: 'var(--color-on-surface-variant)', marginBottom: 24 }}>{error || 'Cliente no encontrado'}</p>
          <button className="btn btn-primary" onClick={handleClose}>Cerrar</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={{ background: 'var(--color-bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 720 }}>
          <RenewModal
            client={client}
            activeMembership={activeMembership}
            plans={plans}
            useKioskApi
            onClose={handleClose}
            onSuccess={handleSuccess}
          />
        </div>
      </div>
      <ToastContainer />
    </>
  )
}
