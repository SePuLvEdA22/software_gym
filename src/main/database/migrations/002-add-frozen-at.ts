import type { Migration } from './types'

export const m002AddFrozenAt: Migration = {
  name: '002_add_frozen_at',
  run: (db) => {
    const columns = db.prepare('PRAGMA table_info(memberships)').all() as Array<{ name: string }>
    if (!columns.some(c => c.name === 'frozen_at')) {
      db.exec('ALTER TABLE memberships ADD COLUMN frozen_at TEXT')
    }
  }
}
