import { useLocation, useNavigate } from 'react-router-dom'
import { Icons } from './Icons'
import logoSrc from '../assets/logo.png'

interface NavItem {
  id: string
  label: string
  icon: keyof typeof Icons
  path: string
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'Dashboard', path: '/' },
  { id: 'clients', label: 'Clientes', icon: 'Users', path: '/clients' },
  { id: 'access', label: 'Control de Acceso', icon: 'Access', path: '/access' },
  { id: 'memberships', label: 'Membresías', icon: 'Membership', path: '/memberships' },
  { id: 'payments', label: 'Pagos', icon: 'CreditCard', path: '/payments' },
  { id: 'logs', label: 'Historial', icon: 'History', path: '/logs' },
  { id: 'whatsapp', label: 'Notificaciones', icon: 'Bell', path: '/whatsapp' },
  { id: 'settings', label: 'Configuración', icon: 'Settings', path: '/settings' }
]

export function Sidebar(): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
          <div className="sidebar-logo">
          <img src={logoSrc} alt="BodyFitGym" className="sidebar-logo-img" />
          <span className="sidebar-logo-text">BodyFitGym</span>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const IconComponent = Icons[item.icon]
          const isActive = location.pathname === item.path || 
            (item.path === '/' && location.pathname === '/') ||
            (item.path !== '/' && location.pathname.startsWith(item.path))
          
          return (
            <div
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <div className="nav-icon">
                <IconComponent />
              </div>
              <span>{item.label}</span>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

export function Header({ title }: { title: string }): JSX.Element {
  return (
    <header className="header">
      <h1 className="header-title">{title}</h1>
      <div className="header-actions">
        <div className="badge badge-default">
          <Icons.User />
          <span style={{ marginLeft: '6px' }}>Administrador</span>
        </div>
      </div>
    </header>
  )
}
