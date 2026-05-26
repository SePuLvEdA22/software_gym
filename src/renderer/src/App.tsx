import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Sidebar, Header } from '@/components/Layout'
import { ToastContainer } from '@/components/ToastContainer'
import { DashboardPage } from '@/pages/DashboardPage'
import { ClientsPage } from '@/pages/ClientsPage'
import { AccessPage } from '@/pages/AccessPage'
import { MembershipsPage } from '@/pages/MembershipsPage'
import { PaymentsPage } from '@/pages/PaymentsPage'
import { LogsPage } from '@/pages/LogsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { KioskPage } from '@/pages/KioskPage'

function getPageTitle(pathname: string): string {
  switch (pathname) {
    case '/':
      return 'Dashboard'
    case '/clients':
      return 'Gestión de Clientes'
    case '/access':
      return 'Control de Acceso'
    case '/memberships':
      return 'Membresías'
    case '/payments':
      return 'Pagos'
    case '/logs':
      return 'Historial de Accesos'
    case '/settings':
      return 'Configuración'
    default:
       return 'BodyFitGym'
  }
}

function AdminLayout(): JSX.Element {
  const location = useLocation()
  const title = getPageTitle(location.pathname)

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Header title={title} />
        <div className="page-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/access" element={<AccessPage />} />
            <Route path="/memberships" element={<MembershipsPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export function App(): JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route path="/kiosk" element={<KioskPage />} />
        <Route path="/*" element={
          <>
            <AdminLayout />
            <ToastContainer />
          </>
        } />
      </Routes>
    </HashRouter>
  )
}
