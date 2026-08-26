import { ipcMain } from 'electron'
import log from 'electron-log'
import { CreateClientSchema, UpdateClientSchema } from '../../shared/schemas'
import type { ClientStatus } from '../../shared/types'
import {
  createClient,
  getClientById,
  getClientByAccessCode,
  getClientByDocumentId,
  getAllClients,
  searchClients,
  updateClient,
  deleteClient,
  generateUniqueAccessCode
} from '../database/clients'
import {
  getClientDebt,
  getDebtors,
  getClientFreezeHistory,
  getClientAttendanceStats,
  getInactiveClients
} from '../database/memberships'
import { getNextClientNumber, logChange } from '../database/users'
import { isDatabaseCorruptedError } from '../database'
import { scheduleThumbnail } from '../photos'
import { sanitizeError } from '../helpers'
import { requirePermission, validateOrThrow } from './helpers'
import { errorMessageIncludes } from '../../shared/errors'

export function registerClientHandlers(): void {
  ipcMain.handle('client:getNextNumber', async () => {
    const auth = requirePermission('clients.create')
    if (auth) return auth
    try {
      return { success: true, data: getNextClientNumber() }
    } catch (error) {
      return { success: false, error: sanitizeError(error) }
    }
  })
  ipcMain.handle('client:create', async (_, data) => {
    const auth = requirePermission('clients.create')
    if (auth) return auth
    try {
      validateOrThrow(CreateClientSchema, data)
      const client = createClient(data)
      // Generar miniatura en segundo plano (no bloquea el guardado)
      if (client.photo) {
        scheduleThumbnail(client.id).catch(() => {})
      }
      logChange('clients', client.id, 'create', null, client as unknown as Record<string, unknown>)
      return { success: true, data: client }
    } catch (error) {
      log.error('Error creating client:', error)
      if (errorMessageIncludes(error, 'UNIQUE constraint failed: clients.document_id')) {
        return { success: false, error: 'Ya existe un cliente con ese número de documento' }
      }
      if (errorMessageIncludes(error, 'UNIQUE constraint failed: clients.access_code')) {
        return { success: false, error: 'Ya existe otro cliente con ese código de acceso' }
      }
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:update', async (_, id, data) => {
    const auth = requirePermission('clients.edit')
    if (auth) return auth
    try {
      const cleaned = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== '')
      )
      validateOrThrow(UpdateClientSchema, cleaned)
      const oldClient = getClientById(id)
      const result = updateClient(id, cleaned)
      if (result && cleaned.photo !== undefined) {
        // Si la foto cambió (o se eliminó) se regenera la miniatura en 2º plano
        scheduleThumbnail(id).catch(() => {})
      }
      if (result && oldClient) {
        logChange('clients', id, 'update', oldClient as unknown as Record<string, unknown>, result as unknown as Record<string, unknown>)
      }
      return { success: !!result, data: result }
    } catch (error) {
      log.error('Error updating client:', error)
      if (errorMessageIncludes(error, 'UNIQUE constraint failed: clients.document_id')) {
        return { success: false, error: 'Ya existe otro cliente con ese número de documento' }
      }
      if (errorMessageIncludes(error, 'UNIQUE constraint failed: clients.access_code')) {
        return { success: false, error: 'Ya existe otro cliente con ese código de acceso' }
      }
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getById', async (_, id) => {
    const auth = requirePermission('clients.view')
    if (auth) return auth
    try {
      const client = getClientById(id)
      return { success: true, data: client }
    } catch (error) {
      log.error('Error getting client:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getByAccessCode', async (_, code) => {
    const auth = requirePermission('clients.view')
    if (auth) return auth
    try {
      const client = getClientByAccessCode(code)
      return { success: true, data: client }
    } catch (error) {
      log.error('Error getting client by access code:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getByDocumentId', async (_, docId) => {
    const auth = requirePermission('clients.view')
    if (auth) return auth
    try {
      const client = getClientByDocumentId(docId)
      return { success: true, data: client }
    } catch (error) {
      log.error('Error getting client by document:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getAll', async (_, options: { status?: ClientStatus; page?: number; pageSize?: number; sortBy?: 'name' | 'recent' }) => {
    const auth = requirePermission('clients.view')
    if (auth) return auth
    try {
      const result = getAllClients(options?.page || 1, options?.pageSize || 50, options?.status, options?.sortBy)
      return { success: true, data: result }
    } catch (error) {
      log.error('Error getting all clients:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:search', async (_, query) => {
    const auth = requirePermission('clients.view')
    if (auth) return auth
    try {
      const clients = searchClients(query)
      return { success: true, data: clients }
    } catch (error) {
      log.error('Error searching clients:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:delete', async (_, id) => {
    const auth = requirePermission('clients.delete')
    if (auth) return auth
    try {
      const oldClient = getClientById(id)
      const success = deleteClient(id)
      if (success && oldClient) {
        logChange('clients', id, 'delete', oldClient as unknown as Record<string, unknown>, null)
      }
      return { success, data: null }
    } catch (error) {
      log.error('Error deleting client:', error)
      if (isDatabaseCorruptedError(error)) {
        log.error('Database corruption detected during deleteClient — advise restore from backup')
        return {
          success: false,
          error:
            'Base de datos corrupta (disk image is malformed). Cierra la app y restaura el último respaldo en Configuración → Sistema → Restaurar. Se conserva copia .corrupt para análisis. Si no tienes respaldo, contacta soporte.'
        }
      }
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:generateCode', async () => {
    const auth = requirePermission('clients.create')
    if (auth) return auth
    try {
      const code = generateUniqueAccessCode()
      return { success: true, data: code }
    } catch (error) {
      log.error('Error generating access code:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getDebt', async (_, clientId) => {
    const auth = requirePermission('clients.view')
    if (auth) return auth
    try {
      const debts = getClientDebt(clientId)
      return { success: true, data: debts }
    } catch (error) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getDebtors', async () => {
    const auth = requirePermission('clients.view')
    if (auth) return auth
    try {
      const debtors = getDebtors()
      return { success: true, data: debtors }
    } catch (error) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getFreezeHistory', async (_, clientId) => {
    const auth = requirePermission('clients.view')
    if (auth) return auth
    try {
      return { success: true, data: getClientFreezeHistory(clientId) }
    } catch (error) {
      log.error('Error getting client freeze history:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getAttendanceStats', async (_, clientId) => {
    const auth = requirePermission('clients.view')
    if (auth) return auth
    try {
      return { success: true, data: getClientAttendanceStats(clientId) }
    } catch (error) {
      log.error('Error getting attendance stats:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getInactive', async (_, daysThreshold) => {
    const auth = requirePermission('clients.view')
    if (auth) return auth
    try {
      return { success: true, data: getInactiveClients(daysThreshold) }
    } catch (error) {
      log.error('Error getting inactive clients:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })
}
