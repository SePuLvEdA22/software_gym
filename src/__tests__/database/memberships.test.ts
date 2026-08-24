import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { formatISO, parseISO, differenceInDays } from 'date-fns'
import { initDatabase, closeDatabase, getDatabase } from '../../main/database/index'
import { createClient } from '../../main/database/clients'
import {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan
} from '../../main/database/plans'
import {
  createMembership,
  getActiveMembership,
  getActiveOrFrozenMembership,
  freezeMembership,
  unfreezeMembership,
  getClientMemberships,
  updateExpiredMemberships,
  getInactiveClients,
  getClientDebt,
  getDebtors,
  getFreezeHistory
} from '../../main/database/memberships'
import {
  createMembershipWithPayment,
  recordPayment,
  getClientPayments,
  getPaymentsByDateRange
} from '../../main/database/payments'
import { getEffectivePrice, createPromotion, getActivePromotionForPlan, getAllPromotions } from '../../main/database/promotions'
import { getTodayAccessCount } from '../../main/database/accessLogs'
import type { Client } from '../../shared/types'

const sampleClientRaw: Omit<Client, 'id' | 'registrationDate'> = {
  fullName: 'Cliente Membresía',
  documentId: 'MEM-001',
  birthDate: '1990-01-01',
  gender: 'male',
  phone: '3001112233',
  email: 'member@example.com',
  address: 'Calle 1',
  photo: null,
  accessCode: 'MEM001',
  status: 'active',
  emergencyContact: { name: '', phone: '', relationship: '', notes: '' },
}

let client: Client
let planId: string

describe('Memberships Database', () => {
  beforeAll(async () => {
    await initDatabase()
    client = createClient(sampleClientRaw)
    const plan = createPlan({
      name: 'Plan Mensual Test',
      type: 'monthly',
      price: 80000,
      durationDays: 30,
      description: 'Plan de prueba',
    })
    planId = plan.id
  })

  afterAll(() => {
    closeDatabase()
  })

  describe('Plans', () => {
    it('should list all plans', () => {
      const plans = getAllPlans()
      expect(plans.length).toBeGreaterThan(0)
      expect(plans.some(p => p.name === 'Plan Mensual Test')).toBe(true)
    })

    it('should get plan by id', () => {
      const plan = getPlanById(planId)
      expect(plan).not.toBeNull()
      expect(plan!.name).toBe('Plan Mensual Test')
      expect(plan!.type).toBe('monthly')
    })

    it('should return null for non-existent plan', () => {
      const plan = getPlanById('non-existent')
      expect(plan).toBeNull()
    })

    it('should update a plan', () => {
      const updated = updatePlan(planId, { price: 90000, name: 'Plan Mensual Premium' })
      expect(updated).not.toBeNull()
      expect(updated!.price).toBe(90000)
      expect(updated!.name).toBe('Plan Mensual Premium')
    })

    it('should deactivate a plan', () => {
      const updated = updatePlan(planId, { isActive: false })
      expect(updated).not.toBeNull()
      expect(updated!.isActive).toBe(false)
      const activePlans = getAllPlans(true)
      expect(activePlans.some(p => p.id === planId)).toBe(false)
      const allPlans = getAllPlans(false)
      expect(allPlans.some(p => p.id === planId)).toBe(true)
    })

    it('should not delete plan with active memberships', () => {
      const plan = createPlan({
        name: 'Plan Eliminación',
        type: 'daily',
        price: 10000,
        durationDays: 1,
        description: '',
      })
      createMembership(client.id, plan.id)
      const result = deletePlan(plan.id)
      expect(result.success).toBe(false)
      expect(result.error).toContain('No se puede eliminar')
    })

    it('should delete plan without memberships', () => {
      const plan = createPlan({
        name: 'Plan Temporal',
        type: 'daily',
        price: 5000,
        durationDays: 1,
        description: '',
      })
      const result = deletePlan(plan.id)
      expect(result.success).toBe(true)
    })
  })

  describe('Memberships CRUD', () => {
    let crudClient: Client
    let crudPlanId: string

    beforeEach(() => {
      crudClient = createClient({ ...sampleClientRaw, documentId: `CRUD-${Date.now()}`, accessCode: `CR${Date.now()}` })
      const plan = createPlan({ name: 'CRUD Plan', type: 'monthly', price: 50000, durationDays: 30, description: '' })
      crudPlanId = plan.id
    })

    it('should create a membership', () => {
      const membership = createMembership(crudClient.id, crudPlanId)
      expect(membership).not.toBeNull()
      expect(membership!.clientId).toBe(crudClient.id)
      expect(membership!.planId).toBe(crudPlanId)
      expect(membership!.status).toBe('active')
      expect(membership!.endDate).toBeDefined()
    })

    it('should get active membership', () => {
      createMembership(crudClient.id, crudPlanId)
      const active = getActiveMembership(crudClient.id)
      expect(active).not.toBeNull()
      expect(active!.status).toBe('active')
    })

    it('should get client memberships', () => {
      createMembership(crudClient.id, crudPlanId)
      const list = getClientMemberships(crudClient.id)
      expect(list.length).toBeGreaterThanOrEqual(1)
    })

    it('should return active or frozen membership', () => {
      createMembership(crudClient.id, crudPlanId)
      const result = getActiveOrFrozenMembership(crudClient.id)
      expect(result).not.toBeNull()
      expect(['active', 'frozen']).toContain(result!.status)
    })
  })

  describe('Freeze / Unfreeze', () => {
    let membershipId: string

    beforeEach(() => {
      const c = createClient({ ...sampleClientRaw, documentId: `FREEZE-${Date.now()}`, accessCode: `FR${Date.now()}` })
      const plan = createPlan({ name: 'Freeze Test Plan', type: 'monthly', price: 50000, durationDays: 30, description: '' })
      const m = createMembership(c.id, plan.id)
      membershipId = m!.id
    })

    it('should freeze a membership', () => {
      const frozen = freezeMembership(membershipId, 'Vacaciones', 15)
      expect(frozen).not.toBeNull()
      expect(frozen!.status).toBe('frozen')
      expect(frozen!.freezeReason).toBe('Vacaciones')
      expect(frozen!.freezeDays).toBe(15)
    })

    it('should unfreeze a membership', () => {
      freezeMembership(membershipId, 'Test', 5)
      const unfrozen = unfreezeMembership(membershipId)
      expect(unfrozen).not.toBeNull()
      expect(unfrozen!.status).toBe('active')
      expect(unfrozen!.freezeReason).toBeNull()
    })
  })

  describe('Expiration: día final válido (fix membresía de 1 día)', () => {
    it('una membresía de 1 día creada hoy queda activa y válida todo el día', () => {
      const c = createClient({ ...sampleClientRaw, documentId: `DAY1-${Date.now()}`, accessCode: `D1${Date.now()}` })
      const plan = createPlan({ name: 'Plan 1 Día', type: 'daily', price: 5000, durationDays: 1, description: '' })
      const m = createMembership(c.id, plan.id)

      expect(m).not.toBeNull()
      expect(m!.status).toBe('active')

      // Vence al FINAL del día de hoy (23:59), no a la hora exacta de compra
      const end = parseISO(m!.endDate)
      const today = new Date()
      expect(end.getFullYear()).toBe(today.getFullYear())
      expect(end.getMonth()).toBe(today.getMonth())
      expect(end.getDate()).toBe(today.getDate())
      expect(end.getHours()).toBe(23)

      // El kiosco la encuentra como activa hoy
      const active = getActiveOrFrozenMembership(c.id)
      expect(active).not.toBeNull()
      expect(active!.status).toBe('active')
    })

    it('una membresía cuyo vencimiento es HOY sigue siendo válida todo el día', () => {
      const c = createClient({ ...sampleClientRaw, documentId: `LAST-${Date.now()}`, accessCode: `LT${Date.now()}` })
      const plan = createPlan({ name: 'Plan Último Día', type: 'weekly', price: 20000, durationDays: 7, description: '' })
      const m = createMembership(c.id, plan.id)
      if (!m) throw new Error('Membership not created')

      // Simular que hoy es su último día (vencía en 7 días → forzar a hoy a las 10:30)
      const today1030 = new Date()
      today1030.setHours(10, 30, 0, 0)
      getDatabase().prepare('UPDATE memberships SET end_date = ? WHERE id = ?').run(formatISO(today1030), m.id)

      // Sigue siendo válida HOY (no se vence a las 10:30 por la hora del vencimiento)
      expect(getActiveOrFrozenMembership(c.id)).not.toBeNull()

      // updateExpiredMemberships NO la marca vencida hoy
      updateExpiredMemberships()
      expect(getActiveMembership(c.id)).not.toBeNull()
    })

    it('una membresía vencida AYER sí se considera vencida', () => {
      const c = createClient({ ...sampleClientRaw, documentId: `YEST-${Date.now()}`, accessCode: `YE${Date.now()}` })
      const plan = createPlan({ name: 'Plan Vencido Ayer', type: 'daily', price: 5000, durationDays: 1, description: '' })
      const m = createMembership(c.id, plan.id)
      if (!m) throw new Error('Membership not created')

      const yesterday = new Date(Date.now() - 86400000)
      getDatabase().prepare('UPDATE memberships SET end_date = ? WHERE id = ?').run(formatISO(yesterday), m.id)

      expect(getActiveOrFrozenMembership(c.id)).toBeNull()
      updateExpiredMemberships()
      const memberships = getClientMemberships(c.id)
      expect(memberships[0].status).toBe('expired')
    })
  })

  describe('Renovación el último día de vigencia', () => {
    it('permite renovar cuando la membresía vence HOY (último día)', () => {
      const c = createClient({ ...sampleClientRaw, documentId: `REN-${Date.now()}`, accessCode: `RN${Date.now()}` })
      const plan = createPlan({ name: 'Plan Renovable', type: 'daily', price: 10000, durationDays: 1, description: '' })
      const m = createMembership(c.id, plan.id)
      if (!m) throw new Error('Membership not created')

      // Vence hoy a las 23:59 (sigue activa todo el día) pero ya se puede renovar
      const result = createMembershipWithPayment(c.id, plan.id, 10000, 'cash')
      expect(result.error).toBeUndefined()
      expect(result.membership).not.toBeNull()
      expect(result.payment).not.toBeNull()
    })

    it('bloquea renovar cuando la membresía aún se extiende más allá de hoy', () => {
      const c = createClient({ ...sampleClientRaw, documentId: `BLK-${Date.now()}`, accessCode: `BK${Date.now()}` })
      const plan = createPlan({ name: 'Plan a Futuro', type: 'monthly', price: 50000, durationDays: 30, description: '' })
      createMembership(c.id, plan.id)

      const result = createMembershipWithPayment(c.id, plan.id, 50000, 'cash')
      expect(result.membership).toBeNull()
      expect(result.error).toContain('ya tiene una membresía activa')
    })
  })

  describe('Expiration', () => {
    it('should update expired memberships', () => {
      const c = createClient({ ...sampleClientRaw, documentId: `EXP-${Date.now()}`, accessCode: `EX${Date.now()}` })
      const plan = createPlan({ name: '1-Day Plan', type: 'daily', price: 5000, durationDays: 1, description: '' })
      const m = createMembership(c.id, plan.id)
      expect(m).not.toBeNull()
      if (!m) throw new Error('Membership not created')

      // Formato local consistente con el que la app guarda end_date (formatISO).
      // NO usar toISOString() (UTC): rompería la comparación lexicográfica.
      const pastDate = formatISO(new Date(Date.now() - 86400000))
      getDatabase().prepare('UPDATE memberships SET end_date = ? WHERE id = ?').run(pastDate, m.id)

      const count = updateExpiredMemberships()
      expect(count).toBeGreaterThanOrEqual(1)

      const active = getActiveMembership(c.id)
      expect(active).toBeNull()
      expect(c.id).toBeDefined()
    })
  })

  describe('Payments', () => {
    it('should create membership with payment', () => {
      const c = createClient({ ...sampleClientRaw, documentId: `PAY-${Date.now()}`, accessCode: `PA${Date.now()}` })
      const plan = createPlan({ name: 'Pay Plan', type: 'weekly', price: 30000, durationDays: 7, description: '' })
      const result = createMembershipWithPayment(c.id, plan.id, 30000, 'cash')
      expect(result).not.toBeNull()
      expect(result!.membership).not.toBeNull()
      expect(result!.payment).not.toBeNull()
      expect(result!.payment!.amount).toBe(30000)
    })

    it('should record a standalone payment', () => {
      const c = createClient({ ...sampleClientRaw, documentId: `STD-${Date.now()}`, accessCode: `ST${Date.now()}` })
      const payment = recordPayment(c.id, 50000, 'nequi', 'Pago independiente')
      expect(payment).not.toBeNull()
      expect(payment!.amount).toBe(50000)
      expect(payment!.method).toBe('nequi')
    })

    it('should get client payments with pagination', () => {
      const c = createClient({ ...sampleClientRaw, documentId: `PG-${Date.now()}`, accessCode: `PG${Date.now()}` })
      for (let i = 0; i < 12; i++) {
        recordPayment(c.id, 10000, 'cash', `Pago ${i}`)
      }
      const page1 = getClientPayments(c.id, 1, 10)
      expect(page1.data.length).toBe(10)
      expect(page1.total).toBe(12)
      expect(page1.totalPages).toBe(2)

      const page2 = getClientPayments(c.id, 2, 10)
      expect(page2.data.length).toBe(2)
    })

    it('should get payments by date range with pagination', () => {
      const start = new Date(Date.now() - 86400000).toISOString()
      const end = new Date(Date.now() + 86400000).toISOString()
      const result = getPaymentsByDateRange(start, end, 1, 50)
      expect(result.data.length).toBeGreaterThan(0)
      expect(result.total).toBeGreaterThan(0)
    })
  })

  describe('Promotions', () => {
    it('should create and get active promotion for plan', () => {
      const plan = createPlan({ name: 'Plan Promo', type: 'monthly', price: 100000, durationDays: 30, description: '' })
      const promo = createPromotion({
        name: 'Descuento 10%',
        planId: plan.id,
        discountType: 'percentage',
        discountValue: 10,
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      })
      expect(promo.isActive).toBe(true)

      const active = getActivePromotionForPlan(plan.id)
      expect(active).not.toBeNull()
      expect(active!.name).toBe('Descuento 10%')
    })

    it('should calculate effective price with percentage discount', () => {
      const plan = createPlan({ name: 'Plan Effective Price', type: 'monthly', price: 100000, durationDays: 30, description: '' })
      createPromotion({
        name: '20% OFF',
        planId: plan.id,
        discountType: 'percentage',
        discountValue: 20,
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      })
      const result = getEffectivePrice(plan)
      expect(result.price).toBe(80000)
      expect(result.discount).toBe(20000)
      expect(result.promotionName).toBe('20% OFF')
    })

    it('should calculate effective price with fixed discount', () => {
      const plan = createPlan({ name: 'Plan Fixed Discount', type: 'monthly', price: 100000, durationDays: 30, description: '' })
      createPromotion({
        name: '$15 OFF',
        planId: plan.id,
        discountType: 'fixed',
        discountValue: 15000,
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      })
      const result = getEffectivePrice(plan)
      expect(result.price).toBe(85000)
      expect(result.discount).toBe(15000)
    })

    it('should list all promotions', () => {
      const promos = getAllPromotions()
      expect(promos.length).toBeGreaterThan(0)
    })

    it('should not exceed plan price with fixed discount', () => {
      const plan = createPlan({ name: 'Plan Cheap', type: 'daily', price: 5000, durationDays: 1, description: '' })
      createPromotion({
        name: 'Over discount',
        planId: plan.id,
        discountType: 'fixed',
        discountValue: 99999,
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      })
      const result = getEffectivePrice(plan)
      expect(result.price).toBe(0)
      expect(result.discount).toBe(5000)
    })

    it('should return no discount when no active promotion', () => {
      const plan = createPlan({ name: 'Plan No Promo', type: 'daily', price: 10000, durationDays: 1, description: '' })
      const result = getEffectivePrice(plan)
      expect(result.price).toBe(10000)
      expect(result.discount).toBe(0)
      expect(result.promotionName).toBeNull()
    })
  })

  describe('Inactive Clients & Debts', () => {
    it('should get inactive clients', () => {
      const inactive = getInactiveClients(365)
      expect(Array.isArray(inactive)).toBe(true)
    })

    it('should detect client debt', () => {
      const plan = createPlan({ name: 'Expensive Plan', type: 'monthly', price: 200000, durationDays: 30, description: '' })
      const c = createClient({ ...sampleClientRaw, documentId: `DEBT-${Date.now()}`, accessCode: `DE${Date.now()}` })
      createMembership(c.id, plan.id)
      const debts = getClientDebt(c.id)
      expect(debts.length).toBeGreaterThanOrEqual(1)
    })

    it('should get debtors list', () => {
      const debtors = getDebtors()
      expect(Array.isArray(debtors)).toBe(true)
    })
  })

  describe('Today Access Count', () => {
    it('should return a number', () => {
      const count = getTodayAccessCount()
      expect(typeof count).toBe('number')
      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Casos borde: congelación, renovación y fechas', () => {
    it('NO permite congelar una membresía que ya no está activa', () => {
      const c = createClient({ ...sampleClientRaw, documentId: `FZNACT-${Date.now()}`, accessCode: `FZ${Date.now()}` })
      const plan = createPlan({ name: 'Plan No Activo', type: 'daily', price: 5000, durationDays: 1, description: '' })
      const m = createMembership(c.id, plan.id)!
      // Forzar vencimiento ayer y marcar como vencida
      const pastDate = formatISO(new Date(Date.now() - 86400000))
      getDatabase().prepare('UPDATE memberships SET end_date = ? WHERE id = ?').run(pastDate, m.id)
      updateExpiredMemberships()

      const frozen = freezeMembership(m.id, 'Intento')
      expect(frozen).toBeNull()
      expect(getClientMemberships(c.id)[0].status).toBe('expired')
    })

    it('NO permite congelar dos veces la misma membresía', () => {
      const c = createClient({ ...sampleClientRaw, documentId: `FRZ2-${Date.now()}`, accessCode: `F2${Date.now()}` })
      const plan = createPlan({ name: 'Plan Doble Freeze', type: 'monthly', price: 50000, durationDays: 30, description: '' })
      const m = createMembership(c.id, plan.id)!

      expect(freezeMembership(m.id, 'Primera', 5)).not.toBeNull()
      const second = freezeMembership(m.id, 'Segunda', 5)
      expect(second).toBeNull()
    })

    it('al descongelar se extiende la fecha de vencimiento por los días congelados', () => {
      const c = createClient({ ...sampleClientRaw, documentId: `UNF-${Date.now()}`, accessCode: `UF${Date.now()}` })
      const plan = createPlan({ name: 'Plan Extiende', type: 'monthly', price: 50000, durationDays: 30, description: '' })
      const m = createMembership(c.id, plan.id)!
      const originalEnd = m.endDate

      freezeMembership(m.id, 'Viaje', 10)
      // Simular que estuvieron congelados 10 días
      const tenDaysAgo = formatISO(new Date(Date.now() - 10 * 86400000))
      getDatabase().prepare('UPDATE memberships SET frozen_at = ? WHERE id = ?').run(tenDaysAgo, m.id)

      const unfrozen = unfreezeMembership(m.id)!
      expect(unfrozen.status).toBe('active')
      const extended = differenceInDays(parseISO(unfrozen.endDate), parseISO(originalEnd))
      expect(extended).toBeGreaterThanOrEqual(9)
      expect(extended).toBeLessThanOrEqual(11)
    })

    it('al descongelar se registra unfrozen_at y actual_days en el historial', () => {
      const c = createClient({ ...sampleClientRaw, documentId: `HIST-${Date.now()}`, accessCode: `HS${Date.now()}` })
      const plan = createPlan({ name: 'Plan Historial', type: 'weekly', price: 20000, durationDays: 7, description: '' })
      const m = createMembership(c.id, plan.id)!

      freezeMembership(m.id, 'Motivo de prueba', 3)
      const tenDaysAgo = formatISO(new Date(Date.now() - 10 * 86400000))
      getDatabase().prepare('UPDATE memberships SET frozen_at = ? WHERE id = ?').run(tenDaysAgo, m.id)
      unfreezeMembership(m.id)

      const history = getFreezeHistory(m.id)
      expect(history.length).toBeGreaterThanOrEqual(1)
      const last = history[0]
      expect(last.unfrozenAt).not.toBeNull()
      expect(last.actualDays).toBeGreaterThanOrEqual(9)
      expect(last.reason).toBe('Motivo de prueba')
    })

    it('bloquea renovar mientras la membresía está congelada', () => {
      const c = createClient({ ...sampleClientRaw, documentId: `RENFZ-${Date.now()}`, accessCode: `RF${Date.now()}` })
      const plan = createPlan({ name: 'Plan Congelado R', type: 'monthly', price: 50000, durationDays: 30, description: '' })
      const m = createMembership(c.id, plan.id)!
      freezeMembership(m.id, 'Vacaciones', 10)

      const result = createMembershipWithPayment(c.id, plan.id, 50000, 'cash')
      expect(result.membership).toBeNull()
      expect(result.error).toContain('congelada')
    })

    it('NO crea membresía para un cliente suspendido', () => {
      const c = createClient({ ...sampleClientRaw, documentId: `SUSP-${Date.now()}`, accessCode: `SP${Date.now()}`, status: 'suspended' })
      const plan = createPlan({ name: 'Plan Suspendido', type: 'monthly', price: 50000, durationDays: 30, description: '' })
      const m = createMembership(c.id, plan.id)
      expect(m).toBeNull()
    })

    it('NO crea membresía ni registra pago cuando startDate retroactivo dejaría el plan ya vencido', () => {
      // Corrección de la falencia documentada: un pase de 1 día con startDate
      // retroactivo nacía con status 'expired' y aun así se registraba el cobro
      // (el cliente pagaba por algo que ya no servía). Ahora la membresía no se
      // crea y el pago no se registra.
      const c = createClient({ ...sampleClientRaw, documentId: `BACK-${Date.now()}`, accessCode: `BK${Date.now()}` })
      const plan = createPlan({ name: 'Pase Retroactivo', type: 'daily', price: 10000, durationDays: 1, description: '' })
      const tenDaysAgo = formatISO(new Date(Date.now() - 10 * 86400000))

      const result = createMembershipWithPayment(c.id, plan.id, 10000, 'cash', tenDaysAgo)

      expect(result.membership).toBeNull()
      expect(result.payment).toBeNull()
      expect(result.error).toBeDefined()
      expect(getClientMemberships(c.id)).toHaveLength(0)
    })

    it('un startDate retroactivo SÍ es válido cuando el plan aún cubre hoy', () => {
      // Con planes largos el retroactivo es legítimo: cubre días pasados y se
      // extiende hasta el futuro, por lo que la membresía sigue teniendo valor.
      const c = createClient({ ...sampleClientRaw, documentId: `BACKOK-${Date.now()}`, accessCode: `BO${Date.now()}` })
      const plan = createPlan({ name: 'Plan Retroactivo Válido', type: 'monthly', price: 50000, durationDays: 30, description: '' })
      const fiveDaysAgo = formatISO(new Date(Date.now() - 5 * 86400000))

      const result = createMembershipWithPayment(c.id, plan.id, 50000, 'cash', fiveDaysAgo)

      expect(result.membership).not.toBeNull()
      expect(result.membership!.status).toBe('active')
      expect(result.payment).not.toBeNull()
    })

    it('una membresía congelada cuyo vencimiento nominal pasó NO se marca vencida ni al cliente', () => {
      // Mientras la membresía está congelada NO consume días: aunque su end_date
      // nominal ya pasó, sigue congelada (se extiende al descongelar). Ni
      // getActiveOrFrozenMembership ni updateExpiredMemberships deben tratarla
      // como vencida.
      const c = createClient({ ...sampleClientRaw, documentId: `FZEXP-${Date.now()}`, accessCode: `FE${Date.now()}` })
      const plan = createPlan({ name: 'Plan Congelado Vencido', type: 'monthly', price: 50000, durationDays: 30, description: '' })
      const m = createMembership(c.id, plan.id)!
      freezeMembership(m.id, 'Ausencia', 10)

      // Simular que el vencimiento nominal pasó mientras estaba congelada
      const pastDate = formatISO(new Date(Date.now() - 5 * 86400000))
      getDatabase().prepare('UPDATE memberships SET end_date = ? WHERE id = ?').run(pastDate, m.id)

      // Sigue siendo "congelada" para el acceso, no "vencida"
      const activeOrFrozen = getActiveOrFrozenMembership(c.id)
      expect(activeOrFrozen).not.toBeNull()
      expect(activeOrFrozen!.status).toBe('frozen')

      // updateExpiredMemberships expira la membresía de status 'active' (no esta)
      // y NO marca al cliente como 'expired' mientras tenga membresía congelada
      updateExpiredMemberships()
      const memberships = getClientMemberships(c.id)
      expect(memberships[0].status).toBe('frozen')
    })
  })
})
