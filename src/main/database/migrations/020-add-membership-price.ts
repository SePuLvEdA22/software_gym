import type { Migration } from './types'

/**
 * Cada membresía guarda el valor con que se vendió (precio del plan en ese
 * momento). Así el saldo y el tope de "Valor pagado" no cambian si después
 * se modifica el precio del plan. Las existentes se llenan con el precio
 * actual de su plan (mejor aproximación disponible).
 */
export const m020AddMembershipPrice: Migration = {
  name: '020_add_membership_price',
  run: (db) => {
    try {
      db.exec('ALTER TABLE memberships ADD COLUMN price REAL')
    } catch {
      // Columna ya existe (migración idempotente)
    }
    db.exec(`
      UPDATE memberships
      SET price = (SELECT price FROM membership_plans WHERE id = memberships.plan_id)
      WHERE price IS NULL
    `)
  },
}
