import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, copyFileSync, unlinkSync, writeFileSync, readFileSync } from 'fs'
import log from 'electron-log'
// @ts-expect-error sql.js has no type declarations
import initSqlJs from 'sql.js'
import { MIGRATIONS } from './migrations'

type SqlJsDb = Awaited<ReturnType<typeof initSqlJs>> extends { Database: infer D } ? D : never

interface StatementWrapper {
  run(...params: unknown[]): { changes: number }
  get(...params: unknown[]): Record<string, unknown> | undefined
  all(...params: unknown[]): Record<string, unknown>[]
}

export class SqlJsDatabase {
  private db: InstanceType<SqlJsDb>
  private filePath: string
  private batchSaving = false
  private pendingSaveTimer: NodeJS.Timeout | null = null

  // Ventana de coalescencia: escrituras rápidas consecutivas comparten un
  // único volcado a disco. El estado en memoria SIEMPRE está actualizado;
  // solo se difiere la serialización del archivo completo.
  private static readonly SAVE_DEBOUNCE_MS = 300

  constructor(data: ArrayLike<number> | Buffer | null, filePath: string, Sql: Awaited<ReturnType<typeof initSqlJs>>) {
    this.db = new Sql.Database(data)
    this.filePath = filePath
  }

  prepare(sql: string): StatementWrapper {
    return {
      run: (...params: unknown[]): { changes: number } => {
        const stmt = this.db.prepare(sql)
        stmt.bind(params)
        stmt.step()
        stmt.free()
        const changes = this.db.getRowsModified()
        this.scheduleSave()
        return { changes }
      },

      get: (...params: unknown[]): Record<string, unknown> | undefined => {
        const stmt = this.db.prepare(sql)
        stmt.bind(params)
        if (stmt.step()) {
          const row = stmt.getAsObject() as Record<string, unknown>
          stmt.free()
          return row
        }
        stmt.free()
        return undefined
      },

      all: (...params: unknown[]): Record<string, unknown>[] => {
        const stmt = this.db.prepare(sql)
        stmt.bind(params)
        const rows: Record<string, unknown>[] = []
        while (stmt.step()) {
          rows.push(stmt.getAsObject() as Record<string, unknown>)
        }
        stmt.free()
        return rows
      }
    }
  }

  exec(sql: string): void {
    this.db.exec(sql)
    this.scheduleSave()
  }

  run(sql: string, params?: unknown[]): void {
    if (params) {
      const stmt = this.db.prepare(sql)
      stmt.bind(params)
      stmt.step()
      stmt.free()
    } else {
      this.db.run(sql)
    }
    this.scheduleSave()
  }

  close(): void {
    this.flushWrites()
    this.db.close()
  }

  transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T {
    return (...args: unknown[]) => {
      this.batchSaving = true
      this.run('BEGIN')
      try {
        const result = fn(...args)
        this.run('COMMIT')
        this.batchSaving = false
        // Durabilidad: una transacción completada se persiste de inmediato,
        // sin esperar la ventana de debounce.
        this.saveNow()
        return result
      } catch (e) {
        this.run('ROLLBACK')
        this.batchSaving = false
        this.saveNow()
        throw e
      }
    }
  }

  export(): Buffer {
    return Buffer.from(this.db.export())
  }

  private scheduleSave(): void {
    if (this.batchSaving) return
    if (this.pendingSaveTimer) return
    this.pendingSaveTimer = setTimeout(() => {
      this.pendingSaveTimer = null
      if (this.batchSaving) return
      this.saveNow()
    }, SqlJsDatabase.SAVE_DEBOUNCE_MS)
    // Evita colgar el proceso (tests) por un timer pendiente.
    this.pendingSaveTimer.unref?.()
  }

  /** Vuelca a disco de inmediato cualquier guardado pendiente. */
  flushWrites(): void {
    if (this.pendingSaveTimer) {
      clearTimeout(this.pendingSaveTimer)
      this.pendingSaveTimer = null
    }
    this.saveNow()
  }

  private saveNow(): void {
    try {
      const data = this.db.export()
      writeFileSync(this.filePath, Buffer.from(data))
    } catch (err) {
      log.error('Failed to save database:', err)
    }
  }
}

let db: SqlJsDatabase | null = null
let sqlInitPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null

function getSqlJs(): Promise<Awaited<ReturnType<typeof initSqlJs>>> {
  if (!sqlInitPromise) {
    sqlInitPromise = initSqlJs()
  }
  return sqlInitPromise!
}

export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'bodyfitgym.db')
  log.info('Database path:', dbPath)
  return dbPath
}

export async function initDatabase(): Promise<SqlJsDatabase> {
  if (db) return db

  const dbPath = getDatabasePath()
  const dbDir = join(dbPath, '..')

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  const Sql = await getSqlJs()

  try {
    let buffer: Buffer | null = null
    if (existsSync(dbPath)) {
      buffer = readFileSync(dbPath)
    }
    db = new SqlJsDatabase(buffer, dbPath, Sql)
    db.run('PRAGMA foreign_keys = ON')
  } catch (err) {
    log.warn('Database error, attempting recovery by recreating...', err)

    if (db) {
      try { db.close() } catch { log.error('Error closing corrupted database') }
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

    db = new SqlJsDatabase(null, dbPath, Sql)
    db.run('PRAGMA foreign_keys = ON')
  }

  runMigrations(db)

  return db
}

function runMigrations(db: SqlJsDatabase): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  const appliedRows = db.prepare('SELECT name FROM _migrations').all() as { name: string }[]
  const appliedSet = new Set(appliedRows.map(r => r.name))

  const runAll = db.transaction(() => {
    for (const migration of MIGRATIONS) {
      if (!appliedSet.has(migration.name)) {
        migration.run(db)
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name)
        log.info(`Migration applied: ${migration.name}`)
      }
    }
  })

  runAll()
  log.info('Database migrations completed')
}

export function getDatabase(): SqlJsDatabase {
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
      db.close()
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

    const srcData = readFileSync(srcPath)
    const Sql = await getSqlJs()
    copyFileSync(srcPath, destPath)
    db = new SqlJsDatabase(srcData, destPath, Sql)
    db.run('PRAGMA foreign_keys = ON')
    runMigrations(db)
    log.info('Database restored successfully')
    return true
  } catch (error) {
    log.error('Restore error:', error)
    if (!db) {
      try {
        const Sql = await getSqlJs()
        const destPath = getDatabasePath()
        let buffer: Buffer | null = null
        if (existsSync(destPath)) {
          buffer = readFileSync(destPath)
        }
        db = new SqlJsDatabase(buffer, destPath, Sql)
        db.run('PRAGMA foreign_keys = ON')
      } catch (e) {
        log.error('Failed to reopen database after restore error:', e)
      }
    }
    return false
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    log.info('Database closed')
  }
}
