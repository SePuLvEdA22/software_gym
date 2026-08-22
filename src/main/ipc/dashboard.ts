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
import { deactivateExpiredPromotions, updateExpiredMemberships } from '../database/memberships'
import { sanitizeError } from '../helpers'

export function registerDashboardHandlers(): void {
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
}
