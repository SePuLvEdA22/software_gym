import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, copyFileSync } from 'fs'
import bcrypt from 'bcryptjs'
import log from 'electron-log'

let db: Database.Database | null = null

export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'bodyfitgym.db')
  log.info('Database path:', dbPath)
  return dbPath
}

export function initDatabase(): Database.Database {
  if (db) return db

  const dbPath = getDatabasePath()
  const dbDir = join(dbPath, '..')
  
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)

  return db
}

function runMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  const applied = db.prepare('SELECT name FROM _migrations').all() as { name: string }[]
  const appliedSet = new Set(applied.map(r => r.name))

  interface Migration {
    name: string
    run: (db: Database.Database) => void
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
        const count = (db.prepare('SELECT COUNT(*) as count FROM membership_plans').get() as { count: number }).count
        if (count > 0) return

        const insertPlan = db.prepare(`
          INSERT INTO membership_plans (id, name, type, price, duration_days, description)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        const plans = [
          ['plan_diario', 'Diario', 'daily', 15000, 1, 'Acceso por un día'],
          ['plan_semanal', 'Semanal', 'weekly', 60000, 7, 'Acceso por una semana'],
          ['plan_15dias', '15 Días', 'biweekly', 100000, 15, 'Acceso por 15 días'],
          ['plan_mensual', 'Mensual', 'monthly', 180000, 30, 'Acceso por un mes'],
          ['plan_trimestral', 'Trimestral', 'quarterly', 480000, 90, 'Acceso por 3 meses'],
          ['plan_semestral', 'Semestral', 'semiannual', 900000, 180, 'Acceso por 6 meses'],
          ['plan_anual', 'Anual', 'annual', 1600000, 365, 'Acceso por un año']
        ]
        for (const plan of plans) insertPlan.run(...plan)

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

export function getDatabase(): Database.Database {
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
    db.pragma('wal_checkpoint(TRUNCATE)')
    db.exec(`VACUUM INTO '${destPath.replace(/'/g, "''")}'`)
    log.info(`Database backed up to: ${destPath}`)
    return true
  } catch (error: any) {
    log.error('Backup error:', error)
    return false
  }
}

export function restoreDatabase(srcPath: string): boolean {
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
      log.info(`Existing database backed up to: ${backupPath}`)
    }
    copyFileSync(srcPath, destPath)
    db = new Database(getDatabasePath())
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    log.info('Database restored successfully')
    return true
  } catch (error: any) {
    log.error('Restore error:', error)
    if (!db) {
      try {
        db = new Database(getDatabasePath())
        db.pragma('journal_mode = WAL')
        db.pragma('foreign_keys = ON')
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
