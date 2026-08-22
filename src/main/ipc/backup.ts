import { ipcMain } from 'electron'
import log from 'electron-log'
import { getBackupConfig, setBackupConfig, performAutoBackup } from '../backup'
import { sanitizeError } from '../helpers'
import { requireRole } from './helpers'

export function registerBackupHandlers(): void {
  ipcMain.handle('backup:getConfig', async () => {
    try {
      return { success: true, data: getBackupConfig() }
    } catch (error: any) {
      log.error('Error getting backup config:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('backup:setConfig', async (_, config: { enabled: boolean; retention: number }) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      setBackupConfig(config)
      return { success: true }
    } catch (error: any) {
      log.error('Error setting backup config:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('backup:runNow', async () => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      const result = performAutoBackup()
      return result.success
        ? { success: true, data: result.filePath }
        : { success: false, error: result.error }
    } catch (error: any) {
      log.error('Error running backup:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })
}
