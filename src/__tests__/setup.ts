import { vi } from 'vitest'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'

vi.mock('electron', () => {
  // randomUUID garantiza un directorio único por worker/test file:
  // Date.now() podía colisionar entre workers en paralelo, haciendo que dos
  // archivos de test compartieran la misma base de datos (tests no independientes).
  const userDataPath = path.join(os.tmpdir(), 'bodyfitgym-test', randomUUID())
  return {
    app: {
      getPath: vi.fn((name: string) => {
        if (name === 'userData') return userDataPath
        return path.join(userDataPath, name)
      }),
      getName: vi.fn(() => 'BodyFitGym'),
      getVersion: vi.fn(() => '1.0.0'),
    },
    dialog: {
      showSaveDialog: vi.fn(),
      showOpenDialog: vi.fn(),
    },
  }
})

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))
