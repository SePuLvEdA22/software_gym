import { app, shell, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, session } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import log from 'electron-log'
import { initDatabase, closeDatabase, getDatabase } from './database'
import { setupIpcHandlers } from './ipc'
import { initializeDoorController } from './door/controller'
import { setDoorConfig } from './door/config'
import { updateWhatsappConfig, checkAndSendExpiryReminders, getWhatsappConfig } from './whatsapp'
import { initUpdater } from './updater'
import * as Sentry from '@sentry/electron/main'

log.initialize({ preload: true })
log.transports.file.level = 'info'
log.transports.console.level = 'debug'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [Sentry.electronEventsIntegration()],
  })
  log.info('Sentry initialized for main process')
}

console.log = log.log
console.error = log.error
console.warn = log.warn
console.info = log.info

let adminWindow: BrowserWindow | null = null
let kioskWindow: BrowserWindow | null = null

type AppMode = 'admin' | 'kiosk' | 'both'

function getAppMode(): AppMode {
  const mode = process.env.GYM_MODE || process.env.npm_package_config_gym_mode || 'both'
  
  if (mode === 'kiosk') return 'kiosk'
  if (mode === 'admin') return 'admin'
  return 'both'
}

function getPreloadPath(): string {
  const possiblePaths = [
    join(__dirname, '../preload/index.mjs'),
    join(__dirname, '../preload/index.js'),
  ]
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      log.info(`[PRELOAD] Found preload at: ${path}`)
      return path
    }
    log.info(`[PRELOAD] Not found at: ${path}`)
  }
  
  log.warn('[PRELOAD] Could not find preload file in any location!')
  return possiblePaths[0]
}

function createAdminWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  const window = new BrowserWindow({
    width: Math.min(width, 1600),
    height: Math.min(height, 900),
    minWidth: 1200,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
     title: 'BodyFitGym - Panel Administrativo',
     webPreferences: {
       preload: getPreloadPath(),
       sandbox: false,
       contextIsolation: true,
       nodeIntegration: false
     },
    icon: join(__dirname, '../../resources/icon.png')
  })

  window.on('ready-to-show', () => {
    window.show()
    window.maximize()
  })

  window.on('close', (e) => {
    if (tray) {
      e.preventDefault()
      window.hide()
      log.info('Window minimized to tray')
    }
  })

  const allowedExternalUrls = [
    'https://wa.me/',
    'https://api.whatsapp.com/',
    'https://web.whatsapp.com/',
    'mailto:'
  ]
  window.webContents.setWindowOpenHandler((details) => {
    const allowed = allowedExternalUrls.some(prefix => details.url.startsWith(prefix))
    if (allowed) {
      shell.openExternal(details.url)
    } else {
      log.warn(`Blocked external URL: ${details.url}`)
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  log.info('Admin window created')
  return window
}

function createKioskWindow(_displayIndex = 0): BrowserWindow {
  const displays = screen.getAllDisplays()
  const primaryDisplay = screen.getPrimaryDisplay()
  
  log.info('========================================')
  log.info('=== CREATING KIOSK WINDOW ===')
  log.info(`Displays available: ${displays.length}`)
  log.info(`Primary display ID: ${primaryDisplay.id}`)
  log.info(`process.env.ELECTRON_RENDERER_URL: ${process.env['ELECTRON_RENDERER_URL'] || 'NOT DEFINED'}`)
  log.info(`is.dev: ${is.dev}`)
  
  displays.forEach((d, i) => {
    log.info(`Display ${i}: ${d.bounds.width}x${d.bounds.height} at (${d.bounds.x},${d.bounds.y}) - ${d.id === primaryDisplay.id ? 'PRIMARY' : 'SECONDARY'}`)
  })

  const targetDisplay = displays.length > 1 
    ? displays.find(d => d.id !== primaryDisplay.id) || displays[1] || displays[0]
    : displays[0]

  const { x, y, width, height } = targetDisplay.bounds

  log.info(`Using display: ${width}x${height} at (${x},${y})`)
  log.info('========================================')

  const window = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: true,
    fullscreen: false,
    autoHideMenuBar: true,
     title: 'BodyFitGym Kiosco - Toca la pantalla',
     webPreferences: {
       preload: getPreloadPath(),
       sandbox: false,
       contextIsolation: true,
       nodeIntegration: false,
       devTools: !app.isPackaged
     },
    show: true,
    alwaysOnTop: displays.length > 1
  })

  if (!app.isPackaged) {
    window.webContents.openDevTools({ mode: 'detach' })
  }

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173'
  
  if (is.dev) {
    const kioskUrl = rendererUrl + '#/kiosk'
    log.info(`[DEV MODE] Loading kiosk URL: ${kioskUrl}`)
    window.loadURL(kioskUrl)
  } else {
    log.info('[PROD MODE] Loading kiosk from file')
    window.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: '/kiosk'
    })
  }

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log.error(`=== KIOSK FAILED TO LOAD ===`)
    log.error(`Error code: ${errorCode}`)
    log.error(`Description: ${errorDescription}`)
    log.error(`URL: ${validatedURL}`)
  })

  window.webContents.on('did-finish-load', () => {
    log.info('=== KIOSK FINISHED LOADING ===')
  })

  window.on('ready-to-show', () => {
    log.info('=== KIOSK READY TO SHOW ===')
    if (displays.length > 1) {
      window.setFullScreen(true)
    }
    window.focus()
  })

  window.on('show', () => {
    log.info('=== KIOSK WINDOW SHOWN ===')
  })

  log.info('=== KIOSK WINDOW INSTANCE CREATED ===')
  return window
}

function createKioskWindowAuto(): BrowserWindow {
  const displays = screen.getAllDisplays()
  log.info(`Available displays: ${displays.length}`)
  displays.forEach((d, i) => {
    log.info(`Display ${i}: ${d.bounds.width}x${d.bounds.height} at (${d.bounds.x},${d.bounds.y}) - primary: ${d.id === screen.getPrimaryDisplay().id}`)
  })

  let displayIndex = 0
  
  if (displays.length > 1) {
    const primaryDisplay = screen.getPrimaryDisplay()
    const secondaryDisplay = displays.find(d => d.id !== primaryDisplay.id)
    if (secondaryDisplay) {
      displayIndex = displays.indexOf(secondaryDisplay)
      log.info(`Found secondary display at index ${displayIndex}`)
    } else {
      displayIndex = 1
      log.info(`Using display index 1`)
    }
  } else {
    log.info('Only one display available, using display 0')
    displayIndex = 0
  }

  return createKioskWindow(displayIndex)
}

function setupWindowControls(): void {
  ipcMain.handle('window:open-kiosk', async () => {
    try {
      log.info('Opening kiosk window (request from admin panel)')
      
      if (kioskWindow && !kioskWindow.isDestroyed()) {
        log.info('Kiosk window already exists but was hidden - closing it first for fresh state')
        try {
          kioskWindow.removeAllListeners('closed')
          kioskWindow.close()
        } catch (e) {
          log.warn('Error closing existing kiosk window:', e)
        }
        kioskWindow = null
      }
      
      log.info('Creating new kiosk window')
      kioskWindow = createKioskWindowAuto()
      
      kioskWindow.on('closed', () => {
        log.info('Kiosk window closed')
        kioskWindow = null
      })
      
      log.info('Kiosk window created successfully')
      return { success: true, data: { isOpen: true, alreadyOpen: false } }
    } catch (error: any) {
      log.error('Error opening kiosk window:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('window:close-kiosk', async () => {
    try {
      if (kioskWindow && !kioskWindow.isDestroyed()) {
        log.info('Closing kiosk window (request from admin panel)')
        kioskWindow.removeAllListeners('closed')
        kioskWindow.close()
        kioskWindow = null
        return { success: true, data: { wasOpen: true } }
      }
      log.info('Kiosk window already closed or destroyed')
      return { success: true, data: { wasOpen: false } }
    } catch (error: any) {
      log.error('Error closing kiosk window:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('window:kiosk-status', async () => {
    const isOpen = kioskWindow !== null && !kioskWindow.isDestroyed() && kioskWindow.isVisible()
    return { success: true, data: { isOpen } }
  })

  ipcMain.handle('window:minimize-admin', async () => {
    if (adminWindow) {
      adminWindow.minimize()
    }
    return { success: true }
  })

  ipcMain.handle('window:maximize-admin', async () => {
    if (adminWindow) {
      if (adminWindow.isMaximized()) {
        adminWindow.unmaximize()
      } else {
        adminWindow.maximize()
      }
    }
    return { success: true }
  })

  log.info('Window controls IPC handlers registered')
}

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

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar ventana',
      click: () => {
        if (adminWindow && !adminWindow.isDestroyed()) {
          adminWindow.show()
          adminWindow.focus()
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
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    if (adminWindow && !adminWindow.isDestroyed()) {
      adminWindow.show()
      adminWindow.focus()
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
  } catch (error: any) {
    log.error('Error setting auto-start:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('system:get-auto-start', async () => {
  try {
    const settings = app.getLoginItemSettings()
    return { success: true, data: settings.openAtLogin }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

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
    } catch (e) {
      log.warn('Failed to parse saved WhatsApp config')
    }
  }

  log.info('Initializing door controller...')
  await initializeDoorController()

  log.info('Setting up IPC handlers...')
  setupIpcHandlers()
  setupWindowControls()

  createTray()

  const appMode = getAppMode()
  log.info(`Starting in mode: ${appMode}`)

  if (appMode === 'admin' || appMode === 'both') {
    adminWindow = createAdminWindow()
    initUpdater(adminWindow)
  }

  if (appMode === 'kiosk' || appMode === 'both') {
    try {
      const displays = screen.getAllDisplays()
      if (displays.length > 1 || appMode === 'kiosk') {
        log.info('Auto-creating kiosk window...')
        kioskWindow = createKioskWindowAuto()
        kioskWindow.on('closed', () => {
          kioskWindow = null
        })
      } else {
        log.info('Only one display detected, kiosk window not opened automatically')
        log.info('You can open it manually from Settings > Pantalla Kiosco')
      }
    } catch (error: any) {
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

  setInterval(async () => {
    try {
      if (getWhatsappConfig().enabled) {
        const result = await checkAndSendExpiryReminders()
        if (result.sent > 0) {
          log.info(`Periodic reminder check: ${result.sent} sent`)
        }
      }
    } catch (e) {
      log.error('Periodic reminder check error:', e)
    }
  }, (getWhatsappConfig().checkIntervalHours || 6) * 60 * 60 * 1000)

  app.on('activate', () => {
    const windows = BrowserWindow.getAllWindows()
    
    if (windows.length === 0) {
      const mode = getAppMode()
      if (mode === 'admin' || mode === 'both') {
        adminWindow = createAdminWindow()
      }
    }
  })

  log.info('Application ready')
})

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
  if (adminWindow) {
    if (adminWindow.isMinimized()) {
      adminWindow.restore()
    }
    adminWindow.focus()
  }
})

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error)
})

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason)
})
