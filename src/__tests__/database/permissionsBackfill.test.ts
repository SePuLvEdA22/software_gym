import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDatabase, closeDatabase, getDatabase } from '../../main/database/index'
import { createUser, getUserById } from '../../main/database/users'
import { setSessionUser } from '../../main/database/users'
import { requirePermission } from '../../main/ipc/helpers'
import { ROLE_DEFAULT_PERMISSIONS } from '../../shared/permissions'
import type { User } from '../../shared/types'

describe('requirePermission (backend)', () => {
  it('sin sesión devuelve No autenticado', () => {
    setSessionUser(null)
    expect(requirePermission('clients.view')).toEqual({ success: false, error: 'No autenticado' })
  })

  it('admin tiene bypass total', () => {
    const admin = { id: '1', role: 'admin', permissions: [] } as unknown as User
    setSessionUser(admin)
    expect(requirePermission('users.delete')).toBeNull()
    setSessionUser(null)
  })

  it('usuario con el permiso otorgado pasa; sin él, No autorizado', () => {
    const reception = { id: '2', role: 'reception', permissions: ['clients.view'] } as unknown as User
    setSessionUser(reception)
    expect(requirePermission('clients.view')).toBeNull()
    expect(requirePermission('memberships.create')).toEqual({ success: false, error: 'No autorizado' })
    setSessionUser(null)
  })
})

describe('Migración 013: backfill de permisos por rol', () => {
  beforeAll(async () => {
    await initDatabase()
    // Usuarios "legacy": creados con el array de permisos vacío
    createUser({ username: 'backfill_rec', fullName: 'Rec Legacy', password: 'test1234', role: 'reception' })
    createUser({ username: 'backfill_trn', fullName: 'Trainer Legacy', password: 'test1234', role: 'trainer' })
    createUser({ username: 'backfill_act', fullName: 'Conta Legacy', password: 'test1234', role: 'accounting' })

    // Simula una BD existente que aún no ha aplicado la migración 013
    getDatabase().prepare("DELETE FROM _migrations WHERE name = '013_backfill_user_permissions'").run()
    closeDatabase()
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  const lookup = (username: string): User | null => {
    const row = getDatabase().prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: string } | undefined
    return row ? getUserById(row.id) : null
  }

  it('recepción recibe los defaults de su rol', () => {
    const user = lookup('backfill_rec')
    expect(user).not.toBeNull()
    expect(user!.permissions).toEqual(ROLE_DEFAULT_PERMISSIONS.reception)
  })

  it('entrenador y contabilidad también son rellenados según su rol', () => {
    expect(lookup('backfill_trn')!.permissions).toEqual(ROLE_DEFAULT_PERMISSIONS.trainer)
    expect(lookup('backfill_act')!.permissions).toEqual(ROLE_DEFAULT_PERMISSIONS.accounting)
  })

  it('la migración no se ejecuta dos veces sobre permisos ya otorgados', async () => {
    // Un usuario con permisos personalizados NO debe ser tocado por re-ejecuciones
    createUser({ username: 'custom_perms', fullName: 'Custom', password: 'test1234', role: 'trainer', permissions: ['clients.view'] })
    getDatabase().prepare("DELETE FROM _migrations WHERE name = '013_backfill_user_permissions'").run()
    closeDatabase()
    await initDatabase()

    const user = getDatabase().prepare('SELECT permissions FROM users WHERE username = ?').get('custom_perms') as { permissions: string }
    expect(JSON.parse(user.permissions)).toEqual(['clients.view'])
  })
})
