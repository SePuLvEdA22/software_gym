import type { Migration } from './types'

export const m005AddPromotionsTable: Migration = {
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
}
