import { app, ipcMain, BrowserWindow, screen, Tray, Menu, nativeImage, session } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import log from 'electron-log'
import { toErrorMessage } from '../shared/errors'
import { initDatabase, closeDatabase, getDatabase } from './database'
import { setupIpcHandlers } from './ipc'
import { initializeDoorController } from './door/controller'
import { setDoorConfig } from './door/config'
import { updateWhatsappConfig, checkAndSendExpiryReminders, getWhatsappConfig, startReminderScheduler } from './whatsapp'
import { initUpdater } from './updater'
import { getBackupConfig, performAutoBackup } from './backup'
import { ensureThumbnails } from './photos'
import {
  getAppMode,
  ensureAdminWindow,
  openKioskWindowAuto,
  getAdminWindow,
  getKioskWindow,
  setTray,
  setupWindowControls
} from './windows'
import { setupFormWindowControls } from './formWindows'
import * as Sentry from '@sentry/electron/main'

log.initialize({ preload: true })
log.transports.file.level = 'info'
log.transports.console.level = 'debug'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    // integrations: [Sentry.electronEventsIntegration()],
  })
  log.info('Sentry initialized for main process')
}

console.log = log.log
console.error = log.error
console.warn = log.warn
console.info = log.info

let tray: Tray | null = null

function createTray(): void {
  const iconSize = 16
  const canvas = Buffer.alloc(iconSize * iconSize * 4)
  for (let i = 0; i < iconSize * iconSize; i++) {
    canvas[i * 4] = 255
    canvas[i * 4 + 1] = 107
    canvas[i * 4 + 2] = 0
    canvas[i * 4 + 3] = 255
  }
  const image = nativeImage.createFromBuffer(canvas, { width: iconSize, height: iconSize })

  tray = new Tray(image)
  tray.setToolTip('BodyFitGym')
  setTray(tray)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar ventana',
      click: () => {
        const admin = getAdminWindow()
        if (admin) {
          admin.show()
          admin.focus()
        }
        const kiosk = getKioskWindow()
        if (kiosk && !kiosk.isVisible()) {
          const displays = screen.getAllDisplays()
          if (displays.length > 1) {
            kiosk.show()
            kiosk.setFullScreen(true)
          }
        }
      }
    },
    {
      label: 'Enviar recordatorios ahora',
      click: async () => {
        const result = await checkAndSendExpiryReminders()
        log.info(`Manually sent ${result.sent} reminders`)
      }
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        tray?.destroy()
        tray = null
        setTray(null)
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    const admin = getAdminWindow()
    if (admin) {
      admin.show()
      admin.focus()
    }
  })
}

ipcMain.handle('system:set-auto-start', async (_, enabled: boolean) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: app.getPath('exe')
    })
    const db = getDatabase()
    db.prepare(`INSERT INTO settings (key, value) VALUES ('auto_start', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
      .run(enabled ? '1' : '0')
    return { success: true }
  } catch (error) {
    log.error('Error setting auto-start:', error)
    return { success: false, error: toErrorMessage(error) }
  }
})

ipcMain.handle('system:get-auto-start', async () => {
  try {
    const settings = app.getLoginItemSettings()
    return { success: true, data: settings.openAtLogin }
  } catch (error) {
    return { success: false, error: toErrorMessage(error) }
  }
})

ipcMain.handle('system:get-app-version', async () => {
  try {
    return { success: true, data: app.getVersion() }
  } catch (error) {
    return { success: false, error: toErrorMessage(error) }
  }
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.bodyfitgym.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  log.info('Initializing database...')
  await initDatabase()
  log.info('Database initialized')

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      const origin = webContents.getURL()
      const allowed = origin.includes('renderer') || origin.includes('localhost') || origin.includes('file://')
      log.info(`[PERMISSION] media request from ${origin}: ${allowed ? 'allowed' : 'denied'}`)
      callback(allowed)
    } else {
      callback(false)
    }
  })
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'media') return true
    return false
  })

  const savedDoorConfig = getDatabase().prepare("SELECT value FROM settings WHERE key = 'door_config'").get() as { value: string } | undefined
  if (savedDoorConfig) {
    setDoorConfig(savedDoorConfig.value)
    log.info('Door config loaded from database')
  }

  const savedWhatsappConfig = getDatabase().prepare("SELECT value FROM settings WHERE key = 'whatsapp_config'").get() as { value: string } | undefined
  if (savedWhatsappConfig) {
    try {
      updateWhatsappConfig(JSON.parse(savedWhatsappConfig.value))
      log.info('WhatsApp config loaded from database')
    } catch {
      log.warn('Failed to parse saved WhatsApp config')
    }
  }

  log.info('Initializing door controller...')
  await initializeDoorController()

  log.info('Setting up IPC handlers...')
  setupIpcHandlers()
  setupWindowControls()
  setupFormWindowControls()

  createTray()

  const appMode = getAppMode()
  log.info(`Starting in mode: ${appMode}`)

  if (appMode === 'admin' || appMode === 'both') {
    initUpdater(ensureAdminWindow().window)
  }

  if (appMode === 'kiosk' || appMode === 'both') {
    try {
      const displays = screen.getAllDisplays()
      if (displays.length > 1 || appMode === 'kiosk') {
        log.info('Auto-creating kiosk window...')
        openKioskWindowAuto()
      } else {
        log.info('Only one display detected, kiosk window not opened automatically')
        log.info('You can open it manually from Settings > Pantalla Kiosco')
      }
    } catch (error) {
      log.error('Error creating kiosk window:', error)
    }
  }

  const autoStartRow = getDatabase().prepare("SELECT value FROM settings WHERE key = 'auto_start'").get() as { value: string } | undefined
  if (autoStartRow && autoStartRow.value === '1') {
    app.setLoginItemSettings({ openAtLogin: true, path: app.getPath('exe') })
    log.info('Auto-start enabled')
  }

  if (getWhatsappConfig().enabled) {
    const reminderResult = await checkAndSendExpiryReminders()
    log.info(`Startup reminder check: ${reminderResult.sent} sent`)
  }

  // Inicia el timer de recordatorios. Vive en ../whatsapp para que se pueda
  // reiniciar al cambiar checkIntervalHours en la configuración (sin reiniciar
  // la app); sees reinicia además vía IPC (system:restartReminderInterval).
  startReminderScheduler()

  // ── Respaldo automático de la base de datos ──
  // Copia al iniciar la aplicación (si está habilitado) y luego una copia
  // diaria. La retención y el estado se configuran desde Configuración > Sistema.
  const runAutoBackup = (reason: string): void => {
    try {
      if (!getBackupConfig().enabled) return
      const result = performAutoBackup()
      if (result.success) {
        log.info(`Auto-backup (${reason}): ${result.filePath}`)
      } else {
        log.error(`Auto-backup (${reason}) failed:`, result.error)
      }
    } catch (e) {
      log.error(`Auto-backup (${reason}) error:`, e)
    }
  }

  // El respaldo de arranque y el backfill de miniaturas se difieren (setImmediate)
  // para no retrasar el primer paint de la ventana.
  setImmediate(() => runAutoBackup('startup'))
  setImmediate(() => {
    ensureThumbnails().catch(() => {})
  })
  setInterval(() => runAutoBackup('daily'), 24 * 60 * 60 * 1000)

  // Allow dynamic interval restart when config changes
  ipcMain.handle('system:restartReminderInterval', async () => {
    startReminderScheduler()
    return { success: true }
  })

  app.on('activate', () => {
    const windows = BrowserWindow.getAllWindows()

    if (windows.length === 0) {
      const mode = getAppMode()
      if (mode === 'admin' || mode === 'both') {
        ensureAdminWindow()
      }
    }
  })

  log.info('Application ready')
})
}

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  closeDatabase()
})

app.on('second-instance', () => {
  const admin = getAdminWindow()
  if (admin) {
    if (admin.isMinimized()) admin.restore()
    admin.show()
    admin.focus()
  }
  const kiosk = getKioskWindow()
  if (kiosk) {
    const displays = screen.getAllDisplays()
    if (displays.length > 1 && !kiosk.isVisible()) {
      kiosk.show()
      kiosk.setFullScreen(true)
    }
  }
})

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error)
})

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason)
})
