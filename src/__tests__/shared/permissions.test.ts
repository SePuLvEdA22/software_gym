import { describe, it, expect } from 'vitest'
import {
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  hasPermission,
  hasAnyPermission
} from '../../shared/permissions'

describe('Catálogo de permisos', () => {
  it('no tiene ids duplicados', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length)
  })

  it('todos los defaults de rol existen en el catálogo', () => {
    for (const [role, perms] of Object.entries(ROLE_DEFAULT_PERMISSIONS)) {
      for (const p of perms) {
        expect(ALL_PERMISSIONS, `${role} referencia permiso desconocido: ${p}`).toContain(p)
      }
    }
  })

  it('admin tiene todos los permisos por defecto', () => {
    expect([...ROLE_DEFAULT_PERMISSIONS.admin].sort()).toEqual([...ALL_PERMISSIONS].sort())
  })

  it('cada grupo del catálogo tiene al menos un permiso con id y label', () => {
    for (const group of PERMISSION_GROUPS) {
      expect(group.permissions.length).toBeGreaterThan(0)
      for (const p of group.permissions) {
        expect(p.id).toBeTruthy()
        expect(p.label).toBeTruthy()
      }
    }
  })
})

describe('hasPermission', () => {
  it('usuario nulo o sin sesión: sin acceso', () => {
    expect(hasPermission(null, 'clients.view')).toBe(false)
    expect(hasPermission(undefined, 'clients.view')).toBe(false)
  })

  it('admin pasa siempre (bypass)', () => {
    const admin = { role: 'admin' as const, permissions: [] }
    expect(hasPermission(admin, 'settings.edit')).toBe(true)
    expect(hasPermission(admin, 'cualquier.cosita')).toBe(true)
  })

  it('no admin: depende del array otorgado', () => {
    const reception = { role: 'reception' as const, permissions: ['clients.view'] }
    expect(hasPermission(reception, 'clients.view')).toBe(true)
    expect(hasPermission(reception, 'users.view')).toBe(false)
  })

  it('no admin sin array de permisos: sin acceso', () => {
    const trainer = { role: 'trainer' as const, permissions: undefined }
    expect(hasPermission(trainer, 'tracking.view')).toBe(false)
  })
})

describe('hasAnyPermission', () => {
  it('true si tiene al menos uno', () => {
    const user = { role: 'accounting' as const, permissions: ['payments.view'] }
    expect(hasAnyPermission(user, ['reports.export', 'payments.view'])).toBe(true)
    expect(hasAnyPermission(user, ['reports.export', 'users.view'])).toBe(false)
  })
})
