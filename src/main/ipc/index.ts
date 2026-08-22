import log from 'electron-log'
import { registerAuthHandlers } from './auth'
import { registerUserHandlers } from './users'
import { registerClientHandlers } from './clients'
import { registerMembershipHandlers } from './memberships'
import { registerAccessHandlers } from './access'
import { registerDashboardHandlers } from './dashboard'
import { registerDoorHandlers } from './door'
import { registerKioskHandlers } from './kiosk'
import { registerSystemHandlers } from './system'
import { registerPromotionHandlers } from './promotions'
import { registerWhatsappHandlers } from './whatsapp'
import { registerBackupHandlers } from './backup'
import { registerInventoryHandlers } from './inventory'
import { registerBodyTrackingHandlers } from './bodyTracking'
import { registerMessageTemplateHandlers } from './messageTemplates'
import { registerSettingsHandlers } from './settings'

export function setupIpcHandlers(): void {
  registerAuthHandlers()
  registerUserHandlers()
  registerClientHandlers()
  registerMembershipHandlers()
  registerAccessHandlers()
  registerDashboardHandlers()
  registerDoorHandlers()
  registerKioskHandlers()
  registerSystemHandlers()
  registerPromotionHandlers()
  registerWhatsappHandlers()
  registerBackupHandlers()
  registerInventoryHandlers()
  registerBodyTrackingHandlers()
  registerMessageTemplateHandlers()
  registerSettingsHandlers()

  log.info('IPC handlers registered')
}
