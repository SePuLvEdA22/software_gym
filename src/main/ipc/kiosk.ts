import { ipcMain } from 'electron'
import log from 'electron-log'
import { getClientById } from '../database/clients'
import {
  getAllPlans,
  getClientMemberships,
  getPlanById,
  getEffectivePrice,
  createMembershipWithPayment
} from '../database/memberships'
import { getWhatsappConfig, sendWelcomeMessage, sendPaymentConfirmation } from '../whatsapp/index'
import { sanitizeError } from '../helpers'

/**
 * Canales públicos del kiosco.
 *
 * Las ventanas del kiosco corren sin sesión de usuario: el acceso físico se
 * valida por código de acceso. Aquí se expone ÚNICAMENTE lo que necesita el
 * flujo de auto-renovación; el resto del dominio permanece protegido por
 * requirePermission en los módulos correspondientes.
 */
export function registerKioskHandlers(): void {
  ipcMain.handle('kiosk:getRenewalInfo', async (_, clientId) => {
    try {
      const client = getClientById(clientId)
      if (!client) return { success: false, error: 'Cliente no encontrado' }
      const memberships = getClientMemberships(clientId)
      const active = memberships.find(
        (m: { status: string }) => m.status === 'active' || m.status === 'frozen'
      )
      const plans = getAllPlans(true)
      return {
        success: true,
        data: { client, memberships, activeMembership: active || null, plans }
      }
    } catch (error) {
      log.error('[kiosk] Error getting renewal info:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('kiosk:getEffectivePrice', async (_, planId) => {
    try {
      const plan = getPlanById(planId)
      if (!plan) return { success: false, error: 'Plan no encontrado' }
      return { success: true, data: getEffectivePrice(plan) }
    } catch (error) {
      log.error('[kiosk] Error getting effective price:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })

  ipcMain.handle('kiosk:createRenewal', async (_, clientId, planId, amount, method, startDateIso, notes, discount) => {
    try {
      // El plan debe existir y estar activo: no se confía ciegamente en el renderer.
      const plan = getPlanById(planId)
      if (!plan || !plan.isActive) return { success: false, error: 'Plan no disponible' }

      const result = createMembershipWithPayment(clientId, planId, amount, method, startDateIso, notes ?? 'Renovación en kiosco', discount)

      if (result.membership && getWhatsappConfig().enabled) {
        sendWelcomeMessage(clientId).catch(err => log.error('Error sending welcome:', err))
        sendPaymentConfirmation(clientId, result.membership.planName, result.membership.endDate)
          .catch(err => log.error('Error sending payment confirmation:', err))
      }

      return { success: !!result.membership, data: result, error: result.error }
    } catch (error) {
      log.error('[kiosk] Error creating renewal:', error)
      return { success: false, error: sanitizeError(error) }
    }
  })
}
