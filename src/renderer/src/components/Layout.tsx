import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icons } from './Icons'
import logoSrc from '../assets/logo.png'
import type { UserRole } from '../../../shared/types'

interface NavItem {
  id: string
  label: string
  icon: keyof typeof Icons
  path: string
  roles?: UserRole[]
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'Dashboard', path: '/', roles: ['admin', 'reception', 'accounting'] },
  { id: 'clients', label: 'Clientes', icon: 'Users', path: '/clients' },
  { id: 'access', label: 'Control de Acceso', icon: 'Access', path: '/access', roles: ['admin', 'reception'] },
  { id: 'memberships', label: 'Membresías', icon: 'Membership', path: '/memberships' },
  { id: 'payments', label: 'Pagos', icon: 'CreditCard', path: '/payments', roles: ['admin', 'reception', 'accounting'] },
  { id: 'inventory', label: 'Inventario', icon: 'Package', path: '/inventory', roles: ['admin', 'reception', 'accounting'] },
  { id: 'tracking', label: 'Seguimiento', icon: 'Activity', path: '/tracking', roles: ['admin', 'trainer'] },
  { id: 'logs', label: 'Historial', icon: 'History', path: '/logs' },
  { id: 'whatsapp', label: 'Notificaciones', icon: 'Bell', path: '/whatsapp', roles: ['admin', 'reception'] },
  { id: 'messages', label: 'Mensajes', icon: 'Send', path: '/messages', roles: ['admin'] },
  { id: 'users', label: 'Usuarios', icon: 'Shield', path: '/users', roles: ['admin'] },
  { id: 'settings', label: 'Configuración', icon: 'Settings', path: '/settings', roles: ['admin'] }
]

export function Sidebar({ currentUser }: { currentUser: any }): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()

  const visibleItems = navItems.filter(item => {
    if (!item.roles) return true
    if (!currentUser) return false
    return item.roles.includes(currentUser.role)
  })

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
          <div className="sidebar-logo">
          <img src={logoSrc} alt="BodyFitGym" className="sidebar-logo-img" />
          <span className="sidebar-logo-text">BodyFitGym</span>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {visibleItems.map((item) => {
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

interface HeaderProps {
  title: string
  onLogout?: () => void
}

export function Header({ title, onLogout }: HeaderProps): JSX.Element {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI.auth.checkSession().then((r: any) => {
      if (r.success) setCurrentUser(r.data)
    })
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    reception: 'Recepción',
    trainer: 'Entrenador',
    accounting: 'Contabilidad'
  }

  return (
    <header className="header">
      <h1 className="header-title">{title}</h1>
      <div className="header-actions" style={{ position: 'relative' }} ref={menuRef}>
        <div
          className="badge badge-default"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setShowMenu(!showMenu)}
        >
          <Icons.User />
          <span style={{ marginLeft: '6px' }}>
            {currentUser ? `${currentUser.fullName} (${roleLabels[currentUser.role] || currentUser.role})` : 'Usuario'}
          </span>
          <Icons.ChevronDown />
        </div>
        {showMenu && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: 'var(--color-surface)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 1000,
            minWidth: 180,
            overflow: 'hidden'
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-secondary)' }}>
              {currentUser?.username}
            </div>
            <div
              style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              onClick={() => { setShowMenu(false); onLogout?.() }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Icons.Logout />
              <span>Cerrar Sesión</span>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
