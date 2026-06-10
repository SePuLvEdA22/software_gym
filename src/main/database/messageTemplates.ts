import { getDatabase } from './index'
import { MessageTemplate } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'

export function getTemplates(): MessageTemplate[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM message_templates ORDER BY name ASC').all() as any[]
  return rows.map(mapTemplate)
}

export function getTemplateById(id: string): MessageTemplate | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(id) as any
  return row ? mapTemplate(row) : null
}

function mapTemplate(r: any): MessageTemplate {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    subject: r.subject || '',
    content: r.content,
    variables: r.variables ? JSON.parse(r.variables) : [],
    createdAt: r.created_at
  }
}

export function createTemplate(data: { name: string; type: 'email' | 'whatsapp'; subject: string; content: string; variables: string[] }): MessageTemplate {
  const db = getDatabase()
  const id = uuidv4()
  db.prepare(`
    INSERT INTO message_templates (id, name, type, subject, content, variables)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.name, data.type, data.subject || '', data.content, JSON.stringify(data.variables || []))
  return getTemplateById(id)!
}

export function updateTemplate(id: string, data: { name: string; type: 'email' | 'whatsapp'; subject: string; content: string; variables: string[] }): MessageTemplate | null {
  const db = getDatabase()
  db.prepare(`
    UPDATE message_templates SET name = ?, type = ?, subject = ?, content = ?, variables = ? WHERE id = ?
  `).run(data.name, data.type, data.subject || '', data.content, JSON.stringify(data.variables || []), id)
  return getTemplateById(id)
}

export function deleteTemplate(id: string): boolean {
  const db = getDatabase()
  const r = db.prepare('DELETE FROM message_templates WHERE id = ?').run(id)
  return r.changes > 0
}

function resolveVariables(content: string, client: { fullName: string; documentId: string; phone: string; planName?: string; planEnd?: string }): string {
  return content
    .replace(/\{\{nombre\}\}/g, client.fullName)
    .replace(/\{\{documento\}\}/g, client.documentId)
    .replace(/\{\{telefono\}\}/g, client.phone)
    .replace(/\{\{plan\}\}/g, client.planName || 'Sin plan')
    .replace(/\{\{vencimiento\}\}/g, client.planEnd || 'N/A')
    .replace(/\{nombre\}/g, client.fullName)
    .replace(/\{documento\}/g, client.documentId)
    .replace(/\{telefono\}/g, client.phone)
    .replace(/\{plan\}/g, client.planName || 'Sin plan')
    .replace(/\{vencimiento\}/g, client.planEnd || 'N/A')
}

export function sendTemplateToClient(templateId: string, clientId: string): { sent: boolean; message?: string } {
  const template = getTemplateById(templateId)
  if (!template) return { sent: false, message: 'Plantilla no encontrada' }

  const db = getDatabase()
  // try to get client with plan info
  const client = db.prepare(`
    SELECT c.id, c.full_name, c.document_id, c.phone, p.name as plan_name, cp.end_date as plan_end
    FROM clients c LEFT JOIN client_plans cp ON cp.client_id = c.id AND cp.is_active = 1
    LEFT JOIN plans p ON p.id = cp.plan_id
    WHERE c.id = ? AND c.is_active = 1
  `).get(clientId) as any

  if (!client) return { sent: false, message: 'Cliente no encontrado o inactivo' }

  const message = resolveVariables(template.content, {
    fullName: client.full_name,
    documentId: client.document_id,
    phone: client.phone,
    planName: client.plan_name,
    planEnd: client.plan_end
  })

  // Get the WhatsApp provider from settings and send
  try {
    const settings = db.prepare('SELECT value FROM settings WHERE key = ?').get('whatsapp_default_provider') as any
    const provider = settings?.value || 'mock'

    if (template.type === 'whatsapp') {
      if (provider === 'mock') {
        console.log(`[MOCK WA] Sending to ${client.phone}: ${message}`)
      } else {
        // Real provider integration would go here
        console.log(`[${provider}] Sending to ${client.phone}: ${message}`)
      }
    } else {
      console.log(`[EMAIL] Sending to ${client.phone}: ${template.subject} - ${message}`)
    }

    return { sent: true }
  } catch (err: any) {
    return { sent: false, message: err.message }
  }
}

export function sendTemplateToAll(templateId: string): { sent: number; failed: number } {
  const db = getDatabase()
  const activeClients = db.prepare(`
    SELECT id FROM clients WHERE is_active = 1
  `).all() as any[]

  let sent = 0
  let failed = 0

  for (const c of activeClients) {
    const r = sendTemplateToClient(templateId, c.id)
    if (r.sent) sent++
    else failed++
  }

  return { sent, failed }
}
