import { vi } from 'vitest'
import path from 'path'
import os from 'os'

vi.mock('electron', () => {
  const userDataPath = path.join(os.tmpdir(), 'bodyfitgym-test', Date.now().toString())
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
