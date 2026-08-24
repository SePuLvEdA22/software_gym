import { AccessValidation } from '../../shared/types'
import { getClientByAccessCode, updateClientStatus } from './clients'
import { getActiveOrFrozenMembership, getClientDebt } from './memberships'
import { logAccess } from './accessLogs'
import { getClientRoutines } from './routines'

/**
 * Árbol de decisión del kiosco de entrada: valida un código de acceso y
 * devuelve el resultado (denied_not_found / denied_expired / denied_frozen /
 * granted). Lógica extraída del handler IPC 'access:validate' para poder
 * probarla de forma unitaria.
 *
 * Reglas:
 * - Código desconocido → denied_not_found (se registra en access_logs).
 * - Sin membresía vigente ni congelada (vence el día o ya venció) → el cliente
 *   se marca como 'expired' y se responde denied_expired con su deuda si tiene.
 * - Membresía congelada → denied_frozen (no puede entrar mientras esté congelada).
 * - Membresía activa → granted, incluyendo rutinas y deuda pendiente si existe.
 *
 * Nota: un cliente suspendido/inactivo SIN membresía se marca 'expired' en el
 * intento (mismo camino que un cliente vencido). Un cliente suspendido/inactivo
 * CON membresía activa obtiene acceso (comportamiento histórico conservado).
 */
export function validateAccess(accessCode: string): AccessValidation {
  const client = getClientByAccessCode(accessCode)

  if (!client) {
    logAccess(accessCode, 'denied_not_found', 'Cliente no encontrado')
    return {
      valid: false,
      message: 'Cliente no encontrado',
      code: 'denied_not_found'
    }
  }

  // Los dos bloques originales del handler (inactive/suspended y el general)
  // hacían exactamente lo mismo cuando no hay membresía vigente: se colapsan
  // en una sola verificación sin cambiar el comportamiento.
  const activeOrFrozen = getActiveOrFrozenMembership(client.id)

  if (!activeOrFrozen) {
    updateClientStatus(client.id, 'expired')
    const debts = getClientDebt(client.id)
    logAccess(accessCode, 'denied_expired', 'Membresía vencida', client.id, client.fullName)
    return {
      valid: false,
      client,
      debt: debts.length > 0 ? debts : undefined,
      message: 'Membresía vencida',
      code: 'denied_expired'
    }
  }

  if (activeOrFrozen.status === 'frozen') {
    const debts = getClientDebt(client.id)
    logAccess(accessCode, 'denied_frozen', 'Membresía congelada', client.id, client.fullName)
    return {
      valid: false,
      client,
      membership: activeOrFrozen,
      debt: debts.length > 0 ? debts : undefined,
      message: 'Membresía congelada - contacta recepción',
      code: 'denied_frozen'
    }
  }

  const membership = activeOrFrozen
  const debts = getClientDebt(client.id)
  const routines = getClientRoutines(client.id)

  logAccess(accessCode, 'granted', 'Acceso permitido', client.id, client.fullName)

  return {
    valid: true,
    client,
    membership,
    debt: debts.length > 0 ? debts : undefined,
    routines,
    message: `Bienvenido ${client.fullName}`,
    code: 'granted'
  }
}
