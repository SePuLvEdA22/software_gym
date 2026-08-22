import { ipcMain } from 'electron'
import {
  getTemplates, getTemplateById, createTemplate, updateTemplate, deleteTemplate,
  sendTemplateToClient, sendTemplateToAll,
  sendTemplateToExpiring
} from '../database/messageTemplates'
import { sanitizeError } from '../helpers'
import { requireRole } from './helpers'

export function registerMessageTemplateHandlers(): void {
  ipcMain.handle('messageTemplates:getAll', async () => {
    const auth = requireRole('admin')
    if (auth) return auth
    try { return { success: true, data: getTemplates() } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('messageTemplates:getById', async (_, id: string) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try { return { success: true, data: getTemplateById(id) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('messageTemplates:create', async (_, data: any) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try { return { success: true, data: createTemplate(data) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('messageTemplates:update', async (_, id: string, data: any) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try { return { success: true, data: updateTemplate(id, data) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('messageTemplates:delete', async (_, id: string) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try { return { success: deleteTemplate(id) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('messageTemplates:sendToClient', async (_, templateId: string, clientId: string) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try { return { success: true, data: await sendTemplateToClient(templateId, clientId) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('messageTemplates:sendToAll', async (_, templateId: string) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try { return { success: true, data: await sendTemplateToAll(templateId) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })

  ipcMain.handle('messageTemplates:sendToExpiring', async (_, templateId: string, days: number) => {
    const auth = requireRole('admin')
    if (auth) return auth
    try { return { success: true, data: await sendTemplateToExpiring(templateId, days) } }
    catch (error: any) { return { success: false, error: sanitizeError(error) } }
  })
}
