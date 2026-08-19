import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { formatISO, addDays } from 'date-fns'
import { initDatabase, closeDatabase, getDatabase } from '../main/database/index'
import { createClient } from '../main/database/clients'
import { createPlan, createMembership } from '../main/database/memberships'
import {
  generatePaymentConfirmationMessage,
  generateExpiryReminderMessage,
  generateExpiredMessage,
  generateWelcomeMessage,
  formatPhoneNumber,
  updateWhatsappConfig,
  sendMessage,
  getMessageHistory,
  checkAndSendExpiryReminders,
} from '../main/whatsapp/index'
import type { Client } from '../shared/types'

const sampleClient: Omit<Client, 'id' | 'registrationDate'> = {
  fullName: 'Ana Gómez',
  documentId: '99887766',
  birthDate: '1995-08-20',
  gender: 'female',
  phone: '3001234567',
  email: 'ana@example.com',
  address: 'Calle 1 #2-3',
  photo: null,
  accessCode: '777888',
  status: 'active',
  emergencyContact: { name: '', phone: '', relationship: '', notes: '' },
}

describe('WhatsApp Module', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  // Aislar el estado de configuración entre tests
  beforeEach(() => {
    updateWhatsappConfig({ enabled: false, provider: 'mock' })
  })

  describe('Generadores de mensajes', () => {
    it('debería generar mensaje de confirmación de pago con fecha formateada', () => {
      const msg = generatePaymentConfirmationMessage('Ana Gómez', 'Plan Mensual', '2026-09-15')
      expect(msg).toContain('Ana Gómez')
      expect(msg).toContain('Plan Mensual')
      expect(msg).toContain('septiembre de 2026')
    })

    it('debería generar recordatorio para vencimiento el mismo día', () => {
      const msg = generateExpiryReminderMessage('Ana Gómez', 0, 'Plan Mensual')
      expect(msg).toContain('vence HOY')
      expect(msg).not.toContain('Plan Mensual')
    })

    it('debería generar recordatorio para vencimiento mañana', () => {
      const msg = generateExpiryReminderMessage('Ana Gómez', 1, 'Plan Mensual')
      expect(msg).toContain('vence mañana')
    })

    it('debería generar recordatorio con días restantes y nombre del plan', () => {
      const msg = generateExpiryReminderMessage('Ana Gómez', 5, 'Plan Mensual')
      expect(msg).toContain('5 días')
      expect(msg).toContain('Plan Mensual')
    })

    it('debería generar mensaje de membresía vencida', () => {
      const msg = generateExpiredMessage('Ana Gómez')
      expect(msg).toContain('Ana Gómez')
      expect(msg).toContain('ha vencido')
    })

    it('debería generar mensaje de bienvenida con código de acceso', () => {
      const msg = generateWelcomeMessage('Ana Gómez', '777888')
      expect(msg).toContain('Ana Gómez')
      expect(msg).toContain('777888')
    })
  })

  describe('formatPhoneNumber', () => {
    it('debería devolver null para teléfono vacío', () => {
      expect(formatPhoneNumber('')).toBeNull()
      expect(formatPhoneNumber('   ')).toBeNull()
    })

    it('debería devolver null para teléfono con menos de 10 dígitos', () => {
      expect(formatPhoneNumber('123456789')).toBeNull()
      expect(formatPhoneNumber('abc')).toBeNull()
    })

    it('debería agregar prefijo 57 a números nacionales de 10 dígitos', () => {
      expect(formatPhoneNumber('3001234567')).toBe('573001234567')
    })

    it('debería limpiar caracteres no numéricos', () => {
      expect(formatPhoneNumber('(300) 123-45-67')).toBe('573001234567')
      expect(formatPhoneNumber('300 123 4567')).toBe('573001234567')
    })

    it('debería conservar números que ya tienen código de país', () => {
      expect(formatPhoneNumber('573001234567')).toBe('573001234567')
      expect(formatPhoneNumber('+57 300 123 4567')).toBe('573001234567')
    })
  })

  describe('Recordatorios de vencimiento (checkAndSendExpiryReminders)', () => {
    function makeClientWithMembership(code: string) {
      const client = createClient({
        ...sampleClient,
        documentId: `remind-${code}-${Date.now()}`,
        accessCode: code,
      })
      const plan = createPlan({ name: 'Plan Recordatorio', type: 'monthly', price: 50000, durationDays: 30, description: '' })
      createMembership(client.id, plan.id)
      return client
    }

    it('no envía nada cuando la configuración está deshabilitada', async () => {
      makeClientWithMembership('REM000')
      const result = await checkAndSendExpiryReminders()
      expect(result.sent).toBe(0)
    })

    it('envía recordatorio de 3 días y NO repite el mismo día (dedup)', async () => {
      updateWhatsappConfig({ enabled: true, provider: 'mock', reminders: { threeDays: true, oneDay: true, sameDay: true } })
      const client = makeClientWithMembership('REM003')
      // Membresía que vence exactamente en 3 días
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      getDatabase().prepare('UPDATE memberships SET end_date = ? WHERE client_id = ?').run(formatISO(addDays(todayStart, 3)), client.id)

      const first = await checkAndSendExpiryReminders()
      expect(first.sent).toBeGreaterThanOrEqual(1)

      const history = getMessageHistory({ clientId: client.id })
      const msg = history.data[0]
      expect(msg.messageType).toBe('expiry_reminder_3d')
      expect(msg.status).toBe('sent')
      expect(msg.message).toContain('3 días')

      // Segunda ejecución el mismo día: no debe duplicar
      const second = await checkAndSendExpiryReminders()
      expect(second.sent).toBe(0)
      expect(getMessageHistory({ clientId: client.id }).total).toBe(1)
    })

    it('respeta los toggles de recordatorios (threeDays apagado = no envía)', async () => {
      updateWhatsappConfig({ enabled: true, provider: 'mock', reminders: { threeDays: false, oneDay: false, sameDay: false } })
      const client = makeClientWithMembership('REMOFF')
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      getDatabase().prepare('UPDATE memberships SET end_date = ? WHERE client_id = ?').run(formatISO(addDays(todayStart, 3)), client.id)

      const result = await checkAndSendExpiryReminders()
      expect(result.sent).toBe(0)
      expect(getMessageHistory({ clientId: client.id }).total).toBe(0)
    })

    it('envía mensaje de membresía vencida para vencidas dentro de los últimos 30 días', async () => {
      updateWhatsappConfig({ enabled: true, provider: 'mock', reminders: { threeDays: true, oneDay: true, sameDay: true } })
      const client = makeClientWithMembership('REMEXP')
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const yesterday = formatISO(addDays(todayStart, -1))
      getDatabase().prepare("UPDATE memberships SET end_date = ?, status = 'expired' WHERE client_id = ?").run(yesterday, client.id)

      const result = await checkAndSendExpiryReminders()
      expect(result.sent).toBeGreaterThanOrEqual(1)

      const history = getMessageHistory({ clientId: client.id })
      expect(history.data[0].messageType).toBe('membership_expired')
      expect(history.data[0].message).toContain('ha vencido')
    })

    it('envía mensaje de membresía vencida también cuando el CLIENTE está marcado expired (bug producción)', async () => {
      // En producción updateExpiredMemberships marca c.status = 'expired' al
      // vencer la membresía. El filtro anterior exigía c.status = 'active' en
      // ambas ramas, así que "membresía vencida" nunca se enviaba para clientes
      // ya vencidos. Este test reproduce ese escenario real.
      updateWhatsappConfig({ enabled: true, provider: 'mock', reminders: { threeDays: true, oneDay: true, sameDay: true } })
      const client = makeClientWithMembership('REMEXP2')
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const yesterday = formatISO(addDays(todayStart, -1))
      getDatabase().prepare("UPDATE memberships SET end_date = ?, status = 'expired' WHERE client_id = ?").run(yesterday, client.id)
      getDatabase().prepare("UPDATE clients SET status = 'expired' WHERE id = ?").run(client.id)

      const result = await checkAndSendExpiryReminders()
      expect(result.sent).toBeGreaterThanOrEqual(1)

      const history = getMessageHistory({ clientId: client.id })
      expect(history.data[0].messageType).toBe('membership_expired')
      expect(history.data[0].message).toContain('ha vencido')
    })

    it('no envía recordatorio a una membresía que vence en más de 3 días', async () => {
      updateWhatsappConfig({ enabled: true, provider: 'mock', reminders: { threeDays: true, oneDay: true, sameDay: true } })
      const client = makeClientWithMembership('REMFAR')
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      getDatabase().prepare('UPDATE memberships SET end_date = ? WHERE client_id = ?').run(formatISO(addDays(todayStart, 20)), client.id)

      await checkAndSendExpiryReminders()
      // Verificación por cliente (no por el conteo global sent, que depende del
      // dedup de tests previos en este mismo archivo): este cliente no califica.
      expect(getMessageHistory({ clientId: client.id }).total).toBe(0)
    })
  })

  describe('sendMessage', () => {
    it('debería guardar mensaje como enviado con provider mock', async () => {
      const client = createClient({
        ...sampleClient,
        documentId: 'whats-test-1',
        accessCode: '111222',
      })
      const result = await sendMessage(client.id, '573001234567', 'welcome', 'Hola de prueba')

      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()

      const history = getMessageHistory({ clientId: client.id })
      expect(history.total).toBeGreaterThanOrEqual(1)
      const msg = history.data.find((m) => m.id === result.messageId)
      expect(msg).toBeDefined()
      expect(msg!.status).toBe('sent')
    })

    it('NO debería marcar como enviado un mensaje con provider no implementado (twilio)', async () => {
      const client = createClient({
        ...sampleClient,
        documentId: 'whats-test-2',
        accessCode: '333444',
      })
      updateWhatsappConfig({ enabled: true, provider: 'twilio', apiKey: 'fake-key' })

      const result = await sendMessage(client.id, '573001234567', 'welcome', 'Mensaje con twilio')

      expect(result.success).toBe(false)
      expect(result.messageId).toBeDefined()

      const history = getMessageHistory({ clientId: client.id })
      const msg = history.data.find((m) => m.id === result.messageId)
      expect(msg).toBeDefined()
      expect(msg!.status).toBe('failed')
    })

    it('NO debería marcar como enviado un mensaje con provider custom no implementado', async () => {
      const client = createClient({
        ...sampleClient,
        documentId: 'whats-test-3',
        accessCode: '555666',
      })
      updateWhatsappConfig({ enabled: true, provider: 'custom', apiKey: 'fake-key' })

      const result = await sendMessage(client.id, '573001234567', 'welcome', 'Mensaje con custom')

      expect(result.success).toBe(false)
      expect(result.messageId).toBeDefined()

      const history = getMessageHistory({ clientId: client.id })
      const msg = history.data.find((m) => m.id === result.messageId)
      expect(msg).toBeDefined()
      expect(msg!.status).toBe('failed')
    })
  })
})
