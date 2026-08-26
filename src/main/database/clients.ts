import { getDatabase } from './index'
import { clearQueryCache } from './queryCache'
import { Client, Gender, ClientStatus } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import { join } from 'path'
import { writeFileSync, readFileSync, unlinkSync } from 'fs'
import { getThumbsDir, getPhotosDir, resolvePhotoPath } from '../photos'

export interface DbClient {
  id: string
  full_name: string
  document_id: string | null
  birth_date: string
  gender: string
  phone: string
  email: string
  address: string
  photo_path: string | null
  thumbnail_path: string | null
  registration_date: string
  access_code: string
  status: string
  emergency_name: string
  emergency_phone: string
  emergency_relationship: string
  emergency_notes: string
}

function savePhotoFile(clientId: string, base64Data: string | null): string | null {
  if (!base64Data) return null
  const dir = getPhotosDir()
  const fileName = `${clientId}.jpg`
  const filePath = join(dir, fileName)
  const buffer = Buffer.from(base64Data, 'base64')
  writeFileSync(filePath, buffer)
  return filePath
}

/** Documento opcional: vacío → NULL (la columna es UNIQUE y NULL no colisiona) */
function normalizeDocumentId(value: string | undefined | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function readPhotoFile(filePath: string | null): string | null {
  if (!filePath) return null
  try {
    // Las fotos migradas del sistema antiguo tienen photo_path con solo el
    // nombre del archivo; resolver contra userData/photos si no existe tal cual.
    const resolved = resolvePhotoPath(filePath)
    if (!resolved) return null
    const buffer = readFileSync(resolved)
    return buffer.toString('base64')
  } catch {
    return null
  }
}

function mapDbClient(dbClient: DbClient, options: { thumbnailOnly?: boolean } = {}): Client {
  // Listados usan la miniatura (unos KB); el detalle (kiosco, edición) usa la
  // foto completa. Si aún no hay miniatura se cae a la foto completa para no
  // perder el avatar (hasta que el backfill la genere).
  const thumbnailOnly = options.thumbnailOnly ?? true
  const photo = thumbnailOnly
    ? readPhotoFile(dbClient.thumbnail_path) ?? readPhotoFile(dbClient.photo_path)
    : readPhotoFile(dbClient.photo_path)

  return {
    id: dbClient.id,
    fullName: dbClient.full_name,
    // NULL en BD = sin documento (columna UNIQUE; NULL no colisiona)
    documentId: dbClient.document_id ?? '',
    birthDate: dbClient.birth_date,
    gender: dbClient.gender as Gender,
    phone: dbClient.phone,
    email: dbClient.email,
    address: dbClient.address,
    photo,
    registrationDate: dbClient.registration_date,
    accessCode: dbClient.access_code,
    status: dbClient.status as ClientStatus,
    emergencyContact: {
      name: dbClient.emergency_name,
      phone: dbClient.emergency_phone,
      relationship: dbClient.emergency_relationship,
      notes: dbClient.emergency_notes
    }
  }
}

export function createClient(data: Omit<Client, 'id' | 'registrationDate'>): Client {
  const db = getDatabase()
  const id = uuidv4()
  const registrationDate = new Date().toISOString()
  const photoPath = savePhotoFile(id, data.photo)
  const documentId = normalizeDocumentId(data.documentId)

  const stmt = db.prepare(`
    INSERT INTO clients (
      id, full_name, document_id, birth_date, gender, phone, email, address,
      photo_path, registration_date, access_code, status,
      emergency_name, emergency_phone, emergency_relationship, emergency_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    data.fullName,
    documentId,
    data.birthDate,
    data.gender,
    data.phone,
    data.email,
    data.address,
    photoPath,
    registrationDate,
    data.accessCode,
    data.status,
    data.emergencyContact.name,
    data.emergencyContact.phone,
    data.emergencyContact.relationship,
    data.emergencyContact.notes
  )

  clearQueryCache()

  return {
    ...data,
    // Refleja lo guardado en BD (trimeado / NULL → '')
    documentId: documentId ?? '',
    id,
    registrationDate
  }
}

export function updateClient(id: string, data: Partial<Client>): Client | null {
  const db = getDatabase()
  const existing = getClientById(id)
  
  if (!existing) return null

  const updated: Client = {
    ...existing,
    ...data,
    emergencyContact: {
      ...existing.emergencyContact,
      ...(data.emergencyContact || {})
    }
  }

  let photoPath: string | null = null
  const hasPhotoChange = data.photo !== undefined
  if (data.photo !== undefined) {
    photoPath = savePhotoFile(id, data.photo)
  }

  const fields: string[] = [
    'full_name = ?', 'document_id = ?', 'birth_date = ?', 'gender = ?', 'phone = ?',
    'email = ?', 'address = ?', 'access_code = ?', 'status = ?',
    'emergency_name = ?', 'emergency_phone = ?', 'emergency_relationship = ?',
    'emergency_notes = ?', 'updated_at = CURRENT_TIMESTAMP'
  ]
  const documentId = normalizeDocumentId(updated.documentId)
  const params: (string | number | null)[] = [
    updated.fullName, documentId, updated.birthDate,
    updated.gender, updated.phone, updated.email, updated.address,
    updated.accessCode, updated.status,
    updated.emergencyContact.name, updated.emergencyContact.phone,
    updated.emergencyContact.relationship, updated.emergencyContact.notes
  ]

  if (hasPhotoChange) {
    // Solo se toca la foto cuando el caller la envió explícitamente: si se
    // elimina (null), la miniatura anterior queda desactualizada y se invalida
    // (se regenerará en segundo plano si aplica). Sin photo, la foto se conserva.
    if (!photoPath) {
      try { unlinkSync(join(getThumbsDir(), `${id}.jpg`)) } catch { /* no existe */ }
    }
    fields.push('photo_path = ?')
    fields.push('thumbnail_path = ?')
    params.push(photoPath)
    params.push(null)
  }

  params.push(id)
  db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`).run(...params)

  clearQueryCache()

  return getClientById(id)
}

export function getClientById(id: string): Client | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM clients WHERE id = ?')
  const result = stmt.get(id) as DbClient | undefined
  
  return result ? mapDbClient(result, { thumbnailOnly: false }) : null
}

export function getClientByAccessCode(accessCode: string): Client | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM clients WHERE access_code = ?')
  const result = stmt.get(accessCode) as DbClient | undefined
  
  return result ? mapDbClient(result, { thumbnailOnly: false }) : null
}

export function getClientByDocumentId(documentId: string): Client | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM clients WHERE document_id = ?')
  const result = stmt.get(documentId) as DbClient | undefined
  
  return result ? mapDbClient(result, { thumbnailOnly: false }) : null
}

// Ordenamientos permitidos para el listado de clientes (whitelist: nunca
// interpolamos SQL desde el renderer). 'recent' = fecha de registro desc,
// para que un cliente recién creado aparezca de primero en el filtro Recientes.
const CLIENT_ORDER_BY: Record<'name' | 'recent', string> = {
  name: 'full_name ASC',
  recent: 'registration_date DESC, full_name ASC'
}

export function getAllClients(
  page = 1,
  pageSize = 50,
  status?: ClientStatus,
  sortBy: 'name' | 'recent' = 'name'
): { data: Client[]; total: number; page: number; totalPages: number } {
  const db = getDatabase()
  
  let countQuery = 'SELECT COUNT(*) as total FROM clients WHERE 1=1'
  let query = 'SELECT * FROM clients WHERE 1=1'
  const params: string[] = []
  
  if (status) {
    countQuery += ' AND status = ?'
    query += ' AND status = ?'
    params.push(status)
  }
  
  const { total } = db.prepare(countQuery).get(...params) as { total: number }
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize
  
  query += ` ORDER BY ${CLIENT_ORDER_BY[sortBy] || CLIENT_ORDER_BY.name} LIMIT ? OFFSET ?`
  const stmt = db.prepare(query)
  const results = stmt.all(...params, pageSize, offset) as unknown as DbClient[]
  
  return {
    data: results.map((dbClient) => mapDbClient(dbClient)),
    total,
    page: safePage,
    totalPages
  }
}

export function searchClients(query: string): Client[] {
  const db = getDatabase()
  const searchPattern = `%${query}%`
  
  const stmt = db.prepare(`
    SELECT * FROM clients 
    WHERE full_name LIKE ? 
       OR document_id LIKE ? 
       OR phone LIKE ? 
       OR access_code LIKE ?
    ORDER BY full_name ASC
    LIMIT 50
  `)
  
  const results = stmt.all(searchPattern, searchPattern, searchPattern, searchPattern) as unknown as DbClient[]
  
  return results.map((dbClient) => mapDbClient(dbClient))
}

export function deleteClient(id: string): boolean {
  const db = getDatabase()

  const op = db.transaction(() => {
    // Tablas hijas sin ON DELETE CASCADE: deben borrarse antes del cliente
    // para no dejar huérfanos ni provocar FOREIGN KEY constraint failed
    // con foreign_keys=ON. El bug reportado (malformed) se agravaba por
    // huérfanos de body_measurements/client_goals/client_routines.
    db.prepare('DELETE FROM body_measurements WHERE client_id = ?').run(id)
    db.prepare('DELETE FROM client_goals WHERE client_id = ?').run(id)
    db.prepare('DELETE FROM client_routines WHERE client_id = ?').run(id)
    db.prepare('DELETE FROM access_logs WHERE client_id = ?').run(id)
    db.prepare('DELETE FROM payments WHERE client_id = ?').run(id)
    db.prepare('DELETE FROM freeze_history WHERE client_id = ?').run(id)
    db.prepare('DELETE FROM memberships WHERE client_id = ?').run(id)
    db.prepare('DELETE FROM whatsapp_messages WHERE client_id = ?').run(id)
    const result = db.prepare('DELETE FROM clients WHERE id = ?').run(id)
    return result.changes > 0
  })

  const deleted = op()
  clearQueryCache()
  return deleted
}

export function updateClientStatus(id: string, status: ClientStatus): Client | null {
  const db = getDatabase()
  const stmt = db.prepare('UPDATE clients SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  stmt.run(status, id)

  clearQueryCache()
  
  return getClientById(id)
}

export function generateUniqueAccessCode(): string {
  const db = getDatabase()
  
  const findFreeCode = db.transaction((): string | null => {
    for (let i = 0; i < 100; i++) {
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const stmt = db.prepare('SELECT COUNT(*) as count FROM clients WHERE access_code = ?')
      const result = stmt.get(code) as { count: number }
      
      if (result.count === 0) {
        return code
      }
    }
    return null
  })
  
  const code = findFreeCode()
  if (code) return code
  
  return uuidv4().substring(0, 8)
}
