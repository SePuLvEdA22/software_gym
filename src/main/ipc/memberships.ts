import { ipcMain } from 'electron'
import log from 'electron-log'
import { RecordPaymentSchema } from '../../shared/schemas'
import {
  getAllPlans,
  getPlanById,
  createMembership,
  getActiveMembership,
  getClientMemberships,
  freezeMembership,
  unfreezeMembership,
  recordPayment,
  getClientPayments,
  getPaymentsByDateRange,
  getEffectivePrice,
  getFreezeHistory,
  createMembershipWithPayment,
  getMembershipPayments,
  createPlan,
  updatePlan,
  deletePlan
} from '../database/memberships'
import {
  getWhatsappConfig,
  sendWelcomeMessage,
  sendPaymentConfirmation
} from '../whatsapp/index'
import { sanitizeError } from '../helpers'
import { requirePermission, requireRole, validateOrThrow } from './helpers'

export function registerMembershipHandlers(): void {
  ipcMain.handle('plans:getAll', async (_, activeOnly = true) => {
    const auth = requirePermission('memberships.view')
    if (auth) return auth
    try {
      const plans = getAllPlans(activeOnly)
      return { success: true, data: plans }
    } catch (error: any) {
      log.error('Error getting plans:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('plans:getById', async (_, id) => {
    const auth = requirePermission('memberships.view')
    if (auth) return auth
    try {
      const plan = getPlanById(id)
      return { success: true, data: plan }
    } catch (error: any) {
      log.error('Error getting plan:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('membership:create', async (_, clientId, planId, startDate) => {
    const auth = requirePermission('memberships.create')
    if (auth) return auth
    try {
      const membership = createMembership(clientId, planId, startDate)
      return { success: !!membership, data: membership }
    } catch (error: any) {
      log.error('Error creating membership:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('membership:createWithPayment', async (_, clientId, planId, amount, method, startDate, notes, discount) => {
    const auth = requirePermission('memberships.create')
    if (auth) return auth
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
    const auth = requirePermission('memberships.view')
    if (auth) return auth
    try {
      const membership = getActiveMembership(clientId)
      return { success: true, data: membership }
    } catch (error: any) {
      log.error('Error getting active membership:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('membership:getByClient', async (_, clientId) => {
    const auth = requirePermission('memberships.view')
    if (auth) return auth
    try {
      const memberships = getClientMemberships(clientId)
      return { success: true, data: memberships }
    } catch (error: any) {
      log.error('Error getting client memberships:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('membership:freeze', async (_, membershipId, reason, plannedDays) => {
    const auth = requirePermission('memberships.freeze')
    if (auth) return auth
    try {
      const membership = freezeMembership(membershipId, reason, plannedDays)
      return { success: !!membership, data: membership }
    } catch (error: any) {
      log.error('Error freezing membership:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('membership:unfreeze', async (_, membershipId) => {
    const auth = requirePermission('memberships.freeze')
    if (auth) return auth
    try {
      const membership = unfreezeMembership(membershipId)
      return { success: !!membership, data: membership }
    } catch (error: any) {
      log.error('Error unfreezing membership:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('payment:record', async (_, clientId, amount, method, description, membershipId, notes, discount) => {
    const auth = requirePermission('payments.create')
    if (auth) return auth
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
    const auth = requirePermission('payments.view')
    if (auth) return auth
    try {
      const payments = getClientPayments(clientId, options?.page || 1, options?.pageSize || 50)
      return { success: true, data: payments }
    } catch (error: any) {
      log.error('Error getting client payments:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('payment:getByDateRange', async (_, startDate, endDate, options?: { page?: number; pageSize?: number; method?: string }) => {
    const auth = requirePermission('payments.view')
    if (auth) return auth
    try {
      const payments = getPaymentsByDateRange(startDate, endDate, options?.page || 1, options?.pageSize || 50, options?.method)
      return { success: true, data: payments }
    } catch (error: any) {
      log.error('Error getting payments by date:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('payment:getByMembership', async (_, membershipId: string) => {
    const auth = requirePermission('payments.view')
    if (auth) return auth
    try {
      return { success: true, data: getMembershipPayments(membershipId) }
    } catch (error: any) {
      log.error('Error getting membership payments:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('membership:getEffectivePrice', async (_, planId) => {
    const auth = requirePermission('memberships.view')
    if (auth) return auth
    try {
      const plan = getPlanById(planId)
      if (!plan) return { success: false, error: 'Plan no encontrado' }
      return { success: true, data: getEffectivePrice(plan) }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('membership:getFreezeHistory', async (_, membershipId) => {
    const auth = requirePermission('memberships.view')
    if (auth) return auth
    try {
      return { success: true, data: getFreezeHistory(membershipId) }
    } catch (error: any) {
      log.error('Error getting freeze history:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('plans:create', async (_, data) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      return { success: true, data: createPlan(data) }
    } catch (error: any) {
      log.error('Error creating plan:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('plans:update', async (_, id, data) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      const result = updatePlan(id, data)
      return { success: !!result, data: result }
    } catch (error: any) {
      log.error('Error updating plan:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('plans:delete', async (_, id) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      const result = deletePlan(id)
      return result.success ? { success: true } : { success: false, error: result.error }
    } catch (error: any) {
      log.error('Error deleting plan:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })
}
