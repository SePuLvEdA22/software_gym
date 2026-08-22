import { ipcMain } from 'electron'
import log from 'electron-log'
import type { AccessValidation } from '../../shared/types'
import { validateAccess } from '../database/accessValidation'
import {
  getAccessLogs,
  getAccessLogsByDate,
  getClientAccessLogs
} from '../database/memberships'
import { sanitizeError } from '../helpers'

export function registerAccessHandlers(): void {
  ipcMain.handle('access:validate', async (_, accessCode: string): Promise<{ success: boolean; data: AccessValidation }> => {
    try {
      const data = validateAccess(accessCode)
      return { success: true, data }
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
}
