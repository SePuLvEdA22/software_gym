import { getDatabase } from './index'
import { cached, clearQueryCache } from './queryCache'
import { Membership, MembershipPlan, MembershipStatus, MembershipType, Payment, PaymentMethod, AccessLog, AccessType, AccessResult, Promotion, ClientDebt, DebtorSummary, FreezeHistory, ClientAttendanceStats, InactiveClient, PageResponse } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import { getClientById, updateClientStatus } from './clients'
import { addDays, formatISO, parseISO, differenceInDays, startOfDay, endOfDay } from 'date-fns'
import log from 'electron-log'

export interface DbMembership {
  id: string
  client_id: string
  plan_id: string
  plan_name: string
  start_date: string
  end_date: string
  status: string
  created_at: string
  frozen_at?: string | null
  freeze_reason?: string | null
  freeze_days?: number | null
}

function mapDbMembership(dbMembership: DbMembership): Membership {
  return {
    id: dbMembership.id,
    clientId: dbMembership.client_id,
    planId: dbMembership.plan_id,
    planName: dbMembership.plan_name,
    startDate: dbMembership.start_date,
    endDate: dbMembership.end_date,
    status: dbMembership.status as MembershipStatus,
    createdAt: dbMembership.created_at,
    frozenAt: dbMembership.frozen_at || null,
    freezeReason: dbMembership.freeze_reason || null,
    freezeDays: dbMembership.freeze_days || null
  }
}

export interface DbPlan {
  id: string
  name: string
  type: string
  price: number
  duration_days: number
  description: string
  is_active: number
  created_at: string
}

function mapDbPlan(dbPlan: DbPlan): MembershipPlan {
  return {
    id: dbPlan.id,
    name: dbPlan.name,
    type: dbPlan.type as MembershipType,
    price: dbPlan.price,
    durationDays: dbPlan.duration_days,
    description: dbPlan.description,
    isActive: dbPlan.is_active === 1,
    createdAt: dbPlan.created_at
  }
}

export interface DbPayment {
  id: string
  client_id: string
  client_name?: string
  membership_id: string | null
  amount: number
  discount: number
  method: string
  description: string
  date: string
  notes: string
  created_at: string
}

function mapDbPayment(dbPayment: DbPayment): Payment {
  return {
    id: dbPayment.id,
    clientId: dbPayment.client_id,
    clientName: dbPayment.client_name,
    membershipId: dbPayment.membership_id,
    amount: dbPayment.amount,
    discount: dbPayment.discount || 0,
    method: dbPayment.method as PaymentMethod,
    description: dbPayment.description,
    date: dbPayment.date,
    notes: dbPayment.notes,
    createdAt: dbPayment.created_at
  }
}

export interface DbAccessLog {
  id: string
  client_id: string | null
  client_name: string | null
  access_code: string
  access_type: string
  result: string
  message: string
  timestamp: string
}

/**
 * 'YYYY-MM-DD' de hoy (fecha actual). Se usa para comparaciones
 * día-conscientes de vencimiento por prefijo de fecha: una membresía cuyo
 * vencimiento es HOY sigue siendo válida todo el día y solo se vence al
 * terminar el día. El prefijo es robusto para formatos ISO local
 * ('YYYY-MM-DDTHH:mm:ss±HH:mm') y legado ('YYYY-MM-DD HH:mm:ss').
 */
function todayKey(): string {
  return formatISO(new Date()).slice(0, 10)
}

function mapDbAccessLog(dbLog: DbAccessLog): AccessLog {
  return {
    id: dbLog.id,
    clientId: dbLog.client_id || '',
    clientName: dbLog.client_name || '',
    accessCode: dbLog.access_code,
    accessType: dbLog.access_type as AccessType,
    result: dbLog.result as AccessResult,
    message: dbLog.message,
    timestamp: dbLog.timestamp
  }
}

export function getAllPlans(activeOnly = true): MembershipPlan[] {
  const db = getDatabase()
  
  let query = 'SELECT * FROM membership_plans WHERE 1=1'
  const params: (string | number)[] = []
  
  if (activeOnly) {
    query += ' AND is_active = ?'
    params.push(1)
  }
  
  query += ' ORDER BY duration_days ASC'
  
  const stmt = db.prepare(query)
  const results = stmt.all(...params) as unknown as DbPlan[]
  
  return results.map(mapDbPlan)
}

export function getPlanById(id: string): MembershipPlan | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM membership_plans WHERE id = ?')
  const result = stmt.get(id) as DbPlan | undefined
  
  return result ? mapDbPlan(result) : null
}

export function createPlan(data: Omit<MembershipPlan, 'id' | 'createdAt' | 'isActive'>): MembershipPlan {
  const db = getDatabase()
  const id = uuidv4()
  const now = formatISO(new Date())

  const stmt = db.prepare(`
    INSERT INTO membership_plans (id, name, type, price, duration_days, description, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `)

  stmt.run(id, data.name, data.type, data.price, data.durationDays, data.description, now)

  return {
    id,
    name: data.name,
    type: data.type,
    price: data.price,
    durationDays: data.durationDays,
    description: data.description,
    isActive: true,
    createdAt: now
  }
}

export function updatePlan(id: string, data: Partial<MembershipPlan>): MembershipPlan | null {
  const db = getDatabase()
  const existing = getPlanById(id)
  if (!existing) return null

  const fields: string[] = []
  const params: (string | number | boolean)[] = []

  if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name) }
  if (data.type !== undefined) { fields.push('type = ?'); params.push(data.type) }
  if (data.price !== undefined) { fields.push('price = ?'); params.push(data.price) }
  if (data.durationDays !== undefined) { fields.push('duration_days = ?'); params.push(data.durationDays) }
  if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description) }
  if (data.isActive !== undefined) { fields.push('is_active = ?'); params.push(data.isActive ? 1 : 0) }

  if (fields.length === 0) return existing

  params.push(id)
  db.prepare(`UPDATE membership_plans SET ${fields.join(', ')} WHERE id = ?`).run(...params)

  return getPlanById(id)
}

export function deletePlan(id: string): { success: boolean; error?: string } {
  const db = getDatabase()
  const activeCount = db.prepare('SELECT COUNT(*) as count FROM memberships WHERE plan_id = ?').get(id) as { count: number }
  if (activeCount.count > 0) {
    return { success: false, error: `No se puede eliminar: ${activeCount.count} membresía(s) usan este plan. Desactívalo en su lugar.` }
  }
  const result = db.prepare('DELETE FROM membership_plans WHERE id = ?').run(id)
  return { success: result.changes > 0 }
}

export interface DbPromotion {
  id: string
  name: string
  plan_id: string
  discount_type: string
  discount_value: number
  start_date: string
  end_date: string
  is_active: number
  created_at: string
}

function mapDbPromotion(p: DbPromotion): Promotion {
  return {
    id: p.id,
    name: p.name,
    planId: p.plan_id,
    discountType: p.discount_type as 'percentage' | 'fixed',
    discountValue: p.discount_value,
    startDate: p.start_date,
    endDate: p.end_date,
    isActive: p.is_active === 1,
    createdAt: p.created_at
  }
}

export function getAllPromotions(activeOnly = true): Promotion[] {
  const db = getDatabase()
  let query = 'SELECT * FROM promotions WHERE 1=1'
  const params: (string | number)[] = []
  if (activeOnly) {
    query += ' AND is_active = ?'
    params.push(1)
  }
  query += ' ORDER BY created_at DESC'
  const results = db.prepare(query).all(...params) as unknown as DbPromotion[]
  return results.map(mapDbPromotion)
}

export function getPromotionById(id: string): Promotion | null {
  const db = getDatabase()
  const result = db.prepare('SELECT * FROM promotions WHERE id = ?').get(id) as DbPromotion | undefined
  return result ? mapDbPromotion(result) : null
}

export function createPromotion(data: Omit<Promotion, 'id' | 'createdAt' | 'isActive'>): Promotion {
  const db = getDatabase()
  const id = uuidv4()
  const now = formatISO(new Date())
  db.prepare(`
    INSERT INTO promotions (id, name, plan_id, discount_type, discount_value, start_date, end_date, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(id, data.name, data.planId, data.discountType, data.discountValue, data.startDate, data.endDate, now)
  return { id, ...data, isActive: true, createdAt: now }
}

export function updatePromotion(id: string, data: Partial<Promotion>): Promotion | null {
  const db = getDatabase()
  const existing = getPromotionById(id)
  if (!existing) return null
  const fields: string[] = []
  const params: (string | number | boolean)[] = []
  if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name) }
  if (data.planId !== undefined) { fields.push('plan_id = ?'); params.push(data.planId) }
  if (data.discountType !== undefined) { fields.push('discount_type = ?'); params.push(data.discountType) }
  if (data.discountValue !== undefined) { fields.push('discount_value = ?'); params.push(data.discountValue) }
  if (data.startDate !== undefined) { fields.push('start_date = ?'); params.push(data.startDate) }
  if (data.endDate !== undefined) { fields.push('end_date = ?'); params.push(data.endDate) }
  if (data.isActive !== undefined) { fields.push('is_active = ?'); params.push(data.isActive ? 1 : 0) }
  if (fields.length === 0) return existing
  params.push(id)
  db.prepare(`UPDATE promotions SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  return getPromotionById(id)
}

export function deletePromotion(id: string): boolean {
  const db = getDatabase()
  return db.prepare('DELETE FROM promotions WHERE id = ?').run(id).changes > 0
}

export function deactivateExpiredPromotions(): number {
  const db = getDatabase()
  const now = formatISO(new Date())
  const result = db.prepare(`
    UPDATE promotions SET is_active = 0
    WHERE is_active = 1 AND end_date < ?
  `).run(now)
  if (result.changes > 0) {
    log.info(`Deactivated ${result.changes} expired promotions`)
  }
  return result.changes
}

export function getActivePromotionForPlan(planId: string): Promotion | null {
  const db = getDatabase()
  const now = formatISO(new Date())
  const result = db.prepare(`
    SELECT * FROM promotions
    WHERE plan_id = ? AND is_active = 1 AND start_date <= ? AND end_date >= ?
    LIMIT 1
  `).get(planId, now, now) as DbPromotion | undefined
  return result ? mapDbPromotion(result) : null
}

export function getEffectivePrice(plan: MembershipPlan): { price: number; discount: number; promotionName: string | null } {
  const promo = getActivePromotionForPlan(plan.id)
  if (!promo) return { price: plan.price, discount: 0, promotionName: null }
  const discount = promo.discountType === 'percentage'
    ? plan.price * (promo.discountValue / 100)
    : Math.min(promo.discountValue, plan.price)
  return { price: plan.price - discount, discount, promotionName: promo.name }
}

export function getClientDebt(clientId: string): ClientDebt[] {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT 
      m.id as membershipId,
      m.plan_name as planName,
      p.price as planPrice,
      m.end_date as endDate,
      m.status,
      COALESCE((SELECT SUM(pm.amount) FROM payments pm WHERE pm.membership_id = m.id), 0) as totalPaid,
      COALESCE((SELECT SUM(pm.discount) FROM payments pm WHERE pm.membership_id = m.id), 0) as totalDiscount
    FROM memberships m
    JOIN membership_plans p ON p.id = m.plan_id
    WHERE m.client_id = ?
    ORDER BY m.created_at DESC
  `).all(clientId) as { membershipId: string; planName: string; planPrice: number; endDate: string; status: string; totalPaid: number; totalDiscount: number }[]

  const debts: ClientDebt[] = []
  for (const row of rows) {
    const effectiveDue = row.planPrice - row.totalDiscount
    if (row.totalPaid < effectiveDue) {
      debts.push({
        clientId,
        clientName: '',
        clientPhone: '',
        membershipId: row.membershipId,
        planName: row.planName,
        totalDue: row.planPrice,
        totalPaid: row.totalPaid,
        balance: effectiveDue - row.totalPaid,
        endDate: row.endDate,
        status: row.status
      })
    }
  }
  return debts
}

export function getDebtors(): DebtorSummary[] {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT 
      c.id as clientId,
      c.full_name as clientName,
      c.phone,
      m.id as membershipId,
      p.price as planPrice,
      COALESCE((SELECT SUM(pm.amount) FROM payments pm WHERE pm.membership_id = m.id), 0) as totalPaid,
      COALESCE((SELECT SUM(pm.discount) FROM payments pm WHERE pm.membership_id = m.id), 0) as totalDiscount
    FROM memberships m
    JOIN clients c ON c.id = m.client_id
    JOIN membership_plans p ON p.id = m.plan_id
    WHERE m.status = 'active' OR m.status = 'frozen'
    GROUP BY m.id
    HAVING totalPaid < (p.price - totalDiscount)
    ORDER BY ((p.price - totalDiscount) - totalPaid) DESC
  `).all() as { clientId: string; clientName: string; phone: string; membershipId: string; planPrice: number; totalPaid: number; totalDiscount: number }[]

  return rows.map(r => ({
    clientId: r.clientId,
    clientName: r.clientName,
    phone: r.phone,
    balance: r.planPrice - r.totalPaid - r.totalDiscount
  }))
}

export function getExpiringMemberships(days: number): { clientId: string; clientName: string; phone: string; planName: string; endDate: string; daysLeft: number }[] {
  const db = getDatabase()
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const endDate = new Date(now)
  endDate.setDate(endDate.getDate() + days)
  const endStr = formatISO(endDate)

  const rows = db.prepare(`
    SELECT c.id as clientId, c.full_name as clientName, c.phone,
           m.plan_name as planName, m.end_date as endDate
    FROM memberships m
    JOIN clients c ON c.id = m.client_id
    WHERE m.status = 'active'
      AND m.end_date >= ? 
      AND m.end_date <= ?
    ORDER BY m.end_date ASC
  `).all(formatISO(now), endStr) as { clientId: string; clientName: string; phone: string; planName: string; endDate: string }[]

  return rows.map(r => ({
    ...r,
    daysLeft: differenceInDays(parseISO(r.endDate), now)
  }))
}

export function getActiveOrFrozenMembership(clientId: string): Membership | null {
  const db = getDatabase()
  // Día-consciente: se compara contra la FECHA de hoy, no contra el instante
  // exacto. Una membresía cuyo vencimiento es hoy sigue siendo válida todo el
  // día (no se vence a mitad de día por la hora de compra).
  const now = todayKey()

  // Una membresía CONGELADA NO consume días: si su vencimiento nominal pasó
  // mientras estaba congelada no está "vencida", está congelada (al descongelar
  // se extiende en unfreezeMembership). Por eso el filtro de end_date solo
  // aplica a las activas; así el kiosco responde denied_frozen (no
  // denied_expired) y updateExpiredMemberships no las marca vencidas.
  const stmt = db.prepare(`
    SELECT * FROM memberships 
    WHERE client_id = ? 
      AND (
        (status = 'active' AND end_date >= ?)
        OR status = 'frozen'
      )
    ORDER BY end_date DESC
    LIMIT 1
  `)
  
  const result = stmt.get(clientId, now) as DbMembership | undefined
  
  return result ? mapDbMembership(result) : null
}

export function createMembership(clientId: string, planId: string, startDate?: string): Membership | null {
  const db = getDatabase()
  const plan = getPlanById(planId)
  const client = getClientById(clientId)
  
  if (!plan || !client) {
    log.error('Cannot create membership: Plan or client not found')
    return null
  }
  
  if (client.status === 'suspended') {
    log.error(`Cannot create membership: Client ${clientId} is suspended`)
    return null
  }

  const existingMembership = getActiveOrFrozenMembership(clientId)
  // La membresía vigente NO bloquea la creación si vence HOY (su último día):
  // se permite renovar durante el último día de vigencia. Solo bloquea si se
  // extiende más allá de hoy.
  if (existingMembership && existingMembership.endDate.slice(0, 10) > todayKey()) {
    log.error(`Cannot create membership: Client ${clientId} already has an active or frozen membership`)
    return null
  }
  
  const actualStartDate = startDate ? parseISO(startDate) : new Date()
  // La membresía es válida durante TODOS los días completos de su duración:
  // vence al final (23:59:59) del último día, no a la misma hora de compra.
  // Así, una membresía de 1 día es válida durante todo el día y cualquier
  // membresía en su último día sigue operativa hasta que el día termine.
  // (durationDays mínimo 1: defensa ante planes con duración 0).
  const durationDays = Math.max(1, plan.durationDays)
  const endDate = endOfDay(addDays(startOfDay(actualStartDate), durationDays - 1))
  const now = new Date()

  // Día-consciente: si la fecha de vencimiento cae en un día ya pasado, la
  // membresía no tiene ningún valor (p. ej. startDate muy retroactivo + plan de
  // 1 día) y NO se crea. Antes nacía con status 'expired' pero igual se cobraba
  // el pago en createMembershipWithPayment: el cliente pagaba por algo vencido.
  if (formatISO(endDate).slice(0, 10) < todayKey()) {
    log.error(`Cannot create membership: end date ${formatISO(endDate)} is already in the past`)
    return null
  }
  
  const newMembership: Membership = {
    id: uuidv4(),
    clientId,
    planId,
    planName: plan.name,
    startDate: formatISO(actualStartDate),
    endDate: formatISO(endDate),
    status: formatISO(endDate).slice(0, 10) >= todayKey() ? 'active' : 'expired',
    createdAt: formatISO(now),
    frozenAt: null,
    freezeReason: null,
    freezeDays: null
  }
  
  const stmt = db.prepare(`
    INSERT INTO memberships (id, client_id, plan_id, plan_name, start_date, end_date, status, created_at, frozen_at, freeze_reason, freeze_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  
  stmt.run(
    newMembership.id,
    newMembership.clientId,
    newMembership.planId,
    newMembership.planName,
    newMembership.startDate,
    newMembership.endDate,
    newMembership.status,
    newMembership.createdAt,
    newMembership.frozenAt,
    null,
    null
  )
  
  if (newMembership.status === 'active') {
    updateClientStatus(clientId, 'active')
  }

  clearQueryCache()
  
  return newMembership
}

export function freezeMembership(membershipId: string, reason?: string, plannedDays?: number): Membership | null {
  const db = getDatabase()
  const now = formatISO(new Date())
  
  const getStmt = db.prepare('SELECT * FROM memberships WHERE id = ?')
  const membership = getStmt.get(membershipId) as DbMembership | undefined
  
  if (!membership) {
    log.error(`Cannot freeze: Membership ${membershipId} not found`)
    return null
  }
  
  if (membership.status !== 'active') {
    log.error(`Cannot freeze: Membership ${membershipId} is not active (status: ${membership.status})`)
    return null
  }
  
  const freezeOp = db.transaction(() => {
    db.prepare(`
      UPDATE memberships 
      SET status = 'frozen', frozen_at = ?, freeze_reason = ?, freeze_days = ?
      WHERE id = ?
    `).run(now, reason || null, plannedDays || null, membershipId)

    db.prepare(`
      INSERT INTO freeze_history (id, membership_id, client_id, frozen_at, reason, planned_days)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), membershipId, membership.client_id, now, reason || null, plannedDays || null)
  })
  
  freezeOp()
  
  const updatedMembership = getStmt.get(membershipId) as DbMembership | undefined
  
  clearQueryCache()
  
  return updatedMembership ? mapDbMembership(updatedMembership) : null
}

export function unfreezeMembership(membershipId: string, opts?: { automatic?: boolean }): Membership | null {
  const db = getDatabase()
  const now = new Date()
  const nowIso = formatISO(now)
  
  const getStmt = db.prepare('SELECT * FROM memberships WHERE id = ?')
  const membership = getStmt.get(membershipId) as DbMembership | undefined
  
  if (!membership) {
    log.error(`Cannot unfreeze: Membership ${membershipId} not found`)
    return null
  }
  
  if (membership.status !== 'frozen') {
    log.error(`Cannot unfreeze: Membership ${membershipId} is not frozen (status: ${membership.status})`)
    return null
  }
  
  if (!membership.frozen_at) {
    log.error(`Cannot unfreeze: Membership ${membershipId} has no frozen_at date`)
    return null
  }
  
  const frozenDate = parseISO(membership.frozen_at)
  const frozenDays = Math.ceil((now.getTime() - frozenDate.getTime()) / (1000 * 60 * 60 * 24))
  
  const unfreezeOp = db.transaction(() => {
    if (frozenDays > 0) {
      const currentEndDate = parseISO(membership.end_date)
      const newEndDate = addDays(currentEndDate, frozenDays)
      
      log.info(`Extending membership ${membershipId} by ${frozenDays} days (was frozen)`)
      
      db.prepare(`
        UPDATE memberships 
        SET status = 'active', 
            frozen_at = NULL,
            freeze_reason = NULL,
            freeze_days = NULL,
            end_date = ?
        WHERE id = ?
      `).run(formatISO(newEndDate), membershipId)
    } else {
      db.prepare(`
        UPDATE memberships 
        SET status = 'active', 
            frozen_at = NULL,
            freeze_reason = NULL,
            freeze_days = NULL
        WHERE id = ?
      `).run(membershipId)
    }

    db.prepare(`
      UPDATE freeze_history 
      SET unfrozen_at = ?, actual_days = ?, unfrozen_by = ?
      WHERE membership_id = ? AND unfrozen_at IS NULL
    `).run(nowIso, frozenDays, opts?.automatic ? 'auto' : 'manual', membershipId)
  })
  
  unfreezeOp()
  
  const updatedMembership = getStmt.get(membershipId) as DbMembership | undefined
  
  if (updatedMembership) {
    const mapped = mapDbMembership(updatedMembership)
    if (mapped.status === 'active') {
      updateClientStatus(mapped.clientId, 'active')
    }
    return mapped
  }
  
  clearQueryCache()
  
  return null
}

/**
 * Descongela automáticamente las membresías cuyo periodo planeado de
 * congelamiento (freeze_days) ya venció. Reutiliza unfreezeMembership: la
 * fecha de fin se extiende por los días transcurridos, de modo que los días
 * de la membresía vuelven a contar desde donde se quedaron.
 *
 * Evaluación perezosa: se invoca al cargar el dashboard y en system:updateExpired,
 * por lo que funciona incluso si la app estuvo cerrada durante el vencimiento.
 */
export function autoUnfreezeDueMemberships(): number {
  const db = getDatabase()
  const now = Date.now()

  const frozen = db.prepare(`
    SELECT id, frozen_at, freeze_days FROM memberships
    WHERE status = 'frozen' AND freeze_days IS NOT NULL AND frozen_at IS NOT NULL
  `).all() as Array<{ id: string; frozen_at: string; freeze_days: number | null }>

  let count = 0
  for (const row of frozen) {
    const plannedDays = Number(row.freeze_days)
    if (!Number.isFinite(plannedDays) || plannedDays <= 0) continue

    const frozenAt = parseISO(row.frozen_at)
    if (Number.isNaN(frozenAt.getTime())) continue

    if (now >= addDays(frozenAt, plannedDays).getTime()) {
      const result = unfreezeMembership(row.id, { automatic: true })
      if (result) count++
    }
  }

  if (count > 0) {
    log.info(`Auto-unfroze ${count} membership(s): planned freeze period ended`)
  }
  return count
}

export function getActiveMembership(clientId: string): Membership | null {
  const db = getDatabase()
  // Día-consciente: válida hasta el final del día de vencimiento (ver
  // getActiveOrFrozenMembership). Evita denegar el acceso a mitad de día.
  const now = todayKey()
  
  const stmt = db.prepare(`
    SELECT * FROM memberships 
    WHERE client_id = ? 
      AND status = 'active' 
      AND end_date >= ?
    ORDER BY end_date DESC
    LIMIT 1
  `)
  
  const result = stmt.get(clientId, now) as DbMembership | undefined
  
  return result ? mapDbMembership(result) : null
}

export function getClientMemberships(clientId: string): Membership[] {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    SELECT * FROM memberships 
    WHERE client_id = ? 
    ORDER BY created_at DESC
  `)
  
  const results = stmt.all(clientId) as unknown as DbMembership[]
  
  return results.map(mapDbMembership)
}

export function updateExpiredMemberships(): number {
  const db = getDatabase()
  // Día-consciente: una membresía que vence HOY no se marca como vencida hasta
  // que el día termina. Se compara contra la fecha de hoy.
  const now = todayKey()

  const expiredOp = db.transaction(() => {
    const getExpired = db.prepare(`
      SELECT DISTINCT client_id FROM memberships 
      WHERE status = 'active' AND end_date < ?
    `)

    const expiredClients = getExpired.all(now) as { client_id: string }[]

    const updateStmt = db.prepare(`
      UPDATE memberships SET status = 'expired' 
      WHERE status = 'active' AND end_date < ?
    `)

    const result = updateStmt.run(now)

    for (const client of expiredClients) {
      // Si el cliente conserva una membresía congelada (válida aunque su
      // vencimiento nominal haya pasado, porque no consume días congelado),
      // NO se le marca 'expired': sigue congelado hasta que se descongele.
      const activeOrFrozen = getActiveOrFrozenMembership(client.client_id)
      if (!activeOrFrozen) {
        updateClientStatus(client.client_id, 'expired')
      }
    }

    return result.changes
  })

  const changes = expiredOp()
  clearQueryCache()
  log.info(`Updated ${changes} expired memberships`)
  return changes
}

export interface DbFreezeHistory {
  id: string
  membership_id: string
  client_id: string
  frozen_at: string
  unfrozen_at: string | null
  reason: string | null
  planned_days: number | null
  actual_days: number | null
  unfrozen_by: string | null
}

function mapDbFreezeHistory(h: DbFreezeHistory): FreezeHistory {
  return {
    id: h.id,
    membershipId: h.membership_id,
    clientId: h.client_id,
    frozenAt: h.frozen_at,
    unfrozenAt: h.unfrozen_at || null,
    reason: h.reason || null,
    plannedDays: h.planned_days || null,
    actualDays: h.actual_days || null,
    unfrozenBy: (h.unfrozen_by as FreezeHistory['unfrozenBy']) || null
  }
}

export function getFreezeHistory(membershipId: string): FreezeHistory[] {
  const db = getDatabase()
  const results = db.prepare('SELECT * FROM freeze_history WHERE membership_id = ? ORDER BY frozen_at DESC').all(membershipId) as unknown as DbFreezeHistory[]
  return results.map(mapDbFreezeHistory)
}

export function getClientFreezeHistory(clientId: string): FreezeHistory[] {
  const db = getDatabase()
  const results = db.prepare('SELECT * FROM freeze_history WHERE client_id = ? ORDER BY frozen_at DESC').all(clientId) as unknown as DbFreezeHistory[]
  return results.map(mapDbFreezeHistory)
}

export function getClientAttendanceStats(clientId: string): ClientAttendanceStats {
  const db = getDatabase()
  const now = new Date()
  const startOfMonth = formatISO(new Date(now.getFullYear(), now.getMonth(), 1))
  
  const totalResult = db.prepare('SELECT COUNT(*) as count FROM access_logs WHERE client_id = ? AND result = ?').get(clientId, 'granted') as { count: number }
  const lastResult = db.prepare('SELECT timestamp FROM access_logs WHERE client_id = ? AND result = ? ORDER BY timestamp DESC LIMIT 1').get(clientId, 'granted') as { timestamp: string } | undefined
  const firstResult = db.prepare('SELECT timestamp FROM access_logs WHERE client_id = ? AND result = ? ORDER BY timestamp ASC LIMIT 1').get(clientId, 'granted') as { timestamp: string } | undefined
  const monthResult = db.prepare('SELECT COUNT(*) as count FROM access_logs WHERE client_id = ? AND result = ? AND timestamp >= ?').get(clientId, 'granted', startOfMonth) as { count: number }

  return {
    totalVisits: totalResult.count,
    lastVisit: lastResult?.timestamp || null,
    firstVisit: firstResult?.timestamp || null,
    daysAttendedThisMonth: monthResult.count
  }
}

/**
 * Consulta pesada (subconsultas correlacionadas sobre access_logs) que el dashboard
 * ejecuta 2 veces por carga y cada 30 s. Se cachea con TTL corto; se invalida al
 * registrar un acceso concedido (logAccess) o al mutar clientes/membresías.
 */
export function getInactiveClients(daysThreshold: number = 30): InactiveClient[] {
  // TTL 60 s: el dashboard refresca cada 30 s, así el cache sirve refrescos
  // consecutivos. Las escrituras (accesos, membresías, clientes) invalidan.
  return cached(`inactiveClients:${daysThreshold}`, 60_000, () => {
    const db = getDatabase()
    const cutoff = formatISO(new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000))

    const rows = db.prepare(`
      SELECT 
        c.id as clientId,
        c.full_name as clientName,
        c.phone,
        m.plan_name as planName,
        (SELECT MAX(a.timestamp) FROM access_logs a WHERE a.client_id = c.id AND a.result = 'granted') as lastVisit
      FROM clients c
      JOIN memberships m ON m.client_id = c.id AND m.status = 'active'
      WHERE c.status = 'active'
        AND (
          (SELECT MAX(a.timestamp) FROM access_logs a WHERE a.client_id = c.id AND a.result = 'granted') IS NULL
          OR (SELECT MAX(a.timestamp) FROM access_logs a WHERE a.client_id = c.id AND a.result = 'granted') < ?
        )
      ORDER BY lastVisit ASC
    `).all(cutoff) as { clientId: string; clientName: string; phone: string; planName: string; lastVisit: string | null }[]

    return rows.map(r => ({
      clientId: r.clientId,
      clientName: r.clientName,
      phone: r.phone,
      planName: r.planName,
      lastVisit: r.lastVisit || null,
      daysSinceLastVisit: r.lastVisit
        ? Math.floor((Date.now() - new Date(r.lastVisit).getTime()) / (1000 * 60 * 60 * 24))
        : daysThreshold
    }))
  })
}

export function createMembershipWithPayment(
  clientId: string,
  planId: string,
  amount: number,
  method: PaymentMethod,
  startDate?: string,
  notes?: string,
  discount?: number
): { membership: Membership | null; payment: Payment | null; error?: string } {
  const db = getDatabase()

  const operation = db.transaction(() => {
    const plan = getPlanById(planId)
    if (!plan) {
      return { membership: null, payment: null, error: 'Plan no encontrado' }
    }

    const existing = getActiveOrFrozenMembership(clientId)
    if (existing) {
      // Renovar es válido en el último día de vigencia (vence hoy): la membresía
      // sigue operativa hoy, pero ya se puede pagar la siguiente.
      if (existing.status === 'active' && existing.endDate.slice(0, 10) > todayKey()) {
        return { membership: null, payment: null, error: 'El cliente ya tiene una membresía activa. No puede renovar hasta que venza.' }
      }
      if (existing.status === 'frozen') {
        return { membership: null, payment: null, error: 'El cliente tiene una membresía congelada. Descongélela primero.' }
      }
    }

    const membership = createMembership(clientId, planId, startDate)
    if (!membership) {
      return { membership: null, payment: null, error: 'No se pudo crear la membresía' }
    }

    const paymentDesc = `Pago membresía ${membership.planName}`
    const payment = recordPayment(
      clientId,
      amount,
      method,
      paymentDesc,
      membership.id,
      notes,
      discount
    )

    return { membership, payment }
  })

  return operation()
}

export function getMembershipPayments(membershipId: string): Payment[] {
  const db = getDatabase()
  const results = db.prepare(`
    SELECT p.*, c.full_name as client_name
    FROM payments p
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE p.membership_id = ?
    ORDER BY p.date DESC
  `).all(membershipId) as unknown as DbPayment[]
  return results.map(mapDbPayment)
}

export function recordPayment(
  clientId: string,
  amount: number,
  method: PaymentMethod,
  description: string,
  membershipId?: string,
  notes?: string,
  discount?: number
): Payment {
  const db = getDatabase()
  
  const payment: Payment = {
    id: uuidv4(),
    clientId,
    membershipId: membershipId || null,
    amount,
    discount: discount || 0,
    method,
    description,
    date: formatISO(new Date()),
    notes: notes || '',
    createdAt: formatISO(new Date())
  }
  
  const stmt = db.prepare(`
    INSERT INTO payments (id, client_id, membership_id, amount, discount, method, description, date, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  
  stmt.run(
    payment.id,
    payment.clientId,
    payment.membershipId,
    payment.amount,
    payment.discount,
    payment.method,
    payment.description,
    payment.date,
    payment.notes,
    payment.createdAt
  )
  
  return payment
}

export function getClientPayments(clientId: string, page = 1, pageSize = 50): PageResponse<Payment> {
  const db = getDatabase()
  
  const countRow = db.prepare('SELECT COUNT(*) as total FROM payments WHERE client_id = ?').get(clientId) as { total: number }
  const total = countRow.total
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize

  const stmt = db.prepare(`
    SELECT p.*, c.full_name as client_name
    FROM payments p
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE p.client_id = ?
    ORDER BY p.date DESC
    LIMIT ? OFFSET ?
  `)
  
  const results = stmt.all(clientId, pageSize, offset) as unknown as DbPayment[]
  
  return { data: results.map(mapDbPayment), total, page: safePage, totalPages }
}

export function getPaymentsByDateRange(startDate: string, endDate: string, page = 1, pageSize = 50, method?: string): PageResponse<Payment> {
  const db = getDatabase()
  
  const params: (string | number)[] = [startDate, endDate]
  let methodClause = ''
  if (method) {
    methodClause = ' AND p.method = ?'
    params.push(method)
  }
  
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM payments WHERE date >= ? AND date <= ?${methodClause}`).get(...params) as { total: number }
  const total = countRow.total
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize

  const stmt = db.prepare(`
    SELECT p.*, c.full_name as client_name
    FROM payments p
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE p.date >= ? AND p.date <= ?${methodClause}
    ORDER BY p.date DESC
    LIMIT ? OFFSET ?
  `)
  
  const results = stmt.all(...params, pageSize, offset) as unknown as DbPayment[]
  
  return { data: results.map(mapDbPayment), total, page: safePage, totalPages }
}

export function logAccess(
  accessCode: string,
  result: AccessResult,
  message: string,
  clientId?: string,
  clientName?: string,
  accessType: AccessType = 'check_in'
): AccessLog {
  const db = getDatabase()
  
  const log: AccessLog = {
    id: uuidv4(),
    clientId: clientId || '',
    clientName: clientName || '',
    accessCode,
    accessType,
    result,
    message,
    timestamp: formatISO(new Date())
  }
  
  const stmt = db.prepare(`
    INSERT INTO access_logs (id, client_id, client_name, access_code, access_type, result, message, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  
  stmt.run(
    log.id,
    log.clientId || null,
    log.clientName || null,
    log.accessCode,
    log.accessType,
    log.result,
    log.message,
    log.timestamp
  )

  // Un acceso concedido cambia la lista de clientes inactivos del dashboard.
  if (result === 'granted') {
    clearQueryCache()
  }
  
  return log
}

export function getAccessLogs(page = 1, pageSize = 50, result?: string): PageResponse<AccessLog> {
  const db = getDatabase()
  
  const params: (string | number)[] = []
  let resultClause = ''
  if (result) {
    resultClause = ' WHERE result = ?'
    params.push(result)
  }
  
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM access_logs${resultClause}`).get(...params) as { total: number }
  const total = countRow.total
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize

  const stmt = db.prepare(`
    SELECT * FROM access_logs${resultClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `)
  
  const results = stmt.all(...params, pageSize, offset) as unknown as DbAccessLog[]
  
  return { data: results.map(mapDbAccessLog), total, page: safePage, totalPages }
}

export function getAccessLogsByDate(startDate: string, endDate: string, page = 1, pageSize = 50, result?: string): PageResponse<AccessLog> {
  const db = getDatabase()
  
  const params: (string | number)[] = [startDate, endDate]
  let resultClause = ''
  if (result) {
    resultClause = ' AND result = ?'
    params.push(result)
  }
  
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM access_logs WHERE timestamp >= ? AND timestamp <= ?${resultClause}`).get(...params) as { total: number }
  const total = countRow.total
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize

  const stmt = db.prepare(`
    SELECT * FROM access_logs 
    WHERE timestamp >= ? AND timestamp <= ?${resultClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `)
  
  const results = stmt.all(...params, pageSize, offset) as unknown as DbAccessLog[]
  
  return { data: results.map(mapDbAccessLog), total, page: safePage, totalPages }
}

export function getClientAccessLogs(clientId: string, page = 1, pageSize = 50): PageResponse<AccessLog> {
  const db = getDatabase()
  
  const countRow = db.prepare('SELECT COUNT(*) as total FROM access_logs WHERE client_id = ?').get(clientId) as { total: number }
  const total = countRow.total
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize

  const stmt = db.prepare(`
    SELECT * FROM access_logs 
    WHERE client_id = ?
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `)
  
  const results = stmt.all(clientId, pageSize, offset) as unknown as DbAccessLog[]
  
  return { data: results.map(mapDbAccessLog), total, page: safePage, totalPages }
}

export function getTodayAccessCount(): number {
  const db = getDatabase()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startOfDay = formatISO(today)
  const tomorrow = addDays(today, 1)
  const endOfDay = formatISO(tomorrow)
  
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM access_logs 
    WHERE result = 'granted'
      AND timestamp >= ? 
      AND timestamp < ?
  `)
  
  const result = stmt.get(startOfDay, endOfDay) as { count: number }
  
  return result.count
}
