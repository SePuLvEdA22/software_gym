import type { Migration } from './types'

export const m003AddDiscountToPayments: Migration = {
  name: '003_add_discount_to_payments',
  run: (db) => {
    const columns = db.prepare('PRAGMA table_info(payments)').all() as Array<{ name: string }>
    if (!columns.some(c => c.name === 'discount')) {
      db.exec('ALTER TABLE payments ADD COLUMN discount REAL DEFAULT 0')
    }
  }
}
