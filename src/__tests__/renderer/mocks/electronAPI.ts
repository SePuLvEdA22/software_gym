import { vi } from 'vitest'
import type { Mock } from 'vitest'
import type { ElectronAPI } from '../../../preload/index'

/** Tipo mínimo del resultado IPC que expone el preload. */
export interface IpcResult<T> {
  success: boolean
  data?: T
  error?: string
}

type AnyIpcMethod = (...args: never[]) => Promise<IpcResult<unknown>>
type MockableNamespace = Record<string, AnyIpcMethod>

/** Cada método del namespace conserv su firma y además expone la API de Mock. */
type MockedNamespace<N> = {
  [K in keyof N]: N[K] extends AnyIpcMethod ? N[K] & Mock : N[K]
}

/** Overrides: namespaces parciales; cada método acepta un Mock genérico o la firma real. */
type MockOverrides = {
  [K in keyof ElectronAPI]?: ElectronAPI[K] extends MockableNamespace
    ? {
        [J in keyof ElectronAPI[K]]?: ElectronAPI[K][J] extends AnyIpcMethod
          ? ElectronAPI[K][J] | Mock
          : unknown
      }
    : unknown
}

type MockedApi = {
  [K in keyof ElectronAPI]: ElectronAPI[K] extends MockableNamespace
    ? MockedNamespace<ElectronAPI[K]>
    : ElectronAPI[K]
}

/**
 * Construye un mock de window.electronAPI con defaults sensatos:
 * toda invocación IPC devuelve `{ success: false, error: ... }`
 * salvo que el test sobrescriba el método concreto.
 */
export function installElectronApiMock(overrides?: MockOverrides): MockedApi & ElectronAPI {
  const fail = (): Promise<IpcResult<never>> =>
    Promise.resolve({ success: false, error: 'electronAPI no mockeado para este test' })

  const base = {
    auth: {
      login: vi.fn(() => Promise.resolve({ success: false, error: 'Credenciales incorrectas' })),
      logout: vi.fn(() => Promise.resolve({ success: true, data: null })),
      checkSession: vi.fn(() => Promise.resolve({ success: true, data: null }))
    },
    system: {
      updateAdmin: vi.fn(fail),
      exportCsv: vi.fn(() => Promise.resolve({ success: true, data: 'C:\\export\\pagos.csv' }))
    },
    access: {
      validate: vi.fn(() => Promise.resolve({ success: false, error: 'no mock' }))
    },
    door: {
      open: vi.fn(() => Promise.resolve({ success: true, data: true }))
    },
    gym: {
      getSettings: vi.fn(() =>
        Promise.resolve({
          success: true,
          data: { name: 'BodyFitGym', address: '', phone: '', welcomeMessage: '' }
        })
      )
    },
    client: {
      create: vi.fn(fail),
      update: vi.fn(fail),
      getById: vi.fn(fail)
    },
    window: {
      notifyClientFormSaved: vi.fn(() => Promise.resolve({ success: true, data: null })),
      notifyFormSaved: vi.fn(() => Promise.resolve({ success: true, data: null })),
      openKioskRenew: vi.fn(() => Promise.resolve({ success: true, data: null }))
    }
  }

  const merged = { ...base, ...(overrides ?? {}) }
  ;(window as unknown as { electronAPI: ElectronAPI }).electronAPI = merged as ElectronAPI
  return merged as MockedApi & ElectronAPI
}
