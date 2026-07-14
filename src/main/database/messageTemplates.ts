import { getDatabase } from './index'
import { MessageTemplate } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import { sendMessage } from '../whatsapp/index'

interface DbMessageTemplate {
  id: string
  name: string
  type: string
  subject: string
  content: string
  variables: string
  created_at: string
}

function mapTemplate(r: DbMessageTemplate): MessageTemplate {
  return {
    id: r.id,
    name: r.name,
    type: r.type as 'email' | 'whatsapp',
    subject: r.subject || '',
    content: r.content,
    variables: r.variables ? JSON.parse(r.variables) : [],
    createdAt: r.created_at
  }
}

export function getTemplates(): MessageTemplate[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM message_templates ORDER BY name ASC').all() as Record<string, unknown>[]
  return rows.map((r) => mapTemplate(r as unknown as DbMessageTemplate))
}

export function getTemplateById(id: string): MessageTemplate | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? mapTemplate(row as unknown as DbMessageTemplate) : null
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

interface ClientWithPlan {
  id: string
  full_name: string
  document_id: string
  phone: string
  plan_name: string | null
  plan_end: string | null
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
  const client = db.prepare(`
    SELECT c.id, c.full_name, c.document_id, c.phone,
           m.plan_name, m.end_date as plan_end
    FROM clients c
    LEFT JOIN memberships m ON m.client_id = c.id AND m.status = 'active'
    WHERE c.id = ? AND c.status = 'active'
  `).get(clientId) as ClientWithPlan | undefined

  if (!client) return { sent: false, message: 'Cliente no encontrado o inactivo' }

  const message = resolveVariables(template.content, {
    fullName: client.full_name,
    documentId: client.document_id,
    phone: client.phone,
    planName: client.plan_name || undefined,
    planEnd: client.plan_end || undefined
  })

  try {
    if (template.type === 'whatsapp') {
      sendMessage(clientId, client.phone, 'welcome', message)
        .catch((err: unknown) => console.error('[Templates] Error sending WhatsApp:', err))
    }
    if (template.type === 'email') {
      console.log(`[EMAIL] To: ${client.phone} | Subject: ${template.subject} | Message: ${message}`)
    }

    return { sent: true }
  } catch (err: any) {
    return { sent: false, message: err.message }
  }
}

export function sendTemplateToAll(templateId: string): { sent: number; failed: number } {
  const db = getDatabase()
  const activeClients = db.prepare(`
    SELECT id FROM clients WHERE status = 'active'
  `).all() as { id: string }[]

  let sent = 0
  let failed = 0

  for (const c of activeClients) {
    const r = sendTemplateToClient(templateId, c.id)
    if (r.sent) sent++
    else failed++
  }

  return { sent, failed }
}
