import log from 'electron-log'
import { ROLE_DEFAULT_PERMISSIONS } from '../../../shared/permissions'
import type { UserRole } from '../../../shared/types'
import type { Migration } from './types'

export const m013BackfillUserPermissions: Migration = {
  name: '013_backfill_user_permissions',
  run: (db) => {
    // Los permisos granulares ahora se verifican en los handlers IPC y en
    // el menú. Los usuarios creados antes de activarse la verificación
    // tienen el array vacío: se les asignan los defaults de su rol para no
    // perder acceso tras la actualización.
    const rows = db.prepare("SELECT id, role FROM users WHERE permissions = '[]' OR permissions IS NULL").all() as Array<{ id: string; role: string }>
    const update = db.prepare('UPDATE users SET permissions = ? WHERE id = ?')
    for (const row of rows) {
      const perms = ROLE_DEFAULT_PERMISSIONS[row.role as UserRole] ?? []
      update.run(JSON.stringify(perms), row.id)
    }
    log.info(`Migration 013: permisos por defecto asignados a ${rows.length} usuario(s)`)
  }
}
