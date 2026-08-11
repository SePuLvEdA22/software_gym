import { getDatabase } from './index'
import { Product, InventoryMovement, PageResponse } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import { formatISO } from 'date-fns'
import { getSessionUser } from './users'

export interface DbProduct {
  id: string
  name: string
  category: string
  description: string
  price: number
  cost: number
  stock: number
  min_stock: number
  barcode: string
  is_active: number
  created_at: string
  updated_at: string
}

function mapDbProduct(p: DbProduct): Product {
  return {
    id: p.id,
    name: p.name,
    category: p.category as Product['category'],
    description: p.description,
    price: p.price,
    cost: p.cost,
    stock: p.stock,
    minStock: p.min_stock,
    barcode: p.barcode,
    isActive: p.is_active === 1,
    createdAt: p.created_at,
    updatedAt: p.updated_at
  }
}

export interface DbMovement {
  id: string
  product_id: string
  product_name: string
  type: string
  quantity: number
  price: number
  total: number
  description: string
  user_id: string | null
  user_name: string | null
  timestamp: string
}

function mapDbMovement(m: DbMovement): InventoryMovement {
  return {
    id: m.id,
    productId: m.product_id,
    productName: m.product_name,
    type: m.type as 'in' | 'out',
    quantity: m.quantity,
    price: m.price,
    total: m.total,
    description: m.description,
    userId: m.user_id,
    userName: m.user_name || '',
    timestamp: m.timestamp
  }
}

export function getAllProducts(activeOnly = true, page = 1, pageSize = 50, search?: string, category?: string): PageResponse<Product> {
  const db = getDatabase()
  let countQuery = 'SELECT COUNT(*) as total FROM products WHERE 1=1'
  let query = 'SELECT * FROM products WHERE 1=1'
  const params: (string | number)[] = []
  if (activeOnly) {
    const clause = ' AND is_active = ?'
    countQuery += clause
    query += clause
    params.push(1)
  }
  if (search) {
    const clause = ' AND (name LIKE ? OR barcode LIKE ?)'
    countQuery += clause
    query += clause
    const searchPattern = `%${search}%`
    params.push(searchPattern, searchPattern)
  }
  if (category) {
    const clause = ' AND category = ?'
    countQuery += clause
    query += clause
    params.push(category)
  }
  const countRow = db.prepare(countQuery).get(...params) as { total: number }
  const total = countRow.total
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize
  query += ' ORDER BY name ASC LIMIT ? OFFSET ?'
  const rows = db.prepare(query).all(...params, pageSize, offset) as unknown as DbProduct[]
  return { data: rows.map(mapDbProduct), total, page: safePage, totalPages }
}

export function getProductById(id: string): Product | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as DbProduct | undefined
  return row ? mapDbProduct(row) : null
}

export function createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>): Product {
  const db = getDatabase()
  const id = uuidv4()
  const now = formatISO(new Date())
  db.prepare(`
    INSERT INTO products (id, name, category, description, price, cost, stock, min_stock, barcode, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, data.name, data.category, data.description, data.price, data.cost, data.stock, data.minStock, data.barcode, now, now)
  return getProductById(id)!
}

export function updateProduct(id: string, data: Partial<Product>): Product | null {
  const db = getDatabase()
  const existing = getProductById(id)
  if (!existing) return null
  const fields: string[] = []
  const params: (string | number)[] = []
  if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name) }
  if (data.category !== undefined) { fields.push('category = ?'); params.push(data.category) }
  if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description) }
  if (data.price !== undefined) { fields.push('price = ?'); params.push(data.price) }
  if (data.cost !== undefined) { fields.push('cost = ?'); params.push(data.cost) }
  if (data.stock !== undefined) { fields.push('stock = ?'); params.push(data.stock) }
  if (data.minStock !== undefined) { fields.push('min_stock = ?'); params.push(data.minStock) }
  if (data.barcode !== undefined) { fields.push('barcode = ?'); params.push(data.barcode) }
  if (data.isActive !== undefined) { fields.push('is_active = ?'); params.push(data.isActive ? 1 : 0) }
  if (fields.length === 0) return existing
  fields.push('updated_at = ?')
  params.push(formatISO(new Date()))
  params.push(id)
  db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  return getProductById(id)
}

export function deleteProduct(id: string): boolean {
  const db = getDatabase()
  return db.prepare('DELETE FROM products WHERE id = ?').run(id).changes > 0
}

export function registerMovement(
  productId: string,
  type: 'in' | 'out',
  quantity: number,
  price: number,
  description: string
): InventoryMovement | null {
  const db = getDatabase()
  const product = getProductById(productId)
  if (!product) return null

  // Integridad de stock: la cantidad debe ser positiva y una salida no puede
  // superar el stock disponible. Antes, una salida con cantidad negativa
  // INCREMENTABA el stock y las salidas podían dejarlo en negativo.
  if (quantity <= 0) return null
  if (type === 'out' && quantity > product.stock) return null

  const user = getSessionUser()
  const id = uuidv4()
  const now = formatISO(new Date())
  const total = price * quantity

  db.transaction(() => {
    db.prepare(`
      INSERT INTO inventory_movements (id, product_id, product_name, type, quantity, price, total, description, user_id, user_name, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, productId, product.name, type, quantity, price, total, description, user?.id || null, user?.fullName || 'Sistema', now)

    const change = type === 'in' ? quantity : -quantity
    db.prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?').run(change, now, productId)
  })()

  const row = db.prepare('SELECT * FROM inventory_movements WHERE id = ?').get(id) as DbMovement | undefined
  return row ? mapDbMovement(row) : null
}

export function getMovements(productId?: string, page = 1, pageSize = 50): PageResponse<InventoryMovement> {
  const db = getDatabase()
  let countQuery = 'SELECT COUNT(*) as total FROM inventory_movements WHERE 1=1'
  let query = 'SELECT * FROM inventory_movements WHERE 1=1'
  const params: (string | number)[] = []
  if (productId) {
    const clause = ' AND product_id = ?'
    countQuery += clause
    query += clause
    params.push(productId)
  }
  const countRow = db.prepare(countQuery).get(...params) as { total: number }
  const total = countRow.total
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize
  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
  const rows = db.prepare(query).all(...params, pageSize, offset) as unknown as DbMovement[]
  return { data: rows.map(mapDbMovement), total, page: safePage, totalPages }
}

export function getLowStockProducts(threshold?: number): Product[] {
  const result = getAllProducts(true, 1, 10000)
  return result.data.filter(p => p.stock <= (threshold || p.minStock))
}
