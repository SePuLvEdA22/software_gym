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
  getInactiveClients
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
  checkAndSendExpiryReminders
} from '../whatsapp/index'
import { backupDatabase, restoreDatabase } from '../database/index'
import { AccessValidation } from '../../shared/types'
import { openDoor, getDoorStatus } from '../door/controller'
import { getDoorConfig, updateDoorConfig, getDoorConfigJson } from '../door/config'
import { sendHttpCommand } from '../door/httpRelay'
import { sendSerialCommand } from '../door/serialRelay'
import { getDatabase } from '../database'

export function setupIpcHandlers(): void {
  ipcMain.handle('client:create', async (_, data) => {
    try {
      return { success: true, data: createClient(data) }
    } catch (error: any) {
      log.error('Error creating client:', error)
      if (error.message?.includes('UNIQUE constraint failed: clients.document_id')) {
        return { success: false, error: 'Ya existe un cliente con ese número de documento' }
      }
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('client:update', async (_, id, data) => {
    try {
      const result = updateClient(id, data)
      return { success: !!result, data: result }
    } catch (error: any) {
      log.error('Error updating client:', error)
      if (error.message?.includes('UNIQUE constraint failed: clients.document_id')) {
        return { success: false, error: 'Ya existe otro cliente con ese número de documento' }
      }
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

  ipcMain.handle('membership:freeze', async (_, membershipId, reason, plannedDays) => {
    try {
      const membership = freezeMembership(membershipId, reason, plannedDays)
      return { success: !!membership, data: membership }
    } catch (error: any) {
      log.error('Error freezing membership:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('membership:unfreeze', async (_, membershipId) => {
    try {
      const membership = unfreezeMembership(membershipId)
      return { success: !!membership, data: membership }
    } catch (error: any) {
      log.error('Error unfreezing membership:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('payment:record', async (_, clientId, amount, method, description, membershipId, notes, discount) => {
    try {
      const payment = recordPayment(clientId, amount, method, description, membershipId, notes, discount)
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

      const activeOrFrozen = getActiveOrFrozenMembership(client.id)

      if (!activeOrFrozen) {
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

      if (activeOrFrozen.status === 'frozen') {
        logAccess(accessCode, 'denied_frozen', 'Membresía congelada', client.id, client.fullName)
        return {
          success: true,
          data: {
            valid: false,
            client,
            membership: activeOrFrozen,
            message: 'Membresía congelada - contacta recepción',
            code: 'denied_frozen'
          }
        }
      }

      const membership = activeOrFrozen

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

  ipcMain.handle('access:getLogsByDate', async (_, startDate, endDate) => {
    try {
      const logs = getAccessLogsByDate(startDate, endDate)
      return { success: true, data: logs }
    } catch (error: any) {
      log.error('Error getting logs by date:', error)
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

  ipcMain.handle('door:getConfig', async () => {
    try {
      const config = getDoorConfig()
      return { success: true, data: config }
    } catch (error: any) {
      log.error('Error getting door config:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('door:saveConfig', async (_, config) => {
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
      return { success: false, error: error.message }
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

  ipcMain.handle('promotion:getAll', async (_, activeOnly) => {
    try {
      const promotions = getAllPromotions(activeOnly)
      return { success: true, data: promotions }
    } catch (error: any) {
      log.error('Error getting promotions:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('promotion:getById', async (_, id) => {
    try {
      const promotion = getPromotionById(id)
      return { success: true, data: promotion }
    } catch (error: any) {
      log.error('Error getting promotion:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('promotion:create', async (_, data) => {
    try {
      return { success: true, data: createPromotion(data) }
    } catch (error: any) {
      log.error('Error creating promotion:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('promotion:update', async (_, id, data) => {
    try {
      const result = updatePromotion(id, data)
      return { success: !!result, data: result }
    } catch (error: any) {
      log.error('Error updating promotion:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('promotion:delete', async (_, id) => {
    try {
      return { success: deletePromotion(id) }
    } catch (error: any) {
      log.error('Error deleting promotion:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('membership:getEffectivePrice', async (_, planId) => {
    try {
      const plan = getPlanById(planId)
      if (!plan) return { success: false, error: 'Plan no encontrado' }
      return { success: true, data: getEffectivePrice(plan) }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('client:getDebt', async (_, clientId) => {
    try {
      const debts = getClientDebt(clientId)
      return { success: true, data: debts }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('client:getDebtors', async () => {
    try {
      const debtors = getDebtors()
      return { success: true, data: debtors }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('membership:getFreezeHistory', async (_, membershipId) => {
    try {
      return { success: true, data: getFreezeHistory(membershipId) }
    } catch (error: any) {
      log.error('Error getting freeze history:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('client:getFreezeHistory', async (_, clientId) => {
    try {
      return { success: true, data: getClientFreezeHistory(clientId) }
    } catch (error: any) {
      log.error('Error getting client freeze history:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('client:getAttendanceStats', async (_, clientId) => {
    try {
      return { success: true, data: getClientAttendanceStats(clientId) }
    } catch (error: any) {
      log.error('Error getting attendance stats:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('client:getInactive', async (_, daysThreshold) => {
    try {
      return { success: true, data: getInactiveClients(daysThreshold) }
    } catch (error: any) {
      log.error('Error getting inactive clients:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('dashboard:getRevenueByYear', async (_, year) => {
    try {
      return { success: true, data: getRevenueByYear(year) }
    } catch (error: any) {
      log.error('Error getting revenue by year:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('dashboard:getRevenueByTimeOfDay', async (_, startDate, endDate) => {
    try {
      return { success: true, data: getRevenueByTimeOfDay(startDate, endDate) }
    } catch (error: any) {
      log.error('Error getting revenue by time of day:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plans:create', async (_, data) => {
    try {
      return { success: true, data: createPlan(data) }
    } catch (error: any) {
      log.error('Error creating plan:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plans:update', async (_, id, data) => {
    try {
      const result = updatePlan(id, data)
      return { success: !!result, data: result }
    } catch (error: any) {
      log.error('Error updating plan:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plans:delete', async (_, id) => {
    try {
      return { success: deletePlan(id) }
    } catch (error: any) {
      log.error('Error deleting plan:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('dashboard:getExpiringSoon', async (_, days) => {
    try {
      return { success: true, data: getExpiringSoon(days) }
    } catch (error: any) {
      log.error('Error getting expiring memberships:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('dashboard:getBirthdays', async () => {
    try {
      return { success: true, data: getBirthdaysThisMonth() }
    } catch (error: any) {
      log.error('Error getting birthdays:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('whatsapp:getConfig', async () => {
    try {
      return { success: true, data: getWhatsappConfig() }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('whatsapp:saveConfig', async (_, config) => {
    try {
      updateWhatsappConfig(config)
      const db = getDatabase()
      db.prepare(`INSERT INTO settings (key, value) VALUES ('whatsapp_config', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`)
        .run(JSON.stringify(getWhatsappConfig()))
      log.info('WhatsApp config saved to database')
      return { success: true }
    } catch (error: any) {
      log.error('Error saving WhatsApp config:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('whatsapp:sendWelcome', async (_, clientId) => {
    try {
      const result = await sendWelcomeMessage(clientId)
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('whatsapp:sendPaymentConfirmation', async (_, clientId, planName, endDate) => {
    try {
      const result = await sendPaymentConfirmation(clientId, planName, endDate)
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('whatsapp:getHistory', async (_, clientId, limit) => {
    try {
      return { success: true, data: getMessageHistory(clientId, limit) }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('whatsapp:checkReminders', async () => {
    try {
      const result = await checkAndSendExpiryReminders()
      return { success: true, data: result }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('system:backupDb', async () => {
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
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('system:restoreDb', async () => {
    try {
      const { canceled, filePaths } = await require('electron').dialog.showOpenDialog({
        title: 'Restaurar copia de seguridad',
        filters: [{ name: 'Database', extensions: ['db'] }],
        properties: ['openFile']
      })
      if (canceled || filePaths.length === 0) return { success: false, error: 'Cancelado' }
      const ok = restoreDatabase(filePaths[0])
      return { success: ok }
    } catch (error: any) {
      log.error('Restore error:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('system:exportCsv', async (_, type: string, filters?: any) => {
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
      return { success: false, error: error.message }
    }
  })

  log.info('IPC handlers registered')
}
