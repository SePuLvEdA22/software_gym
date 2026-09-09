import type { Migration } from './types'

export const m016AddMembershipUpdatedAt: Migration = {
  name: '016_add_membership_updated_at',
  run: (db) => {
    try {
      db.exec(`ALTER TABLE memberships ADD COLUMN updated_at TEXT`)
    } catch {
      // Columna ya existe (migración idempotente)
    }
  }
}
