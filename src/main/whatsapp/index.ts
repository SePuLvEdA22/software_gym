import { v4 as uuidv4 } from 'uuid'
import { formatISO, differenceInDays, addDays } from 'date-fns'
import log from 'electron-log'
import { getDatabase } from '../database'
import { getClientById } from '../database/clients'
import { WhatsappMessage, MessageType, MessageStatus } from '../../shared/types'

interface WhatsappConfig {
  enabled: boolean
  provider: 'mock' | 'twilio' | 'evolution_api' | 'custom' | 'whatsapp_cloud'
  phoneNumberId: string
  apiUrl: string
  apiKey: string
  instanceId: string
  reminders: {
    threeDays: boolean
    oneDay: boolean
    sameDay: boolean
  }
}

let config: WhatsappConfig = {
  enabled: false,
  provider: 'mock',
  phoneNumberId: '',
  apiUrl: '',
  apiKey: '',
  instanceId: '',
  reminders: {
    threeDays: true,
    oneDay: true,
    sameDay: true
  }
}

export function updateWhatsappConfig(newConfig: Partial<WhatsappConfig>): void {
  config = { ...config, ...newConfig }
  if (newConfig.reminders) {
    config.reminders = { ...config.reminders, ...newConfig.reminders }
  }
  log.info('WhatsApp config updated:', { ...config, apiKey: '***' })
}

export function getWhatsappConfig(): WhatsappConfig {
  return { ...config }
}

export function generatePaymentConfirmationMessage(clientName: string, planName: string, endDate: string): string {
  const date = new Date(endDate)
  const formattedDate = date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  
  return `Hola ${clientName}, tu pago fue registrado correctamente. Tu membresía ${planName} vence el ${formattedDate}.`
}

export function generateExpiryReminderMessage(clientName: string, daysLeft: number, planName: string): string {
  if (daysLeft === 0) {
    return `Hola ${clientName}! Tu membresía vence HOY. Renueva tu plan para continuar ingresando al gimnasio.`
  }
  
  if (daysLeft === 1) {
    return `Hola ${clientName}! Tu membresía vence mañana. Renueva tu plan para no perder acceso.`
  }
  
  return `Hola ${clientName}! Tu membresía ${planName} vence en ${daysLeft} días. No olvides renovarla.`
}

export function generateExpiredMessage(clientName: string): string {
  return `Hola ${clientName}. Tu membresía ha vencido. Renueva tu plan para continuar ingresando al gimnasio.`
}

export function generateWelcomeMessage(clientName: string, accessCode: string): string {
  return `Bienvenido ${clientName} a nuestro gimnasio! Tu código de acceso es: ${accessCode}. Cuídalo.`
}

export async function sendMessage(
  clientId: string,
  phone: string,
  messageType: MessageType,
  message: string
): Promise<{ success: boolean; messageId?: string }> {
  const db = getDatabase()
  
  const messageId = uuidv4()
  const createdAt = formatISO(new Date())
  
  const stmt = db.prepare(`
    INSERT INTO whatsapp_messages (
      id, client_id, phone, message_type, message, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  
  stmt.run(
    messageId,
    clientId,
    phone,
    messageType,
    message,
    'pending',
    createdAt
  )
  
  if (!config.enabled || config.provider === 'mock') {
    log.info(`[WhatsApp MOCK] To: ${phone} | Type: ${messageType}`)
    log.info(`Message: ${message}`)
    
    const updateStmt = db.prepare(`
      UPDATE whatsapp_messages SET status = 'sent', sent_at = ? WHERE id = ?
    `)
    updateStmt.run(formatISO(new Date()), messageId)
    
    return { success: true, messageId }
  }
  
  try {
    const result = await sendViaProvider(phone, message, messageType)
    
    const updateStmt = db.prepare(`
      UPDATE whatsapp_messages SET status = ?, sent_at = ? WHERE id = ?
    `)
    updateStmt.run(
      result.success ? 'sent' : 'failed',
      result.success ? formatISO(new Date()) : null,
      messageId
    )
    
    return { success: result.success, messageId }
  } catch (error: any) {
    log.error('Error sending WhatsApp message:', error)
    
    const updateStmt = db.prepare(`
      UPDATE whatsapp_messages SET status = 'failed' WHERE id = ?
    `)
    updateStmt.run(messageId)
    
    return { success: false }
  }
}

async function sendViaProvider(phone: string, message: string, messageType?: MessageType): Promise<{ success: boolean }> {
  switch (config.provider) {
    case 'whatsapp_cloud':
      return sendViaWhatsAppCloud(phone, message, messageType)
    case 'twilio':
      return sendViaTwilio(phone, message)
    case 'evolution_api':
      return sendViaEvolutionApi(phone, message)
    case 'custom':
      return sendViaCustom(phone, message)
    default:
      return { success: true }
  }
}

const templateNames: Record<MessageType, string> = {
  welcome: 'bienvenida',
  payment_confirmation: 'pago_confirmado',
  expiry_reminder_3d: 'recordatorio',
  expiry_reminder_1d: 'recordatorio',
  expiry_reminder_same_day: 'recordatorio',
  membership_expired: 'membresia_vencida'
}

function extractTemplateParams(_messageType: MessageType, message: string): { type: 'text'; text: string }[] {
  return [{ type: 'text', text: message }]
}

async function sendViaWhatsAppCloud(phone: string, message: string, messageType?: MessageType): Promise<{ success: boolean }> {
  try {
    const url = `https://graph.facebook.com/v22.0/${config.phoneNumberId}/messages`
    const templateName = messageType ? templateNames[messageType] : undefined

    let body: any

    if (templateName) {
      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone.replace(/\D/g, ''),
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'es' },
          components: [{
            type: 'body',
            parameters: extractTemplateParams(messageType!, message)
          }]
        }
      }
    } else {
      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone.replace(/\D/g, ''),
        type: 'text',
        text: { body: message }
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()
    log.info(`[WhatsApp Cloud] Response: ${response.status}`, data)

    return { success: response.ok }
  } catch (error: any) {
    log.error('[WhatsApp Cloud] Error:', error.message)
    return { success: false }
  }
}

async function sendViaTwilio(_phone: string, _message: string): Promise<{ success: boolean }> {
  log.warn('Twilio integration placeholder')
  return { success: true }
}

async function sendViaEvolutionApi(phone: string, message: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${config.apiUrl}/message/sendText/${config.instanceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey
      },
      body: JSON.stringify({
        number: phone,
        text: message
      })
    })
    const data = await response.json()
    log.info(`[Evolution API] Response:`, data)
    return { success: data.status === 'success' }
  } catch (error: any) {
    log.error('[Evolution API] Error:', error.message)
    return { success: false }
  }
}

async function sendViaCustom(_phone: string, _message: string): Promise<{ success: boolean }> {
  log.warn('Custom WhatsApp integration placeholder')
  return { success: true }
}

function wasAlreadySentToday(clientId: string, messageType: MessageType): boolean {
  const db = getDatabase()
  const today = formatISO(new Date()).slice(0, 10)
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM whatsapp_messages
    WHERE client_id = ? AND message_type = ? AND created_at LIKE ?
  `).get(clientId, messageType, `${today}%`) as { count: number }
  return result.count > 0
}

export async function checkAndSendExpiryReminders(): Promise<{ sent: number }> {
  if (!config.enabled) {
    log.info('WhatsApp notifications disabled, skipping reminders')
    return { sent: 0 }
  }
  
  const db = getDatabase()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = formatISO(today)
  const threeDaysFromNow = formatISO(addDays(today, 3))
  
  const candidates = db.prepare(`
    SELECT c.id, c.full_name, c.phone, m.plan_name, m.end_date
    FROM clients c
    JOIN memberships m ON m.client_id = c.id AND m.status = 'active'
    WHERE c.status = 'active'
      AND m.end_date BETWEEN ? AND ?
    ORDER BY m.end_date ASC
  `).all(todayStr, threeDaysFromNow) as { id: string; full_name: string; phone: string; plan_name: string; end_date: string }[]
  
  let sentCount = 0
  
  for (const row of candidates) {
    const endDate = new Date(row.end_date)
    endDate.setHours(0, 0, 0, 0)
    
    const daysLeft = differenceInDays(endDate, today)
    
    const phone = formatPhoneNumber(row.phone)
    if (!phone) continue
    
    if (daysLeft === 3 && config.reminders.threeDays) {
      if (!wasAlreadySentToday(row.id, 'expiry_reminder_3d')) {
        const message = generateExpiryReminderMessage(row.full_name, 3, row.plan_name)
        await sendMessage(row.id, phone, 'expiry_reminder_3d', message)
        sentCount++
      }
    }
    
    if (daysLeft === 1 && config.reminders.oneDay) {
      if (!wasAlreadySentToday(row.id, 'expiry_reminder_1d')) {
        const message = generateExpiryReminderMessage(row.full_name, 1, row.plan_name)
        await sendMessage(row.id, phone, 'expiry_reminder_1d', message)
        sentCount++
      }
    }
    
    if (daysLeft === 0 && config.reminders.sameDay) {
      if (!wasAlreadySentToday(row.id, 'expiry_reminder_same_day')) {
        const message = generateExpiryReminderMessage(row.full_name, 0, row.plan_name)
        await sendMessage(row.id, phone, 'expiry_reminder_same_day', message)
        sentCount++
      }
    }
  }
  
  log.info(`Sent ${sentCount} expiry reminders`)
  return { sent: sentCount }
}

export async function sendPaymentConfirmation(
  clientId: string,
  planName: string,
  endDate: string
): Promise<{ success: boolean }> {
  const client = getClientById(clientId)
  
  if (!client) {
    log.error('Client not found for payment confirmation')
    return { success: false }
  }
  
  const phone = formatPhoneNumber(client.phone)
  if (!phone) {
    log.warn('No valid phone number for client:', client.id)
    return { success: false }
  }
  
  const message = generatePaymentConfirmationMessage(client.fullName, planName, endDate)
  const result = await sendMessage(clientId, phone, 'payment_confirmation', message)
  
  return result
}

export async function sendWelcomeMessage(clientId: string): Promise<{ success: boolean }> {
  const client = getClientById(clientId)
  
  if (!client) {
    log.error('Client not found for welcome message')
    return { success: false }
  }
  
  const phone = formatPhoneNumber(client.phone)
  if (!phone) {
    log.warn('No valid phone number for client:', client.id)
    return { success: false }
  }
  
  const message = generateWelcomeMessage(client.fullName, client.accessCode)
  const result = await sendMessage(clientId, phone, 'welcome', message)
  
  return result
}

function formatPhoneNumber(phone: string): string | null {
  if (!phone) return null
  
  const cleaned = phone.replace(/\D/g, '')
  
  if (cleaned.length < 10) return null
  
  if (cleaned.length === 10) {
    return '57' + cleaned
  }
  
  return cleaned
}

export function getMessageHistory(clientId?: string, limit = 50): WhatsappMessage[] {
  const db = getDatabase()
  
  let query = `SELECT wm.*, c.full_name as client_name FROM whatsapp_messages wm LEFT JOIN clients c ON c.id = wm.client_id WHERE 1=1`
  const params: (string | number)[] = []
  
  if (clientId) {
    query += ' AND wm.client_id = ?'
    params.push(clientId)
  }
  
  query += ' ORDER BY wm.created_at DESC LIMIT ?'
  params.push(limit)
  
  const stmt = db.prepare(query)
  const results = stmt.all(...params) as any[]
  
  return results.map(r => ({
    id: r.id,
    clientId: r.client_id,
    clientName: r.client_name || '',
    phone: r.phone,
    messageType: r.message_type as MessageType,
    message: r.message,
    status: r.status as MessageStatus,
    scheduledFor: r.scheduled_for,
    sentAt: r.sent_at,
    createdAt: r.created_at
  }))
}
