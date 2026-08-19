import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDatabase, closeDatabase, getDatabase } from '../../main/database/index'
import { createClient, getClientById, updateClientStatus } from '../../main/database/clients'
import { formatISO } from 'date-fns'
import {
  createPlan,
  createMembership,
  createMembershipWithPayment,
  freezeMembership,
  getAccessLogs,
} from '../../main/database/memberships'
import { saveClientRoutine } from '../../main/database/routines'
import { validateAccess } from '../../main/database/accessValidation'
import type { Client } from '../../shared/types'

const sampleClientRaw: Omit<Client, 'id' | 'registrationDate'> = {
  fullName: 'Cliente Kiosco',
  documentId: 'KIOSK-001',
  birthDate: '1990-01-01',
  gender: 'male',
  phone: '3001112233',
  email: 'kiosk@example.com',
  address: 'Calle 1',
  photo: null,
  accessCode: 'KIOSK001',
  status: 'active',
  emergencyContact: { name: '', phone: '', relationship: '', notes: '' },
}

function makeClient(code: string, status: Client['status'] = 'active'): Client {
  return createClient({
    ...sampleClientRaw,
    documentId: `K-${code}-${Date.now()}-${Math.random()}`,
    accessCode: code,
    status,
  })
}

describe('Validación de acceso del kiosco (validateAccess)', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  it('código desconocido → denied_not_found sin cliente y con registro de acceso', () => {
    const result = validateAccess('NO-EXISTE-99')

    expect(result.valid).toBe(false)
    expect(result.code).toBe('denied_not_found')
    expect(result.client).toBeUndefined()
    expect(result.message).toBe('Cliente no encontrado')

    const logs = getAccessLogs(1, 50).data
    expect(logs.some(l => l.accessCode === 'NO-EXISTE-99' && l.result === 'denied_not_found')).toBe(true)
  })

  it('cliente activo con membresía vigente → granted con membresía y bienvenida', () => {
    const client = makeClient('ACC001')
    const plan = createPlan({ name: 'Plan Kiosco', type: 'monthly', price: 80000, durationDays: 30, description: '' })
    createMembership(client.id, plan.id)

    const result = validateAccess('ACC001')

    expect(result.valid).toBe(true)
    expect(result.code).toBe('granted')
    expect(result.client!.id).toBe(client.id)
    expect(result.membership!.planName).toBe('Plan Kiosco')
    expect(result.membership!.status).toBe('active')
    expect(result.message).toBe(`Bienvenido ${client.fullName}`)
  })

  it('membresía congelada → denied_frozen con la membresía en la respuesta', () => {
    const client = makeClient('FRZ001')
    const plan = createPlan({ name: 'Plan Congelado', type: 'monthly', price: 80000, durationDays: 30, description: '' })
    const m = createMembership(client.id, plan.id)!
    freezeMembership(m.id, 'Vacaciones', 10)

    const result = validateAccess('FRZ001')

    expect(result.valid).toBe(false)
    expect(result.code).toBe('denied_frozen')
    expect(result.membership!.status).toBe('frozen')
    expect(result.message).toContain('congelada')
  })

  it('membresía congelada cuyo vencimiento nominal pasó → denied_frozen (no denied_expired)', () => {
    // Mientras está congelada, la membresía no consume días: aunque su end_date
    // ya pasó sigue siendo "congelada", no "vencida". La validación debe
    // responder denied_frozen y NO marcar al cliente como expired.
    const client = makeClient('FRZEXP')
    const plan = createPlan({ name: 'Plan Congelado Extendido', type: 'monthly', price: 80000, durationDays: 30, description: '' })
    const m = createMembership(client.id, plan.id)!
    freezeMembership(m.id, 'Viaje', 10)

    const pastDate = formatISO(new Date(Date.now() - 5 * 86400000))
    getDatabase().prepare('UPDATE memberships SET end_date = ? WHERE id = ?').run(pastDate, m.id)

    const result = validateAccess('FRZEXP')

    expect(result.valid).toBe(false)
    expect(result.code).toBe('denied_frozen')
    expect(result.membership!.status).toBe('frozen')
    // El kiosco NO lo marca 'expired' porque tiene membresía congelada vigente
    expect(getClientById(client.id)!.status).not.toBe('expired')
  })

  it('cliente sin ninguna membresía → denied_expired y el estado pasa a expired', () => {
    const client = makeClient('EXP001')
    const result = validateAccess('EXP001')

    expect(result.valid).toBe(false)
    expect(result.code).toBe('denied_expired')
    expect(result.client!.id).toBe(client.id)
    expect(result.message).toBe('Membresía vencida')

    // El kiosco actualiza el estado del cliente a expired
    expect(getClientById(client.id)!.status).toBe('expired')
  })

  it('membresía vencida (end_date ayer) → denied_expired y se reporta la deuda pendiente', () => {
    const client = makeClient('DEB001')
    const plan = createPlan({ name: 'Plan Deuda', type: 'monthly', price: 100000, durationDays: 30, description: '' })
    createMembership(client.id, plan.id)

    // Forzar vencimiento ayer (sin pago)
    const yesterday = formatISO(new Date(Date.now() - 86400000))
    getDatabase().prepare('UPDATE memberships SET end_date = ? WHERE client_id = ?').run(yesterday, client.id)
    updateClientStatus(client.id, 'expired')

    const result = validateAccess('DEB001')

    expect(result.valid).toBe(false)
    expect(result.code).toBe('denied_expired')
    expect(result.debt).toBeDefined()
    expect(result.debt!.length).toBeGreaterThanOrEqual(1)
    expect(result.debt![0].planName).toBe('Plan Deuda')
  })

  it('membresía activa pagada a medias → granted pero con deuda pendiente en la respuesta', () => {
    const client = makeClient('PAG001')
    const plan = createPlan({ name: 'Plan Medio Pago', type: 'monthly', price: 100000, durationDays: 30, description: '' })
    createMembershipWithPayment(client.id, plan.id, 50000, 'cash')

    const result = validateAccess('PAG001')

    expect(result.valid).toBe(true)
    expect(result.code).toBe('granted')
    expect(result.debt).toBeDefined()
    expect(result.debt![0].balance).toBe(50000)
  })

  it('membresía activa pagada al 100% → granted sin deuda', () => {
    const client = makeClient('PAG002')
    const plan = createPlan({ name: 'Plan Pagado', type: 'monthly', price: 100000, durationDays: 30, description: '' })
    createMembershipWithPayment(client.id, plan.id, 100000, 'cash')

    const result = validateAccess('PAG002')

    expect(result.valid).toBe(true)
    expect(result.debt).toBeUndefined()
  })

  it('granted incluye las rutinas guardadas del cliente', () => {
    const client = makeClient('RUT001')
    const plan = createPlan({ name: 'Plan Rutinas', type: 'weekly', price: 30000, durationDays: 7, description: '' })
    createMembership(client.id, plan.id)
    saveClientRoutine(client.id, 0, [{ name: 'Press Banca', sets: 4, reps: '10' }])

    const result = validateAccess('RUT001')

    expect(result.valid).toBe(true)
    expect(result.routines).toBeDefined()
    expect(result.routines!.length).toBe(1)
    expect(result.routines![0].exercises[0].name).toBe('Press Banca')
  })

  it('cliente inactivo sin membresía → denied_expired (puede renovar desde el kiosco)', () => {
    makeClient('INA001', 'inactive')
    const result = validateAccess('INA001')

    expect(result.valid).toBe(false)
    expect(result.code).toBe('denied_expired')
  })

  it('cliente suspendido sin membresía → denied_expired y el estado se sobrescribe a expired', () => {
    // FALENCIA DOCUMENTADA: un cliente suspendido pierde el estado 'suspended'
    // al intentar entrar sin membresía; el kiosco lo marca como 'expired'.
    const client = makeClient('SUS001', 'suspended')
    const result = validateAccess('SUS001')

    expect(result.valid).toBe(false)
    expect(result.code).toBe('denied_expired')

    expect(getClientById(client.id)!.status).toBe('expired')
  })

  it('cliente suspendido CON membresía activa → acceso concedido (comportamiento histórico conservado)', () => {
    // FALENCIA DOCUMENTADA / DECISIÓN DE NEGOCIO: un cliente 'suspended' con
    // membresía vigente OBTIENE acceso. Si 'suspended' debe bloquear la entrada,
    // el kiosco debería denegar aquí (denied_inactive) — pendiente de decisión.
    // createMembership bloquea clientes suspendidos, así que el estado se simula
    // suspendiendo después de crear la membresía (flujo real: admin suspende).
    const client = makeClient('SUS002', 'active')
    const plan = createPlan({ name: 'Plan Suspendido Activo', type: 'monthly', price: 80000, durationDays: 30, description: '' })
    createMembership(client.id, plan.id)
    updateClientStatus(client.id, 'suspended')

    const result = validateAccess('SUS002')

    expect(result.valid).toBe(true)
    expect(result.code).toBe('granted')
  })

  it('los accesos concedidos y denegados quedan registrados en access_logs', () => {
    const logs = getAccessLogs(1, 200).data
    const codes = new Set(logs.map(l => l.accessCode))
    for (const code of ['ACC001', 'FRZ001', 'EXP001', 'PAG001', 'RUT001']) {
      expect(codes.has(code)).toBe(true)
    }
  })
})
