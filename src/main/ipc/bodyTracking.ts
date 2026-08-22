import { ipcMain } from 'electron'
import {
  getMeasurements, saveMeasurement, getGoals, saveGoal
} from '../database/bodyTracking'
import { getClientRoutines, saveClientRoutine, deleteClientRoutine } from '../database/routines'
import { sanitizeError } from '../helpers'
import { requirePermission } from './helpers'

export function registerBodyTrackingHandlers(): void {
  ipcMain.handle('bodyTracking:getMeasurements', async (_, clientId: string, limit?: number) => {
    const auth = requirePermission('tracking.view')
    if (auth) return auth
    try { return { success: true, data: getMeasurements(clientId, limit) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('bodyTracking:saveMeasurement', async (_, clientId: string, data: any) => {
    const auth = requirePermission('tracking.edit')
    if (auth) return auth
    try { return { success: true, data: saveMeasurement(clientId, data) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('bodyTracking:getGoals', async (_, clientId: string) => {
    const auth = requirePermission('tracking.view')
    if (auth) return auth
    try { return { success: true, data: getGoals(clientId) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('bodyTracking:saveGoal', async (_, clientId: string, data: any) => {
    const auth = requirePermission('tracking.edit')
    if (auth) return auth
    try { return { success: true, data: saveGoal(clientId, data) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('routine:getByClient', async (_, clientId: string) => {
    const auth = requirePermission('clients.view')
    if (auth) return auth
    try {
      const routines = getClientRoutines(clientId)
      return { success: true, data: routines }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('routine:save', async (_, clientId: string, dayOfWeek: number, exercises: any[]) => {
    const auth = requirePermission('clients.edit')
    if (auth) return auth
    try {
      const routine = saveClientRoutine(clientId, dayOfWeek, exercises)
      return { success: true, data: routine }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('routine:delete', async (_, clientId: string, dayOfWeek: number) => {
    const auth = requirePermission('clients.edit')
    if (auth) return auth
    try {
      const deleted = deleteClientRoutine(clientId, dayOfWeek)
      return { success: true, data: deleted }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })
}
