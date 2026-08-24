import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { Sidebar, Header, landingPathFor, type SessionUser } from '@/components/Layout'
import { ToastContainer } from '@/components/ToastContainer'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useAppStore } from '@/store/appStore'
import { hasPermission } from '@shared/permissions'
import type { User } from '@shared/types'
import { ClientsPage } from '@/pages/ClientsPage'
import { PaymentsPage } from '@/pages/PaymentsPage'
import { LogsPage } from '@/pages/LogsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { KioskPage } from '@/pages/KioskPage'
import { ClientFormPage } from '@/pages/ClientFormPage'
import { WhatsappPage } from '@/pages/WhatsappPage'
import { LoginPage } from '@/pages/LoginPage'
import { UsersPage } from '@/pages/UsersPage'
import { InventoryPage } from '@/pages/InventoryPage'
import { BodyTrackingPage } from '@/pages/BodyTrackingPage'
import { MessagesPage } from '@/pages/MessagesPage'
import { KioskRenewPage } from '@/pages/KioskRenewPage'
import { FormPage } from '@/pages/forms/FormPage'

// DashboardPage es el único consumidor de recharts (~500 KB). Se carga de forma
// diferida para que el chunk inicial de la app no incluya esa librería.
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage }))
)

function PageLoader(): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
      <div className="spinner" />
    </div>
  )
}

function getPageTitle(pathname: string): string {
  switch (pathname) {
    case '/': return 'Panel Principal'
    case '/clients': return 'Clientes y Membresías'
    case '/payments': return 'Pagos'
    case '/logs': return 'Historial de Accesos'
    case '/whatsapp': return 'Notificaciones WhatsApp'
    case '/inventory': return 'Inventario'
    case '/tracking': return 'Seguimiento'
    case '/messages': return 'Mensajes'
    case '/users': return 'Usuarios'
    case '/settings': return 'Configuración'
    default: return 'BodyFitGym'
  }
}

/**
 * Protege una ruta por permiso granular. Sin el permiso se redirige a la
 * primera sección permitida; si no hay ninguna, a /no-access.
 */
function PermissionGuard({ permission, currentUser, children }: { permission: string; currentUser: SessionUser; children: JSX.Element }): JSX.Element {
  if (!currentUser) return <Navigate to="/" replace />
  if (hasPermission(currentUser, permission)) return children
  return <Navigate to={landingPathFor(currentUser)} replace />
}

function NoAccessPanel(): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 12 }}>
      <h2 className="headline-md">Sin acceso</h2>
      <p className="body-lg" style={{ color: 'var(--color-on-surface-variant)' }}>
        Tu usuario no tiene permisos para ninguna sección. Contacta al administrador.
      </p>
    </div>
  )
}

/** Ruta raíz: dashboard si tiene permiso; si no, primera sección permitida. */
function HomeRoute({ currentUser }: { currentUser: SessionUser }): JSX.Element {
  if (!currentUser) return <PageLoader />
  if (!hasPermission(currentUser, 'dashboard.view')) {
    const alt = landingPathFor(currentUser)
    if (alt !== '/') return <Navigate to={alt} replace />
    return <NoAccessPanel />
  }
  return <DashboardPage />
}

function AdminLayout({ currentUser }: { currentUser: User | null }): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const title = getPageTitle(location.pathname)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 768)
  const prevWidthRef = useRef(window.innerWidth)
  const setTriggerNewClientModal = useAppStore((s) => s.setTriggerNewClientModal)

  const toggleSidebar = useCallback(() => setSidebarCollapsed(prev => !prev), [])

  // Auto-collapse/expand sidebar based on screen width
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      const prevWidth = prevWidthRef.current
      prevWidthRef.current = width

      if (width < 768 && prevWidth >= 768) {
        // Crossing below threshold → collapse
        setSidebarCollapsed(true)
      } else if (width >= 768 && prevWidth < 768) {
        // Crossing above threshold → expand
        setSidebarCollapsed(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Auto-collapse sidebar on navigation when on mobile
  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true)
    }
  }, [location.pathname])

  useEffect(() => {
    const handleNavigatePayments = (data: { clientId: string }) => {
      navigate(`/payments?clientId=${encodeURIComponent(data.clientId)}`)
    }
    const cleanup = window.electronAPI?.window?.onNavigatePayments?.(handleNavigatePayments)
    return () => {
      cleanup?.()
    }
  }, [navigate])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        const path = location.pathname
        if (path === '/clients') {
          setTriggerNewClientModal(true)
        } else if (path === '/inventory') {
          window.dispatchEvent(new CustomEvent('shortcut:newProduct'))
        } else {
          setTriggerNewClientModal(true)
          navigate('/clients')
        }
      }
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        const searchInput = document.querySelector<HTMLInputElement>('input[type="text"].search-input, .search-box input, input.search-input')
        if (searchInput) searchInput.focus()
      }
      if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal-overlay')
        if (modals.length > 0) {
          const closeBtn = modals[modals.length - 1].querySelector('.modal-close')
          if (closeBtn) (closeBtn as HTMLButtonElement).click()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [location.pathname, navigate, setTriggerNewClientModal])

  const handleLogout = async () => {
    await window.electronAPI.auth.logout()
    window.location.reload()
  }

  return (
    <div className="app-container">
      <Sidebar currentUser={currentUser} collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <main className="main-content">
        <Header title={title} onLogout={handleLogout} onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
        <div className="page-content">
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomeRoute currentUser={currentUser} />} />
            <Route path="/clients" element={<PermissionGuard permission="clients.view" currentUser={currentUser}><ClientsPage /></PermissionGuard>} />
            <Route path="/payments" element={<PermissionGuard permission="payments.view" currentUser={currentUser}><PaymentsPage /></PermissionGuard>} />
            <Route path="/logs" element={<PermissionGuard permission="logs.view" currentUser={currentUser}><LogsPage /></PermissionGuard>} />
            <Route path="/whatsapp" element={<PermissionGuard permission="whatsapp.view" currentUser={currentUser}><WhatsappPage /></PermissionGuard>} />
            <Route path="/users" element={<PermissionGuard permission="users.view" currentUser={currentUser}><UsersPage /></PermissionGuard>} />
            <Route path="/inventory" element={<PermissionGuard permission="inventory.view" currentUser={currentUser}><InventoryPage /></PermissionGuard>} />
            <Route path="/tracking" element={<PermissionGuard permission="tracking.view" currentUser={currentUser}><BodyTrackingPage /></PermissionGuard>} />
            <Route path="/messages" element={<PermissionGuard permission="messages.view" currentUser={currentUser}><MessagesPage /></PermissionGuard>} />
            <Route path="/settings" element={<PermissionGuard permission="settings.view" currentUser={currentUser}><SettingsPage /></PermissionGuard>} />
            <Route path="/no-access" element={<NoAccessPanel />} />
          </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  )
}

export function App(): JSX.Element {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    checkAuth()
    async function checkAuth() {
      try {
        const result = await window.electronAPI.auth.checkSession()
        setAuthenticated(result.success && !!result.data)
        if (result.success) setCurrentUser(result.data ?? null)
      } catch {
        setAuthenticated(false)
      }
    }
  }, [])

  if (authenticated === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--color-bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ marginTop: 16, color: 'var(--color-secondary)' }}>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/kiosk" element={<KioskPage />} />
        <Route path="/kiosk-renew" element={<KioskRenewPage />} />
        <Route path="/client-form" element={<ClientFormPage />} />
        <Route path="/form/:type" element={<FormPage />} />
        <Route path="/*" element={
          <>
            <LoginPage onLoginSuccess={async () => {
                const r = await window.electronAPI.auth.checkSession()
                if (r.success) {
                  setCurrentUser(r.data ?? null)
                  setAuthenticated(true)
                }
              }} />
              <ToastContainer />
            </>
          } />
        </Routes>
      </HashRouter>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/kiosk" element={<KioskPage />} />
        <Route path="/kiosk-renew" element={<KioskRenewPage />} />
        <Route path="/client-form" element={<ClientFormPage />} />
        <Route path="/form/:type" element={<FormPage />} />
        <Route path="/*" element={
          <>
            <AdminLayout currentUser={currentUser} />
            <ToastContainer />
            <ConfirmDialog />
          </>
        } />
      </Routes>
    </HashRouter>
  )
}
