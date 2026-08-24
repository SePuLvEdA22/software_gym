import { app, shell, BrowserWindow, screen, ipcMain } from 'electron'
import type { Tray } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import log from 'electron-log'
import { toErrorMessage } from '../shared/errors'

type AppMode = 'admin' | 'kiosk' | 'both'

let adminWindow: BrowserWindow | null = null
let kioskWindow: BrowserWindow | null = null
let clientFormWindow: BrowserWindow | null = null
let kioskRenewWindow: BrowserWindow | null = null
let trayRef: Tray | null = null

export function getAppMode(): AppMode {
  const mode = process.env.GYM_MODE || process.env.npm_package_config_gym_mode || 'both'

  if (mode === 'kiosk') return 'kiosk'
  if (mode === 'admin') return 'admin'
  return 'both'
}

export function getPreloadPath(): string {
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

/** Referencia al Tray para decidir si la ventana admin se oculta o se cierra. */
export function setTray(tray: Tray | null): void {
  trayRef = tray
}

export function getAdminWindow(): BrowserWindow | null {
  return adminWindow && !adminWindow.isDestroyed() ? adminWindow : null
}

export function getKioskWindow(): BrowserWindow | null {
  return kioskWindow && !kioskWindow.isDestroyed() ? kioskWindow : null
}

/**
 * Devuelve la ventana admin existente o crea una nueva (guardándola como la
 * actual). El flag `created` permite a los llamadores diferir acciones hasta
 * que la página termine de cargar.
 */
export function ensureAdminWindow(): { window: BrowserWindow; created: boolean } {
  if (adminWindow && !adminWindow.isDestroyed()) return { window: adminWindow, created: false }
  adminWindow = createAdminWindow()
  return { window: adminWindow, created: true }
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
    if (trayRef) {
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

function loadRendererHash(window: BrowserWindow, hash: string): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + hash)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }
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
    show: true
  })

  if (!app.isPackaged) {
    window.webContents.openDevTools({ mode: 'detach' })
  }

  if (is.dev) {
    const rendererUrl = process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173'
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
  })

  window.on('show', () => {
    log.info('=== KIOSK WINDOW SHOWN ===')
  })

  log.info('=== KIOSK WINDOW INSTANCE CREATED ===')
  return window
}

/** Crea el kiosco en la mejor pantalla disponible y registra su ciclo de vida. */
export function openKioskWindowAuto(): BrowserWindow {
  const displays = screen.getAllDisplays()
  log.info(`Available displays: ${displays.length}`)
  displays.forEach((d, i) => {
    log.info(`Display ${i}: ${d.bounds.width}x${d.bounds.height} at (${d.bounds.x},${d.bounds.y}) - primary: ${d.id === screen.getPrimaryDisplay().id}`)
  })

  let displayIndex: number

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

  kioskWindow = createKioskWindow(displayIndex)
  kioskWindow.on('closed', () => {
    log.info('Kiosk window closed')
    kioskWindow = null
  })
  return kioskWindow
}

function createClientFormWindow(clientId?: string): BrowserWindow {
  const { height } = screen.getPrimaryDisplay().workAreaSize

  const window = new BrowserWindow({
    height: Math.min(height - 100, 800),
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    show: false,
    autoHideMenuBar: true,
    title: clientId ? 'Editar Cliente - BodyFitGym' : 'Nuevo Cliente - BodyFitGym',
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
  })

  const hash = clientId ? `/client-form?id=${encodeURIComponent(clientId)}` : '/client-form'
  loadRendererHash(window, hash)

  window.on('closed', () => {
    clientFormWindow = null
  })

  log.info(`Client form window created (clientId: ${clientId || 'new'})`)
  return window
}

function createKioskRenewWindow(clientId: string): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const window = new BrowserWindow({
    width: Math.min(900, width - 100),
    height: Math.min(height - 100, 750),
    minWidth: 700,
    minHeight: 600,
    resizable: true,
    show: false,
    autoHideMenuBar: true,
    title: 'Renovar Membresía - BodyFitGym Kiosco',
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
  })

  loadRendererHash(window, `/kiosk-renew?id=${encodeURIComponent(clientId)}`)

  window.on('closed', () => {
    kioskRenewWindow = null
  })

  log.info(`Kiosk renew window created for client: ${clientId}`)
  return window
}

export function setupWindowControls(): void {
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
      openKioskWindowAuto()

      log.info('Kiosk window created successfully')
      return { success: true, data: { isOpen: true, alreadyOpen: false } }
    } catch (error) {
      log.error('Error opening kiosk window:', error)
      return { success: false, error: toErrorMessage(error) }
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
    } catch (error) {
      log.error('Error closing kiosk window:', error)
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipcMain.handle('window:kiosk-status', async () => {
    const isOpen = kioskWindow !== null && !kioskWindow.isDestroyed() && kioskWindow.isVisible()
    return { success: true, data: { isOpen } }
  })

  ipcMain.handle('window:open-kiosk-renew', async (_, clientId: string) => {
    try {
      if (kioskRenewWindow && !kioskRenewWindow.isDestroyed()) {
        kioskRenewWindow.removeAllListeners('closed')
        kioskRenewWindow.close()
      }
      kioskRenewWindow = createKioskRenewWindow(clientId)
      return { success: true }
    } catch (error) {
      log.error('Error opening kiosk renew window:', error)
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipcMain.handle('window:open-client-form', async (_, clientId?: string) => {
    try {
      if (clientFormWindow && !clientFormWindow.isDestroyed()) {
        clientFormWindow.removeAllListeners('closed')
        clientFormWindow.close()
      }
      clientFormWindow = createClientFormWindow(clientId)
      return { success: true }
    } catch (error) {
      log.error('Error opening client form window:', error)
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipcMain.handle('window:open-client-payments', async (_, clientId: string) => {
    try {
      if (adminWindow && !adminWindow.isDestroyed()) {
        adminWindow.show()
        adminWindow.focus()
        adminWindow.webContents.send('navigate:payments', { clientId })
      }
      return { success: true }
    } catch (error) {
      log.error('Error opening client payments:', error)
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipcMain.handle('window:open-client-renew', async (_, clientId: string) => {
    try {
      const { window, created } = ensureAdminWindow()
      window.show()
      window.focus()

      // Navigate directly via URL hash so it works even if React hasn't mounted yet
      const navigateJs = `window.location.hash = '#/clients?clientId=${encodeURIComponent(clientId)}&action=renew'`

      if (created) {
        // New window: wait for the page to load before navigating
        window.webContents.once('did-finish-load', () => {
          window.webContents.executeJavaScript(navigateJs)
        })
      } else {
        // Existing window: navigate immediately
        window.webContents.executeJavaScript(navigateJs)
      }

      return { success: true }
    } catch (error) {
      log.error('Error opening client renew:', error)
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipcMain.handle('window:notify-client-form-saved', async () => {
    try {
      if (adminWindow && !adminWindow.isDestroyed()) {
        adminWindow.webContents.send('clientForm:saved')
      }
      if (clientFormWindow && !clientFormWindow.isDestroyed()) {
        clientFormWindow.removeAllListeners('closed')
        clientFormWindow.close()
        clientFormWindow = null
      }
      return { success: true }
    } catch (error) {
      log.error('Error notifying client form saved:', error)
      return { success: false, error: toErrorMessage(error) }
    }
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
