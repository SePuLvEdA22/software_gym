import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDatabase, closeDatabase } from '../../main/database/index'
import {
  logAccess,
  getAccessLogs,
  getAccessLogsByDate,
  getClientAccessLogs,
  getTodayAccessCount,
} from '../../main/database/memberships'
describe('Access Logs', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  it('should log a granted access', () => {
    const log = logAccess('ACC001', 'granted', 'Acceso permitido', 'test-client-id', 'Test Client')
    expect(log).not.toBeNull()
    expect(log!.accessCode).toBe('ACC001')
    expect(log!.result).toBe('granted')
    expect(log!.accessType).toBe('check_in')
    expect(log!.clientId).toBe('test-client-id')
    expect(log!.clientName).toBe('Test Client')
    expect(log!.timestamp).toBeDefined()
    expect(log!.id).toBeDefined()
  })

  it('should log a denied access', () => {
    const log = logAccess('INVALID', 'denied_not_found', 'Código no encontrado')
    expect(log).not.toBeNull()
    expect(log!.result).toBe('denied_not_found')
    expect(log!.clientId).toBe('')
    expect(log!.clientName).toBe('')
  })

  it('should log different access types', () => {
    logAccess('ACC001', 'granted', 'Salida', 'test-client-id', 'Test Client', 'check_out')
    const logs = getAccessLogs(1, 50).data
    const checkOuts = logs.filter(l => l.accessType === 'check_out')
    expect(checkOuts.length).toBeGreaterThanOrEqual(1)
  })

  it('should log different denial reasons', () => {
    logAccess('EXP001', 'denied_expired', 'Membresía vencida', 'expired-client', 'Expired')
    logAccess('INV001', 'denied_inactive', 'Cliente inactivo', 'inactive-client', 'Inactive')
    logAccess('FRZ001', 'denied_frozen', 'Membresía congelada', 'frozen-client', 'Frozen')

    const logs = getAccessLogs(1, 50).data
    expect(logs.some(l => l.result === 'denied_expired')).toBe(true)
    expect(logs.some(l => l.result === 'denied_inactive')).toBe(true)
    expect(logs.some(l => l.result === 'denied_frozen')).toBe(true)
  })

  it('should get access logs with pagination', () => {
    for (let i = 0; i < 5; i++) {
      logAccess(`PAG${i}`, 'granted', `Test ${i}`)
    }
    const page1 = getAccessLogs(1, 3)
    expect(page1.data.length).toBeLessThanOrEqual(3)
    expect(page1.total).toBeGreaterThanOrEqual(5)
    expect(page1.page).toBe(1)
    expect(page1.totalPages).toBeGreaterThanOrEqual(2)

    const page2 = getAccessLogs(2, 3)
    expect(page2.data.length).toBeGreaterThan(0)
    expect(page2.page).toBe(2)
  })

  it('should handle empty result page', () => {
    const result = getAccessLogs(9999, 50)
    expect(result.data.length).toBeGreaterThan(0)
    expect(result.page).toBeLessThanOrEqual(result.totalPages)
  })

  it('should get access logs by date range', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    const tomorrow = new Date(Date.now() + 86400000).toISOString()
    const result = getAccessLogsByDate(yesterday, tomorrow, 1, 50)
    expect(result.data.length).toBeGreaterThan(0)
    expect(result.total).toBeGreaterThan(0)
    expect(result.page).toBe(1)
  })

  it('should return empty for future date range', () => {
    const farFuture = '2099-01-01T00:00:00.000Z'
    const result = getAccessLogsByDate(farFuture, farFuture, 1, 50)
    expect(result.data).toEqual([])
    expect(result.total).toBe(0)
  })

  it('should get access logs by date range with pagination', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    const tomorrow = new Date(Date.now() + 86400000).toISOString()
    const page1 = getAccessLogsByDate(yesterday, tomorrow, 1, 5)
    expect(page1.data.length).toBeLessThanOrEqual(5)
    expect(page1.totalPages).toBeGreaterThanOrEqual(1)
  })

  it('should get client access logs with pagination', () => {
    const clientId = 'test-client-id'
    const page1 = getClientAccessLogs(clientId, 1, 2)
    expect(page1.data.length).toBeLessThanOrEqual(2)
    expect(page1.total).toBeGreaterThanOrEqual(1)
    expect(page1.data.every(l => l.clientId === clientId)).toBe(true)
  })

  it('should return empty for non-existent client logs', () => {
    const result = getClientAccessLogs('non-existent-client', 1, 50)
    expect(result.data).toEqual([])
    expect(result.total).toBe(0)
  })

  it('should return today access count', () => {
    const count = getTodayAccessCount()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
