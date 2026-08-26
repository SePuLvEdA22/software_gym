import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, copyFileSync, unlinkSync, writeFileSync } from 'fs'
import log from 'electron-log'
import Database from 'better-sqlite3'
import { MIGRATIONS } from './migrations'

export interface StatementWrapper {
  run(...params: unknown[]): { changes: number }
  get(...params: unknown[]): Record<string, unknown> | undefined
  all(...params: unknown[]): Record<string, unknown>[]
}

/**
 * Motor SQLite nativo (better-sqlite3). Misma interfaz pública que la antigua
 * fachada de sql.js (prepare/run/exec/transaction/export/close) para que los
 * repositorios no cambien.
 *
 * Diferencia clave: las escrituras son DIRECTAS a disco con WAL+NORMAL
 * (durable) y transacción nativa con SAVEPOINT. Ya no existe el debounce de
 * persistencia ni los volcados diferidos: cada statement completado y cada
 * transacción confirmada están durables en el momento en que la llamada regresa.
 */
export class NativeDatabase {
  private db: Database.Database
  readonly filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
    this.db = new Database(filePath)
    this.db.pragma('foreign_keys = ON')
    // WAL + NORMAL es el modo recomendado por better-sqlite3 para durabilidad
    // ante cortes abruptos: WAL evita que un COMMIT a medias corrompa el
    // archivo principal. busy_timeout evita SQLITE_BUSY en respaldos concurrentes.
    try {
      this.db.pragma('journal_mode = WAL')
    } catch {
      // best-effort: algunos filesystems no soportan WAL
    }
    try {
      this.db.pragma('synchronous = NORMAL')
    } catch {
      /* best-effort */
    }
    try {
      this.db.pragma('busy_timeout = 5000')
    } catch {
      /* best-effort */
    }
  }

  prepare(sql: string): StatementWrapper {
    const stmt = this.db.prepare(sql)
    return {
      run: (...params: unknown[]): { changes: number } => {
        const info = stmt.run(...normalizeParams(params))
        return { changes: Number(info.changes) }
      },

      get: (...params: unknown[]): Record<string, unknown> | undefined =>
        stmt.get(...normalizeParams(params)) as Record<string, unknown> | undefined,

      all: (...params: unknown[]): Record<string, unknown>[] =>
        stmt.all(...normalizeParams(params)) as Record<string, unknown>[]
    }
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  run(sql: string, params?: unknown[]): void {
    if (params && params.length > 0) {
      this.db.prepare(sql).run(...normalizeParams(params))
    } else {
      // Sin parámetros puede haber varias sentencias separadas por ';'.
      this.db.exec(sql)
    }
  }

  transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T {
    // Delegar a better-sqlite3 transaction nativa: usa SAVEPOINT, soporta
    // anidamiento y es atómica ante ROLLBACK. El wrapper manual con
    // BEGIN/COMMIT fallaba con transacciones anidadas y dejaba el archivo
    // en estado intermedio si el COMMIT era interrumpido.
    const wrapped = this.db.transaction(fn as (...args: unknown[]) => T)
    return (...args: unknown[]) => (wrapped as (...a: unknown[]) => T)(...args)
  }

  /** Ejecuta PRAGMA integrity_check; retorna {ok, error} sin lanzar. */
  checkIntegrity(): { ok: boolean; error?: string } {
    try {
      const row = this.db.prepare('PRAGMA integrity_check').get() as { integrity_check?: string } | undefined
      const value = (row as Record<string, unknown>)?.['integrity_check'] as string | undefined
      if (value === 'ok' || value === undefined) return { ok: true }
      return { ok: false, error: String(value) }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  /** Snapshot completo de la base como Buffer (respaldos y herramientas legadas). */
  export(): Buffer {
    return Buffer.from(this.db.serialize())
  }

  close(): void {
    this.db.close()
  }
}

/**
 * better-sqlite3 solo acepta primitivos/buffer/null: undefined se convierte en
 * NULL y los booleanos en 1/0 (sql.js era más permisivo).
 */
function normalizeParams(params: unknown[]): unknown[] {
  return params.map(p =>
    p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p
  )
}

export function isDatabaseCorruptedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('malformed') ||
    msg.includes('disk image is malformed') ||
    msg.includes('file is not a database') ||
    msg.includes('database disk image') ||
    msg.includes('not a database')
  )
}

export function checkDatabaseIntegrity(): { ok: boolean; error?: string } {
  if (!db) return { ok: false, error: 'Database not initialized' }
  return db.checkIntegrity()
}

let db: NativeDatabase | null = null

export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'bodyfitgym.db')
  log.info('Database path:', dbPath)
  return dbPath
}

export async function initDatabase(): Promise<NativeDatabase> {
  if (db) return db

  const dbPath = getDatabasePath()
  const dbDir = join(dbPath, '..')

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  openAndMigrate(dbPath)

  if (!db) {
    throw new Error('Database could not be opened')
  }
  return db
}

/**
 * Abre la base en `dbPath` y aplica migraciones. Si el archivo está corrupto
 * lo elimina (o lo renombra si no se puede borrar) y arranca una base nueva,
 * igual que hacía la versión sql.js.
 * También ejecuta PRAGMA integrity_check tras abrir para detectar corrupción
 * silenciosa que no lanza excepción en la apertura (caso del bug reportado).
 */
function openAndMigrate(dbPath: string): void {
  try {
    db = new NativeDatabase(dbPath)
    const integrity = db.checkIntegrity()
    if (!integrity.ok) {
      throw new Error(`integrity_check failed: ${integrity.error}`)
    }
    runMigrations(db)
    log.info('Database initialized at', dbPath)
    return
  } catch (err) {
    log.error('Failed to open database, attempting recovery:', err)
    try {
      db?.close()
    } catch {
      /* la conexión pudo no abrirse */
    }
    db = null
  }

  const walPath = dbPath + '-wal'
  const shmPath = dbPath + '-shm'
  try { unlinkSync(dbPath) } catch { log.error('Failed to delete corrupted db file') }
  try { unlinkSync(walPath) } catch { /* best-effort: puede no existir */ }
  try { unlinkSync(shmPath) } catch { /* best-effort: puede no existir */ }

  if (existsSync(dbPath)) {
    log.warn('Db file still exists after deletion attempt, renaming...')
    try {
      const renamedPath = dbPath + '.old.' + Date.now()
      copyFileSync(dbPath, renamedPath)
      unlinkSync(dbPath)
    } catch (e) {
      log.error('Could not remove corrupted database file:', e)
    }
  }

  db = new NativeDatabase(dbPath)
  runMigrations(db)
  log.info('Fresh database created after recovery')
}

export function runMigrations(database: NativeDatabase): void {
  database.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  const appliedRows = database.prepare('SELECT name FROM _migrations').all() as { name: string }[]
  const appliedSet = new Set(appliedRows.map(r => r.name))

  const runAll = database.transaction(() => {
    for (const migration of MIGRATIONS) {
      if (!appliedSet.has(migration.name)) {
        migration.run(database)
        database.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name)
        log.info(`Migration applied: ${migration.name}`)
      }
    }
  })

  runAll()
  log.info('Database migrations completed')
}

export function getDatabase(): NativeDatabase {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

export function backupDatabase(destPath: string): boolean {
  try {
    if (!db) {
      log.error('Database not initialized for backup')
      return false
    }
    // serialize() produce un snapshot consistente del estado actual,
    // incluyendo WAL si existe (WAL+NORMAL activo desde hardening).
    const data = db.export()
    writeFileSync(destPath, data)
    log.info(`Database backed up to: ${destPath}`)
    return true
  } catch (error) {
    log.error('Backup error:', error)
    return false
  }
}

export async function restoreDatabase(srcPath: string): Promise<boolean> {
  try {
    const destPath = getDatabasePath()
    if (!existsSync(srcPath)) {
      log.error('Restore error: source file not found')
      return false
    }

    if (db) {
      try { db.close() } catch { /* puede estar corrupta */ }
      db = null
    }

    if (existsSync(destPath)) {
      const backupPath = destPath + '.backup.' + Date.now()
      copyFileSync(destPath, backupPath)
      const walPath = destPath + '-wal'
      const shmPath = destPath + '-shm'
      try { copyFileSync(walPath, backupPath + '-wal') } catch { /* best-effort: WAL puede no existir */ }
      try { copyFileSync(shmPath, backupPath + '-shm') } catch { /* best-effort: SHM puede no existir */ }
      log.info(`Existing database backed up to: ${backupPath}`)
    }

    const walPath = destPath + '-wal'
    const shmPath = destPath + '-shm'
    try { unlinkSync(walPath) } catch { /* best-effort: puede no existir */ }
    try { unlinkSync(shmPath) } catch { /* best-effort: puede no existir */ }

    copyFileSync(srcPath, destPath)
    openAndMigrate(destPath)
    log.info('Database restored successfully')
    return true
  } catch (error) {
    log.error('Restore error:', error)
    if (!db) {
      try {
        openAndMigrate(getDatabasePath())
      } catch (e) {
        log.error('Failed to reopen database after restore error:', e)
      }
    }
    return false
  }
}

export function closeDatabase(): void {
  if (db) {
    try { db.close() } catch { /* idempotente */ }
    db = null
    log.info('Database closed')
  }
}
