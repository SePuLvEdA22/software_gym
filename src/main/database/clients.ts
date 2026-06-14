import { getDatabase } from './index'
import { Client, Gender, ClientStatus } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import { app } from 'electron'
import { join } from 'path'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'

export interface DbClient {
  id: string
  full_name: string
  document_id: string
  birth_date: string
  gender: string
  phone: string
  email: string
  address: string
  photo_path: string | null
  registration_date: string
  access_code: string
  status: string
  emergency_name: string
  emergency_phone: string
  emergency_relationship: string
  emergency_notes: string
}

function getPhotosDir(): string {
  const dir = join(app.getPath('userData'), 'photos')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
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

function readPhotoFile(filePath: string | null): string | null {
  if (!filePath) return null
  try {
    if (!existsSync(filePath)) return null
    const buffer = readFileSync(filePath)
    return buffer.toString('base64')
  } catch {
    return null
  }
}

function mapDbClient(dbClient: DbClient): Client {
  return {
    id: dbClient.id,
    fullName: dbClient.full_name,
    documentId: dbClient.document_id,
    birthDate: dbClient.birth_date,
    gender: dbClient.gender as Gender,
    phone: dbClient.phone,
    email: dbClient.email,
    address: dbClient.address,
    photo: readPhotoFile(dbClient.photo_path),
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
    data.documentId,
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

  return {
    ...data,
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

  let photoPath: string | null = undefined
  if (data.photo !== undefined) {
    photoPath = savePhotoFile(id, data.photo)
  }

  const fields: string[] = [
    'full_name = ?', 'document_id = ?', 'birth_date = ?', 'gender = ?', 'phone = ?',
    'email = ?', 'address = ?', 'access_code = ?', 'status = ?',
    'emergency_name = ?', 'emergency_phone = ?', 'emergency_relationship = ?',
    'emergency_notes = ?', 'updated_at = CURRENT_TIMESTAMP'
  ]
  const params: (string | number | null)[] = [
    updated.fullName, updated.documentId, updated.birthDate,
    updated.gender, updated.phone, updated.email, updated.address,
    updated.accessCode, updated.status,
    updated.emergencyContact.name, updated.emergencyContact.phone,
    updated.emergencyContact.relationship, updated.emergencyContact.notes
  ]

  if (photoPath !== undefined) {
    fields.push('photo_path = ?')
    params.push(photoPath)
  }

  params.push(id)
  db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`).run(...params)

  return getClientById(id)
}

export function getClientById(id: string): Client | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM clients WHERE id = ?')
  const result = stmt.get(id) as DbClient | undefined
  
  return result ? mapDbClient(result) : null
}

export function getClientByAccessCode(accessCode: string): Client | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM clients WHERE access_code = ?')
  const result = stmt.get(accessCode) as DbClient | undefined
  
  return result ? mapDbClient(result) : null
}

export function getClientByDocumentId(documentId: string): Client | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM clients WHERE document_id = ?')
  const result = stmt.get(documentId) as DbClient | undefined
  
  return result ? mapDbClient(result) : null
}

export function getAllClients(page = 1, pageSize = 50, status?: ClientStatus): { data: Client[]; total: number; page: number; totalPages: number } {
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
  
  query += ' ORDER BY full_name ASC LIMIT ? OFFSET ?'
  const stmt = db.prepare(query)
  const results = stmt.all(...params, pageSize, offset) as DbClient[]
  
  return {
    data: results.map(mapDbClient),
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
  
  const results = stmt.all(searchPattern, searchPattern, searchPattern, searchPattern) as DbClient[]
  
  return results.map(mapDbClient)
}

export function deleteClient(id: string): boolean {
  const db = getDatabase()
  
  const op = db.transaction(() => {
    db.prepare('DELETE FROM access_logs WHERE client_id = ?').run(id)
    db.prepare('DELETE FROM payments WHERE client_id = ?').run(id)
    db.prepare('DELETE FROM freeze_history WHERE client_id = ?').run(id)
    db.prepare('DELETE FROM memberships WHERE client_id = ?').run(id)
    db.prepare('DELETE FROM whatsapp_messages WHERE client_id = ?').run(id)
    const result = db.prepare('DELETE FROM clients WHERE id = ?').run(id)
    return result.changes > 0
  })
  
  return op()
}

export function updateClientStatus(id: string, status: ClientStatus): Client | null {
  const db = getDatabase()
  const stmt = db.prepare('UPDATE clients SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  stmt.run(status, id)
  
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
