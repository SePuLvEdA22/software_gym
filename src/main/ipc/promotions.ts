import { ipcMain } from 'electron'
import log from 'electron-log'
import {
  getAllPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion
} from '../database/memberships'
import { sanitizeError } from '../helpers'

export function registerPromotionHandlers(): void {
  ipcMain.handle('promotion:getAll', async (_, activeOnly) => {
    try {
      const promotions = getAllPromotions(activeOnly)
      return { success: true, data: promotions }
    } catch (error) {
      log.error('Error getting promotions:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('promotion:getById', async (_, id) => {
    try {
      const promotion = getPromotionById(id)
      return { success: true, data: promotion }
    } catch (error) {
      log.error('Error getting promotion:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('promotion:create', async (_, data) => {
    try {
      return { success: true, data: createPromotion(data) }
    } catch (error) {
      log.error('Error creating promotion:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('promotion:update', async (_, id, data) => {
    try {
      const result = updatePromotion(id, data)
      return { success: !!result, data: result }
    } catch (error) {
      log.error('Error updating promotion:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('promotion:delete', async (_, id) => {
    try {
      return { success: deletePromotion(id) }
    } catch (error) {
      log.error('Error deleting promotion:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })
}
