import { useState, useEffect, useCallback } from 'react'
import { HashRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { Sidebar, Header } from '@/components/Layout'
import { ToastContainer } from '@/components/ToastContainer'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useAppStore } from '@/store/appStore'
import { DashboardPage } from '@/pages/DashboardPage'
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
import type { UserRole } from '@shared/types'

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

function RoleGuard({ roles, currentUser, children }: { roles?: UserRole[]; currentUser: any; children: JSX.Element }): JSX.Element {
  if (!currentUser) return <Navigate to="/" replace />
  if (roles && !roles.includes(currentUser.role)) return <Navigate to="/" replace />
  return children
}

function AdminLayout({ currentUser }: { currentUser: any }): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const title = getPageTitle(location.pathname)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const setTriggerNewClientModal = useAppStore((s) => s.setTriggerNewClientModal)

  const toggleSidebar = useCallback(() => setSidebarCollapsed(prev => !prev), [])

  useEffect(() => {
    const handleNavigatePayments = (_: any, data: { clientId: string }) => {
      navigate(`/payments?clientId=${encodeURIComponent(data.clientId)}`)
    }
    window.electronAPI?.window?.onNavigatePayments?.(handleNavigatePayments)
    return () => {
      const cleanup = window.electronAPI?.window?.onNavigatePayments
      if (cleanup) cleanup()
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
          <Routes>
            <Route path="/" element={
              currentUser?.role === 'trainer'
                ? <Navigate to="/tracking" replace />
                : <DashboardPage />
            } />
            <Route path="/clients" element={<RoleGuard roles={undefined} currentUser={currentUser}><ClientsPage /></RoleGuard>} />
            <Route path="/payments" element={<RoleGuard roles={['admin', 'reception', 'accounting']} currentUser={currentUser}><PaymentsPage /></RoleGuard>} />
            <Route path="/logs" element={<RoleGuard roles={undefined} currentUser={currentUser}><LogsPage /></RoleGuard>} />
            <Route path="/whatsapp" element={<RoleGuard roles={['admin', 'reception']} currentUser={currentUser}><WhatsappPage /></RoleGuard>} />
            <Route path="/users" element={<RoleGuard roles={['admin']} currentUser={currentUser}><UsersPage /></RoleGuard>} />
            <Route path="/inventory" element={<RoleGuard roles={['admin', 'reception', 'accounting']} currentUser={currentUser}><InventoryPage /></RoleGuard>} />
            <Route path="/tracking" element={<RoleGuard roles={['admin', 'trainer']} currentUser={currentUser}><BodyTrackingPage /></RoleGuard>} />
            <Route path="/messages" element={<RoleGuard roles={['admin']} currentUser={currentUser}><MessagesPage /></RoleGuard>} />
            <Route path="/settings" element={<RoleGuard roles={['admin']} currentUser={currentUser}><SettingsPage /></RoleGuard>} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export function App(): JSX.Element {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
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
        if (result.success) setCurrentUser(result.data)
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
        <Route path="/*" element={
          <>
            <LoginPage onLoginSuccess={async () => {
                const r = await window.electronAPI.auth.checkSession()
                if (r.success) {
                  setCurrentUser(r.data)
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
