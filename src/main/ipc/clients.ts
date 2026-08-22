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
import { scheduleThumbnail } from '../photos'
import { sanitizeError } from '../helpers'
import { validateOrThrow } from './helpers'

export function registerClientHandlers(): void {
  ipcMain.handle('client:getNextNumber', async () => {
    try {
      return { success: true, data: getNextClientNumber() }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })
  ipcMain.handle('client:create', async (_, data) => {
    try {
      validateOrThrow(CreateClientSchema, data)
      const client = createClient(data)
      // Generar miniatura en segundo plano (no bloquea el guardado)
      if (client.photo) {
        scheduleThumbnail(client.id).catch(() => {})
      }
      logChange('clients', client.id, 'create', null, client as unknown as Record<string, unknown>)
      return { success: true, data: client }
    } catch (error: any) {
      log.error('Error creating client:', error)
      if (error.message?.includes('UNIQUE constraint failed: clients.document_id')) {
        return { success: false, error: 'Ya existe un cliente con ese número de documento' }
      }
      if (error.message?.includes('UNIQUE constraint failed: clients.access_code')) {
        return { success: false, error: 'Ya existe otro cliente con ese código de acceso' }
      }
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:update', async (_, id, data) => {
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
    } catch (error: any) {
      log.error('Error updating client:', error)
      if (error.message?.includes('UNIQUE constraint failed: clients.document_id')) {
        return { success: false, error: 'Ya existe otro cliente con ese número de documento' }
      }
      if (error.message?.includes('UNIQUE constraint failed: clients.access_code')) {
        return { success: false, error: 'Ya existe otro cliente con ese código de acceso' }
      }
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getById', async (_, id) => {
    try {
      const client = getClientById(id)
      return { success: true, data: client }
    } catch (error: any) {
      log.error('Error getting client:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getByAccessCode', async (_, code) => {
    try {
      const client = getClientByAccessCode(code)
      return { success: true, data: client }
    } catch (error: any) {
      log.error('Error getting client by access code:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getByDocumentId', async (_, docId) => {
    try {
      const client = getClientByDocumentId(docId)
      return { success: true, data: client }
    } catch (error: any) {
      log.error('Error getting client by document:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getAll', async (_, options: { status?: ClientStatus; page?: number; pageSize?: number; sortBy?: 'name' | 'recent' }) => {
    try {
      const result = getAllClients(options?.page || 1, options?.pageSize || 50, options?.status, options?.sortBy)
      return { success: true, data: result }
    } catch (error: any) {
      log.error('Error getting all clients:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:search', async (_, query) => {
    try {
      const clients = searchClients(query)
      return { success: true, data: clients }
    } catch (error: any) {
      log.error('Error searching clients:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:delete', async (_, id) => {
    try {
      const oldClient = getClientById(id)
      const success = deleteClient(id)
      if (success && oldClient) {
        logChange('clients', id, 'delete', oldClient as unknown as Record<string, unknown>, null)
      }
      return { success, data: null }
    } catch (error: any) {
      log.error('Error deleting client:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:generateCode', async () => {
    try {
      const code = generateUniqueAccessCode()
      return { success: true, data: code }
    } catch (error: any) {
      log.error('Error generating access code:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getDebt', async (_, clientId) => {
    try {
      const debts = getClientDebt(clientId)
      return { success: true, data: debts }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getDebtors', async () => {
    try {
      const debtors = getDebtors()
      return { success: true, data: debtors }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getFreezeHistory', async (_, clientId) => {
    try {
      return { success: true, data: getClientFreezeHistory(clientId) }
    } catch (error: any) {
      log.error('Error getting client freeze history:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getAttendanceStats', async (_, clientId) => {
    try {
      return { success: true, data: getClientAttendanceStats(clientId) }
    } catch (error: any) {
      log.error('Error getting attendance stats:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('client:getInactive', async (_, daysThreshold) => {
    try {
      return { success: true, data: getInactiveClients(daysThreshold) }
    } catch (error: any) {
      log.error('Error getting inactive clients:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })
}
