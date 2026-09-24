import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDatabase, closeDatabase, getDatabase } from '../../main/database/index'
import { createClient } from '../../main/database/clients'
import { createPlan } from '../../main/database/plans'
import { createMembershipWithPayment } from '../../main/database/payments'
import { getMembershipPaymentMethods } from '../../main/database/payments'
import { createUser, getUserById, setSessionUser } from '../../main/database/users'
import { requireAnyPermission } from '../../main/ipc/helpers'
import { ROLE_DEFAULT_PERMISSIONS } from '../../shared/permissions'
import type { User } from '../../shared/types'

describe('Permiso payments.edit_method', () => {
  it('está en el catálogo y en los defaults de reception/trainer/accounting', () => {
    expect(ROLE_DEFAULT_PERMISSIONS.reception).toContain('payments.edit_method')
    expect(ROLE_DEFAULT_PERMISSIONS.trainer).toContain('payments.edit_method')
    expect(ROLE_DEFAULT_PERMISSIONS.accounting).toContain('payments.edit_method')
  })

  it('trainer edita método sin ver pagos por defecto', () => {
    expect(ROLE_DEFAULT_PERMISSIONS.trainer).not.toContain('payments.view')
    expect(ROLE_DEFAULT_PERMISSIONS.trainer).not.toContain('payments.create')
    expect(ROLE_DEFAULT_PERMISSIONS.trainer).toContain('payments.edit_method')
  })
})

describe('requireAnyPermission (transición edit_method/create)', () => {
  it('permite con el permiso nuevo aunque falte el anterior', () => {
    setSessionUser({ id: 't1', role: 'trainer', permissions: ['payments.edit_method'] } as unknown as User)
    expect(requireAnyPermission(['payments.edit_method', 'payments.create'])).toBeNull()
    setSessionUser(null)
  })

  it('permite con el permiso anterior aunque falte el nuevo (BD sin migrar)', () => {
    setSessionUser({ id: 'r1', role: 'reception', permissions: ['payments.create'] } as unknown as User)
    expect(requireAnyPermission(['payments.edit_method', 'payments.create'])).toBeNull()
    setSessionUser(null)
  })

  it('deniega sin ninguno de los dos', () => {
    setSessionUser({ id: 't2', role: 'trainer', permissions: ['clients.view'] } as unknown as User)
    expect(requireAnyPermission(['payments.edit_method', 'payments.create'])).toEqual({
      success: false,
      error: 'No autorizado'
    })
    setSessionUser(null)
  })
})

describe('getMembershipPaymentMethods (vista ciega a montos)', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  it('retorna solo id + método, sin amount/discount/notes/date', () => {
    const c = createClient({
      fullName: 'Cliente Ciego',
      documentId: `BLIND-${Date.now()}`,
      birthDate: '1990-01-01',
      gender: 'male',
      phone: '3009998877',
      email: '',
      address: '',
      photo: null,
      accessCode: `BL${Date.now()}`,
      status: 'active',
      emergencyContact: { name: '', phone: '', relationship: '', notes: '' }
    })
    const plan = createPlan({ name: 'Plan Ciego', type: 'monthly', price: 50000, durationDays: 30, description: '' })
    const { membership } = createMembershipWithPayment(c.id, plan.id, 50000, 'cash')
    expect(membership).not.toBeNull()
    const methods = getMembershipPaymentMethods(membership!.id)
    expect(methods.length).toBe(1)
    expect(Object.keys(methods[0]).sort()).toEqual(['id', 'method'])
    expect(methods[0].method).toBe('cash')
  })
})

describe('Migración 019: grant edit_method aditivo', () => {
  beforeAll(async () => {
    await initDatabase()
    createUser({ username: 'm19_trainer', fullName: 'Trainer M19', password: 'test1234', role: 'trainer', permissions: ['clients.view', 'memberships.view'] })
    createUser({ username: 'm19_recep', fullName: 'Recep M19', password: 'test1234', role: 'reception', permissions: ['payments.view', 'payments.create'] })
    createUser({ username: 'm19_custom', fullName: 'Custom M19', password: 'test1234', role: 'trainer', permissions: ['clients.view', 'payments.edit_method'] })

    getDatabase().prepare("DELETE FROM _migrations WHERE name = '019_grant_edit_payment_method'").run()
    closeDatabase()
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  const permsOf = (username: string): string[] => {
    const row = getDatabase().prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: string } | undefined
    return getUserById(row!.id)!.permissions
  }

  it('agrega el permiso a trainer y reception existentes sin quitar los previos', () => {
    expect(permsOf('m19_trainer')).toContain('payments.edit_method')
    expect(permsOf('m19_trainer')).toContain('clients.view')
    expect(permsOf('m19_recep')).toContain('payments.edit_method')
    expect(permsOf('m19_recep')).toContain('payments.create')
  })

  it('es idempotente: no duplica el permiso si ya existe', () => {
    const perms = permsOf('m19_custom')
    expect(perms.filter((p) => p === 'payments.edit_method').length).toBe(1)
  })
})
