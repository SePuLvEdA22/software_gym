import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { readFileSync } from 'fs'
import { app } from 'electron'
import { initDatabase, closeDatabase, getDatabase } from '../../main/database/index'

// El archivo físico vive en el userData mockeado por setup.ts
function dbFilePath(): string {
  return `${app.getPath('userData')}/bodyfitgym.db`
}

describe('Persistencia sql.js (debounce + garantías)', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    vi.useRealTimers()
    closeDatabase()
  })

  it('escritura normal: memoria actualizada al instante y archivo tras el debounce', () => {
    const db = getDatabase()

    db.prepare("INSERT INTO settings (key, value) VALUES ('persist_test_1', 'v1')").run()

    // La lectura en memoria ya refleja el cambio
    const row = db.prepare("SELECT value FROM settings WHERE key = 'persist_test_1'").get()
    expect(row).toBeDefined()
    expect((row as { value: string }).value).toBe('v1')

    // El volcado diferido aún no corrió: al cerrar se vuelca (verificado en otro test)
  })

  it('el archivo en disco NO cambia dentro de la ventana de debounce (coalescencia)', async () => {
    await initDatabase()
    const path = dbFilePath()

    // Punto de partida estable: cerrar pendientes previos
    getDatabase().flushWrites()
    const before = readFileSync(path)

    vi.useFakeTimers()
    try {
      const db = getDatabase()
      db.prepare("INSERT INTO settings (key, value) VALUES ('persist_test_2', 'v2')").run()
      db.prepare("INSERT INTO settings (key, value) VALUES ('persist_test_3', 'v3')").run()

      // Dentro de la ventana: sin volcado adicional
      vi.advanceTimersByTime(100)
      expect(readFileSync(path).equals(before)).toBe(true)

      // Al vencer la ventana: un único volcado con ambos cambios
      vi.advanceTimersByTime(300)
      const after = readFileSync(path)
      expect(after.equals(before)).toBe(false)
      expect(after.length).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
      closeDatabase()
    }
  })

  it('close() vuelca los pendientes de inmediato sin esperar el debounce', async () => {
    await initDatabase()
    const path = dbFilePath()
    getDatabase().flushWrites()

    vi.useFakeTimers()
    try {
      const db = getDatabase()
      db.prepare("INSERT INTO settings (key, value) VALUES ('persist_test_close', 'vc')").run()

      // Sin avanzar el tiempo: el cierre debe forzar el volcado
      closeDatabase()

      const raw = readFileSync(path).toString('binary')
      expect(raw.includes('persist_test_close')).toBe(true)
    } finally {
      vi.useRealTimers()
    }

    await initDatabase()
    const restored = getDatabase().prepare("SELECT value FROM settings WHERE key = 'persist_test_close'").get()
    expect(restored).toBeDefined()
  })

  it('una transacción completada se persiste al instante (sin debounce)', async () => {
    await initDatabase()
    const path = dbFilePath()
    const db = getDatabase()
    db.flushWrites()
    const before = readFileSync(path)

    vi.useFakeTimers()
    try {
      const runTx = db.transaction(() => {
        db.run("INSERT INTO settings (key, value) VALUES ('persist_test_tx', 'vt')")
      })
      runTx()

      // Sin avanzar timers: el COMMIT ya está en disco
      expect(readFileSync(path).equals(before)).toBe(false)
      expect(readFileSync(path).toString('binary').includes('persist_test_tx')).toBe(true)
    } finally {
      vi.useRealTimers()
      closeDatabase()
    }
  })

  it('flushWrites fuerza el volcado sin cerrar la BD', async () => {
    await initDatabase()
    const path = dbFilePath()
    const db = getDatabase()
    db.flushWrites()
    const before = readFileSync(path)

    vi.useFakeTimers()
    try {
      db.prepare("INSERT INTO settings (key, value) VALUES ('persist_test_flush', 'vf')").run()
      expect(readFileSync(path).equals(before)).toBe(true)

      db.flushWrites()
      expect(readFileSync(path).equals(before)).toBe(false)
      expect(readFileSync(path).toString('binary').includes('persist_test_flush')).toBe(true)
    } finally {
      vi.useRealTimers()
      closeDatabase()
    }
  })
})
