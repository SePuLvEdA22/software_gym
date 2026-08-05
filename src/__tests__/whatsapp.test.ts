import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initDatabase, closeDatabase } from '../main/database/index'
import { createClient } from '../main/database/clients'
import {
  generatePaymentConfirmationMessage,
  generateExpiryReminderMessage,
  generateExpiredMessage,
  generateWelcomeMessage,
  formatPhoneNumber,
  updateWhatsappConfig,
  sendMessage,
  getMessageHistory,
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
