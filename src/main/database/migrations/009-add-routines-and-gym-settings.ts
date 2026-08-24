import type { Migration } from './types'

export const m009AddRoutinesAndGymSettings: Migration = {
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
}
