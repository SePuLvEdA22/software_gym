import type { Migration } from './types'

export const m012AddIndexesAndThumbnails: Migration = {
  name: '012_add_indexes_and_thumbnails',
  run: (db) => {
    // Índices de rendimiento: las subconsultas correlacionadas del dashboard
    // (clientes inactivos, deudores, horas pico) hacían full-scans sobre
    // access_logs/payments sin índice por cliente/membresía.
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_access_logs_client ON access_logs(client_id);
      CREATE INDEX IF NOT EXISTS idx_access_logs_result_timestamp ON access_logs(result, timestamp);
      CREATE INDEX IF NOT EXISTS idx_payments_membership ON payments(membership_id);
    `)

    // Columna para thumbnails de fotos: los listados leen la miniatura
    // (unos KB) en vez de la foto completa (cientos de KB) por cada cliente.
    const columns = db.prepare('PRAGMA table_info(clients)').all() as Array<{ name: string }>
    if (!columns.some(c => c.name === 'thumbnail_path')) {
      db.exec('ALTER TABLE clients ADD COLUMN thumbnail_path TEXT')
    }
  }
}
