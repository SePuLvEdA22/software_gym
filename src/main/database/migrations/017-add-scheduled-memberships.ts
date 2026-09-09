import type { Migration } from './types'

export const m017AddScheduledMemberships: Migration = {
  name: '017_add_scheduled_memberships',
  run: (db) => {
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_memberships_scheduled ON memberships(client_id) WHERE status = 'scheduled'`)
    } catch {
      // best-effort, no crítico si falla en filesystems que no soportan índices parciales
    }
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_memberships_start_date ON memberships(start_date)`)
    } catch {}
  }
}
