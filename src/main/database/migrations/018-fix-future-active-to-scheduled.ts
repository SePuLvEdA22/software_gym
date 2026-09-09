import type { Migration } from './types'

export const m018FixFutureActiveToScheduled: Migration = {
  name: '018_fix_future_active_to_scheduled',
  run: (db) => {
    // Corrige membresías que nacieron 'active' con start en el futuro (bug hasFutureActive >)
    // Deben ser 'scheduled' hasta su fecha de inicio.
    try {
      db.prepare(`
        UPDATE memberships
        SET status = 'scheduled', updated_at = datetime('now','localtime')
        WHERE status = 'active' AND substr(start_date, 1, 10) > date('now','localtime')
      `).run()
    } catch {
      void 0
    }
    try {
      const today = new Date().toISOString().slice(0, 10)
      const rows = db.prepare(`SELECT id, start_date FROM memberships WHERE status = 'active'`).all() as Array<{ id: string; start_date: string }>
      for (const r of rows) {
        if (r.start_date.slice(0, 10) > today) {
          try {
            db.prepare(`UPDATE memberships SET status = 'scheduled', updated_at = ? WHERE id = ?`).run(new Date().toISOString(), r.id)
          } catch {
            void 0
          }
        }
      }
    } catch {
      void 0
    }
  }
}
