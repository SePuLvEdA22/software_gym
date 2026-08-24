import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icons } from './Icons'
import logoSrc from '../assets/logo.png'
import { hasPermission } from '../../../shared/permissions'
import type { User, UserRole } from '../../../shared/types'

/** Mínimo que el sidebar/guards necesitan del usuario autenticado. */
export type SessionUser = { role: UserRole; permissions?: string[] } | null

interface NavItem {
  id: string
  label: string
  icon: keyof typeof Icons
  path: string
  permission: string
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Panel Principal', icon: 'Dashboard', path: '/', permission: 'dashboard.view' },
  { id: 'clients', label: 'Clientes', icon: 'Users', path: '/clients', permission: 'clients.view' },
  { id: 'payments', label: 'Pagos', icon: 'CreditCard', path: '/payments', permission: 'payments.view' },
  { id: 'inventory', label: 'Inventario', icon: 'Package', path: '/inventory', permission: 'inventory.view' },
  { id: 'tracking', label: 'Seguimiento', icon: 'Activity', path: '/tracking', permission: 'tracking.view' },
  { id: 'logs', label: 'Historial', icon: 'History', path: '/logs', permission: 'logs.view' },
  { id: 'whatsapp', label: 'Notificaciones', icon: 'Bell', path: '/whatsapp', permission: 'whatsapp.view' },
  { id: 'messages', label: 'Mensajes', icon: 'Send', path: '/messages', permission: 'messages.view' },
  { id: 'users', label: 'Usuarios', icon: 'Shield', path: '/users', permission: 'users.view' },
  { id: 'settings', label: 'Configuración', icon: 'Settings', path: '/settings', permission: 'settings.view' }
]

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  reception: 'Recepción',
  trainer: 'Entrenador',
  accounting: 'Contabilidad'
}

/**
 * Primera ruta a la que puede entrar el usuario. Se usa al aterrizar en "/"
 * cuando no tiene dashboard.view (p. ej. entrenador → seguimiento).
 */
export function landingPathFor(currentUser: SessionUser): string {
  if (hasPermission(currentUser, 'dashboard.view')) return '/'
  const item = navItems.find(i => i.path !== '/' && hasPermission(currentUser, i.permission))
  return item?.path ?? '/no-access'
}

export function Sidebar({ currentUser, collapsed, onToggle }: { currentUser: User | null; collapsed: boolean; onToggle: () => void }): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()

  // Solo se muestran las secciones cuyo permiso tiene otorgado el usuario
  // (el admin pasa siempre: bypass en hasPermission).
  const visibleItems = navItems.filter(item => hasPermission(currentUser, item.permission))

  return (
    <>
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src={logoSrc} alt="BodyFitGym" className="sidebar-logo-img" />
            <div>
              <span className="sidebar-logo-text">BodyFitGym</span>
            </div>
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
                onClick={() => { navigate(item.path); if (collapsed) onToggle() }}
              >
                <div className="nav-icon">
                  <IconComponent />
                </div>
                <span>{item.label}</span>
              </div>
            )
          })}
        </nav>

        {currentUser && (
          <div className="sidebar-footer">
            <div className="sidebar-footer-avatar">
              {currentUser.fullName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="sidebar-footer-info">
              <div className="sidebar-footer-name">{currentUser.fullName}</div>
              <div className="sidebar-footer-role">{roleLabels[currentUser.role] || currentUser.role}</div>
            </div>
          </div>
        )}
      </aside>
      {collapsed && <div className="sidebar-overlay" onClick={onToggle} />}
    </>
  )
}

interface HeaderProps {
  title: string
  onLogout?: () => void
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
}

export function Header({ title, onLogout, onToggleSidebar, sidebarCollapsed }: HeaderProps): JSX.Element {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<{ type: string; message: string; count: number }[]>([])
  const menuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const loadNotifications = async () => {
    try {
      const notifs: { type: string; message: string; count: number }[] = []
      
      // Expiring memberships (next 3 days)
      const expiringResult = await window.electronAPI.dashboard.getExpiringSoon(3)
      if (expiringResult.success && expiringResult.data) {
        const expiring = expiringResult.data
        if (expiring.length > 0) {
          notifs.push({ type: 'warning', message: `Membresías por vencer (3 días)`, count: expiring.length })
        }
      }
      
      // Debtors
      const debtorsResult = await window.electronAPI.client.getDebtors()
      if (debtorsResult.success && debtorsResult.data) {
        const debtors = debtorsResult.data
        if (debtors.length > 0) {
          notifs.push({ type: 'error', message: `Clientes con deuda pendiente`, count: debtors.length })
        }
      }
      
      setNotifications(notifs)
    } catch { /* fallo silencioso: las notificaciones se recargan en el próximo intervalo */ }
  }

  useEffect(() => {
    window.electronAPI.auth.checkSession().then((r) => {
      if (r.success) setCurrentUser(r.data ?? null)
    })
    loadNotifications()
    // Refresh every 5 minutes
    const interval = setInterval(loadNotifications, 300000)
    return () => clearInterval(interval)
  }, [])

  const totalNotifications = notifications.reduce((sum, n) => sum + n.count, 0)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    if (showMenu || showNotifications) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu, showNotifications])

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="sidebar-toggle" onClick={onToggleSidebar} title={sidebarCollapsed ? 'Mostrar menú' : 'Ocultar menú'}>
          {sidebarCollapsed ? <Icons.Menu /> : <Icons.Close />}
        </button>
        <h1 className="header-title">{title}</h1>
      </div>
      <div className="header-actions" style={{ position: 'relative' }}>
        <div ref={notifRef} style={{ position: 'relative', display: 'inline-flex' }}>
          <button className="header-icon-btn" title="Notificaciones" onClick={() => { setShowNotifications(!showNotifications); loadNotifications(); }}>
            <Icons.Bell />
            {totalNotifications > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -2,
                minWidth: 18, height: 18,
                borderRadius: 9, padding: '0 4px',
                backgroundColor: 'var(--color-error)',
                color: '#fff', fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1
              }}>
                {totalNotifications > 99 ? '99+' : totalNotifications}
              </span>
            )}
          </button>
          {showNotifications && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: 'var(--color-surface)', borderRadius: 10,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 1000,
              minWidth: 280, overflow: 'hidden',
              border: '1px solid var(--color-surface-container-highest)'
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-surface-container-highest)', fontSize: 14, fontWeight: 700 }}>
                Notificaciones
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--color-on-surface-variant)', fontSize: 13 }}>
                  No hay notificaciones
                </div>
              ) : (
                notifications.map((n, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px',
                    borderBottom: i < notifications.length - 1 ? '1px solid var(--color-surface-container-highest)' : 'none'
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      backgroundColor: n.type === 'error' ? 'var(--color-error)' :
                                       n.type === 'warning' ? 'var(--color-warning)' :
                                       'var(--color-info)'
                    }} />
                    <span style={{ flex: 1, fontSize: 13 }}>{n.message}</span>
                    <span className="chip" style={{ fontSize: 12 }}>{n.count}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="header-user-badge" onClick={() => setShowMenu(!showMenu)}>
          <div className="header-user-avatar">
            {currentUser?.fullName?.charAt(0).toUpperCase() || 'U'}
          </div>
          <span className="header-user-name">{currentUser?.fullName || 'Usuario'}</span>
          <Icons.ChevronDown />
        </div>
        {showMenu && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: 'var(--color-surface)',
            borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 1000,
            minWidth: 200,
            overflow: 'hidden',
            border: '1px solid var(--color-surface-container-highest)'
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-surface-container-highest)', fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
              {currentUser?.username}
            </div>
            <div
              style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}
              onClick={() => { setShowMenu(false); onLogout?.() }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-container)')}
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
