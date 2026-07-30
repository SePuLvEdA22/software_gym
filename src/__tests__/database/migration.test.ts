import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDatabase, closeDatabase, getDatabase } from '../../main/database/index'
import { createClient } from '../../main/database/clients'
import {
  createPlan,
  createMembership,
  freezeMembership,
} from '../../main/database/memberships'
import type { Client } from '../../shared/types'

const sampleClient: Omit<Client, 'id' | 'registrationDate'> = {
  fullName: 'Test Cliente Migración',
  documentId: 'MIG-TEST',
  birthDate: '1990-01-01',
  gender: 'male',
  phone: '3000000000',
  email: 'test@migracion.com',
  address: 'Calle Test',
  photo: null,
  accessCode: 'MIG001',
  status: 'active',
  emergencyContact: { name: '', phone: '', relationship: '', notes: '' },
}

/**
 * SQL que se ejecuta en runLegacyMigration() para sincronizar
 * el estado del cliente con el de su membresía más reciente.
 */
const SYNC_CLIENT_STATUS_SQL = `
  UPDATE clients SET status =
    CASE
      WHEN EXISTS (
        SELECT 1 FROM memberships
        WHERE client_id = clients.id
          AND status = 'active'
          AND end_date >= datetime('now')
      ) THEN 'active'
      WHEN EXISTS (
        SELECT 1 FROM memberships
        WHERE client_id = clients.id
          AND status = 'frozen'
      ) THEN 'active'
      ELSE 'inactive'
    END
`

describe('Migración: sincronización estado cliente ↔ membresía', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  it('cliente con membresía activa y vigente → status = active', () => {
    // Escenario real de migración: cliente viene como 'active' de la BD antigua
    const c = createClient({ ...sampleClient, documentId: 'ACT-001', accessCode: 'ACT01' })
    const plan = createPlan({ name: 'Plan Activo', type: 'monthly', price: 50000, durationDays: 30, description: '' })
    createMembership(c.id, plan.id)

    getDatabase().exec(SYNC_CLIENT_STATUS_SQL)

    const updated = getDatabase().prepare('SELECT status FROM clients WHERE id = ?').get(c.id) as { status: string }
    expect(updated.status).toBe('active')
  })

  it('cliente con membresía vencida (end_date pasado) → status = inactive', () => {
    // Escenario real de migración: cliente viene como 'active' pero su membresía expiró
    const c = createClient({ ...sampleClient, documentId: 'EXP-001', accessCode: 'EXP01' })
    const plan = createPlan({ name: 'Plan Vencido', type: 'daily', price: 10000, durationDays: 1, description: '' })
    const m = createMembership(c.id, plan.id)

    // Forzar end_date al pasado y status = 'expired' (lo que hace la migración)
    const pastDate = new Date(Date.now() - 86400000 * 10).toISOString()
    getDatabase().prepare("UPDATE memberships SET end_date = ?, status = 'expired' WHERE id = ?").run(pastDate, m!.id)

    getDatabase().exec(SYNC_CLIENT_STATUS_SQL)

    const updated = getDatabase().prepare('SELECT status FROM clients WHERE id = ?').get(c.id) as { status: string }
    expect(updated.status).toBe('inactive')
  })

  it('cliente con membresía congelada → status = active', () => {
    const c = createClient({ ...sampleClient, documentId: 'FRZ-001', accessCode: 'FRZ01' })
    const plan = createPlan({ name: 'Plan Congelado', type: 'monthly', price: 50000, durationDays: 30, description: '' })
    const m = createMembership(c.id, plan.id)
    freezeMembership(m!.id, 'Vacaciones', 10)

    getDatabase().exec(SYNC_CLIENT_STATUS_SQL)

    const updated = getDatabase().prepare('SELECT status FROM clients WHERE id = ?').get(c.id) as { status: string }
    expect(updated.status).toBe('active')
  })

  it('cliente con membresía activa pero end_date vencido → status = inactive', () => {
    // Caso borde: membership.status='active' pero end_date ya pasó
    const c = createClient({ ...sampleClient, documentId: 'EXP-ACT', accessCode: 'EXPAC' })
    const plan = createPlan({ name: 'Plan Activo pero Vencido', type: 'daily', price: 10000, durationDays: 1, description: '' })
    const m = createMembership(c.id, plan.id)

    const pastDate = new Date(Date.now() - 86400000 * 5).toISOString()
    getDatabase().prepare("UPDATE memberships SET end_date = ? WHERE id = ?").run(pastDate, m!.id)

    getDatabase().exec(SYNC_CLIENT_STATUS_SQL)

    const updated = getDatabase().prepare('SELECT status FROM clients WHERE id = ?').get(c.id) as { status: string }
    expect(updated.status).toBe('inactive')
  })

  it('cliente sin membresías → status = inactive', () => {
    const c = createClient({ ...sampleClient, documentId: 'NOMEM-01', accessCode: 'NOM01' })

    getDatabase().exec(SYNC_CLIENT_STATUS_SQL)

    const updated = getDatabase().prepare('SELECT status FROM clients WHERE id = ?').get(c.id) as { status: string }
    expect(updated.status).toBe('inactive')
  })

  it('cliente con membresía activa Y otra vencida → status = active (toma la activa)', () => {
    const c = createClient({ ...sampleClient, documentId: 'MULTI-01', accessCode: 'MUL01' })
    const planActivo = createPlan({ name: 'Plan Vigente', type: 'monthly', price: 50000, durationDays: 30, description: '' })
    const planVencido = createPlan({ name: 'Plan Expirado', type: 'daily', price: 10000, durationDays: 1, description: '' })

    const mExpired = createMembership(c.id, planVencido.id)
    const pastDate = new Date(Date.now() - 86400000 * 10).toISOString()
    getDatabase().prepare("UPDATE memberships SET end_date = ?, status = 'expired' WHERE id = ?").run(pastDate, mExpired!.id)

    createMembership(c.id, planActivo.id)

    getDatabase().exec(SYNC_CLIENT_STATUS_SQL)

    const updated = getDatabase().prepare('SELECT status FROM clients WHERE id = ?').get(c.id) as { status: string }
    expect(updated.status).toBe('active')
  })
})
