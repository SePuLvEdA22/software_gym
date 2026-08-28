import { getDatabase } from './index'
import { User, UserRole, ChangeLog, PageResponse } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import { formatISO } from 'date-fns'

export interface DbUser {
  id: string
  username: string
  full_name: string
  password_hash: string
  role: string
  permissions: string
  is_active: number
  last_login: string | null
  created_at: string
  updated_at: string
}

function mapDbUser(dbUser: DbUser): User {
  return {
    id: dbUser.id,
    username: dbUser.username,
    fullName: dbUser.full_name,
    role: dbUser.role as UserRole,
    permissions: JSON.parse(dbUser.permissions || '[]'),
    isActive: dbUser.is_active === 1,
    lastLogin: dbUser.last_login || null,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at
  }
}

let currentSessionUser: User | null = null

const MAX_LOGIN_ATTEMPTS = 5
const BLOCK_DURATION_MS = 30_000
const loginAttempts = new Map<string, { attempts: number; blockedUntil: number | null }>()

function cleanupLoginAttempts(): void {
  const now = Date.now()
  for (const [key, value] of loginAttempts) {
    if (value.blockedUntil && now >= value.blockedUntil) {
      loginAttempts.delete(key)
    }
  }
}

export function setSessionUser(user: User | null): void {
  currentSessionUser = user
}

export function getSessionUser(): User | null {
  return currentSessionUser
}

export function authenticateUser(username: string, password: string): { success: boolean; user?: User; mustChangePassword?: boolean; error?: string } {
  const db = getDatabase()
  const now = Date.now()

  cleanupLoginAttempts()

  const record = loginAttempts.get(username)
  if (record?.blockedUntil && now < record.blockedUntil) {
    const remainingSeconds = Math.ceil((record.blockedUntil - now) / 1000)
    return { success: false, error: `Demasiados intentos. Intente de nuevo en ${remainingSeconds} segundos.` }
  }

  const row = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username) as DbUser | undefined
  if (!row) {
    const attempts = (loginAttempts.get(username)?.attempts || 0) + 1
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      loginAttempts.set(username, { attempts, blockedUntil: now + BLOCK_DURATION_MS })
    } else {
      loginAttempts.set(username, { attempts, blockedUntil: null })
    }
    return { success: false, error: 'Usuario o contraseña incorrectos' }
  }

  if (!bcrypt.compareSync(password, row.password_hash)) {
    const attempts = (loginAttempts.get(username)?.attempts || 0) + 1
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      loginAttempts.set(username, { attempts, blockedUntil: now + BLOCK_DURATION_MS })
    } else {
      loginAttempts.set(username, { attempts, blockedUntil: null })
    }
    return { success: false, error: 'Usuario o contraseña incorrectos' }
  }

  loginAttempts.delete(username)

  const user = mapDbUser(row)
  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(formatISO(new Date()), user.id)
  currentSessionUser = user

  const mustChangeRow = db.prepare("SELECT value FROM settings WHERE key = 'must_change_password'").get() as
    | { value: string }
    | undefined
  // La bandera solo aplica a la cuenta admin por defecto: si se devolviera
  // para cualquier rol, un usuario no-admin quedaría atrapado en la pantalla
  // de cambio de contraseña (system:updateAdmin exige rol admin).
  const mustChangePassword = user.id === 'user_admin' && mustChangeRow?.value === '1'

  return { success: true, user, mustChangePassword }
}

export function verifyUserPassword(userId: string, password: string): boolean {
  const db = getDatabase()
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as
    | { password_hash: string }
    | undefined
  if (!row) return false
  return bcrypt.compareSync(password, row.password_hash)
}

export function clearMustChangePassword(): void {
  const db = getDatabase()
  db.prepare(`INSERT INTO settings (key, value) VALUES ('must_change_password', '0')
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run()
}

export function getAllUsers(page = 1, pageSize = 50): PageResponse<User> {
  const db = getDatabase()
  const countRow = db.prepare('SELECT COUNT(*) as total FROM users').get() as { total: number }
  const total = countRow.total
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize
  const rows = db.prepare('SELECT * FROM users ORDER BY full_name ASC LIMIT ? OFFSET ?').all(pageSize, offset) as unknown as DbUser[]
  return { data: rows.map(mapDbUser), total, page: safePage, totalPages }
}

export function getUserById(id: string): User | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined
  return row ? mapDbUser(row) : null
}

export function createUser(data: { username: string; fullName: string; password: string; role: UserRole; permissions?: string[] }): { success: boolean; user?: User; error?: string } {
  const db = getDatabase()
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(data.username)
  if (existing) return { success: false, error: 'Ya existe un usuario con ese nombre de usuario' }
  const id = uuidv4()
  const passwordHash = bcrypt.hashSync(data.password, 10)
  const permissions = JSON.stringify(data.permissions || [])
  db.prepare(`
    INSERT INTO users (id, username, full_name, password_hash, role, permissions, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, data.username, data.fullName, passwordHash, data.role, permissions, formatISO(new Date()), formatISO(new Date()))
  const user = getUserById(id)
  return { success: true, user: user || undefined }
}

export function updateUser(id: string, data: Partial<{ username: string; fullName: string; role: UserRole; permissions: string[]; isActive: boolean; password: string }>): { success: boolean; user?: User; error?: string } {
  const db = getDatabase()
  const existing = getUserById(id)
  if (!existing) return { success: false, error: 'Usuario no encontrado' }
  const fields: string[] = []
  const params: (string | number)[] = []
  if (data.username !== undefined) { fields.push('username = ?'); params.push(data.username) }
  if (data.fullName !== undefined) { fields.push('full_name = ?'); params.push(data.fullName) }
  if (data.role !== undefined) { fields.push('role = ?'); params.push(data.role) }
  if (data.permissions !== undefined) { fields.push('permissions = ?'); params.push(JSON.stringify(data.permissions)) }
  if (data.isActive !== undefined) { fields.push('is_active = ?'); params.push(data.isActive ? 1 : 0) }
  if (data.password) { fields.push('password_hash = ?'); params.push(bcrypt.hashSync(data.password, 10)) }
  if (fields.length === 0) return { success: true, user: existing }
  fields.push('updated_at = ?')
  params.push(formatISO(new Date()))
  params.push(id)
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  return { success: true, user: getUserById(id) || undefined }
}

export function deleteUser(id: string): { success: boolean; error?: string } {
  if (id === 'user_admin') return { success: false, error: 'No se puede eliminar el usuario administrador principal' }
  const db = getDatabase()
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id)
  return { success: result.changes > 0 }
}

export function getNextClientNumber(): number {
  const db = getDatabase()
  const result = db.transaction(() => {
    const row = db.prepare('SELECT last_number FROM client_number_seq WHERE id = 1').get() as { last_number: number }
    const nextNum = row.last_number + 1
    db.prepare('UPDATE client_number_seq SET last_number = ? WHERE id = 1').run(nextNum)
    return nextNum
  })()
  return result
}

export function logChange(
  tableName: string,
  recordId: string,
  action: 'create' | 'update' | 'delete' | 'login',
  oldValues?: Record<string, unknown> | null,
  newValues?: Record<string, unknown> | null
): void {
  const db = getDatabase()
  const user = getSessionUser()
  db.prepare(`
    INSERT INTO change_log (id, user_id, user_name, table_name, record_id, action, old_values, new_values, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    user?.id || null,
    user?.fullName || 'Sistema',
    tableName,
    recordId,
    action,
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null,
    formatISO(new Date())
  )
}

export function getChangeLogs(
  page = 1,
  pageSize = 50,
  tableName?: string,
  action?: string,
  from?: string,
  to?: string
): PageResponse<ChangeLog> {
  const db = getDatabase()
  let countQuery = 'SELECT COUNT(*) as total FROM change_log WHERE 1=1'
  let query = `SELECT id, user_id AS userId, user_name AS userName, table_name AS tableName, record_id AS recordId, action, old_values AS oldValues, new_values AS newValues, timestamp FROM change_log WHERE 1=1`
  const params: (string | number)[] = []
  if (tableName) { countQuery += ' AND table_name = ?'; query += ' AND table_name = ?'; params.push(tableName) }
  if (action) { countQuery += ' AND action = ?'; query += ' AND action = ?'; params.push(action) }
  // Filtro por días: comparamos YYYY-MM-DD extraído vía substr (no date() que convierte a UTC
  // y desplaza 23:47-05:00 a 04:47Z del día siguiente). Renderer envía 'YYYY-MM-DD' directo.
  if (from) { countQuery += ' AND substr(timestamp, 1, 10) >= ?'; query += ' AND substr(timestamp, 1, 10) >= ?'; params.push(from) }
  if (to) { countQuery += ' AND substr(timestamp, 1, 10) <= ?'; query += ' AND substr(timestamp, 1, 10) <= ?'; params.push(to) }
  const countRow = db.prepare(countQuery).all(...params)[0] as { total: number } | undefined
  const total = countRow?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize
  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
  const rows = db.prepare(query).all(...params, pageSize, offset) as unknown as ChangeLog[]
  return { data: rows, total, page: safePage, totalPages }
}

export function getUserByUsername(username: string): User | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as DbUser | undefined
  return row ? mapDbUser(row) : null
}
