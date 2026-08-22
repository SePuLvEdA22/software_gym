import { ipcMain } from 'electron'
import log from 'electron-log'
import { backupDatabase, restoreDatabase, getDatabase } from '../database/index'
import { updateExpiredMemberships } from '../database/memberships'
import {
  getSessionUser,
  updateUser,
  verifyUserPassword,
  clearMustChangePassword
} from '../database/users'
import { sanitizeError } from '../helpers'
import { requirePermission, requireRole } from './helpers'

export function registerSystemHandlers(): void {
  ipcMain.handle('system:updateExpired', async () => {
    try {
      const count = updateExpiredMemberships()
      return { success: true, data: count }
    } catch (error: any) {
      log.error('Error updating expired memberships:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('system:backupDb', async () => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      const { canceled, filePath } = await require('electron').dialog.showSaveDialog({
        title: 'Guardar copia de seguridad',
        defaultPath: `backup-bodyfitgym-${new Date().toISOString().slice(0, 10)}.db`,
        filters: [{ name: 'Database', extensions: ['db'] }]
      })
      if (canceled || !filePath) return { success: false, error: 'Cancelado' }
      const ok = backupDatabase(filePath)
      return { success: ok, data: filePath }
    } catch (error: any) {
      log.error('Backup error:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('system:restoreDb', async () => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      const { canceled, filePaths } = await require('electron').dialog.showOpenDialog({
        title: 'Restaurar copia de seguridad',
        filters: [{ name: 'Database', extensions: ['db'] }],
        properties: ['openFile']
      })
      if (canceled || filePaths.length === 0) return { success: false, error: 'Cancelado' }
      const ok = await restoreDatabase(filePaths[0])
      return { success: ok }
    } catch (error: any) {
      log.error('Restore error:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('system:migrateLegacy', async (event) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try {
      const { canceled, filePaths } = await require('electron').dialog.showOpenDialog({
        title: 'Seleccionar base de datos antigua (db_actual.sql)',
        filters: [{ name: 'Base de Datos MySQL (SQL)', extensions: ['sql'] }],
        properties: ['openFile']
      })
      if (canceled || filePaths.length === 0) return { success: false, error: 'Cancelado' }

      const { runLegacyMigration } = await import('../migration/legacyMigrator')

      // Enviar progreso al renderer
      const sendProgress = (progress: any) => {
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('migration:progress', progress)
        }
      }

      sendProgress({ phase: 'parsing', message: 'Iniciando migración...' })

      const result = await runLegacyMigration(filePaths[0], sendProgress)

      if (result.success) {
        log.info(`Migración legacy completada: ${result.totalRecords} registros, ${result.photosExported} fotos`)
      } else {
        log.error('Migración legacy fallida:', result.errors)
      }

      return { success: result.success, data: result }
    } catch (error: any) {
      log.error('Migration error:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('system:exportCsv', async (_, type: string, filters?: any) => {
    const auth = requirePermission('reports.export')
    if (auth) return auth
    try {
      const db = getDatabase()
      let rows: any[] = []
      let csv = ''

      if (type === 'clients') {
        rows = db.prepare('SELECT full_name, document_id, phone, email, status, registration_date FROM clients ORDER BY full_name').all() as any[]
        csv = 'Nombre,Documento,Telefono,Email,Estado,Registro\n'
        csv += rows.map(r => `"${r.full_name}","${r.document_id || ''}","${r.phone || ''}","${r.email || ''}","${r.status}","${r.registration_date}"`).join('\n')
      } else if (type === 'payments') {
        rows = db.prepare(`
          SELECT p.date, c.full_name, p.amount, p.method, p.description, p.notes
          FROM payments p JOIN clients c ON c.id = p.client_id
          ORDER BY p.date DESC
        `).all() as any[]
        csv = 'Fecha,Cliente,Valor,Metodo,Descripcion,Notas\n'
        csv += rows.map(r => `"${r.date}","${r.full_name}",${r.amount},"${r.method}","${r.description || ''}","${r.notes || ''}"`).join('\n')
      } else if (type === 'access') {
        const dateFrom = filters?.from || ''
        const dateTo = filters?.to || ''
        let sql = `SELECT a.timestamp, a.client_name, a.access_code, a.result, a.message FROM access_logs a WHERE 1=1`
        const params: string[] = []
        if (dateFrom) { sql += ' AND a.timestamp >= ?'; params.push(dateFrom) }
        if (dateTo) { sql += ' AND a.timestamp <= ?'; params.push(dateTo) }
        sql += ' ORDER BY a.timestamp DESC'
        rows = db.prepare(sql).all(...params) as any[]
        csv = 'Fecha,Cliente,Codigo,Resultado,Mensaje\n'
        csv += rows.map(r => `"${r.timestamp}","${r.client_name || ''}","${r.access_code}","${r.result}","${r.message || ''}"`).join('\n')
      }

      const { canceled, filePath } = await require('electron').dialog.showSaveDialog({
        title: 'Exportar CSV',
        defaultPath: `${type}-${new Date().toISOString().slice(0, 10)}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      })
      if (canceled || !filePath) return { success: false, error: 'Cancelado' }

      const { writeFileSync } = require('fs')
      writeFileSync(filePath, '\uFEFF' + csv, 'utf-8')
      return { success: true, data: filePath }
    } catch (error: any) {
      log.error('Export error:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('system:updateAdmin', async (_, data: { username?: string; currentPassword: string; newPassword?: string }) => {
    try {
      const user = getSessionUser()
      if (!user || user.role !== 'admin') {
        return { success: false, error: 'No autorizado' }
      }
      // Seguridad: la contraseña actual es obligatoria y debe coincidir
      // antes de permitir cambiar credenciales del administrador.
      if (!data.currentPassword || !verifyUserPassword('user_admin', data.currentPassword)) {
        return { success: false, error: 'Contraseña actual incorrecta' }
      }
      const result = updateUser('user_admin', {
        username: data.username,
        password: data.newPassword
      })
      if (result.success && data.newPassword) {
        clearMustChangePassword()
      }
      return result.success
        ? { success: true }
        : { success: false, error: result.error || 'Error al actualizar' }
    } catch (error: any) {
      log.error('Error updating admin credentials:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })
}
