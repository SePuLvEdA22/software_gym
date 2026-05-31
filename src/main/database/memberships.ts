import { getDatabase } from './index'
import { Membership, MembershipPlan, MembershipStatus, MembershipType, Payment, PaymentMethod, AccessLog, AccessType, AccessResult, Promotion, ClientDebt, DebtorSummary, FreezeHistory, ClientAttendanceStats, InactiveClient } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import { getClientById, updateClientStatus } from './clients'
import { addDays, formatISO, isAfter, parseISO, differenceInDays } from 'date-fns'
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
  const results = stmt.all(...params) as DbPlan[]
  
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
  const results = db.prepare(query).all(...params) as DbPromotion[]
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
  const now = formatISO(new Date())
  
  const stmt = db.prepare(`
    SELECT * FROM memberships 
    WHERE client_id = ? 
      AND (status = 'active' OR status = 'frozen')
      AND end_date >= ?
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
  if (existingMembership) {
    log.error(`Cannot create membership: Client ${clientId} already has an active or frozen membership`)
    return null
  }
  
  const actualStartDate = startDate ? parseISO(startDate) : new Date()
  const endDate = addDays(actualStartDate, plan.durationDays)
  const now = new Date()
  
  const newMembership: Membership = {
    id: uuidv4(),
    clientId,
    planId,
    planName: plan.name,
    startDate: formatISO(actualStartDate),
    endDate: formatISO(endDate),
    status: isAfter(endDate, now) ? 'active' : 'expired',
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
  
  return updatedMembership ? mapDbMembership(updatedMembership) : null
}

export function unfreezeMembership(membershipId: string): Membership | null {
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
      SET unfrozen_at = ?, actual_days = ?
      WHERE membership_id = ? AND unfrozen_at IS NULL
    `).run(nowIso, frozenDays, membershipId)
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
  
  return null
}

export function getActiveMembership(clientId: string): Membership | null {
  const db = getDatabase()
  const now = formatISO(new Date())
  
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
  
  const results = stmt.all(clientId) as DbMembership[]
  
  return results.map(mapDbMembership)
}

export function updateExpiredMemberships(): number {
  const db = getDatabase()
  const now = formatISO(new Date())

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
      const activeMembership = getActiveMembership(client.client_id)
      if (!activeMembership) {
        updateClientStatus(client.client_id, 'expired')
      }
    }

    return result.changes
  })

  const changes = expiredOp()
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
    actualDays: h.actual_days || null
  }
}

export function getFreezeHistory(membershipId: string): FreezeHistory[] {
  const db = getDatabase()
  const results = db.prepare('SELECT * FROM freeze_history WHERE membership_id = ? ORDER BY frozen_at DESC').all(membershipId) as DbFreezeHistory[]
  return results.map(mapDbFreezeHistory)
}

export function getClientFreezeHistory(clientId: string): FreezeHistory[] {
  const db = getDatabase()
  const results = db.prepare('SELECT * FROM freeze_history WHERE client_id = ? ORDER BY frozen_at DESC').all(clientId) as DbFreezeHistory[]
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

export function getInactiveClients(daysThreshold: number = 30): InactiveClient[] {
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

    const existingMembership = getActiveOrFrozenMembership(clientId)
    if (existingMembership) {
      const currentEndDate = parseISO(existingMembership.endDate)
      const newEndDate = addDays(currentEndDate, plan.durationDays)

      db.prepare(`UPDATE memberships SET end_date = ?, plan_name = ?, plan_id = ? WHERE id = ?`)
        .run(formatISO(newEndDate), plan.name, planId, existingMembership.id)

      db.prepare(`UPDATE memberships SET status = 'active' WHERE id = ? AND status = 'frozen'`)
        .run(existingMembership.id)

      const extendedMembership = mapDbMembership(
        db.prepare('SELECT * FROM memberships WHERE id = ?').get(existingMembership.id) as DbMembership
      )

      updateClientStatus(clientId, 'active')

      const paymentDesc = `Renovación membresía ${plan.name}`
      const payment = recordPayment(
        clientId,
        amount,
        method,
        paymentDesc,
        existingMembership.id,
        notes,
        discount
      )

      return { membership: extendedMembership, payment }
    }

    const membership = createMembership(clientId, planId, startDate)
    if (!membership) {
      return { membership: null, payment: null, error: 'No se pudo crear la membresía' }
    }

    const paymentDesc = `Renovación membresía ${membership.planName}`
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

export function getClientPayments(clientId: string): Payment[] {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    SELECT p.*, c.full_name as client_name
    FROM payments p
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE p.client_id = ?
    ORDER BY p.date DESC
    LIMIT 100
  `)
  
  const results = stmt.all(clientId) as DbPayment[]
  
  return results.map(mapDbPayment)
}

export function getPaymentsByDateRange(startDate: string, endDate: string): Payment[] {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    SELECT p.*, c.full_name as client_name
    FROM payments p
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE p.date >= ? AND p.date <= ?
    ORDER BY p.date DESC
  `)
  
  const results = stmt.all(startDate, endDate) as DbPayment[]
  
  return results.map(mapDbPayment)
}

export function logAccess(
  accessCode: string,
  result: AccessResult,
  message: string,
  clientId?: string,
  clientName?: string
): AccessLog {
  const db = getDatabase()
  
  const log: AccessLog = {
    id: uuidv4(),
    clientId: clientId || '',
    clientName: clientName || '',
    accessCode,
    accessType: 'check_in',
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
  
  return log
}

export function getAccessLogs(limit = 100): AccessLog[] {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    SELECT * FROM access_logs 
    ORDER BY timestamp DESC
    LIMIT ?
  `)
  
  const results = stmt.all(limit) as DbAccessLog[]
  
  return results.map(mapDbAccessLog)
}

export function getAccessLogsByDate(startDate: string, endDate: string): AccessLog[] {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    SELECT * FROM access_logs 
    WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp DESC
  `)
  
  const results = stmt.all(startDate, endDate) as DbAccessLog[]
  
  return results.map(mapDbAccessLog)
}

export function getClientAccessLogs(clientId: string, limit = 50): AccessLog[] {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    SELECT * FROM access_logs 
    WHERE client_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `)
  
  const results = stmt.all(clientId, limit) as DbAccessLog[]
  
  return results.map(mapDbAccessLog)
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
