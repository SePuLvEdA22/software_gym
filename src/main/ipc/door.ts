import { ipcMain } from 'electron'
import log from 'electron-log'
import { openDoor, getDoorStatus } from '../door/controller'
import { getDoorConfig, updateDoorConfig, getDoorConfigJson } from '../door/config'
import { sendHttpCommand } from '../door/httpRelay'
import { sendSerialCommand } from '../door/serialRelay'
import { getDatabase } from '../database'
import { sanitizeError } from '../helpers'
import { requireRole } from './helpers'

export function registerDoorHandlers(): void {
  ipcMain.handle('door:open', async () => {
    try {
      const result = await openDoor()
      return { success: true, data: result }
    } catch (error: any) {
      log.error('Error opening door:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('door:getStatus', async () => {
    try {
      const status = getDoorStatus()
      return { success: true, data: status }
    } catch (error: any) {
      log.error('Error getting door status:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('door:getConfig', async () => {
    try {
      const config = getDoorConfig()
      return { success: true, data: config }
    } catch (error: any) {
      log.error('Error getting door config:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('door:saveConfig', async (_, config) => {
    const auth = requireRole('admin')
    if (auth) return auth
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
      return { success: false, error: sanitizeError(error) }
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
      return { success: false, error: sanitizeError(error) }
    }
  })
}
