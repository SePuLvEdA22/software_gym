import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDatabase, closeDatabase, getDatabase } from '../../main/database/index'
import { createClient } from '../../main/database/clients'
import { recordPayment, getPaymentsSummary } from '../../main/database/payments'
import type { Client } from '../../shared/types'

const sampleClient: Omit<Client, 'id' | 'registrationDate'> = {
  fullName: 'Summary Test',
  documentId: 'SUM-001',
  birthDate: '1990-01-01',
  gender: 'male',
  phone: '3000000001',
  email: 'sum@example.com',
  address: 'Calle Summary',
  photo: null,
  accessCode: 'SUM001',
  status: 'active',
  emergencyContact: { name: '', phone: '', relationship: '', notes: '' },
}

function setPaymentDate(paymentId: string, isoDate: string): void {
  const db = getDatabase()
  db.prepare('UPDATE payments SET date = ? WHERE id = ?').run(isoDate, paymentId)
}

describe('getPaymentsSummary', () => {
  let clientId: string

  beforeAll(async () => {
    await initDatabase()
    const client = createClient({
      ...sampleClient,
      documentId: `SUM-${Date.now()}`,
      accessCode: `S${String(Date.now()).slice(-6)}`,
    })
    clientId = client.id

    // Septiembre 2026: 2 pagos (bordes primero y último día)
    const p1 = recordPayment(clientId, 50000, 'cash', 'Pago sep inicio', undefined, '', 5000)
    setPaymentDate(p1.id, '2026-09-01T10:00:00-05:00')
    const p2 = recordPayment(clientId, 80000, 'transfer', 'Pago sep fin', undefined, '', 0)
    setPaymentDate(p2.id, '2026-09-30T18:00:00-05:00')

    // Octubre 2026: 1 pago
    const p3 = recordPayment(clientId, 60000, 'cash', 'Pago oct', undefined, '', 2000)
    setPaymentDate(p3.id, '2026-10-02T09:00:00-05:00')
  })

  afterAll(() => {
    closeDatabase()
  })

  it('debería sumar solo el mes de septiembre (primero a último día)', () => {
    const s = getPaymentsSummary('2026-09-01T00:00:00-05:00', '2026-09-30T23:59:59-05:00')
    expect(s.count).toBe(2)
    expect(s.total).toBe(130000)
    expect(s.totalDiscount).toBe(5000)
    expect(s.byMethod['cash']).toBe(50000)
    expect(s.byMethod['transfer']).toBe(80000)
  })

  it('debería sumar solo octubre y excluir septiembre', () => {
    const s = getPaymentsSummary('2026-10-01T00:00:00-05:00', '2026-10-31T23:59:59-05:00')
    expect(s.count).toBe(1)
    expect(s.total).toBe(60000)
  })

  it('debería filtrar por método de pago', () => {
    const s = getPaymentsSummary('2026-09-01T00:00:00-05:00', '2026-09-30T23:59:59-05:00', 'cash')
    expect(s.count).toBe(1)
    expect(s.total).toBe(50000)
  })

  it('debería retornar ceros en un mes vacío', () => {
    const s = getPaymentsSummary('2025-01-01T00:00:00-05:00', '2025-01-31T23:59:59-05:00')
    expect(s.count).toBe(0)
    expect(s.total).toBe(0)
    expect(s.totalDiscount).toBe(0)
  })
})
