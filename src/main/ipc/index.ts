import { ipcMain } from 'electron'
import log from 'electron-log'
import {
  createClient,
  getClientById,
  getClientByAccessCode,
  getClientByDocumentId,
  getAllClients,
  searchClients,
  updateClient,
  deleteClient,
  updateClientStatus,
  generateUniqueAccessCode
} from '../database/clients'
import {
  getAllPlans,
  getPlanById,
  createMembership,
  getActiveMembership,
  getClientMemberships,
  updateExpiredMemberships,
  recordPayment,
  getClientPayments,
  getPaymentsByDateRange,
  logAccess,
  getAccessLogs,
  getAccessLogsByDate,
  getClientAccessLogs
} from '../database/memberships'
import {
  getDashboardMetrics,
  getRevenueByMonth,
  getClientsByStatus
} from '../database/dashboard'
import { AccessValidation, Membership, Client, ClientStatus } from '../../shared/types'
import { formatISO, parseISO, differenceInDays, isAfter } from 'date-fns'
import { openDoor, getDoorStatus, registerDoorCallback } from '../door/controller'

export function setupIpcHandlers(): void {
  ipcMain.handle('client:create', async (_, data) => {
    try {
      return { success: true, data: createClient(data) }
    } catch (error: any) {
      log.error('Error creating client:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('client:update', async (_, id, data) => {
    try {
      const result = updateClient(id, data)
      return { success: !!result, data: result }
    } catch (error: any) {
      log.error('Error updating client:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('client:getById', async (_, id) => {
    try {
      const client = getClientById(id)
      return { success: true, data: client }
    } catch (error: any) {
      log.error('Error getting client:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('client:getByAccessCode', async (_, code) => {
    try {
      const client = getClientByAccessCode(code)
      return { success: true, data: client }
    } catch (error: any) {
      log.error('Error getting client by access code:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('client:getByDocumentId', async (_, docId) => {
    try {
      const client = getClientByDocumentId(docId)
      return { success: true, data: client }
    } catch (error: any) {
      log.error('Error getting client by document:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('client:getAll', async (_, status) => {
    try {
      const clients = getAllClients(status)
      return { success: true, data: clients }
    } catch (error: any) {
      log.error('Error getting all clients:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('client:search', async (_, query) => {
    try {
      const clients = searchClients(query)
      return { success: true, data: clients }
    } catch (error: any) {
      log.error('Error searching clients:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('client:delete', async (_, id) => {
    try {
      const success = deleteClient(id)
      return { success, data: null }
    } catch (error: any) {
      log.error('Error deleting client:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('client:generateCode', async () => {
    try {
      const code = generateUniqueAccessCode()
      return { success: true, data: code }
    } catch (error: any) {
      log.error('Error generating access code:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plans:getAll', async (_, activeOnly = true) => {
    try {
      const plans = getAllPlans(activeOnly)
      return { success: true, data: plans }
    } catch (error: any) {
      log.error('Error getting plans:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plans:getById', async (_, id) => {
    try {
      const plan = getPlanById(id)
      return { success: true, data: plan }
    } catch (error: any) {
      log.error('Error getting plan:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('membership:create', async (_, clientId, planId, startDate) => {
    try {
      const membership = createMembership(clientId, planId, startDate)
      return { success: !!membership, data: membership }
    } catch (error: any) {
      log.error('Error creating membership:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('membership:getActive', async (_, clientId) => {
    try {
      const membership = getActiveMembership(clientId)
      return { success: true, data: membership }
    } catch (error: any) {
      log.error('Error getting active membership:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('membership:getByClient', async (_, clientId) => {
    try {
      const memberships = getClientMemberships(clientId)
      return { success: true, data: memberships }
    } catch (error: any) {
      log.error('Error getting client memberships:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('payment:record', async (_, clientId, amount, method, description, membershipId, notes) => {
    try {
      const payment = recordPayment(clientId, amount, method, description, membershipId, notes)
      return { success: true, data: payment }
    } catch (error: any) {
      log.error('Error recording payment:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('payment:getByClient', async (_, clientId) => {
    try {
      const payments = getClientPayments(clientId)
      return { success: true, data: payments }
    } catch (error: any) {
      log.error('Error getting client payments:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('payment:getByDateRange', async (_, startDate, endDate) => {
    try {
      const payments = getPaymentsByDateRange(startDate, endDate)
      return { success: true, data: payments }
    } catch (error: any) {
      log.error('Error getting payments by date:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('access:validate', async (_, accessCode: string): Promise<{ success: boolean; data: AccessValidation }> => {
    try {
      const client = getClientByAccessCode(accessCode)
      
      if (!client) {
        logAccess(accessCode, 'denied_not_found', 'Cliente no encontrado')
        return {
          success: true,
          data: {
            valid: false,
            message: 'Cliente no encontrado',
            code: 'denied_not_found'
          }
        }
      }

      if (client.status === 'inactive' || client.status === 'suspended') {
        logAccess(accessCode, 'denied_inactive', `Cliente ${client.status}`, client.id, client.fullName)
        return {
          success: true,
          data: {
            valid: false,
            client,
            message: client.status === 'suspended' ? 'Cliente suspendido' : 'Cliente inactivo',
            code: 'denied_inactive'
          }
        }
      }

      const membership = getActiveMembership(client.id)
      const now = new Date()

      if (!membership) {
        updateClientStatus(client.id, 'expired')
        logAccess(accessCode, 'denied_expired', 'Membresía vencida', client.id, client.fullName)
        return {
          success: true,
          data: {
            valid: false,
            client,
            message: 'Membresía vencida',
            code: 'denied_expired'
          }
        }
      }

      const endDate = parseISO(membership.endDate)
      const daysRemaining = differenceInDays(endDate, now)

      logAccess(accessCode, 'granted', 'Acceso permitido', client.id, client.fullName)
      
      return {
        success: true,
        data: {
          valid: true,
          client,
          membership,
          message: `Bienvenido ${client.fullName}`,
          code: 'granted'
        }
      }
    } catch (error: any) {
      log.error('Error validating access:', error)
      return { success: false, data: { valid: false, message: error.message, code: 'denied_not_found' } }
    }
  })

  ipcMain.handle('access:getLogs', async (_, limit) => {
    try {
      const logs = getAccessLogs(limit)
      return { success: true, data: logs }
    } catch (error: any) {
      log.error('Error getting access logs:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('access:getLogsByClient', async (_, clientId, limit) => {
    try {
      const logs = getClientAccessLogs(clientId, limit)
      return { success: true, data: logs }
    } catch (error: any) {
      log.error('Error getting client access logs:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('dashboard:getMetrics', async () => {
    try {
      updateExpiredMemberships()
      const metrics = getDashboardMetrics()
      return { success: true, data: metrics }
    } catch (error: any) {
      log.error('Error getting dashboard metrics:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('dashboard:getRevenueByMonth', async (_, months) => {
    try {
      const data = getRevenueByMonth(months)
      return { success: true, data }
    } catch (error: any) {
      log.error('Error getting revenue by month:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('dashboard:getClientsByStatus', async () => {
    try {
      const data = getClientsByStatus()
      return { success: true, data }
    } catch (error: any) {
      log.error('Error getting clients by status:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('door:open', async () => {
    try {
      const result = await openDoor()
      return { success: true, data: result }
    } catch (error: any) {
      log.error('Error opening door:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('door:getStatus', async () => {
    try {
      const status = getDoorStatus()
      return { success: true, data: status }
    } catch (error: any) {
      log.error('Error getting door status:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('system:updateExpired', async () => {
    try {
      const count = updateExpiredMemberships()
      return { success: true, data: count }
    } catch (error: any) {
      log.error('Error updating expired memberships:', error)
      return { success: false, error: error.message }
    }
  })

  log.info('IPC handlers registered')
}
