import type { ZodType } from 'zod'
import { getSessionUser } from '../database/users'
import type { UserRole } from '../../shared/types'

export function validateOrThrow(schema: ZodType, data: unknown): void {
  const result = schema.safeParse(data)
  if (!result.success) {
    const messages = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
    throw new Error(`Datos inválidos: ${messages}`)
  }
}

export function requireRole(...roles: UserRole[]): { success: false; error: string } | null {
  const user = getSessionUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!roles.includes(user.role)) return { success: false, error: 'No autorizado' }
  return null
}

/**
 * Verificación de permiso granular. El admin tiene acceso total; el resto
 * depende del array de permisos guardado en el usuario (shared/permissions).
 */
export function requirePermission(permission: string): { success: false; error: string } | null {
  const user = getSessionUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role === 'admin') return null
  if (!(user.permissions ?? []).includes(permission)) {
    return { success: false, error: 'No autorizado' }
  }
  return null
}
