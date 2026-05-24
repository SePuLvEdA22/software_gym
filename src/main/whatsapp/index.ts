import { v4 as uuidv4 } from 'uuid'
import { formatISO, addDays, isToday, differenceInDays } from 'date-fns'
import log from 'electron-log'
import { getDatabase } from '../database'
import { getActiveMembership, getAllClients } from '../database/memberships'
import { WhatsappMessage, MessageType, MessageStatus, Client } from '../../shared/types'

interface WhatsappConfig {
  enabled: boolean
  provider: 'mock' | 'twilio' | 'evolution_api' | 'custom'
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
    const result = await sendViaProvider(phone, message)
    
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

async function sendViaProvider(phone: string, message: string): Promise<{ success: boolean }> {
  switch (config.provider) {
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

async function sendViaTwilio(phone: string, message: string): Promise<{ success: boolean }> {
  log.warn('Twilio integration placeholder')
  return { success: true }
}

async function sendViaEvolutionApi(phone: string, message: string): Promise<{ success: boolean }> {
  log.warn('Evolution API integration placeholder')
  return { success: true }
}

async function sendViaCustom(phone: string, message: string): Promise<{ success: boolean }> {
  log.warn('Custom WhatsApp integration placeholder')
  return { success: true }
}

export async function checkAndSendExpiryReminders(): Promise<{ sent: number }> {
  if (!config.enabled) {
    log.info('WhatsApp notifications disabled, skipping reminders')
    return { sent: 0 }
  }
  
  const clients = getAllClients('active')
  let sentCount = 0
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  for (const client of clients) {
    const membership = getActiveMembership(client.id)
    if (!membership) continue
    
    const endDate = new Date(membership.endDate)
    endDate.setHours(0, 0, 0, 0)
    
    const daysLeft = differenceInDays(endDate, today)
    
    const phone = formatPhoneNumber(client.phone)
    if (!phone) continue
    
    if (daysLeft === 3 && config.reminders.threeDays) {
      const message = generateExpiryReminderMessage(client.fullName, 3, membership.planName)
      await sendMessage(client.id, phone, 'expiry_reminder_3d', message)
      sentCount++
    }
    
    if (daysLeft === 1 && config.reminders.oneDay) {
      const message = generateExpiryReminderMessage(client.fullName, 1, membership.planName)
      await sendMessage(client.id, phone, 'expiry_reminder_1d', message)
      sentCount++
    }
    
    if (daysLeft === 0 && config.reminders.sameDay) {
      const message = generateExpiryReminderMessage(client.fullName, 0, membership.planName)
      await sendMessage(client.id, phone, 'expiry_reminder_same_day', message)
      sentCount++
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
  const clients = getAllClients()
  const client = clients.find(c => c.id === clientId)
  
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
  const clients = getAllClients()
  const client = clients.find(c => c.id === clientId)
  
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
  
  let query = 'SELECT * FROM whatsapp_messages WHERE 1=1'
  const params: (string | number)[] = []
  
  if (clientId) {
    query += ' AND client_id = ?'
    params.push(clientId)
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?'
  params.push(limit)
  
  const stmt = db.prepare(query)
  const results = stmt.all(...params) as any[]
  
  return results.map(r => ({
    id: r.id,
    clientId: r.client_id,
    phone: r.phone,
    messageType: r.message_type as MessageType,
    message: r.message,
    status: r.status as MessageStatus,
    scheduledFor: r.scheduled_for,
    sentAt: r.sent_at,
    createdAt: r.created_at
  }))
}
