import bcrypt from 'bcryptjs'
import log from 'electron-log'
import type { Migration } from './types'

export const m011ForcePasswordChange: Migration = {
  name: '011_force_password_change',
  run: (db) => {
    // Seguridad: si el administrador aún usa la contraseña por defecto
    // (admin123), se marca la bandera must_change_password para forzar su
    // cambio en el primer inicio de sesión. Instalaciones donde ya se
    // cambió la contraseña quedan con la bandera en 0.
    const insert = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    const adminRow = db.prepare("SELECT password_hash FROM users WHERE id = 'user_admin'").get() as
      | { password_hash: string }
      | undefined
    const usesDefaultPassword = !!adminRow && bcrypt.compareSync('admin123', adminRow.password_hash)
    insert.run('must_change_password', usesDefaultPassword ? '1' : '0')
    log.info(`Migration 011: must_change_password = ${usesDefaultPassword ? '1' : '0'}`)
  }
}
