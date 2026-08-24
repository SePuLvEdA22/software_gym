import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, copyFileSync, unlinkSync, writeFileSync, readFileSync } from 'fs'
import bcrypt from 'bcryptjs'
import log from 'electron-log'
// @ts-expect-error sql.js has no type declarations
import initSqlJs from 'sql.js'
import { ROLE_DEFAULT_PERMISSIONS } from '../../shared/permissions'
import type { UserRole } from '../../shared/types'

type SqlJsDb = Awaited<ReturnType<typeof initSqlJs>> extends { Database: infer D } ? D : never

interface StatementWrapper {
  run(...params: unknown[]): { changes: number }
  get(...params: unknown[]): Record<string, unknown> | undefined
  all(...params: unknown[]): Record<string, unknown>[]
}

class SqlJsDatabase {
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

  interface Migration {
    name: string
    run: (db: SqlJsDatabase) => void
  }

  const migrations: Migration[] = [
    {
      name: '001_initial_schema',
      run: (db) => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS clients (
            id TEXT PRIMARY KEY, full_name TEXT NOT NULL, document_id TEXT UNIQUE,
            birth_date TEXT, gender TEXT DEFAULT 'not_specified', phone TEXT,
            email TEXT, address TEXT, photo BLOB, registration_date TEXT NOT NULL,
            access_code TEXT UNIQUE NOT NULL, status TEXT DEFAULT 'inactive',
            emergency_name TEXT, emergency_phone TEXT, emergency_relationship TEXT,
            emergency_notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS membership_plans (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
            price REAL NOT NULL, duration_days INTEGER NOT NULL, description TEXT,
            is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS memberships (
            id TEXT PRIMARY KEY, client_id TEXT NOT NULL, plan_id TEXT NOT NULL,
            plan_name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
            status TEXT DEFAULT 'active', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id),
            FOREIGN KEY (plan_id) REFERENCES membership_plans(id)
          );
          CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY, client_id TEXT, membership_id TEXT,
            amount REAL NOT NULL, method TEXT NOT NULL, description TEXT,
            date TEXT NOT NULL, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id),
            FOREIGN KEY (membership_id) REFERENCES memberships(id)
          );
          CREATE TABLE IF NOT EXISTS access_logs (
            id TEXT PRIMARY KEY, client_id TEXT, client_name TEXT,
            access_code TEXT NOT NULL, access_type TEXT DEFAULT 'check_in',
            result TEXT NOT NULL, message TEXT, timestamp TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS whatsapp_messages (
            id TEXT PRIMARY KEY, client_id TEXT NOT NULL, phone TEXT NOT NULL,
            message_type TEXT NOT NULL, message TEXT NOT NULL, status TEXT DEFAULT 'pending',
            scheduled_for TEXT, sent_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id)
          );
          CREATE TABLE IF NOT EXISTS door_events (
            id TEXT PRIMARY KEY, event_type TEXT NOT NULL, trigger TEXT NOT NULL,
            timestamp TEXT NOT NULL, notes TEXT
          );
          CREATE TABLE IF NOT EXISTS freeze_history (
            id TEXT PRIMARY KEY, membership_id TEXT NOT NULL, client_id TEXT NOT NULL,
            frozen_at TEXT NOT NULL, unfrozen_at TEXT, reason TEXT,
            planned_days INTEGER, actual_days INTEGER,
            FOREIGN KEY (membership_id) REFERENCES memberships(id),
            FOREIGN KEY (client_id) REFERENCES clients(id)
          );
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_clients_access_code ON clients(access_code);
          CREATE INDEX IF NOT EXISTS idx_clients_document ON clients(document_id);
          CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
          CREATE INDEX IF NOT EXISTS idx_memberships_client ON memberships(client_id);
          CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);
          CREATE INDEX IF NOT EXISTS idx_memberships_end_date ON memberships(end_date);
          CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp);
          CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
          CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
          CREATE INDEX IF NOT EXISTS idx_freeze_history_membership ON freeze_history(membership_id);
        `)
      }
    },
    {
      name: '002_add_frozen_at',
      run: (db) => {
        const columns = db.prepare('PRAGMA table_info(memberships)').all() as Array<{ name: string }>
        if (!columns.some(c => c.name === 'frozen_at')) {
          db.exec('ALTER TABLE memberships ADD COLUMN frozen_at TEXT')
        }
      }
    },
    {
      name: '003_add_discount_to_payments',
      run: (db) => {
        const columns = db.prepare('PRAGMA table_info(payments)').all() as Array<{ name: string }>
        if (!columns.some(c => c.name === 'discount')) {
          db.exec('ALTER TABLE payments ADD COLUMN discount REAL DEFAULT 0')
        }
      }
    },
    {
      name: '004_add_freeze_reason_and_days',
      run: (db) => {
        const columns = db.prepare('PRAGMA table_info(memberships)').all() as Array<{ name: string }>
        if (!columns.some(c => c.name === 'freeze_reason')) {
          db.exec('ALTER TABLE memberships ADD COLUMN freeze_reason TEXT')
        }
        if (!columns.some(c => c.name === 'freeze_days')) {
          db.exec('ALTER TABLE memberships ADD COLUMN freeze_days INTEGER')
        }
      }
    },
    {
      name: '005_add_promotions_table',
      run: (db) => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS promotions (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, plan_id TEXT NOT NULL,
            discount_type TEXT NOT NULL, discount_value REAL NOT NULL,
            start_date TEXT NOT NULL, end_date TEXT NOT NULL,
            is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (plan_id) REFERENCES membership_plans(id)
          );
        `)
      }
    },
    {
      name: '006_seed_default_data',
      run: (db) => {
        const insertSettings = db.prepare(`
          INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `)
        insertSettings.run('door_open_duration', '5000')
        insertSettings.run('reminder_3days', '1')
        insertSettings.run('reminder_1day', '1')
        insertSettings.run('reminder_sameday', '1')
        insertSettings.run('admin_username', 'admin')
        insertSettings.run('admin_password', bcrypt.hashSync('admin123', 10))
      }
    },
    {
      name: '007_add_users_and_change_log',
      run: (db) => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'reception',
            permissions TEXT DEFAULT '[]',
            is_active INTEGER DEFAULT 1,
            last_login TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS change_log (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            user_name TEXT NOT NULL,
            table_name TEXT NOT NULL,
            record_id TEXT NOT NULL,
            action TEXT NOT NULL,
            old_values TEXT,
            new_values TEXT,
            timestamp TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS client_number_seq (
            id INTEGER PRIMARY KEY,
            last_number INTEGER NOT NULL DEFAULT 1000
          );
          CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT DEFAULT '',
            price REAL NOT NULL DEFAULT 0,
            cost REAL NOT NULL DEFAULT 0,
            stock INTEGER NOT NULL DEFAULT 0,
            min_stock INTEGER NOT NULL DEFAULT 5,
            barcode TEXT DEFAULT '',
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS inventory_movements (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL,
            product_name TEXT NOT NULL,
            type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL DEFAULT 0,
            total REAL DEFAULT 0,
            description TEXT,
            user_id TEXT,
            user_name TEXT,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (product_id) REFERENCES products(id)
          );
          CREATE TABLE IF NOT EXISTS body_measurements (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            date TEXT NOT NULL,
            weight REAL,
            height REAL,
            neck REAL,
            shoulders REAL,
            chest REAL,
            left_arm REAL,
            right_arm REAL,
            waist REAL,
            hips REAL,
            left_thigh REAL,
            right_thigh REAL,
            left_calf REAL,
            right_calf REAL,
            body_fat REAL,
            notes TEXT DEFAULT '',
            FOREIGN KEY (client_id) REFERENCES clients(id)
          );
          CREATE TABLE IF NOT EXISTS client_goals (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            goal TEXT NOT NULL,
            start_date TEXT NOT NULL,
            target_date TEXT,
            notes TEXT DEFAULT '',
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id)
          );
          CREATE TABLE IF NOT EXISTS message_templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            subject TEXT DEFAULT '',
            content TEXT NOT NULL,
            variables TEXT DEFAULT '[]',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_change_log_timestamp ON change_log(timestamp);
          CREATE INDEX IF NOT EXISTS idx_change_log_table ON change_log(table_name);
          CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
          CREATE INDEX IF NOT EXISTS idx_body_measurements_client ON body_measurements(client_id);
          CREATE INDEX IF NOT EXISTS idx_client_goals_client ON client_goals(client_id);
        `)

        const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number })?.count ?? 0
        if (userCount === 0) {
          const oldAdmin = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get() as { value: string } | undefined
          const passwordHash = oldAdmin ? oldAdmin.value : bcrypt.hashSync('admin123', 10)
          db.prepare(`
            INSERT INTO users (id, username, full_name, password_hash, role, permissions, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
          `).run('user_admin', 'admin', 'Administrador', passwordHash, 'admin', '["*"]')
        }

        const seqCount = (db.prepare('SELECT COUNT(*) as count FROM client_number_seq').get() as { count: number })?.count ?? 0
        if (seqCount === 0) {
          db.prepare('INSERT INTO client_number_seq (id, last_number) VALUES (1, 1000)').run()
        }
      }
    },
    {
      name: '008_migrate_photos_to_files',
      run: (db) => {
        const columns = db.prepare('PRAGMA table_info(clients)').all() as Array<{ name: string }>
        const hasPhoto = columns.some(c => c.name === 'photo')
        const hasPhotoPath = columns.some(c => c.name === 'photo_path')

        if (!hasPhotoPath) {
          db.exec('ALTER TABLE clients ADD COLUMN photo_path TEXT')
        }

        if (hasPhoto && hasPhotoPath) {
          const photosDir = join(app.getPath('userData'), 'photos')
          if (!existsSync(photosDir)) {
            mkdirSync(photosDir, { recursive: true })
          }

          const clientsWithPhoto = db.prepare("SELECT id, photo FROM clients WHERE photo IS NOT NULL").all() as Array<{ id: string; photo: Buffer }>

          for (const client of clientsWithPhoto) {
            try {
              const fileName = `${client.id}.jpg`
              const filePath = join(photosDir, fileName)
              writeFileSync(filePath, client.photo)
              db.prepare('UPDATE clients SET photo_path = ? WHERE id = ?').run(filePath, client.id)
            } catch (err) {
              log.error(`Failed to export photo for client ${client.id}:`, err)
            }
          }

          const photoCount = clientsWithPhoto.length
          log.info(`Exported ${photoCount} client photos to ${photosDir}`)
        }
      }
    },
    {
      name: '009_add_routines_and_gym_settings',
      run: (db) => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS client_routines (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            day_of_week INTEGER NOT NULL,
            exercises TEXT NOT NULL DEFAULT '[]',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id)
          );
          CREATE INDEX IF NOT EXISTS idx_routines_client_day ON client_routines(client_id, day_of_week);
        `)

        const gymName = db.prepare("SELECT value FROM settings WHERE key = 'gym_name'").get() as { value: string } | undefined
        if (!gymName) {
          const insert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)")
          insert.run('gym_name', 'BODYFITGYM')
          insert.run('gym_address', 'AV 4 CALLE 4 Y 5 MOLINOS DEL NORTE')
          insert.run('gym_phone', '3124962338')
          insert.run('gym_welcome_message', 'Bienvenido, nos complace que seas parte de nuestro equipo.')
        }
      }
    },
    {
      name: '010_update_welcome_message',
      run: (db) => {
        const update = db.prepare(`
          INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `)
        update.run('gym_welcome_message', 'Bienvenido, nos complace que seas parte de nuestro equipo.')
      }
    },
    {
      name: '011_force_password_change',
      run: (db) => {
        // Seguridad: si el administrador aún usa la contraseña por defecto
        // (admin123), se marca la bandera must_change_password para forzar su
        // cambio en el primer inicio de sesión. Instalaciones donde ya se
        // cambió la contraseña quedan con la bandera en 0.
        const insert = db.prepare(`
          INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `)
        const adminRow = db.prepare("SELECT password_hash FROM users WHERE id = 'user_admin'").get() as
          | { password_hash: string }
          | undefined
        const usesDefaultPassword = !!adminRow && bcrypt.compareSync('admin123', adminRow.password_hash)
        insert.run('must_change_password', usesDefaultPassword ? '1' : '0')
        log.info(`Migration 011: must_change_password = ${usesDefaultPassword ? '1' : '0'}`)
      }
    },
    {
      name: '012_add_indexes_and_thumbnails',
      run: (db) => {
        // Índices de rendimiento: las subconsultas correlacionadas del dashboard
        // (clientes inactivos, deudores, horas pico) hacían full-scans sobre
        // access_logs/payments sin índice por cliente/membresía.
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_access_logs_client ON access_logs(client_id);
          CREATE INDEX IF NOT EXISTS idx_access_logs_result_timestamp ON access_logs(result, timestamp);
          CREATE INDEX IF NOT EXISTS idx_payments_membership ON payments(membership_id);
        `)

        // Columna para thumbnails de fotos: los listados leen la miniatura
        // (unos KB) en vez de la foto completa (cientos de KB) por cada cliente.
        const columns = db.prepare('PRAGMA table_info(clients)').all() as Array<{ name: string }>
        if (!columns.some(c => c.name === 'thumbnail_path')) {
          db.exec('ALTER TABLE clients ADD COLUMN thumbnail_path TEXT')
        }
      }
    },
    {
      name: '013_backfill_user_permissions',
      run: (db) => {
        // Los permisos granulares ahora se verifican en los handlers IPC y en
        // el menú. Los usuarios creados antes de activarse la verificación
        // tienen el array vacío: se les asignan los defaults de su rol para no
        // perder acceso tras la actualización.
        const rows = db.prepare("SELECT id, role FROM users WHERE permissions = '[]' OR permissions IS NULL").all() as Array<{ id: string; role: string }>
        const update = db.prepare('UPDATE users SET permissions = ? WHERE id = ?')
        for (const row of rows) {
          const perms = ROLE_DEFAULT_PERMISSIONS[row.role as UserRole] ?? []
          update.run(JSON.stringify(perms), row.id)
        }
        log.info(`Migration 013: permisos por defecto asignados a ${rows.length} usuario(s)`)
      }
    },
    {
      name: '014_freeze_history_unfrozen_by',
      run: (db) => {
        // Distinción entre descongelado manual y automático (por días
        // planeados). Filas legacy quedan en NULL y se muestran como manuales.
        const columns = db.prepare('PRAGMA table_info(freeze_history)').all() as Array<{ name: string }>
        if (!columns.some(c => c.name === 'unfrozen_by')) {
          db.exec('ALTER TABLE freeze_history ADD COLUMN unfrozen_by TEXT')
        }
      }
    }
  ]

  const runAll = db.transaction(() => {
    for (const migration of migrations) {
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
