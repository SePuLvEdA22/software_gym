import bcrypt from 'bcryptjs'
import type { Migration } from './types'

export const m006SeedDefaultData: Migration = {
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
}
