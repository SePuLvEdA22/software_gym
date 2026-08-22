import { ipcMain } from 'electron'
import log from 'electron-log'
import {
  updateWhatsappConfig,
  getWhatsappConfig,
  sendWelcomeMessage,
  sendPaymentConfirmation,
  getMessageHistory,
  checkAndSendExpiryReminders,
  sendExpiryReminderToClient,
  sendTestMessage,
  startReminderScheduler
} from '../whatsapp/index'
import { getDatabase } from '../database'
import { sanitizeError } from '../helpers'
import { requireRole } from './helpers'

export function registerWhatsappHandlers(): void {
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
      // Si cambió checkIntervalHours (o el estado), reinicia el timer de
      // recordatorios para que surta efecto sin necesidad de reiniciar la app.
      startReminderScheduler()
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
}
