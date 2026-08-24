import type { NativeDatabase } from '../index'

/**
 * Contrato de una migración de esquema. Cada archivo en esta carpeta exporta
 * una constante que implementa esta interfaz; el runner las aplica en orden
 * dentro de una transacción y registra el nombre en la tabla `_migrations`.
 */
export interface Migration {
  name: string
  run: (db: NativeDatabase) => void
}
