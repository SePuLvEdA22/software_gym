import type { Migration } from './types'

export const m004AddFreezeReasonAndDays: Migration = {
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
}
