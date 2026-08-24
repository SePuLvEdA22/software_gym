import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import log from 'electron-log'
import { getAdminWindow, getPreloadPath } from './windows'
import { toErrorMessage } from '../shared/errors'

interface FormWindowSpec {
  title: string
  width: number
  height: number
  minWidth: number
  minHeight: number
}

const FORM_WINDOW_SPECS: Record<string, FormWindowSpec> = {
  user: { title: 'Nuevo Usuario', width: 720, height: 800, minWidth: 560, minHeight: 520 },
  product: { title: 'Nuevo Producto', width: 640, height: 620, minWidth: 500, minHeight: 500 },
  movement: { title: 'Movimiento de Inventario', width: 560, height: 560, minWidth: 460, minHeight: 440 },
  plan: { title: 'Nuevo Plan', width: 560, height: 640, minWidth: 460, minHeight: 500 },
  promo: { title: 'Nueva Promoción', width: 640, height: 680, minWidth: 520, minHeight: 540 },
  template: { title: 'Nueva Plantilla', width: 640, height: 660, minWidth: 520, minHeight: 500 },
  measurement: { title: 'Nuevas Medidas', width: 720, height: 780, minWidth: 600, minHeight: 540 },
  goal: { title: 'Nuevo Objetivo', width: 560, height: 620, minWidth: 480, minHeight: 480 },
  renew: { title: 'Nueva Membresía', width: 680, height: 780, minWidth: 560, minHeight: 560 },
  freeze: { title: 'Congelar Membresía', width: 560, height: 580, minWidth: 460, minHeight: 460 },
  abono: { title: 'Registrar Abono', width: 560, height: 620, minWidth: 460, minHeight: 480 },
  stats: { title: 'Estadísticas de Asistencia', width: 560, height: 600, minWidth: 480, minHeight: 440 }
}

const formWindows = new Map<string, BrowserWindow>()

export function createFormWindow(type: string, params?: Record<string, string>): BrowserWindow | null {
  const spec = FORM_WINDOW_SPECS[type]
  if (!spec) {
    log.warn(`Unknown form window type: ${type}`)
    return null
  }

  // Una sola ventana por tipo: si ya está abierta CON LOS MISMOS PARAMS se
  // enfoca; si los params cambian (p. ej. otro cliente a renovar o a editar),
  // se recrea para que no muestre datos obsoletos.
  const existing = formWindows.get(type)
  if (existing && !existing.isDestroyed()) {
    const existingHash = existing.webContents.getURL().split('#')[1] || ''
    const query = new URLSearchParams(params || {}).toString()
    const targetHash = `/form/${type}${query ? '?' + query : ''}`
    if (existingHash === targetHash) {
      existing.show()
      existing.focus()
      return existing
    }
    log.info(`Form window ${type} recreated with new params`)
    existing.removeAllListeners('closed')
    existing.close()
    formWindows.delete(type)
  }

  // Centrar la ventana en el monitor donde está el panel administrativo.
  const parent =
    getAdminWindow() ?? BrowserWindow.getFocusedWindow()
  const parentBounds = parent ? parent.getBounds() : screen.getPrimaryDisplay().workArea
  const display = screen.getDisplayMatching(parentBounds)
  const { x, y, width: displayW, height: displayH } = display.workArea
  const winWidth = Math.min(spec.width, displayW - 40)
  const winHeight = Math.min(spec.height, displayH - 40)

  const window = new BrowserWindow({
    x: Math.round(x + (displayW - winWidth) / 2),
    y: Math.round(y + (displayH - winHeight) / 2),
    width: winWidth,
    height: winHeight,
    minWidth: spec.minWidth,
    minHeight: spec.minHeight,
    resizable: true,
    show: false,
    autoHideMenuBar: true,
    title: spec.title,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged
    },
    icon: join(__dirname, '../../resources/icon.png')
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  window.on('closed', () => {
    formWindows.delete(type)
  })

  const query =
    params && Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : ''
  const hash = `/form/${type}${query}`

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + hash)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }

  formWindows.set(type, window)
  log.info(`Form window created: ${type}${query}`)
  return window
}

export function setupFormWindowControls(): void {
  ipcMain.handle('window:open-form', async (_, type: string, params?: Record<string, string>) => {
    try {
      const win = createFormWindow(type, params)
      return win
        ? { success: true }
        : { success: false, error: `Tipo de formulario desconocido: ${type}` }
    } catch (error) {
      log.error('Error opening form window:', error)
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipcMain.handle('window:notify-form-saved', async (_, type: string, message?: string) => {
    try {
      if (!FORM_WINDOW_SPECS[type]) {
        return { success: false, error: `Tipo de formulario desconocido: ${type}` }
      }
      const adminWindow = getAdminWindow()
      if (adminWindow) {
        adminWindow.webContents.send(`form:saved:${type}`, message)
      }
      const win = formWindows.get(type)
      if (win && !win.isDestroyed()) {
        win.removeAllListeners('closed')
        win.close()
        formWindows.delete(type)
      }
      return { success: true }
    } catch (error) {
      log.error('Error notifying form saved:', error)
      return { success: false, error: toErrorMessage(error) }
    }
  })

  log.info('Form window controls IPC handlers registered')
}
