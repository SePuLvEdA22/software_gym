import log from 'electron-log'
import type { Migration } from './types'

const NEW_PERMISSION = 'payments.edit_method'
// Roles que deben poder corregir el método de pago sin ver el módulo de pagos.
// El trainer lo recibe sin payments.view/create (selector ciego a montos);
// reception/accounting ya ven pagos y solo suman la capacidad de edición.
const ROLES_TO_GRANT = ['reception', 'trainer', 'accounting']

export const m019GrantEditPaymentMethod: Migration = {
  name: '019_grant_edit_payment_method',
  run: (db) => {
    // Merge aditivo e idempotente: agrega el permiso a usuarios existentes
    // de los roles indicados sin quitar ni sobrescribir personalizaciones.
    // A diferencia de la 013 (solo backfill de arrays vacíos), esta corre
    // sobre cualquier array no vacío que aún no contenga el permiso.
    const rows = db.prepare('SELECT id, role, permissions FROM users').all() as Array<{
      id: string
      role: string
      permissions: string | null
    }>
    const update = db.prepare('UPDATE users SET permissions = ? WHERE id = ?')
    let granted = 0
    for (const row of rows) {
      if (!ROLES_TO_GRANT.includes(row.role)) continue
      let perms: string[]
      try {
        perms = JSON.parse(row.permissions || '[]')
        if (!Array.isArray(perms)) perms = []
      } catch {
        perms = []
      }
      if (perms.includes(NEW_PERMISSION)) continue
      perms.push(NEW_PERMISSION)
      update.run(JSON.stringify(perms), row.id)
      granted += 1
    }
    log.info(`Migration 019: permiso ${NEW_PERMISSION} otorgado a ${granted} usuario(s)`)
  }
}
