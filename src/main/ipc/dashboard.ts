import { ipcMain } from 'electron'
import log from 'electron-log'
import {
  getDashboardMetrics,
  getRevenueByMonth,
  getClientsByStatus,
  getExpiringSoon,
  getBirthdaysThisMonth,
  getRevenueByYear,
  getRevenueByTimeOfDay
} from '../database/dashboard'
import { autoUnfreezeDueMemberships, deactivateExpiredPromotions, updateExpiredMemberships } from '../database/memberships'
import { sanitizeError } from '../helpers'
import { requirePermission } from './helpers'

export function registerDashboardHandlers(): void {
  ipcMain.handle('dashboard:getMetrics', async (_, period?: 'day' | 'week' | 'month') => {
    const auth = requirePermission('dashboard.view')
    if (auth) return auth
    try {
      deactivateExpiredPromotions()
      // Orden importante: descongelar vencidos antes de marcar expiradas,
      // para que la membresía recién activada no se marque como expirada.
      autoUnfreezeDueMemberships()
      updateExpiredMemberships()
      const metrics = getDashboardMetrics(period)
      return { success: true, data: metrics }
    } catch (error: any) {
      log.error('Error getting dashboard metrics:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('dashboard:getRevenueByMonth', async (_, months) => {
    const auth = requirePermission('dashboard.view')
    if (auth) return auth
    try {
      const data = getRevenueByMonth(months)
      return { success: true, data }
    } catch (error: any) {
      log.error('Error getting revenue by month:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('dashboard:getClientsByStatus', async () => {
    const auth = requirePermission('dashboard.view')
    if (auth) return auth
    try {
      const data = getClientsByStatus()
      return { success: true, data }
    } catch (error: any) {
      log.error('Error getting clients by status:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('dashboard:getRevenueByYear', async (_, year) => {
    const auth = requirePermission('dashboard.view')
    if (auth) return auth
    try {
      return { success: true, data: getRevenueByYear(year) }
    } catch (error: any) {
      log.error('Error getting revenue by year:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('dashboard:getRevenueByTimeOfDay', async (_, startDate, endDate) => {
    const auth = requirePermission('dashboard.view')
    if (auth) return auth
    try {
      return { success: true, data: getRevenueByTimeOfDay(startDate, endDate) }
    } catch (error: any) {
      log.error('Error getting revenue by time of day:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('dashboard:getExpiringSoon', async (_, days) => {
    const auth = requirePermission('dashboard.view')
    if (auth) return auth
    try {
      return { success: true, data: getExpiringSoon(days) }
    } catch (error: any) {
      log.error('Error getting expiring memberships:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('dashboard:getBirthdays', async () => {
    const auth = requirePermission('dashboard.view')
    if (auth) return auth
    try {
      return { success: true, data: getBirthdaysThisMonth() }
    } catch (error: any) {
      log.error('Error getting birthdays:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })
}
