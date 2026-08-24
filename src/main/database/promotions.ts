import { getDatabase } from './index'
import { Promotion, MembershipPlan } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import { formatISO } from 'date-fns'
import log from 'electron-log'

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
