/**
 * 🚀 Motor de Migración Legacy — Integrado en BodyFitGym
 * 
 * Lee el dump SQL de la base de datos antigua (MySQL) y lo importa
 * directamente en la base de datos actual de BodyFitGym.
 * 
 * Diferencias con la versión CLI (scripts/migrate-legacy-data.ts):
 * - Inserta datos DIRECTAMENTE en la BD vía getDatabase() (sin archivo SQL intermedio)
 * - Exporta fotos al directorio de la app (app.getPath('userData')/photos/)
 * - Reporta progreso vía callbacks
 * - Se ejecuta dentro del proceso main de Electron
 */

import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs'
import { createInterface } from 'readline'
import { join } from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import log from 'electron-log'
import { getDatabase, backupDatabase, restoreDatabase } from '../database'
import { fixMojibake } from '../../shared/encoding'

// ============================================================
// TIPOS
// ============================================================

export interface MigrationProgress {
  phase: 'parsing' | 'importing' | 'done' | 'error'
  table?: string
  current?: number
  total?: number
  message: string
}

export interface MigrationSummary {
  success: boolean
  tablesImported: Record<string, number>
  totalRecords: number
  errors: string[]
  photosExported: number
  backupPath?: string
}

type ProgressCallback = (progress: MigrationProgress) => void

type ParserState = 'idle' | 'in_insert_header' | 'in_values'

interface ParsedInsert {
  tableName: string
  columns: string[]
  rows: string[][]
}

// ============================================================
// MAPEOS DE IDs
// ============================================================

interface IdMapping {
  socio: Map<number, string>
  membresia: Map<number, string>
  membresia_name: Map<number, string>
  membresia_duration: Map<number, number>
  sociomembresia: Map<number, string>
  sociomembresia_client: Map<number, number>
  producto: Map<number, string>
  estado: Map<number, string>
  ctipomembresia: Map<number, string>
}

const idMapping: IdMapping = {
  socio: new Map(),
  membresia: new Map(),
  membresia_name: new Map(),
  membresia_duration: new Map(),
  sociomembresia: new Map(),
  sociomembresia_client: new Map(),
  producto: new Map(),
  estado: new Map(),
  ctipomembresia: new Map(),
}

// ============================================================
// PARSER MySQL (adaptado del script CLI)
// ============================================================

class MysqlInsertParser {
  private state: ParserState = 'idle'
  private currentTable = ''
  private currentColumns: string[] = []
  private currentRows: string[][] = []
  private currentRow: string[] = []
  private currentValue = ''
  private inString = false
  private parenDepth = 0
  private lineNumber = 0

  onInsert: ((insert: ParsedInsert) => void) | null = null
  onProgress: ((line: number) => void) | null = null

  processLine(line: string): void {
    this.lineNumber++

    if (this.lineNumber % 5000 === 0) {
      this.onProgress?.(this.lineNumber)
    }

    const insertMatch = line.match(/^INSERT\s+INTO\s+`(\w+)`\s+\(([^)]+)\)\s+VALUES/i)
    if (insertMatch) {
      this.flushCurrentInsert()
      this.state = 'in_values'
      this.currentTable = insertMatch[1]
      this.currentColumns = this.parseColumnNames(insertMatch[2])
      this.currentRows = []
      this.currentRow = []
      this.currentValue = ''
      this.inString = false
      this.parenDepth = 0

      const valuesPart = line.substring(insertMatch[0].length).trim()
      if (valuesPart) {
        this.parseValueChunk(valuesPart)
      }
      return
    }

    if (this.state === 'in_values') {
      this.parseValueChunk(line)
    }
  }

  private parseColumnNames(colsStr: string): string[] {
    return colsStr.split(',').map(c => c.trim().replace(/`/g, ''))
  }

  private parseValueChunk(chunk: string): void {
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i]

      if (this.inString) {
        if (ch === "'") {
          if (i + 1 < chunk.length && chunk[i + 1] === "'") {
            this.currentValue += "'"
            i++
          } else {
            this.inString = false
          }
        } else if (ch === '\\' && i + 1 < chunk.length) {
          this.currentValue += chunk[i + 1]
          i++
        } else {
          this.currentValue += ch
        }
        continue
      }

      if (ch === "'") {
        this.inString = true
        continue
      }

      if (ch === '(' && this.parenDepth === 0) {
        this.parenDepth = 1
        this.currentRow = []
        this.currentValue = ''
        continue
      }

      if (ch === ')' && this.parenDepth === 1) {
        this.parenDepth = 0
        this.currentRow.push(this.currentValue.trim())
        this.currentValue = ''

        const rest = chunk.substring(i + 1).trim()
        if (rest.startsWith(',')) {
          this.currentRows.push(this.currentRow)
          this.currentRow = []
          this.currentValue = ''
          i += rest.indexOf(',')
          const afterComma = rest.substring(rest.indexOf(',') + 1)
          if (afterComma.trim()) {
            this.parseValueChunk(afterComma)
          }
          return
        } else if (rest.startsWith(';')) {
          this.currentRows.push(this.currentRow)
          this.flushCurrentInsert()
          return
        }
        continue
      }

      if (ch === ',' && this.parenDepth === 1) {
        this.currentRow.push(this.currentValue.trim())
        this.currentValue = ''
        continue
      }

      if (this.parenDepth === 1 || !/\s/.test(ch)) {
        this.currentValue += ch
      }
    }

    if (this.inString) {
      this.currentValue += '\n'
    }
  }

  private flushCurrentInsert(): void {
    if (this.currentTable && this.currentRows.length > 0) {
      this.onInsert?.({
        tableName: this.currentTable,
        columns: this.currentColumns,
        rows: this.currentRows,
      })
    }
    this.currentTable = ''
    this.currentColumns = []
    this.currentRows = []
    this.currentRow = []
    this.currentValue = ''
    this.state = 'idle'
    this.inString = false
    this.parenDepth = 0
  }

  finish(): void {
    this.flushCurrentInsert()
  }
}

// ============================================================
// UTILIDADES
// ============================================================

function newId(): string {
  return uuidv4()
}

function parseDate(raw: unknown): string | null {
  if (!raw || raw === 'NULL' || raw === 'null') return null
  const str = String(raw).replace(/'/g, '')
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 19).replace('T', ' ')
  }
  return null
}

function parseSqlValue(raw: string): unknown {
  if (!raw || raw === 'NULL' || raw === 'null') return null
  if (raw.startsWith('0x')) return raw
  if (raw.startsWith("'") && raw.endsWith("'")) {
    // El sistema antiguo guardó caracteres UTF-8 (Ñ, á, é...) como doble
    // codificación cp1252 ("Ã'", "Ã¡"...). Corregir al importar.
    return fixMojibake(raw.slice(1, -1))
  }
  // NOTA: NO convertir a número para preservar ceros a la izquierda
  // (ej: código de acceso '0212' debe seguir siendo '0212', no 212)
  // Todos los llamados usan String(), parseFloat() o parseInt() explícitamente.
  return raw
}

function parseHexBuffer(hexStr: string): Buffer | null {
  if (!hexStr || hexStr === 'NULL') return null
  const cleaned = hexStr.replace(/^0x/i, '')
  if (!cleaned || cleaned.length === 0) return null
  return Buffer.from(cleaned, 'hex')
}

function getDb() {
  return getDatabase()
}

// ============================================================
// TABLA: estado
// ============================================================

function transformEstado(insert: ParsedInsert): void {
  for (const row of insert.rows) {
    const id = parseInt(row[0] || '0', 10)
    const nombre = String(parseSqlValue(row[1]) || '').trim().toLowerCase()
    idMapping.estado.set(id, nombre)
  }
}

// ============================================================
// TABLA: ctipomembresia
// ============================================================

function transformCtipomembresia(insert: ParsedInsert): void {
  for (const row of insert.rows) {
    const id = parseInt(row[0] || '0', 10)
    const nombre = String(parseSqlValue(row[1]) || '').trim()
    idMapping.ctipomembresia.set(id, nombre)
  }
}

// ============================================================
// TABLA: socio → clients
// ============================================================

function getClientStatus(estadoId: number): string {
  const estado = idMapping.estado.get(estadoId) || ''
  switch (estado) {
    case 'activo': return 'active'
    default: return 'inactive'
  }
}

let photosExported = 0

function transformSocio(insert: ParsedInsert): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO clients (id, full_name, document_id, birth_date, gender, phone, email, address, photo_path, registration_date, access_code, status, emergency_name, emergency_phone, emergency_relationship, emergency_notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `)

  const photosDir = join(app.getPath('userData'), 'photos')
  if (!existsSync(photosDir)) mkdirSync(photosDir, { recursive: true })

  for (const row of insert.rows) {
    const oldId = parseInt(row[idx['idsocio']] || '0', 10)
    if (!oldId) continue

    const newUuid = newId()
    idMapping.socio.set(oldId, newUuid)

    const nombre = String(parseSqlValue(row[idx['nombre']]) || '')
    const paterno = String(parseSqlValue(row[idx['paterno']]) || '')
    const materno = String(parseSqlValue(row[idx['materno']]) || '')
    const fullName = [nombre, paterno, materno].filter(Boolean).join(' ').trim()

    const phone = String(parseSqlValue(row[idx['telefono']]) || '')
    const email = String(parseSqlValue(row[idx['correo']]) || '')
    let accessCode = String(parseSqlValue(row[idx['clave']]) || '')
    // Fallback solo si el código está completamente vacío
    // (NO reemplazar códigos cortos pero válidos como "212")
    if (!accessCode) {
      accessCode = `A${String(oldId).padStart(4, '0')}`
    }
    const birthDate = parseDate(row[idx['fechanacimiento']])
    const registrationDate = parseDate(row[idx['fechacreacion']]) || new Date().toISOString().split('T')[0]
    const idEstado = parseInt(row[idx['idestado']] || '1', 10)
    const status = getClientStatus(idEstado)
    const observaciones = String(parseSqlValue(row[idx['observaciones']]) || '')

    // Exportar foto
    let photoPath: string | null = null
    const rawPhoto = row[idx['foto']]
    if (rawPhoto && rawPhoto !== 'NULL' && rawPhoto.startsWith('0x')) {
      const buf = parseHexBuffer(rawPhoto)
      if (buf) {
        const fileName = `${newUuid}.jpg`
        const fullPath = join(photosDir, fileName)
        try {
          writeFileSync(fullPath, buf)
          // Ruta absoluta, igual que las fotos creadas en la app (savePhotoFile).
          photoPath = fullPath
          photosExported++
        } catch (e) {
          log.warn(`[Migracion] Error exportando foto de socio ${oldId}:`, e)
        }
      }
    }

    try {
      stmt.run(
        newUuid,
        fullName,
        `OLD-${oldId}`,
        birthDate || null,
        'not_specified',
        phone || null,
        email || null,
        observaciones || null,
        photoPath,
        registrationDate,
        accessCode,
        status
      )
    } catch (e: any) {
      if (e.message?.includes('clients.access_code')) {
        // Código duplicado: reintentar con código único basado en oldId
        const uniqueCode = `A${String(oldId).padStart(4, '0')}`
        try {
          stmt.run(
            newUuid,
            fullName,
            `OLD-${oldId}`,
            birthDate || null,
            'not_specified',
            phone || null,
            email || null,
            observaciones || null,
            photoPath,
            registrationDate,
            uniqueCode,
            status
          )
          log.info(`[Migracion] Cliente ${oldId} (${fullName}): código duplicado, se usó ${uniqueCode}`)
        } catch (e2: any) {
          log.warn(`[Migracion] Error insertando cliente ${oldId} (${fullName}): ${e2.message}`)
        }
      } else {
        log.warn(`[Migracion] Error insertando cliente ${oldId} (${fullName}): ${e.message}`)
      }
    }
  }
  }

// ============================================================
// TABLA: membresia → membership_plans
// ============================================================

function mapMembershipType(idTipo: number): string {
  const tipo = idMapping.ctipomembresia.get(idTipo) || ''
  switch (tipo.toLowerCase()) {
    case 'mensual': return 'monthly'
    case 'semanal': return 'weekly'
    case 'días':
    case 'dias': return 'daily'
    default: return 'monthly'
  }
}

function calcDuration(idTipo: number, meses: number, semanas: number, dias: number): number {
  switch (idTipo) {
    case 1: return meses * 30 || 30
    case 2: return semanas * 7 || 7
    case 3: return dias || 1
    default: return 30
  }
}

function transformMembresia(insert: ParsedInsert): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO membership_plans (id, name, type, price, duration_days, description, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
  `)

  for (const row of insert.rows) {
    const oldId = parseInt(row[idx['idmembresia']] || '0', 10)
    if (!oldId) continue

    const newUuid = newId()
    idMapping.membresia.set(oldId, newUuid)

    const name = String(parseSqlValue(row[idx['nombre']]) || '').trim()
    idMapping.membresia_name.set(oldId, name)
    const price = parseFloat(String(parseSqlValue(row[idx['precio']]) || '0'))
    const idTipo = parseInt(row[idx['idtipomembresia']] || '1', 10)
    const meses = parseInt(row[idx['meses']] || '0', 10)
    const semanas = parseInt(row[idx['semanas']] || '0', 10)
    const dias = parseInt(row[idx['dias']] || '0', 10)

    const membershipType = mapMembershipType(idTipo)
    const durationDays = calcDuration(idTipo, meses, semanas, dias)
    const desc = `Migrado (M:${meses} S:${semanas} D:${dias})`
    idMapping.membresia_duration.set(oldId, durationDays)

    try {
      stmt.run(newUuid, name, membershipType, price, durationDays, desc)
    } catch (e: any) {
      log.warn(`[Migracion] Error insertando plan ${oldId} (${name}): ${e.message}`)
    }
  }
  }

// ============================================================
// TABLA: sociomembresia → memberships
// ============================================================

function transformSociomembresia(insert: ParsedInsert): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO memberships (id, client_id, plan_id, plan_name, start_date, end_date, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `)

  // Día-consciente: la membresía es válida hasta el final de su día de
  // vencimiento; solo se marca vencida si venció ANTES de hoy.
  const startOfToday = new Date().setHours(0, 0, 0, 0)

  for (const row of insert.rows) {
    const oldId = parseInt(row[idx['idsociomembresia']] || '0', 10)
    if (!oldId) continue

    // Filtrar membresías no activas en el sistema antiguo:
    // idEstado 1 = Activo, 2 = Inactivo, 3 = Eliminado.
    // Las eliminadas/inactivas no eran membresías reales (no aparecían
    // en el sistema antiguo) y NO deben importarse ni sus pagos.
    const idEstado = parseInt(row[idx['idestado']] || '1', 10)
    if (idEstado !== 1) {
      log.info(`[Migracion] Saltando sociomembresia ${oldId}: idEstado=${idEstado} (no activa en el sistema antiguo)`)
      continue
    }

    const newUuid = newId()
    idMapping.sociomembresia.set(oldId, newUuid)
    const oldSocioId = parseInt(row[idx['idsocio']] || '0', 10)
    idMapping.sociomembresia_client.set(oldId, oldSocioId)

    const oldMembresiaId = parseInt(row[idx['idmembresia']] || '0', 10)
    const newClientId = idMapping.socio.get(oldSocioId) || ''
    const newPlanId = idMapping.membresia.get(oldMembresiaId) || ''

    if (!newClientId || !newPlanId) {
      log.warn(`[Migracion] Saltando sociomembresia ${oldId}: socio ${oldSocioId} o plan ${oldMembresiaId} no mapeado`)
      continue
    }

    const planName = idMapping.membresia_name.get(oldMembresiaId) || ''
    const startDate = parseDate(row[idx['fechainiciomembresia']]) || parseDate(row[idx['fechacreacion']])
    let endDate = parseDate(row[idx['vencimiento']])
    const estadoMembresia = String(parseSqlValue(row[idx['estadomembresia']]) || '').trim().toLowerCase()

    // Si no hay fecha de vencimiento, calcularla desde el plan
    if (!endDate && startDate) {
      const durationDays = idMapping.membresia_duration.get(oldMembresiaId) || 30
      const start = new Date(startDate)
      const calculatedEnd = new Date(start)
      calculatedEnd.setDate(calculatedEnd.getDate() + durationDays)
      endDate = calculatedEnd.toISOString().split('T')[0]
    }

    let status = 'active'
    if (estadoMembresia === 'sin pagar') status = 'expired'
    if (endDate && new Date(endDate).getTime() < startOfToday && status === 'active') status = 'expired'
    // Si no tenemos NINGUNA fecha (ni inicio ni fin), no podemos verificar la membresía
    if (!startDate && !endDate) status = 'expired'

    try {
      stmt.run(newUuid, newClientId, newPlanId, planName, startDate || null, endDate || null, status)
    } catch (e: any) {
      log.warn(`[Migracion] Error insertando membresia ${oldId}: ${e.message}`)
    }
  }
  }

// ============================================================
// TABLA: sociomembresia_pago → payments
// ============================================================

function transformSociomembresiaPago(insert: ParsedInsert): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO payments (id, client_id, membership_id, amount, discount, method, description, date, notes, created_at)
    VALUES (?, ?, ?, ?, 0, 'cash', 'Pago migrado', ?, NULL, CURRENT_TIMESTAMP)
  `)

  for (const row of insert.rows) {
    const oldSocioMembresiaId = parseInt(row[idx['idsociomembresia']] || '0', 10)
    const newMembershipId = idMapping.sociomembresia.get(oldSocioMembresiaId) || ''
    if (!newMembershipId) continue

    const oldSocioId = idMapping.sociomembresia_client.get(oldSocioMembresiaId)
    const clientId = oldSocioId ? (idMapping.socio.get(oldSocioId) || '') : ''

    const newUuid = newId()
    const importe = parseFloat(String(parseSqlValue(row[idx['importe']]) || '0'))
    const fecha = parseDate(row[idx['fecha']])

    try {
      stmt.run(newUuid, clientId || null, newMembershipId, importe, fecha || null)
    } catch (e: any) {
      log.warn(`[Migracion] Error insertando pago: ${e.message}`)
    }
  }
  }

// ============================================================
// TABLA: registro → access_logs
// ============================================================

function transformAccessLogs(insert: ParsedInsert, message: string): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO access_logs (id, client_id, client_name, access_code, access_type, result, message, timestamp)
    VALUES (?, ?, '', '', 'check_in', 'granted', ?, ?)
  `)

  for (const row of insert.rows) {
    const oldSocioId = parseInt(row[idx['idsocio']] || '0', 10)
    const newClientId = idMapping.socio.get(oldSocioId) || ''
    if (!newClientId) continue

    const newUuid = newId()
    const fecha = parseDate(row[idx['fechacreacion']])

    try {
      stmt.run(newUuid, newClientId, message, fecha || null)
    } catch (e: any) {
      // Silenciar errores de access_logs (no críticos)
    }
  }
}

function transformRegistro(insert: ParsedInsert): void {
  transformAccessLogs(insert, 'Migrado')
}

// ============================================================
// TABLA: visita → access_logs
// ============================================================

function transformVisita(insert: ParsedInsert): void {
  transformAccessLogs(insert, 'Visita migrada (pase diario)')
}

// ============================================================
// TABLA: producto → products
// ============================================================

function transformProducto(insert: ParsedInsert): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO products (id, name, category, description, price, cost, stock, min_stock, barcode, is_active, created_at, updated_at)
    VALUES (?, ?, 'other', ?, ?, ?, 0, 5, '', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `)

  for (const row of insert.rows) {
    const oldId = parseInt(row[idx['idproducto']] || '0', 10)
    if (!oldId) continue

    const newUuid = newId()
    idMapping.producto.set(oldId, newUuid)

    const name = String(parseSqlValue(row[idx['nombre']]) || '').trim()
    const descripcion = String(parseSqlValue(row[idx['descripcion']]) || '')
    const precio = parseFloat(String(parseSqlValue(row[idx['precio']]) || '0'))
    const costo = parseFloat(String(parseSqlValue(row[idx['costo']]) || '0'))
    const idEstado = parseInt(row[idx['idestado']] || '1', 10)

    try {
      stmt.run(newUuid, name, descripcion, precio, costo, idEstado === 1 ? 1 : 0)
    } catch (e: any) {
      log.warn(`[Migracion] Error insertando producto ${oldId}: ${e.message}`)
    }
  }
  }

// ============================================================
// TABLA: configuracion → settings
// ============================================================

function transformConfiguracion(insert: ParsedInsert): void {
  if (insert.rows.length === 0) return

  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  const row = insert.rows[0]
  const db = getDb()
  const stmt = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)

  const settings: Record<string, string> = {
    gym_name: String(parseSqlValue(row[idx['nombregimnacio']]) || 'BODYFITGYM'),
    gym_address: String(parseSqlValue(row[idx['domicilio']]) || ''),
    gym_phone: String(parseSqlValue(row[idx['telefono']]) || ''),
    gym_welcome_message: String(parseSqlValue(row[idx['mensaje']]) || 'Bienvenido'),
    gym_rfc: String(parseSqlValue(row[idx['rfc']]) || ''),
    ticket_footer: String(parseSqlValue(row[idx['ticketfooter']]) || ''),
    ticket_width: String(parseSqlValue(row[idx['ticketancho']]) || '190'),
    ticket_font_size: String(parseSqlValue(row[idx['ticketfontsize']]) || '12'),
    ticket_font_name: String(parseSqlValue(row[idx['ticketfontname']]) || 'Arial'),
  }

  for (const [key, value] of Object.entries(settings)) {
    try { stmt.run(key, value) } catch {}
  }

  // Logo
  const rawLogo = row[idx['logo']]
  if (rawLogo && rawLogo !== 'NULL' && rawLogo.startsWith('0x')) {
    try {
      const logoBuf = parseHexBuffer(rawLogo)
      if (logoBuf) {
        const photosDir = join(app.getPath('userData'), 'photos')
        if (!existsSync(photosDir)) mkdirSync(photosDir, { recursive: true })
        const logoPath = join(photosDir, 'gym_logo.png')
        writeFileSync(logoPath, logoBuf)
        stmt.run('gym_logo_path', 'gym_logo.png')
      }
    } catch (e) {
      log.warn('[Migracion] Error exportando logo:', e)
    }
  }
}

// ============================================================
// DISPATCHER
// ============================================================

type TableHandler = (insert: ParsedInsert) => void

const tableHandlers: Record<string, TableHandler> = {
  estado: transformEstado,
  ctipomembresia: transformCtipomembresia,
  socio: transformSocio,
  membresia: transformMembresia,
  sociomembresia: transformSociomembresia,
  sociomembresia_pago: transformSociomembresiaPago,
  registro: transformRegistro,
  visita: transformVisita,
  producto: transformProducto,
  configuracion: transformConfiguracion,
}

// Ignorar estas tablas silenciosamente
const ignoredTables = new Set([
  'clase', 'clase_socio', 'cmodulo', 'rol', 'rol_modulo',
  'control_backup', 'control_mail', 'socio_muestra', 'usuario',
  'entrada', 'salida', 'detalleentrada', 'detallesalida',
])

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

/**
 * Ejecuta la migración desde un archivo SQL de MySQL hacia la BD actual de BodyFitGym.
 * 
 * @param sqlFilePath - Ruta al archivo db_actual.sql
 * @param onProgress - Callback para reportar progreso
 * @returns Resumen de la migración
 */
export async function runLegacyMigration(
  sqlFilePath: string,
  onProgress?: ProgressCallback
): Promise<MigrationSummary> {
  log.info(`[Migracion] Iniciando migración desde: ${sqlFilePath}`)

  // Verificar que el archivo existe
  if (!existsSync(sqlFilePath)) {
    return {
      success: false,
      tablesImported: {},
      totalRecords: 0,
      errors: [`Archivo no encontrado: ${sqlFilePath}`],
      photosExported: 0,
    }
  }

  // ==========================================
  // Backup automático antes de migrar
  // ==========================================
  onProgress?.({ phase: 'parsing', message: 'Creando backup de seguridad...' })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = join(app.getPath('userData'), `backup-premigracion-${timestamp}.db`)
  let backupCreated = false
  try {
    backupCreated = backupDatabase(backupPath)
    if (backupCreated) {
      log.info(`[Migracion] Backup creado: ${backupPath}`)
    }
  } catch (e: any) {
    log.warn('[Migracion] Error creando backup:', e.message)
  }

  // Limpiar datos actuales
  onProgress?.({ phase: 'parsing', message: 'Limpiando datos actuales...' })
  const db = getDb()
  try {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      DELETE FROM payments;
      DELETE FROM access_logs;
      DELETE FROM memberships;
      DELETE FROM clients;
      DELETE FROM membership_plans;
      DELETE FROM products;
      DELETE FROM settings WHERE key LIKE 'gym_%' OR key LIKE 'ticket_%' OR key = 'backup_folder' OR key = 'gym_logo_path';
      PRAGMA foreign_keys = ON;
    `)
  } catch (e: any) {
    log.warn('[Migracion] Error limpiando datos previos:', e.message)
  }

  // Resetear mapeos
  for (const map of Object.values(idMapping)) {
    map.clear()
  }
  photosExported = 0

  // Contadores
  const insertCounts: Record<string, number> = {}
  let totalInserts = 0

  // Preparar el parser
  const parser = new MysqlInsertParser()

  parser.onInsert = (insert: ParsedInsert) => {
    const tableName = insert.tableName.toLowerCase()
    const handler = tableHandlers[tableName]

    if (handler) {
      try {
        onProgress?.({
          phase: 'importing',
          table: tableName,
          current: insertCounts[tableName] || 0,
          message: `Importando ${tableName}...`
        })
        handler(insert)
        insertCounts[tableName] = (insertCounts[tableName] || 0) + insert.rows.length
        totalInserts += insert.rows.length
      } catch (err: any) {
        log.error(`[Migracion] Error en tabla ${tableName}:`, err.message)
      }
    } else if (!ignoredTables.has(tableName)) {
      log.warn(`[Migracion] Tabla no mapeada (ignorada): ${tableName}`)
    }
  }

  parser.onProgress = (line: number) => {
    onProgress?.({
      phase: 'parsing',
      current: line,
      message: `Procesando línea ${line.toLocaleString()}...`,
    })
  }

  // Parsear el archivo
  try {
    onProgress?.({ phase: 'parsing', message: 'Iniciando parseo del archivo SQL...' })

    const rl = createInterface({
      input: createReadStream(sqlFilePath, { encoding: 'utf-8', highWaterMark: 1024 * 1024 }),
      crlfDelay: Infinity,
    })

    for await (const line of rl) {
      parser.processLine(line)
    }
    parser.finish()
  } catch (err: any) {
    log.error('[Migracion] Error durante el parseo:', err)

    // Restaurar backup automáticamente
    if (backupCreated && existsSync(backupPath)) {
      onProgress?.({ phase: 'error', message: 'Error en migración. Restaurando backup...' })
      try {
        await restoreDatabase(backupPath)
        log.info('[Migracion] Backup restaurado automáticamente tras error')
      } catch (restoreErr: any) {
        log.error('[Migracion] Error restaurando backup:', restoreErr)
      }
    }

    return {
      success: false,
      tablesImported: insertCounts,
      totalRecords: totalInserts,
      errors: [`Error durante el parseo: ${err.message}`],
      photosExported,
      backupPath: backupCreated ? backupPath : undefined,
    }
  }

  // Seed para client_number_seq
  try {
    db.exec("INSERT OR IGNORE INTO client_number_seq (id, last_number) VALUES (1, 1000);")
  } catch {}

  // Recargar datos del dashboard (actualizar estado de membresías vencidas)
  try {
    db.exec("UPDATE memberships SET status = 'expired' WHERE end_date < datetime('now', 'start of day') AND status = 'active'")
  } catch {}

  // Sincronizar estado de clientes según su membresía más reciente
  try {
    db.exec(`
      UPDATE clients SET status =
        CASE
          WHEN EXISTS (
            SELECT 1 FROM memberships
            WHERE client_id = clients.id
              AND status = 'active'
              AND end_date >= datetime('now', 'start of day')
          ) THEN 'active'
          WHEN EXISTS (
            SELECT 1 FROM memberships
            WHERE client_id = clients.id
              AND status = 'frozen'
          ) THEN 'active'
          ELSE 'inactive'
        END
    `)
  } catch {}

  log.info('[Migracion] Migración completada exitosamente')
  log.info(`[Migracion] Registros: ${totalInserts}, Fotos: ${photosExported}`)

  onProgress?.({ phase: 'done', message: 'Migración completada exitosamente.' })

  return {
    success: true,
    tablesImported: insertCounts,
    totalRecords: totalInserts,
    errors: [],
    photosExported,
    backupPath: backupCreated ? backupPath : undefined,
  }
}
