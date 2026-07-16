import { ipcMain } from 'electron'
import log from 'electron-log'
import { CreateClientSchema, UpdateClientSchema, CreateUserSchema, RecordPaymentSchema } from '../../shared/schemas'
import { ZodError } from 'zod'

function validateOrThrow(schema: import('zod').ZodType, data: unknown): void {
  const result = schema.safeParse(data)
  if (!result.success) {
    const messages = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
    throw new Error(`Datos inválidos: ${messages}`)
  }
}
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
  getActiveOrFrozenMembership,
  getClientMemberships,
  updateExpiredMemberships,
  freezeMembership,
  unfreezeMembership,
  recordPayment,
  getClientPayments,
  getPaymentsByDateRange,
  logAccess,
  getAccessLogs,
  getAccessLogsByDate,
  getClientAccessLogs,
  getAllPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
  getEffectivePrice,
  getClientDebt,
  getDebtors,
  getFreezeHistory,
  getClientFreezeHistory,
  getClientAttendanceStats,
  getInactiveClients,
  createMembershipWithPayment,
  getMembershipPayments,
  deactivateExpiredPromotions
} from '../database/memberships'
import {
  getDashboardMetrics,
  getRevenueByMonth,
  getClientsByStatus,
  getExpiringSoon,
  getBirthdaysThisMonth,
  getRevenueByYear,
  getRevenueByTimeOfDay
} from '../database/dashboard'
import {
  createPlan,
  updatePlan,
  deletePlan
} from '../database/memberships'
import {
  updateWhatsappConfig,
  getWhatsappConfig,
  sendWelcomeMessage,
  sendPaymentConfirmation,
  getMessageHistory,
  checkAndSendExpiryReminders,
  sendExpiryReminderToClient,
  sendTestMessage
} from '../whatsapp/index'
import {
  getAllProducts, getProductById, createProduct, updateProduct, deleteProduct,
  registerMovement, getMovements, getLowStockProducts
} from '../database/inventory'
import {
  getClientRoutines, saveClientRoutine,
  deleteClientRoutine, getGymSettings, saveGymSettings
} from '../database/routines'
import {
  getMeasurements, saveMeasurement, getGoals, saveGoal
} from '../database/bodyTracking'
import {
  getTemplates, getTemplateById, createTemplate, updateTemplate, deleteTemplate,
  sendTemplateToClient, sendTemplateToAll,
  sendTemplateToExpiring
} from '../database/messageTemplates'
import { backupDatabase, restoreDatabase } from '../database/index'
import { AccessValidation, ClientStatus, UserRole } from '../../shared/types'
import { openDoor, getDoorStatus } from '../door/controller'
import { getDoorConfig, updateDoorConfig, getDoorConfigJson } from '../door/config'
import { sendHttpCommand } from '../door/httpRelay'
import { sendSerialCommand } from '../door/serialRelay'
import { getDatabase } from '../database'
import { sanitizeError } from '../helpers'
import {
  authenticateUser,
  getSessionUser,
  setSessionUser,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  logChange,
  getChangeLogs,
  getNextClientNumber
} from '../database/users'
function requireRole(...roles: UserRole[]): { success: false; error: string } | null {
  const user = getSessionUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!roles.includes(user.role)) return { success: false, error: 'No autorizado' }
  return null
}

export function setupIpcHandlers(): void {
  ipcMain.handle('auth:login', async (_, username: string, password: string) => {
    try {
      const result = authenticateUser(username, password)
      if (result.success) {
        logChange('users', result.user!.id, 'update', null, { lastLogin: new Date().toISOString() })
      }
      return result
    } catch (error: any) {
      log.error('Error during login:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('auth:logout', async () => {
    setSessionUser(null)
    return { success: true }
  })

  ipcMain.handle('auth:checkSession', async () => {
    const user = getSessionUser()
    return { success: true, data: user }
  })

  ipcMain.handle('user:getAll', async (_, options?: { page?: number; pageSize?: number }) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      return { success: true, data: getAllUsers(options?.page || 1, options?.pageSize || 50) }
    } catch (error: any) {
      log.error('Error getting users:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('user:getById', async (_, id: string) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      return { success: true, data: getUserById(id) }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('user:create', async (_, data: { username: string; fullName: string; password: string; role: UserRole; permissions?: string[] }) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      validateOrThrow(CreateUserSchema, data)
      const result = createUser(data)
      if (result.success && result.user) {
        logChange('users', result.user.id, 'create', null, result.user as unknown as Record<string, unknown>)
      }
      return result
    } catch (error: any) {
      log.error('Error creating user:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('user:update', async (_, id: string, data: any) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      const oldUser = getUserById(id)
      const result = updateUser(id, data)
      if (result.success && oldUser) {
        logChange('users', id, 'update', oldUser as unknown as Record<string, unknown>, { ...oldUser, ...data } as unknown as Record<string, unknown>)
      }
      return result
    } catch (error: any) {
      log.error('Error updating user:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('user:delete', async (_, id: string) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      const oldUser = getUserById(id)
      const result = deleteUser(id)
      if (result.success && oldUser) {
        logChange('users', id, 'delete', { ...oldUser }, null)
      }
      return result
    } catch (error: any) {
      log.error('Error deleting user:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('user:getChangeLogs', async (_, options?: { page?: number; pageSize?: number; tableName?: string }) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      return { success: true, data: getChangeLogs(options?.page || 1, options?.pageSize || 50, options?.tableName) }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

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

  ipcMain.handle('client:getAll', async (_, options: { status?: ClientStatus; page?: number; pageSize?: number }) => {
    try {
      const result = getAllClients(options?.page || 1, options?.pageSize || 50, options?.status)
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

  ipcMain.handle('plans:getAll', async (_, activeOnly = true) => {
    try {
      const plans = getAllPlans(activeOnly)
      return { success: true, data: plans }
    } catch (error: any) {
      log.error('Error getting plans:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('plans:getById', async (_, id) => {
    try {
      const plan = getPlanById(id)
      return { success: true, data: plan }
    } catch (error: any) {
      log.error('Error getting plan:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('membership:create', async (_, clientId, planId, startDate) => {
    try {
      const membership = createMembership(clientId, planId, startDate)
      return { success: !!membership, data: membership }
    } catch (error: any) {
      log.error('Error creating membership:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('membership:createWithPayment', async (_, clientId, planId, amount, method, startDate, notes, discount) => {
    try {
      const result = createMembershipWithPayment(clientId, planId, amount, method, startDate, notes, discount)
      
      // Auto-enviar mensajes WhatsApp si está habilitado
      if (result.membership && getWhatsappConfig().enabled) {
        sendWelcomeMessage(clientId).catch(err => log.error('Error sending welcome:', err))
        sendPaymentConfirmation(clientId, result.membership.planName, result.membership.endDate)
          .catch(err => log.error('Error sending payment confirmation:', err))
      }
      
      return { success: !!result.membership, data: result, error: result.error }
    } catch (error: any) {
      log.error('Error creating membership with payment:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('membership:getActive', async (_, clientId) => {
    try {
      const membership = getActiveMembership(clientId)
      return { success: true, data: membership }
    } catch (error: any) {
      log.error('Error getting active membership:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('membership:getByClient', async (_, clientId) => {
    try {
      const memberships = getClientMemberships(clientId)
      return { success: true, data: memberships }
    } catch (error: any) {
      log.error('Error getting client memberships:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('membership:freeze', async (_, membershipId, reason, plannedDays) => {
    try {
      const membership = freezeMembership(membershipId, reason, plannedDays)
      return { success: !!membership, data: membership }
    } catch (error: any) {
      log.error('Error freezing membership:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('membership:unfreeze', async (_, membershipId) => {
    try {
      const membership = unfreezeMembership(membershipId)
      return { success: !!membership, data: membership }
    } catch (error: any) {
      log.error('Error unfreezing membership:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('payment:record', async (_, clientId, amount, method, description, membershipId, notes, discount) => {
    try {
      validateOrThrow(RecordPaymentSchema, { clientId, amount, method, description, membershipId, notes, discount })
      const payment = recordPayment(clientId, amount, method, description, membershipId, notes, discount)
      
      // Auto-enviar confirmación de pago si WhatsApp está habilitado
      if (getWhatsappConfig().enabled && membershipId) {
        const membership = getActiveMembership(clientId)
        if (membership) {
          sendPaymentConfirmation(clientId, membership.planName, membership.endDate)
            .catch(err => log.error('Error sending payment confirmation:', err))
        }
      }
      
      return { success: true, data: payment }
    } catch (error: any) {
      log.error('Error recording payment:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('payment:getByClient', async (_, clientId, options?: { page?: number; pageSize?: number }) => {
    try {
      const payments = getClientPayments(clientId, options?.page || 1, options?.pageSize || 50)
      return { success: true, data: payments }
    } catch (error: any) {
      log.error('Error getting client payments:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('payment:getByDateRange', async (_, startDate, endDate, options?: { page?: number; pageSize?: number; method?: string }) => {
    try {
      const payments = getPaymentsByDateRange(startDate, endDate, options?.page || 1, options?.pageSize || 50, options?.method)
      return { success: true, data: payments }
    } catch (error: any) {
      log.error('Error getting payments by date:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('payment:getByMembership', async (_, membershipId: string) => {
    try {
      return { success: true, data: getMembershipPayments(membershipId) }
    } catch (error: any) {
      log.error('Error getting membership payments:', error)
      return { success: false, error: sanitizeError(error) }
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

      const activeOrFrozen = getActiveOrFrozenMembership(client.id)

      if (!activeOrFrozen) {
        updateClientStatus(client.id, 'expired')
        const debts = getClientDebt(client.id)
        logAccess(accessCode, 'denied_expired', 'Membresía vencida', client.id, client.fullName)
        return {
          success: true,
          data: {
            valid: false,
            client,
            debt: debts.length > 0 ? debts : undefined,
            message: 'Membresía vencida',
            code: 'denied_expired'
          }
        }
      }

      if (activeOrFrozen.status === 'frozen') {
        const debts = getClientDebt(client.id)
        logAccess(accessCode, 'denied_frozen', 'Membresía congelada', client.id, client.fullName)
        return {
          success: true,
          data: {
            valid: false,
            client,
            membership: activeOrFrozen,
            debt: debts.length > 0 ? debts : undefined,
            message: 'Membresía congelada - contacta recepción',
            code: 'denied_frozen'
          }
        }
      }

      const membership = activeOrFrozen

      const debts = getClientDebt(client.id)
      const routines = getClientRoutines(client.id)

      logAccess(accessCode, 'granted', 'Acceso permitido', client.id, client.fullName)
      
      return {
        success: true,
        data: {
          valid: true,
          client,
          membership,
          debt: debts.length > 0 ? debts : undefined,
          routines,
          message: `Bienvenido ${client.fullName}`,
          code: 'granted'
        }
      }
    } catch (error: any) {
      log.error('Error validating access:', error)
      return { success: false, data: { valid: false, message: error.message, code: 'denied_not_found' } }
    }
  })

  ipcMain.handle('access:getLogs', async (_, options?: { page?: number; pageSize?: number; result?: string }) => {
    try {
      const logs = getAccessLogs(options?.page || 1, options?.pageSize || 50, options?.result)
      return { success: true, data: logs }
    } catch (error: any) {
      log.error('Error getting access logs:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('access:getLogsByClient', async (_, clientId, options?: { page?: number; pageSize?: number }) => {
    try {
      const logs = getClientAccessLogs(clientId, options?.page || 1, options?.pageSize || 50)
      return { success: true, data: logs }
    } catch (error: any) {
      log.error('Error getting client access logs:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('access:getLogsByDate', async (_, startDate, endDate, options?: { page?: number; pageSize?: number; result?: string }) => {
    try {
      const logs = getAccessLogsByDate(startDate, endDate, options?.page || 1, options?.pageSize || 50, options?.result)
      return { success: true, data: logs }
    } catch (error: any) {
      log.error('Error getting logs by date:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('dashboard:getMetrics', async (_, period?: 'day' | 'week' | 'month') => {
    try {
      deactivateExpiredPromotions()
      updateExpiredMemberships()
      const metrics = getDashboardMetrics(period)
      return { success: true, data: metrics }
    } catch (error: any) {
      log.error('Error getting dashboard metrics:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('dashboard:getRevenueByMonth', async (_, months) => {
    try {
      const data = getRevenueByMonth(months)
      return { success: true, data }
    } catch (error: any) {
      log.error('Error getting revenue by month:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('dashboard:getClientsByStatus', async () => {
    try {
      const data = getClientsByStatus()
      return { success: true, data }
    } catch (error: any) {
      log.error('Error getting clients by status:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('door:open', async () => {
    try {
      const result = await openDoor()
      return { success: true, data: result }
    } catch (error: any) {
      log.error('Error opening door:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('door:getStatus', async () => {
    try {
      const status = getDoorStatus()
      return { success: true, data: status }
    } catch (error: any) {
      log.error('Error getting door status:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('door:getConfig', async () => {
    try {
      const config = getDoorConfig()
      return { success: true, data: config }
    } catch (error: any) {
      log.error('Error getting door config:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('door:saveConfig', async (_, config) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      updateDoorConfig(config)
      const db = getDatabase()
      db.prepare(`INSERT INTO settings (key, value) VALUES ('door_config', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`)
        .run(getDoorConfigJson())
      log.info('Door config saved to database')
      return { success: true, data: null }
    } catch (error: any) {
      log.error('Error saving door config:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('door:testConnection', async () => {
    try {
      const config = getDoorConfig()
      let result = false
      if (config.connectionType === 'http') {
        result = await sendHttpCommand()
      } else if (config.connectionType === 'serial') {
        result = await sendSerialCommand()
      } else {
        result = true
      }
      return { success: true, data: result }
    } catch (error: any) {
      log.error('Error testing connection:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('system:updateExpired', async () => {
    try {
      const count = updateExpiredMemberships()
      return { success: true, data: count }
    } catch (error: any) {
      log.error('Error updating expired memberships:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('promotion:getAll', async (_, activeOnly) => {
    try {
      const promotions = getAllPromotions(activeOnly)
      return { success: true, data: promotions }
    } catch (error: any) {
      log.error('Error getting promotions:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('promotion:getById', async (_, id) => {
    try {
      const promotion = getPromotionById(id)
      return { success: true, data: promotion }
    } catch (error: any) {
      log.error('Error getting promotion:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('promotion:create', async (_, data) => {
    try {
      return { success: true, data: createPromotion(data) }
    } catch (error: any) {
      log.error('Error creating promotion:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('promotion:update', async (_, id, data) => {
    try {
      const result = updatePromotion(id, data)
      return { success: !!result, data: result }
    } catch (error: any) {
      log.error('Error updating promotion:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('promotion:delete', async (_, id) => {
    try {
      return { success: deletePromotion(id) }
    } catch (error: any) {
      log.error('Error deleting promotion:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('membership:getEffectivePrice', async (_, planId) => {
    try {
      const plan = getPlanById(planId)
      if (!plan) return { success: false, error: 'Plan no encontrado' }
      return { success: true, data: getEffectivePrice(plan) }
    } catch (error: any) {
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

  ipcMain.handle('membership:getFreezeHistory', async (_, membershipId) => {
    try {
      return { success: true, data: getFreezeHistory(membershipId) }
    } catch (error: any) {
      log.error('Error getting freeze history:', error)
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

  ipcMain.handle('dashboard:getRevenueByYear', async (_, year) => {
    try {
      return { success: true, data: getRevenueByYear(year) }
    } catch (error: any) {
      log.error('Error getting revenue by year:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('dashboard:getRevenueByTimeOfDay', async (_, startDate, endDate) => {
    try {
      return { success: true, data: getRevenueByTimeOfDay(startDate, endDate) }
    } catch (error: any) {
      log.error('Error getting revenue by time of day:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('plans:create', async (_, data) => {
    try {
      return { success: true, data: createPlan(data) }
    } catch (error: any) {
      log.error('Error creating plan:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('plans:update', async (_, id, data) => {
    try {
      const result = updatePlan(id, data)
      return { success: !!result, data: result }
    } catch (error: any) {
      log.error('Error updating plan:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('plans:delete', async (_, id) => {
    try {
      const result = deletePlan(id)
      return result.success ? { success: true } : { success: false, error: result.error }
    } catch (error: any) {
      log.error('Error deleting plan:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('dashboard:getExpiringSoon', async (_, days) => {
    try {
      return { success: true, data: getExpiringSoon(days) }
    } catch (error: any) {
      log.error('Error getting expiring memberships:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('dashboard:getBirthdays', async () => {
    try {
      return { success: true, data: getBirthdaysThisMonth() }
    } catch (error: any) {
      log.error('Error getting birthdays:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('whatsapp:getConfig', async () => {
    try {
      return { success: true, data: getWhatsappConfig() }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('whatsapp:saveConfig', async (_, config) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      updateWhatsappConfig(config)
      const db = getDatabase()
      const savedConfig = getWhatsappConfig()
      db.prepare(`INSERT INTO settings (key, value) VALUES ('whatsapp_config', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`)
        .run(JSON.stringify(savedConfig))
      log.info('WhatsApp config saved:', { ...savedConfig, apiKey: '***' })
      return { success: true }
    } catch (error: any) {
      log.error('Error saving WhatsApp config:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('whatsapp:sendWelcome', async (_, clientId) => {
    try {
      const result = await sendWelcomeMessage(clientId)
      return result
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('whatsapp:sendPaymentConfirmation', async (_, clientId, planName, endDate) => {
    try {
      const result = await sendPaymentConfirmation(clientId, planName, endDate)
      return result
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('whatsapp:getHistory', async (_, options?: { clientId?: string; page?: number; pageSize?: number }) => {
    try {
      return { success: true, data: getMessageHistory(options) }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('whatsapp:checkReminders', async () => {
    try {
      const result = await checkAndSendExpiryReminders()
      return { success: true, data: result }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('whatsapp:sendExpiryReminderToClient', async (_, clientId: string) => {
    try {
      const result = await sendExpiryReminderToClient(clientId)
      return { success: result.success, data: result }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('whatsapp:sendTestMessage', async (_, phone: string) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      const result = await sendTestMessage(phone)
      return { success: result.success, data: result }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('system:backupDb', async () => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      const { canceled, filePath } = await require('electron').dialog.showSaveDialog({
        title: 'Guardar copia de seguridad',
        defaultPath: `backup-bodyfitgym-${new Date().toISOString().slice(0, 10)}.db`,
        filters: [{ name: 'Database', extensions: ['db'] }]
      })
      if (canceled || !filePath) return { success: false, error: 'Cancelado' }
      const ok = backupDatabase(filePath)
      return { success: ok, data: filePath }
    } catch (error: any) {
      log.error('Backup error:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('system:restoreDb', async () => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      const { canceled, filePaths } = await require('electron').dialog.showOpenDialog({
        title: 'Restaurar copia de seguridad',
        filters: [{ name: 'Database', extensions: ['db'] }],
        properties: ['openFile']
      })
      if (canceled || filePaths.length === 0) return { success: false, error: 'Cancelado' }
      const ok = await restoreDatabase(filePaths[0])
      return { success: ok }
    } catch (error: any) {
      log.error('Restore error:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('system:exportCsv', async (_, type: string, filters?: any) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      const db = getDatabase()
      let rows: any[] = []
      let csv = ''

      if (type === 'clients') {
        rows = db.prepare('SELECT full_name, document_id, phone, email, status, registration_date FROM clients ORDER BY full_name').all() as any[]
        csv = 'Nombre,Documento,Telefono,Email,Estado,Registro\n'
        csv += rows.map(r => `"${r.full_name}","${r.document_id || ''}","${r.phone || ''}","${r.email || ''}","${r.status}","${r.registration_date}"`).join('\n')
      } else if (type === 'payments') {
        rows = db.prepare(`
          SELECT p.date, c.full_name, p.amount, p.method, p.description, p.notes
          FROM payments p JOIN clients c ON c.id = p.client_id
          ORDER BY p.date DESC
        `).all() as any[]
        csv = 'Fecha,Cliente,Valor,Metodo,Descripcion,Notas\n'
        csv += rows.map(r => `"${r.date}","${r.full_name}",${r.amount},"${r.method}","${r.description || ''}","${r.notes || ''}"`).join('\n')
      } else if (type === 'access') {
        const dateFrom = filters?.from || ''
        const dateTo = filters?.to || ''
        let sql = `SELECT a.timestamp, a.client_name, a.access_code, a.result, a.message FROM access_logs a WHERE 1=1`
        const params: string[] = []
        if (dateFrom) { sql += ' AND a.timestamp >= ?'; params.push(dateFrom) }
        if (dateTo) { sql += ' AND a.timestamp <= ?'; params.push(dateTo) }
        sql += ' ORDER BY a.timestamp DESC'
        rows = db.prepare(sql).all(...params) as any[]
        csv = 'Fecha,Cliente,Codigo,Resultado,Mensaje\n'
        csv += rows.map(r => `"${r.timestamp}","${r.client_name || ''}","${r.access_code}","${r.result}","${r.message || ''}"`).join('\n')
      }

      const { canceled, filePath } = await require('electron').dialog.showSaveDialog({
        title: 'Exportar CSV',
        defaultPath: `${type}-${new Date().toISOString().slice(0, 10)}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      })
      if (canceled || !filePath) return { success: false, error: 'Cancelado' }

      const { writeFileSync } = require('fs')
      writeFileSync(filePath, '\uFEFF' + csv, 'utf-8')
      return { success: true, data: filePath }
    } catch (error: any) {
      log.error('Export error:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('system:updateAdmin', async (_, data: { username?: string; currentPassword: string; newPassword?: string }) => {
    try {
      const user = getSessionUser()
      if (!user || user.role !== 'admin') {
        return { success: false, error: 'No autorizado' }
      }
      const result = updateUser('user_admin', {
        username: data.username,
        password: data.newPassword
      })
      return result.success
        ? { success: true }
        : { success: false, error: result.error || 'Error al actualizar' }
    } catch (error: any) {
      log.error('Error updating admin credentials:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('inventory:getAllProducts', async (_, activeOnly, options?: { page?: number; pageSize?: number; search?: string; category?: string }) => {
    try { return { success: true, data: getAllProducts(activeOnly, options?.page || 1, options?.pageSize || 50, options?.search, options?.category) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('inventory:getProductById', async (_, id) => {
    try { return { success: true, data: getProductById(id) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('inventory:createProduct', async (_, data) => {
    try { return { success: true, data: createProduct(data) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('inventory:updateProduct', async (_, id, data) => {
    try { return { success: true, data: updateProduct(id, data) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('inventory:deleteProduct', async (_, id) => {
    try { return { success: deleteProduct(id) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('inventory:registerMovement', async (_, productId, type, quantity, price, description) => {
    try {
      const result = registerMovement(productId, type, quantity, price, description)
      return { success: !!result, data: result, error: result ? undefined : 'Producto no encontrado' }
    } catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('inventory:getMovements', async (_, productId, options?: { page?: number; pageSize?: number }) => {
    try { return { success: true, data: getMovements(productId, options?.page || 1, options?.pageSize || 50) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('inventory:getLowStock', async (_, threshold) => {
    try { return { success: true, data: getLowStockProducts(threshold) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('bodyTracking:getMeasurements', async (_, clientId: string, limit?: number) => {
    try { return { success: true, data: getMeasurements(clientId, limit) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('bodyTracking:saveMeasurement', async (_, clientId: string, data: any) => {
    try { return { success: true, data: saveMeasurement(clientId, data) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('bodyTracking:getGoals', async (_, clientId: string) => {
    try { return { success: true, data: getGoals(clientId) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('bodyTracking:saveGoal', async (_, clientId: string, data: any) => {
    try { return { success: true, data: saveGoal(clientId, data) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('messageTemplates:getAll', async () => {
    const auth = requireRole('admin')
    if (auth) return auth
    try { return { success: true, data: getTemplates() } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('messageTemplates:getById', async (_, id: string) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try { return { success: true, data: getTemplateById(id) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('messageTemplates:create', async (_, data: any) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try { return { success: true, data: createTemplate(data) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('messageTemplates:update', async (_, id: string, data: any) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try { return { success: true, data: updateTemplate(id, data) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('messageTemplates:delete', async (_, id: string) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try { return { success: deleteTemplate(id) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('messageTemplates:sendToClient', async (_, templateId: string, clientId: string) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try { return { success: true, data: sendTemplateToClient(templateId, clientId) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('messageTemplates:sendToAll', async (_, templateId: string) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try { return { success: true, data: sendTemplateToAll(templateId) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('messageTemplates:sendToExpiring', async (_, templateId: string, days: number) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try { return { success: true, data: sendTemplateToExpiring(templateId, days) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('routine:getByClient', async (_, clientId: string) => {
    try {
      const routines = getClientRoutines(clientId)
      return { success: true, data: routines }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('routine:save', async (_, clientId: string, dayOfWeek: number, exercises: any[]) => {
    try {
      const routine = saveClientRoutine(clientId, dayOfWeek, exercises)
      return { success: true, data: routine }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('routine:delete', async (_, clientId: string, dayOfWeek: number) => {
    try {
      const deleted = deleteClientRoutine(clientId, dayOfWeek)
      return { success: true, data: deleted }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('gym:getSettings', async () => {
    try {
      return { success: true, data: getGymSettings() }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('gym:saveSettings', async (_, settings: any) => {
    try {
      const auth = requireRole('admin')
      if (auth) return auth
      return { success: true, data: saveGymSettings(settings) }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  log.info('IPC handlers registered')
}
