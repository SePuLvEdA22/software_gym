import { getDatabase } from './index'
import { Membership, Payment, PaymentMethod, PageResponse } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import { formatISO } from 'date-fns'
import { getPlanById } from './plans'
import { getActiveOrFrozenMembership, createMembership } from './memberships'

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
    if (existing?.status === 'frozen') {
      return { membership: null, payment: null, error: 'El cliente tiene una membresía congelada. Descongélela primero.' }
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
  
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM payments p WHERE p.date >= ? AND p.date <= ?${methodClause}`).get(...params) as { total: number }
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
