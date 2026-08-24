import type { Migration } from './types'

export const m001InitialSchema: Migration = {
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
}
