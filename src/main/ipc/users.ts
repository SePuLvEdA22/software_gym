import { ipcMain } from 'electron'
import log from 'electron-log'
import { CreateUserSchema } from '../../shared/schemas'
import type { UserRole } from '../../shared/types'
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  logChange,
  getChangeLogs,
  clearMustChangePassword
} from '../database/users'
import { sanitizeError } from '../helpers'
import { requireRole, validateOrThrow } from './helpers'

export function registerUserHandlers(): void {
  ipcMain.handle('user:getAll', async (_, options?: { page?: number; pageSize?: number }) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      return { success: true, data: getAllUsers(options?.page || 1, options?.pageSize || 50) }
    } catch (error: any) {
      log.error('Error getting users:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('user:getById', async (_, id: string) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      return { success: true, data: getUserById(id) }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('user:create', async (_, data: { username: string; fullName: string; password: string; role: UserRole; permissions?: string[] }) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      validateOrThrow(CreateUserSchema, data)
      const result = createUser(data)
      if (result.success && result.user) {
        logChange('users', result.user.id, 'create', null, result.user as unknown as Record<string, unknown>)
      }
      return result
    } catch (error: any) {
      log.error('Error creating user:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('user:update', async (_, id: string, data: any) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      const oldUser = getUserById(id)
      const result = updateUser(id, data)
      if (result.success && id === 'user_admin' && data?.password) {
        // Cambiar la contraseña del admin desde la gestión de usuarios también
        // desbloquea el requisito de cambio forzado de contraseña.
        clearMustChangePassword()
      }
      if (result.success && oldUser) {
        logChange('users', id, 'update', oldUser as unknown as Record<string, unknown>, { ...oldUser, ...data } as unknown as Record<string, unknown>)
      }
      return result
    } catch (error: any) {
      log.error('Error updating user:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('user:delete', async (_, id: string) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      const oldUser = getUserById(id)
      const result = deleteUser(id)
      if (result.success && oldUser) {
        logChange('users', id, 'delete', { ...oldUser }, null)
      }
      return result
    } catch (error: any) {
      log.error('Error deleting user:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('user:getChangeLogs', async (_, options?: { page?: number; pageSize?: number; tableName?: string }) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      return { success: true, data: getChangeLogs(options?.page || 1, options?.pageSize || 50, options?.tableName) }
    } catch (error: any) {
      return { success: false, error: sanitizeError(error) }
    }
  })
}
