import type { Migration } from './types'

export const m014FreezeHistoryUnfrozenBy: Migration = {
  name: '014_freeze_history_unfrozen_by',
  run: (db) => {
    // Distinción entre descongelado manual y automático (por días
    // planeados). Filas legacy quedan en NULL y se muestran como manuales.
    const columns = db.prepare('PRAGMA table_info(freeze_history)').all() as Array<{ name: string }>
    if (!columns.some(c => c.name === 'unfrozen_by')) {
      db.exec('ALTER TABLE freeze_history ADD COLUMN unfrozen_by TEXT')
    }
  }
}
