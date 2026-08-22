import { ipcMain } from 'electron'
import log from 'electron-log'
import { openDoor, getDoorStatus, testDoorConnection } from '../door/controller'
import { getDoorConfig, updateDoorConfig, persistDoorConfig } from '../door/config'
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
      persistDoorConfig()
      log.info('Door config saved to database')
      return { success: true, data: null }
    } catch (error: any) {
      log.error('Error saving door config:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('door:testConnection', async () => {
    try {
      const result = await testDoorConnection()
      return { success: true, data: result }
    } catch (error: any) {
      log.error('Error testing connection:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })
}
