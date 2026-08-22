import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { addDays, subMinutes } from 'date-fns'
import { initDatabase, closeDatabase, getDatabase } from '../../main/database/index'
import { createClient } from '../../main/database/clients'
import {
  createPlan,
  createMembership,
  freezeMembership,
  unfreezeMembership,
  autoUnfreezeDueMemberships,
  getFreezeHistory,
} from '../../main/database/memberships'
import type { Client, Membership } from '../../shared/types'

const baseClient: Omit<Client, 'id' | 'registrationDate'> = {
  fullName: 'Cliente Auto-Unfreeze',
  documentId: '',
  birthDate: '1990-01-01',
  gender: 'male',
  phone: '3001112233',
  email: 'autounfreeze@example.com',
  address: 'Calle 1',
  photo: null,
  accessCode: '',
  status: 'active',
  emergencyContact: { name: '', phone: '', relationship: '', notes: '' },
}

let seq = 0

function setupFrozenMembership(plannedDays?: number): Membership {
  seq++
  const client = createClient({
    ...baseClient,
    documentId: `AU-${Date.now()}-${seq}`,
    accessCode: `AU${Date.now()}${seq}`,
  })
  const plan = createPlan({
    name: `Plan AU ${seq}`,
    type: 'monthly',
    price: 80000,
    durationDays: 30,
    description: '',
  })
  const membership = createMembership(client.id, plan.id)
  expect(membership).not.toBeNull()
  const frozen = freezeMembership(membership!.id, 'Vacaciones', plannedDays)
  expect(frozen?.status).toBe('frozen')
  return frozen!
}

function backdateFreeze(membershipId: string, daysAgo: number): void {
  // Retrodata dejando un margen de minutos para que el cómputo por días sea estable.
  getDatabase()
    .prepare('UPDATE memberships SET frozen_at = ? WHERE id = ?')
    .run(subMinutes(addDays(new Date(), -daysAgo), 120).toISOString(), membershipId)
}

function rawMembership(id: string): { status: string; end_date: string } {
  return getDatabase().prepare('SELECT status, end_date FROM memberships WHERE id = ?').get(id) as { status: string; end_date: string }
}

describe('Auto-descongelado por días planeados', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  it('descongela automáticamente al vencer los días planeados y marca el historial como automático', () => {
    const m = setupFrozenMembership(6)
    const endDateBefore = rawMembership(m.id).end_date

    backdateFreeze(m.id, 7)
    const count = autoUnfreezeDueMemberships()
    expect(count).toBeGreaterThanOrEqual(1)

    const after = rawMembership(m.id)
    expect(after.status).toBe('active')

    // La fecha de fin se extendió por los días congelados: vuelven a contar.
    expect(new Date(after.end_date).getTime()).toBeGreaterThan(new Date(endDateBefore).getTime())

    const history = getFreezeHistory(m.id)
    const last = history[0]
    expect(last.unfrozenAt).not.toBeNull()
    expect(last.unfrozenBy).toBe('auto')
  })

  it('NO descongela si aún no se cumplen los días planeados', () => {
    const m = setupFrozenMembership(6)
    // Congelado hace 5 días de 6 planeados: la congelación sigue vigente.
    backdateFreeze(m.id, 5)
    autoUnfreezeDueMemberships()

    expect(rawMembership(m.id).status).toBe('frozen')
  })

  it('congelamiento sin días planeados nunca se descongela automáticamente', () => {
    const m = setupFrozenMembership(undefined)
    backdateFreeze(m.id, 60)
    autoUnfreezeDueMemberships()

    expect(rawMembership(m.id).status).toBe('frozen')
  })

  it('el descongelado manual queda marcado como manual', () => {
    const m = setupFrozenMembership(6)
    const result = unfreezeMembership(m.id)
    expect(result?.status).toBe('active')

    const history = getFreezeHistory(m.id)
    expect(history[0].unfrozenBy).toBe('manual')
  })
})
