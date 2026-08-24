import { ipcMain } from 'electron'
import log from 'electron-log'
import { authenticateUser, getSessionUser, setSessionUser, logChange } from '../database/users'
import { sanitizeError } from '../helpers'

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:login', async (_, username: string, password: string) => {
    try {
      const result = authenticateUser(username, password)
      if (result.success) {
        // Acción dedicada: un inicio de sesión no es un cambio de datos.
        logChange('users', result.user!.id, 'login', null, { lastLogin: new Date().toISOString() })
      }
      return result
    } catch (error) {
      log.error('Error during login:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('auth:logout', async () => {
    setSessionUser(null)
    return { success: true }
  })

  ipcMain.handle('auth:checkSession', async () => {
    const user = getSessionUser()
    return { success: true, data: user }
  })
}
