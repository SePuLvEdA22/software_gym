import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDatabase, closeDatabase } from '../../main/database/index'
import {
  createClient,
  getClientById,
  updateClient,
  getAllClients,
  deleteClient,
  searchClients,
  generateUniqueAccessCode,
  getClientByDocumentId,
  getClientByAccessCode,
} from '../../main/database/clients'
import type { Client } from '../../shared/types'

const sampleClient: Omit<Client, 'id' | 'registrationDate'> = {
  fullName: 'Juan Pérez',
  documentId: '123456789',
  birthDate: '1990-05-15',
  gender: 'male',
  phone: '3001234567',
  email: 'juan@example.com',
  address: 'Calle 123 #45-67',
  photo: null,
  accessCode: '123456',
  status: 'active',
  emergencyContact: {
    name: 'María Pérez',
    phone: '3007654321',
    relationship: 'Esposa',
    notes: '',
  },
}

describe('Clients Database', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  it('should create a client', () => {
    const client = createClient(sampleClient)
    expect(client.id).toBeDefined()
    expect(client.fullName).toBe('Juan Pérez')
    expect(client.documentId).toBe('123456789')
    expect(client.accessCode).toBe('123456')
    expect(client.status).toBe('active')
    expect(client.registrationDate).toBeDefined()
    expect(client.emergencyContact.name).toBe('María Pérez')
  })

  it('should get client by id', () => {
    const client = createClient({ ...sampleClient, documentId: '987654321', accessCode: '654321' })
    const found = getClientById(client.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(client.id)
    expect(found!.fullName).toBe(client.fullName)
  })

  it('should return null for non-existent client id', () => {
    const found = getClientById('non-existent-id')
    expect(found).toBeNull()
  })

  it('should get client by document id', () => {
    const docId = '111222333'
    createClient({ ...sampleClient, documentId: docId, accessCode: '111222' })
    const found = getClientByDocumentId(docId)
    expect(found).not.toBeNull()
    expect(found!.documentId).toBe(docId)
  })

  it('should get client by access code', () => {
    const code = '999888'
    createClient({ ...sampleClient, documentId: '444555666', accessCode: code })
    const found = getClientByAccessCode(code)
    expect(found).not.toBeNull()
    expect(found!.accessCode).toBe(code)
  })

  it('should update a client', () => {
    const client = createClient({ ...sampleClient, documentId: '555666777', accessCode: '555666' })
    const updated = updateClient(client.id, { fullName: 'Juan Pérez Actualizado', phone: '3110000000' })
    expect(updated).not.toBeNull()
    expect(updated!.fullName).toBe('Juan Pérez Actualizado')
    expect(updated!.phone).toBe('3110000000')
    expect(updated!.documentId).toBe(client.documentId)
  })

  it('should allow multiple clients without document (documento opcional)', () => {
    const c1 = createClient({ ...sampleClient, documentId: '', accessCode: 'NODOC01' })
    const c2 = createClient({ ...sampleClient, documentId: '', accessCode: 'NODOC02' })
    // NULL no colisiona con el UNIQUE de document_id
    expect(getClientById(c1.id)!.documentId).toBe('')
    expect(getClientById(c2.id)!.documentId).toBe('')
  })

  it('should trim document on create and map null back to empty string', () => {
    const client = createClient({ ...sampleClient, documentId: '  998877  ', accessCode: 'TRIM01' })
    expect(client.documentId).toBe('998877')
    expect(getClientByDocumentId('998877')).not.toBeNull()
  })

  it('should return null when updating non-existent client', () => {
    const result = updateClient('non-existent', { fullName: 'Test' })
    expect(result).toBeNull()
  })

  it('should get all clients with pagination', () => {
    for (let i = 0; i < 15; i++) {
      createClient({
        ...sampleClient,
        documentId: `paginated-${i}`,
        accessCode: `pag-${i}`,
        fullName: `Cliente ${i}`,
      })
    }
    const page1 = getAllClients(1, 10)
    expect(page1.data.length).toBeLessThanOrEqual(10)
    expect(page1.total).toBeGreaterThanOrEqual(15)
    expect(page1.page).toBe(1)
    expect(page1.totalPages).toBeGreaterThanOrEqual(2)

    const page2 = getAllClients(2, 10)
    expect(page2.data.length).toBeGreaterThan(0)
    expect(page2.page).toBe(2)
  })

  it('should search clients by name', () => {
    const results = searchClients('Juan Pérez')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(c => c.fullName.includes('Juan Pérez'))).toBe(true)
  })

  it('should search clients by document id', () => {
    const results = searchClients('123456789')
    expect(results.length).toBeGreaterThan(0)
  })

  it('should generate unique access codes', () => {
    const code1 = generateUniqueAccessCode()
    const code2 = generateUniqueAccessCode()
    expect(code1).not.toBe(code2)
    expect(code1.length).toBeGreaterThanOrEqual(6)
    expect(code2.length).toBeGreaterThanOrEqual(6)
  })

  it('should delete a client', () => {
    const client = createClient({ ...sampleClient, documentId: 'to-delete', accessCode: 'todel' })
    const deleted = deleteClient(client.id)
    expect(deleted).toBe(true)
    const found = getClientById(client.id)
    expect(found).toBeNull()
  })

  it('should return empty array when searching with no matches', () => {
    const results = searchClients('__NONEXISTENT__')
    expect(results).toEqual([])
  })
})
