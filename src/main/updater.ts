import pkg from "electron-updater";
import { BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'

const { autoUpdater } = pkg; //cambio realizado por Helger

autoUpdater.logger = log
autoUpdater.autoDownload = false

export function initUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('update:checking')
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update:available', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    mainWindow.webContents.send('update:not-available', info)
  })

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('update:error', err?.message ?? 'Error desconocido')
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('update:download-progress', progress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update:downloaded', info)
  })

  ipcMain.handle('update:check', async () => {
    try {
      autoUpdater.checkForUpdates()
      return { success: true }
    } catch (error: any) {
      log.error('Update check error:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('update:download', async () => {
    try {
      autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error: any) {
      log.error('Update download error:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('update:install', async () => {
    try {
      autoUpdater.quitAndInstall()
      return { success: true }
    } catch (error: any) {
      log.error('Update install error:', error)
      return { success: false, error: error.message }
    }
  })
}
