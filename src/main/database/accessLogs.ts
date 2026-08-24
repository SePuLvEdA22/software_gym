import { getDatabase } from './index'
import { clearQueryCache } from './queryCache'
import { AccessLog, AccessType, AccessResult, PageResponse } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import { formatISO, addDays } from 'date-fns'

export interface DbAccessLog {
  id: string
  client_id: string | null
  client_name: string | null
  access_code: string
  access_type: string
  result: string
  message: string
  timestamp: string
}

function mapDbAccessLog(dbLog: DbAccessLog): AccessLog {
  return {
    id: dbLog.id,
    clientId: dbLog.client_id || '',
    clientName: dbLog.client_name || '',
    accessCode: dbLog.access_code,
    accessType: dbLog.access_type as AccessType,
    result: dbLog.result as AccessResult,
    message: dbLog.message,
    timestamp: dbLog.timestamp
  }
}

export function logAccess(
  accessCode: string,
  result: AccessResult,
  message: string,
  clientId?: string,
  clientName?: string,
  accessType: AccessType = 'check_in'
): AccessLog {
  const db = getDatabase()
  
  const log: AccessLog = {
    id: uuidv4(),
    clientId: clientId || '',
    clientName: clientName || '',
    accessCode,
    accessType,
    result,
    message,
    timestamp: formatISO(new Date())
  }
  
  const stmt = db.prepare(`
    INSERT INTO access_logs (id, client_id, client_name, access_code, access_type, result, message, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  
  stmt.run(
    log.id,
    log.clientId || null,
    log.clientName || null,
    log.accessCode,
    log.accessType,
    log.result,
    log.message,
    log.timestamp
  )

  // Un acceso concedido cambia la lista de clientes inactivos del dashboard.
  if (result === 'granted') {
    clearQueryCache()
  }
  
  return log
}

export function getAccessLogs(page = 1, pageSize = 50, result?: string): PageResponse<AccessLog> {
  const db = getDatabase()
  
  const params: (string | number)[] = []
  let resultClause = ''
  if (result) {
    resultClause = ' WHERE result = ?'
    params.push(result)
  }
  
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM access_logs${resultClause}`).get(...params) as { total: number }
  const total = countRow.total
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize

  const stmt = db.prepare(`
    SELECT * FROM access_logs${resultClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `)
  
  const results = stmt.all(...params, pageSize, offset) as unknown as DbAccessLog[]
  
  return { data: results.map(mapDbAccessLog), total, page: safePage, totalPages }
}

export function getAccessLogsByDate(startDate: string, endDate: string, page = 1, pageSize = 50, result?: string): PageResponse<AccessLog> {
  const db = getDatabase()
  
  const params: (string | number)[] = [startDate, endDate]
  let resultClause = ''
  if (result) {
    resultClause = ' AND result = ?'
    params.push(result)
  }
  
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM access_logs WHERE timestamp >= ? AND timestamp <= ?${resultClause}`).get(...params) as { total: number }
  const total = countRow.total
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize

  const stmt = db.prepare(`
    SELECT * FROM access_logs 
    WHERE timestamp >= ? AND timestamp <= ?${resultClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `)
  
  const results = stmt.all(...params, pageSize, offset) as unknown as DbAccessLog[]
  
  return { data: results.map(mapDbAccessLog), total, page: safePage, totalPages }
}

export function getClientAccessLogs(clientId: string, page = 1, pageSize = 50): PageResponse<AccessLog> {
  const db = getDatabase()
  
  const countRow = db.prepare('SELECT COUNT(*) as total FROM access_logs WHERE client_id = ?').get(clientId) as { total: number }
  const total = countRow.total
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize

  const stmt = db.prepare(`
    SELECT * FROM access_logs 
    WHERE client_id = ?
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `)
  
  const results = stmt.all(clientId, pageSize, offset) as unknown as DbAccessLog[]
  
  return { data: results.map(mapDbAccessLog), total, page: safePage, totalPages }
}

export function getTodayAccessCount(): number {
  const db = getDatabase()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startOfDay = formatISO(today)
  const tomorrow = addDays(today, 1)
  const endOfDay = formatISO(tomorrow)
  
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM access_logs 
    WHERE result = 'granted'
      AND timestamp >= ? 
      AND timestamp < ?
  `)
  
  const result = stmt.get(startOfDay, endOfDay) as { count: number }
  
  return result.count
}
