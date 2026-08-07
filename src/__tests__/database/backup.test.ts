import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { initDatabase, closeDatabase } from '../../main/database/index'
import {
  getBackupConfig,
  setBackupConfig,
  performAutoBackup,
  pruneOldBackups,
  getBackupDir,
} from '../../main/backup'

describe('Backup automático de base de datos', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  it('debería crear un respaldo y registrar el último respaldo', () => {
    const result = performAutoBackup()
    expect(result.success).toBe(true)
    expect(result.filePath).toBeDefined()
    expect(existsSync(result.filePath!)).toBe(true)

    const config = getBackupConfig()
    expect(config.lastBackupAt).not.toBeNull()
    expect(config.count).toBeGreaterThanOrEqual(1)
  })

  it('debería guardar y leer la configuración de respaldo', () => {
    setBackupConfig({ enabled: false, retention: 3 })
    let config = getBackupConfig()
    expect(config.enabled).toBe(false)
    expect(config.retention).toBe(3)

    setBackupConfig({ enabled: true, retention: 5 })
    config = getBackupConfig()
    expect(config.enabled).toBe(true)
    expect(config.retention).toBe(5)
  })

  it('debería limitar la retención al rango permitido (1-30)', () => {
    setBackupConfig({ enabled: true, retention: 0 })
    expect(getBackupConfig().retention).toBe(1)

    setBackupConfig({ enabled: true, retention: 99 })
    expect(getBackupConfig().retention).toBe(30)
  })

  it('debería podar respaldos antiguos conservando solo la retención', () => {
    const dir = getBackupDir()
    mkdirSync(dir, { recursive: true })

    // Crear 5 respaldos falsos con nombres cronológicos (orden lexicográfico)
    for (let i = 1; i <= 5; i++) {
      writeFileSync(join(dir, `backup-2026-01-0${i}T00-00-00.db`), 'fake')
    }

    // El respaldo real creado por tests anteriores también cuenta; al podar
    // con retención 2 solo deben quedar exactamente 2 archivos.
    pruneOldBackups(2)

    const remaining = readdirSync(dir)
      .filter((f) => f.startsWith('backup-') && f.endsWith('.db'))
      .sort()
    expect(remaining.length).toBe(2)
  })

  it('debería devolver error si no hay base de datos inicializada', async () => {
    // Se cierra la BD temporalmente para simular el estado no inicializado.
    closeDatabase()
    const result = performAutoBackup()
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    // Volver a abrir para no afectar los demás tests
    await initDatabase()
  })
})
