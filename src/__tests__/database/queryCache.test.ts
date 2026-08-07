import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { initDatabase, closeDatabase } from '../../main/database/index'
import { cached, clearQueryCache } from '../../main/database/queryCache'
import { getInactiveClients, logAccess, createMembership } from '../../main/database/memberships'
import { createClient } from '../../main/database/clients'
import { createPlan } from '../../main/database/memberships'
import type { Client } from '../../shared/types'

const sampleClient: Omit<Client, 'id' | 'registrationDate'> = {
  fullName: 'Cliente Cache',
  documentId: 'CACHE-001',
  birthDate: '1990-05-15',
  gender: 'male',
  phone: '3001112233',
  email: 'cache@example.com',
  address: 'Calle 1',
  photo: null,
  accessCode: '112233',
  status: 'active',
  emergencyContact: { name: '', phone: '', relationship: '', notes: '' },
}

describe('Cache de queries del dashboard', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  it('debería devolver el valor cacheado sin re-ejecutar la función dentro del TTL', () => {
    clearQueryCache()
    let executions = 0
    const fn = () => {
      executions++
      return { value: executions }
    }

    const first = cached('test:ttl', 60_000, fn)
    const second = cached('test:ttl', 60_000, fn)

    expect(first.value).toBe(1)
    expect(second.value).toBe(1)
    expect(executions).toBe(1)
  })

  it('debería re-ejecutar la función cuando el TTL expira', () => {
    clearQueryCache()
    vi.useFakeTimers()
    try {
      let executions = 0
      const fn = () => {
        executions++
        return executions
      }

      cached('test:expire', 1000, fn)
      vi.advanceTimersByTime(1001)
      const after = cached('test:expire', 1000, fn)

      expect(executions).toBe(2)
      expect(after).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('clearQueryCache debería invalidar las entradas existentes', () => {
    let executions = 0
    const fn = () => ++executions

    cached('test:clear', 60_000, fn)
    clearQueryCache()
    cached('test:clear', 60_000, fn)

    expect(executions).toBe(2)
  })

  it('getInactiveClients debería refrescarse tras registrar un acceso concedido', () => {
    clearQueryCache()
    const plan = createPlan({
      name: 'Plan Cache',
      type: 'monthly',
      price: 50000,
      durationDays: 30,
      description: '',
    })
    const client = createClient({
      ...sampleClient,
      documentId: `CACHE-${Date.now()}`,
      accessCode: `CC${Date.now()}`,
    })
    createMembership(client.id, plan.id)

    // El cliente recién registrado sin accesos debería aparecer como inactivo.
    const inactiveBefore = getInactiveClients(365)
    expect(inactiveBefore.some((c) => c.clientId === client.id)).toBe(true)

    // El cache no debería volver a consultar la BD (misma respuesta sin re-consulta).
    const inactiveCached = getInactiveClients(365)
    expect(inactiveCached).toEqual(inactiveBefore)

    // Un acceso concedido invalida el cache: el cliente ya no es inactivo.
    logAccess(client.accessCode, 'granted', 'ok', client.id, client.fullName)
    const inactiveAfter = getInactiveClients(365)
    expect(inactiveAfter.some((c) => c.clientId === client.id)).toBe(false)
  })
})
