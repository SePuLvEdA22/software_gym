import { getDatabase } from './index'
import { MembershipPlan, MembershipType } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import { formatISO } from 'date-fns'

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
