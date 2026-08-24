import type { Migration } from './types'

export const m010UpdateWelcomeMessage: Migration = {
  name: '010_update_welcome_message',
  run: (db) => {
    const update = db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `)
    update.run('gym_welcome_message', 'Bienvenido, nos complace que seas parte de nuestro equipo.')
  }
}
