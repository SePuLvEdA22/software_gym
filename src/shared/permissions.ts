import type { UserRole } from './types'

export interface PermissionDef {
  id: string
  label: string
}

export interface PermissionGroup {
  label: string
  permissions: PermissionDef[]
}

// Catálogo único de permisos granulares. Es la fuente de verdad para:
// - el formulario de usuarios (checkboxes),
// - el filtrado del menú lateral (Layout),
// - la verificación en los handlers IPC (requirePermission).
export const PERMISSION_GROUPS: PermissionGroup[] = [
  { label: 'Panel Principal', permissions: [{ id: 'dashboard.view', label: 'Ver dashboard' }] },
  {
    label: 'Clientes',
    permissions: [
      { id: 'clients.view', label: 'Ver clientes' },
      { id: 'clients.create', label: 'Crear clientes' },
      { id: 'clients.edit', label: 'Editar clientes' },
      { id: 'clients.delete', label: 'Eliminar clientes' }
    ]
  },
  {
    label: 'Pagos',
    permissions: [
      { id: 'payments.view', label: 'Ver pagos' },
      { id: 'payments.create', label: 'Registrar pagos' }
    ]
  },
  {
    label: 'Membresías',
    permissions: [
      { id: 'memberships.view', label: 'Ver membresías' },
      { id: 'memberships.create', label: 'Crear membresías' },
      { id: 'memberships.freeze', label: 'Congelar/Descongelar' }
    ]
  },
  {
    label: 'Inventario',
    permissions: [
      { id: 'inventory.view', label: 'Ver inventario' },
      { id: 'inventory.create', label: 'Agregar productos' },
      { id: 'inventory.edit', label: 'Editar productos' },
      { id: 'inventory.delete', label: 'Eliminar productos' }
    ]
  },
  {
    label: 'Seguimiento',
    permissions: [
      { id: 'tracking.view', label: 'Ver seguimiento' },
      { id: 'tracking.edit', label: 'Editar medidas/objetivos' }
    ]
  },
  {
    label: 'Reportes',
    permissions: [
      { id: 'reports.view', label: 'Ver reportes' },
      { id: 'reports.export', label: 'Exportar datos' }
    ]
  },
  {
    label: 'Notificaciones',
    permissions: [
      { id: 'messages.view', label: 'Ver mensajes' },
      { id: 'messages.send', label: 'Enviar mensajes' },
      { id: 'whatsapp.view', label: 'Ver historial WhatsApp' }
    ]
  },
  { label: 'Historial de Accesos', permissions: [{ id: 'logs.view', label: 'Ver historial' }] },
  {
    label: 'Configuración',
    permissions: [
      { id: 'settings.view', label: 'Ver configuración' },
      { id: 'settings.edit', label: 'Editar configuración' }
    ]
  },
  {
    label: 'Usuarios',
    permissions: [
      { id: 'users.view', label: 'Ver usuarios' },
      { id: 'users.create', label: 'Crear usuarios' },
      { id: 'users.edit', label: 'Editar usuarios' },
      { id: 'users.delete', label: 'Eliminar usuarios' }
    ]
  },
  {
    label: 'Puerta',
    permissions: [
      { id: 'door.open', label: 'Abrir puerta' },
      { id: 'door.configure', label: 'Configurar puerta' }
    ]
  }
]

export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.id))

// Defaults por rol. Alineados con el acceso que cada rol tenía antes de que
// los permisos fueran efectivos; se usan al crear usuarios y en la migración
// que rellena permisos a usuarios existentes con el array vacío.
export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ALL_PERMISSIONS,
  reception: [
    'dashboard.view',
    'clients.view', 'clients.create', 'clients.edit', 'clients.delete',
    'payments.view', 'payments.create',
    'memberships.view', 'memberships.create', 'memberships.freeze',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete',
    'whatsapp.view',
    'logs.view',
    'door.open'
  ],
  trainer: [
    'clients.view',
    'memberships.view',
    'tracking.view', 'tracking.edit',
    'logs.view'
  ],
  accounting: [
    'dashboard.view',
    'clients.view',
    'payments.view', 'payments.create',
    'memberships.view',
    'inventory.view',
    'reports.view', 'reports.export',
    'logs.view'
  ]
}

/**
 * Permiso efectivo: admin tiene acceso total; el resto depende del array
 * guardado en el usuario.
 */
export function hasPermission(
  user: { role: UserRole; permissions?: string[] } | null | undefined,
  permission: string
): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return user.permissions?.includes(permission) ?? false
}

export function hasAnyPermission(
  user: { role: UserRole; permissions?: string[] } | null | undefined,
  permissions: string[]
): boolean {
  return permissions.some(p => hasPermission(user, p))
}
