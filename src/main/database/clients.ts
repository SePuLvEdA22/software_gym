import { getDatabase } from './index'
import { Client, Gender, ClientStatus, EmergencyContact } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'

export interface DbClient {
  id: string
  full_name: string
  document_id: string
  birth_date: string
  gender: string
  phone: string
  email: string
  address: string
  photo: Buffer | null
  registration_date: string
  access_code: string
  status: string
  emergency_name: string
  emergency_phone: string
  emergency_relationship: string
  emergency_notes: string
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
    photo: dbClient.photo ? dbClient.photo.toString('base64') : null,
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

  const stmt = db.prepare(`
    INSERT INTO clients (
      id, full_name, document_id, birth_date, gender, phone, email, address,
      photo, registration_date, access_code, status,
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
    data.photo ? Buffer.from(data.photo, 'base64') : null,
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

  const stmt = db.prepare(`
    UPDATE clients SET
      full_name = ?, document_id = ?, birth_date = ?, gender = ?, phone = ?,
      email = ?, address = ?, photo = ?, access_code = ?, status = ?,
      emergency_name = ?, emergency_phone = ?, emergency_relationship = ?, 
      emergency_notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)

  stmt.run(
    updated.fullName,
    updated.documentId,
    updated.birthDate,
    updated.gender,
    updated.phone,
    updated.email,
    updated.address,
    updated.photo ? Buffer.from(updated.photo, 'base64') : null,
    updated.accessCode,
    updated.status,
    updated.emergencyContact.name,
    updated.emergencyContact.phone,
    updated.emergencyContact.relationship,
    updated.emergencyContact.notes,
    id
  )

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

export function getAllClients(status?: ClientStatus): Client[] {
  const db = getDatabase()
  
  let query = 'SELECT * FROM clients WHERE 1=1'
  const params: string[] = []
  
  if (status) {
    query += ' AND status = ?'
    params.push(status)
  }
  
  query += ' ORDER BY full_name ASC'
  
  const stmt = db.prepare(query)
  const results = stmt.all(...params) as DbClient[]
  
  return results.map(mapDbClient)
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
  
  const accessStmt = db.prepare('DELETE FROM access_logs WHERE client_id = ?')
  accessStmt.run(id)
  
  const paymentsStmt = db.prepare('DELETE FROM payments WHERE client_id = ?')
  paymentsStmt.run(id)
  
  const membershipsStmt = db.prepare('DELETE FROM memberships WHERE client_id = ?')
  membershipsStmt.run(id)
  
  const messagesStmt = db.prepare('DELETE FROM whatsapp_messages WHERE client_id = ?')
  messagesStmt.run(id)
  
  const stmt = db.prepare('DELETE FROM clients WHERE id = ?')
  const result = stmt.run(id)
  
  return result.changes > 0
}

export function updateClientStatus(id: string, status: ClientStatus): Client | null {
  const db = getDatabase()
  const stmt = db.prepare('UPDATE clients SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  stmt.run(status, id)
  
  return getClientById(id)
}

export function generateUniqueAccessCode(): string {
  const db = getDatabase()
  
  for (let i = 0; i < 100; i++) {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const stmt = db.prepare('SELECT COUNT(*) as count FROM clients WHERE access_code = ?')
    const result = stmt.get(code) as { count: number }
    
    if (result.count === 0) {
      return code
    }
  }
  
  return uuidv4().substring(0, 8)
}
