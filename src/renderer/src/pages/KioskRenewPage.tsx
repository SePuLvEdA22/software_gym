import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RenewModal } from '@/components/modals/RenewModal'
import { ToastContainer } from '@/components/ToastContainer'
import { Icons } from '@/components/Icons'
import type { Client, Membership, MembershipPlan } from '@shared/types'
import kioskBg from '@/assets/kiosk-bg.png'
import { useAppStore } from '@/store/appStore'

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
    } catch {
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
  }, [clientId])

  // Sincroniza tema con admin (mismo store persistido en localStorage)
  const kioskTheme = useAppStore((s) => s.theme)
  const setKioskTheme = useAppStore((s) => s.setTheme)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', kioskTheme)
    document.documentElement.setAttribute('data-kiosk', 'true')
  }, [kioskTheme])
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bodyfitgym-theme' && (e.newValue === 'dark' || e.newValue === 'light')) {
        const cur = useAppStore.getState().theme
        if (e.newValue !== cur) setKioskTheme(e.newValue as 'dark' | 'light')
        else {
          document.documentElement.setAttribute('data-theme', e.newValue)
          document.documentElement.setAttribute('data-kiosk', 'true')
        }
      }
    }
    window.addEventListener('storage', onStorage)
    const poll = setInterval(() => {
      try {
        const stored = localStorage.getItem('bodyfitgym-theme')
        if ((stored === 'dark' || stored === 'light') && stored !== useAppStore.getState().theme) setKioskTheme(stored as 'dark' | 'light')
      } catch { /* ignore */ }
    }, 1500)
    return () => {
      window.removeEventListener('storage', onStorage)
      clearInterval(poll)
      document.documentElement.removeAttribute('data-kiosk')
    }
  }, [setKioskTheme])

  const handleClose = () => {
    window.close()
  }

  const handleSuccess = () => {
    setTimeout(() => window.close(), 1500)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--color-bg)', position: 'relative', overflow: 'hidden' }}>
        <img src={kioskBg} className="kiosk-bg" alt="" aria-hidden draggable={false} />
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="spinner" />
          <p style={{ marginTop: 16, color: 'var(--color-secondary)' }}>Cargando...</p>
        </div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--color-bg)', position: 'relative', overflow: 'hidden' }}>
        <img src={kioskBg} className="kiosk-bg" alt="" aria-hidden draggable={false} />
        <div style={{ textAlign: 'center', padding: 32, position: 'relative', zIndex: 1 }}>
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
      <div style={{ background: 'var(--color-bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
        <img src={kioskBg} className="kiosk-bg" alt="" aria-hidden draggable={false} />
        <div style={{ width: '100%', maxWidth: 720, position: 'relative', zIndex: 1 }}>
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

