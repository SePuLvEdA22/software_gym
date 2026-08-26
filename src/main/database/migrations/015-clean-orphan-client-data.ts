import log from 'electron-log'
import type { Migration } from './types'

export const m015CleanOrphanClientData: Migration = {
  name: '015_clean_orphan_client_data',
  run: (db) => {
    // Limpia huérfanos dejados por deleteClient incompleto antes del fix
    // (body_measurements, client_goals, client_routines no se borraban, dejando
    // filas con client_id inexistente que violan FK con foreign_keys=ON y
    // fragmentan índices → agravaba el error "database disk image is malformed").
    const tables = ['body_measurements', 'client_goals', 'client_routines']
    for (const table of tables) {
      try {
        const result = db
          .prepare(`DELETE FROM ${table} WHERE client_id NOT IN (SELECT id FROM clients)`)
          .run() as unknown as { changes: number }
        // StatementWrapper.run retorna {changes}, pero algunas versiones lo
        // exponen como number; loguear de forma segura.
        const changes = (result as { changes?: number })?.changes ?? 0
        if (changes > 0) {
          log.info(`Migration 015: cleaned ${changes} orphan rows from ${table}`)
        }
      } catch (err) {
        // Tabla puede no existir en BDs muy antiguas; no bloquear migración.
        log.warn(`Migration 015: could not clean ${table}:`, err)
      }
    }
  }
}
