import { ipcMain } from 'electron'
import { getGymSettings, saveGymSettings } from '../database/routines'
import { sanitizeError } from '../helpers'
import { requireRole } from './helpers'

export function registerSettingsHandlers(): void {
  ipcMain.handle('gym:getSettings', async () => {
    try {
      return { success: true, data: getGymSettings() }
    } catch (error) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('gym:saveSettings', async (_, settings: Parameters<typeof saveGymSettings>[0]) => {
    try {
      const auth = requireRole('admin')
      if (auth) return auth
      return { success: true, data: saveGymSettings(settings) }
    } catch (error) {
      return { success: false, error: sanitizeError(error) }
    }
  })
}
