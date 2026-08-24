import { vi } from 'vitest'
import type { ElectronAPI } from '../../../preload/index'
import type { IpcResult } from './types'

type DeepPartialResult<T> = {
  [K in keyof T]?: T[K] extends (...args: infer A) => Promise<IpcResult<infer D>>
    ? (...args: A) => Promise<IpcResult<D>>
    : T[K]
}

/**
 * Construye un mock de window.electronAPI con defaults sensatos:
 * toda invocación IPC devuelve `{ success: false, error: 'no mock' }`
 * salvo que el test sobrescriba el método concreto.
 */
export function createElectronApiMock(overrides?: DeepPartialResult<ElectronAPI>): ElectronAPI {
  const fail = <T,>(..._args: unknown[]): Promise<IpcResult<T>> =>
    Promise.resolve({ success: false, error: 'electronAPI no mockeado para este test' })

  const base = {
    auth: {
      login: vi.fn(() => Promise.resolve({ success: false, error: 'Credenciales incorrectas' })),
      logout: vi.fn(() => Promise.resolve({ success: true, data: null })),
      checkSession: vi.fn(() => Promise.resolve({ success: true, data: null }))
    },
    system: {
      updateAdmin: vi.fn(fail<null>),
      exportCsv: vi.fn(() => Promise.resolve({ success: true, data: 'C:\\export\\pagos.csv' }))
    },
    access: {
      validate: vi.fn(() =>
        Promise.resolve({
          success: false,
          error: 'no mock',
          data: undefined
        })
      )
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
      getById: vi.fn(() =>
        Promise.resolve({ success: false, error: 'no mock', data: null as never })
      )
    },
    window: {
      notifyClientFormSaved: vi.fn(() => Promise.resolve({ success: true, data: null })),
      notifyFormSaved: vi.fn(() => Promise.resolve({ success: true, data: null })),
      openKioskRenew: vi.fn(() => Promise.resolve({ success: true, data: null }))
    }
  }

  return { ...base, ...overrides } as unknown as ElectronAPI
}

/** Instala el mock en window.electronAPI y lo devuelve tipado. */
export function installElectronApiMock(overrides?: DeepPartialResult<ElectronAPI>): ElectronAPI {
  const mock = createElectronApiMock(overrides)
  ;(window as unknown as { electronAPI: ElectronAPI }).electronAPI = mock
  return mock
}
