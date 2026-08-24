import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import { app } from 'electron'
import { initDatabase, closeDatabase, getDatabase } from '../../main/database/index'

// El archivo físico vive en el userData mockeado por setup.ts
function dbFilePath(): string {
  return `${app.getPath('userData')}/bodyfitgym.db`
}

describe('Persistencia nativa (escritura inmediata)', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  it('toda escritura llega a disco de inmediato, sin debounce', () => {
    const db = getDatabase()

    db.prepare("INSERT INTO settings (key, value) VALUES ('persist_native_1', 'v1')").run()

    const raw = readFileSync(dbFilePath()).toString('binary')
    expect(raw.includes('persist_native_1')).toBe(true)
  })

  it('cerrar y reabrir conserva los datos', async () => {
    getDatabase().prepare("INSERT INTO settings (key, value) VALUES ('persist_native_close', 'vc')").run()

    closeDatabase()
    await initDatabase()

    const restored = getDatabase().prepare("SELECT value FROM settings WHERE key = 'persist_native_close'").get()
    expect(restored).toBeDefined()
    expect((restored as { value: string }).value).toBe('vc')
  })

  it('una transacción completada queda duradera en disco', () => {
    const db = getDatabase()
    const runTx = db.transaction(() => {
      db.run("INSERT INTO settings (key, value) VALUES ('persist_native_tx', 'vt')")
    })
    runTx()

    const raw = readFileSync(dbFilePath()).toString('binary')
    expect(raw.includes('persist_native_tx')).toBe(true)
  })

  it('un ROLLBACK descarta los cambios de la transacción', () => {
    const db = getDatabase()
    const failingTx = db.transaction(() => {
      db.run("INSERT INTO settings (key, value) VALUES ('persist_native_rollback', 'x')")
      throw new Error('abort')
    })

    expect(failingTx).toThrow('abort')

    const row = db.prepare("SELECT value FROM settings WHERE key = 'persist_native_rollback'").get()
    expect(row).toBeUndefined()
  })
})
