import { ipcMain } from 'electron'
import {
  getAllProducts, getProductById, createProduct, updateProduct, deleteProduct,
  registerMovement, getMovements, getLowStockProducts, getSalesSummary
} from '../database/inventory'
import { sanitizeError } from '../helpers'

export function registerInventoryHandlers(): void {
  ipcMain.handle('inventory:getAllProducts', async (_, activeOnly, options?: { page?: number; pageSize?: number; search?: string; category?: string }) => {
    try { return { success: true, data: getAllProducts(activeOnly, options?.page || 1, options?.pageSize || 50, options?.search, options?.category) } }
    catch (error) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('inventory:getProductById', async (_, id) => {
    try { return { success: true, data: getProductById(id) } }
    catch (error) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('inventory:createProduct', async (_, data) => {
    try { return { success: true, data: createProduct(data) } }
    catch (error) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('inventory:updateProduct', async (_, id, data) => {
    try { return { success: true, data: updateProduct(id, data) } }
    catch (error) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('inventory:deleteProduct', async (_, id) => {
    try { return { success: deleteProduct(id) } }
    catch (error) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('inventory:registerMovement', async (_, productId, type, quantity, price, description) => {
    try {
      const result = registerMovement(productId, type, quantity, price, description)
      // registerMovement devuelve null por producto inexistente, cantidad <= 0
      // o salida que supera el stock disponible (integridad de stock).
      return { success: !!result, data: result, error: result ? undefined : 'Movimiento no registrado: producto no encontrado, cantidad inválida o stock insuficiente' }
    } catch (error) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('inventory:getMovements', async (_, productId, options?: { page?: number; pageSize?: number }) => {
    try { return { success: true, data: getMovements(productId, options?.page || 1, options?.pageSize || 50) } }
    catch (error) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('inventory:getLowStock', async (_, threshold) => {
    try { return { success: true, data: getLowStockProducts(threshold) } }
    catch (error) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('inventory:getSalesSummary', async (_, period?: 'day' | 'week' | 'month') => {
    try { return { success: true, data: getSalesSummary(period) } }
    catch (error) { return { success: false, error: sanitizeError(error) } }
  })
}
