import { getDatabase } from './index'
import { Membership, MembershipPlan, MembershipStatus, MembershipType, Payment, PaymentMethod, AccessLog, AccessType, AccessResult } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import { getClientById, updateClientStatus } from './clients'
import { addDays, formatISO, isAfter, isBefore, parseISO } from 'date-fns'
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
    createdAt: dbMembership.created_at
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
  membership_id: string | null
  amount: number
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
    membershipId: dbPayment.membership_id,
    amount: dbPayment.amount,
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
  const params: number[] = []
  
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

export function createMembership(clientId: string, planId: string, startDate?: string): Membership | null {
  const db = getDatabase()
  const plan = getPlanById(planId)
  const client = getClientById(clientId)
  
  if (!plan || !client) {
    log.error('Cannot create membership: Plan or client not found')
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
    createdAt: formatISO(now)
  }
  
  const stmt = db.prepare(`
    INSERT INTO memberships (id, client_id, plan_id, plan_name, start_date, end_date, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  
  stmt.run(
    newMembership.id,
    newMembership.clientId,
    newMembership.planId,
    newMembership.planName,
    newMembership.startDate,
    newMembership.endDate,
    newMembership.status,
    newMembership.createdAt
  )
  
  if (newMembership.status === 'active') {
    updateClientStatus(clientId, 'active')
  }
  
  return newMembership
}

export function getActiveMembership(clientId: string): Membership | null {
  const db = getDatabase()
  const now = formatISO(new Date())
  
  const stmt = db.prepare(`
    SELECT * FROM memberships 
    WHERE client_id = ? 
      AND status = 'active' 
      AND end_date > ?
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
  
  log.info(`Updated ${result.changes} expired memberships`)
  return result.changes
}

export function recordPayment(
  clientId: string,
  amount: number,
  method: PaymentMethod,
  description: string,
  membershipId?: string,
  notes?: string
): Payment {
  const db = getDatabase()
  
  const payment: Payment = {
    id: uuidv4(),
    clientId,
    membershipId: membershipId || null,
    amount,
    method,
    description,
    date: formatISO(new Date()),
    notes: notes || '',
    createdAt: formatISO(new Date())
  }
  
  const stmt = db.prepare(`
    INSERT INTO payments (id, client_id, membership_id, amount, method, description, date, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  
  stmt.run(
    payment.id,
    payment.clientId,
    payment.membershipId,
    payment.amount,
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
    SELECT * FROM payments 
    WHERE client_id = ? 
    ORDER BY date DESC
    LIMIT 100
  `)
  
  const results = stmt.all(clientId) as DbPayment[]
  
  return results.map(mapDbPayment)
}

export function getPaymentsByDateRange(startDate: string, endDate: string): Payment[] {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    SELECT * FROM payments 
    WHERE date >= ? AND date <= ?
    ORDER BY date DESC
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
