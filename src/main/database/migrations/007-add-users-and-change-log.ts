import bcrypt from 'bcryptjs'
import type { Migration } from './types'

export const m007AddUsersAndChangeLog: Migration = {
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
}
