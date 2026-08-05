/**
 * 🚀 Script de Migración: Base de Datos Antigua (MySQL) → BodyFitGym (SQLite)
 * 
 * Este script lee el dump SQL de la base de datos antigua (software_actual/db_actual.sql),
 * parsea los INSERTs, transforma los datos al nuevo esquema de BodyFitGym,
 * y genera un archivo SQL compatible con SQLite con todos los datos migrados.
 * 
 * Uso:
 *   npx tsx scripts/migrate-legacy-data.ts
 * 
 * Output:
 *   - software_actual/migrated-data.sql   → Datos transformados listos para SQLite
 *   - software_actual/id_mapping.json      → Mapeo de IDs viejos → nuevos UUIDs
 *   - software_actual/migrated_photos/     → Fotos exportadas como archivos
 */

import { createReadStream, createWriteStream, existsSync, mkdirSync, writeFileSync } from 'fs'
import { createInterface } from 'readline'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

// ============================================================
// CONFIGURACIÓN
// ============================================================

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')

const OLD_DB_PATH = join(PROJECT_ROOT, 'software_actual', 'db_actual.sql')
const OUTPUT_SQL_PATH = join(PROJECT_ROOT, 'software_actual', 'migrated-data.sql')
const PHOTOS_OUTPUT_DIR = join(PROJECT_ROOT, 'software_actual', 'migrated_photos')
const ID_MAP_PATH = join(PROJECT_ROOT, 'software_actual', 'id_mapping.json')

// ============================================================
// UTILIDADES
// ============================================================

/** Mapa de IDs viejos (INT) → nuevos (UUID) para cada tabla */
interface IdMapping {
  socio: Map<number, string>       // idSocio → clients.id
  membresia: Map<number, string>   // idMembresia → membership_plans.id
  membresia_name: Map<number, string>  // idMembresia → plan name (para resolver plan_name en memberships)
  sociomembresia: Map<number, string>  // idSocioMembresia → memberships.id
  sociomembresia_client: Map<number, number> // idSocioMembresia → idSocio (para resolver client_id en pagos)
  producto: Map<number, string>    // idProducto → products.id
  usuario: Map<number, string>     // idUsuario → users.id
  socio_muestra: Map<number, string> // id → body_measurements.id
  estado: Map<number, string>      // idEstados → estado name
  ctipomembresia: Map<number, string> // id → name
}

const idMapping: IdMapping = {
  socio: new Map(),
  membresia: new Map(),
  membresia_name: new Map(),
  sociomembresia: new Map(),
  sociomembresia_client: new Map(),
  producto: new Map(),
  usuario: new Map(),
  socio_muestra: new Map(),
  estado: new Map(),
  ctipomembresia: new Map(),
}

function newId(): string {
  return uuidv4()
}

function escapeSqlite(val: string): string {
  return val.replace(/'/g, "''")
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'number') return val.toString()
  return `'${escapeSqlite(String(val))}'`
}

// ============================================================
// PARSER DE MySQL INSERT
// ============================================================

/** Estado del parser */
type ParserState = 'idle' | 'in_insert_header' | 'in_values'

/** Resultado parseado de un INSERT */
interface ParsedInsert {
  tableName: string
  columns: string[]
  rows: string[][]  // Cada row es un array de strings (valores crudos)
}

/**
 * Parser de MySQL INSERT statements.
 * Lee línea por línea y extrae INSERTs con sus VALUES multi-fila.
 * 
 * Maneja:
 * - INSERT INTO `table` (cols) VALUES
 * - Múltiples filas: (val1, val2), (val3, val4), ...;
 * - Strings con 'escaping' y '' dobles
 * - Hex strings (0x...) para BLOBs
 * - NULL values
 * - Fechas en formato MySQL
 */
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
  private totalInsertsParsed = 0
  
  /** Callback llamado cuando se completa un INSERT completo */
  onInsert: ((insert: ParsedInsert) => void) | null = null
  /** Callback para reportar progreso */
  onProgress: ((line: number, total: number, inserts: number) => void) | null = null

  /** Procesa una línea del archivo SQL */
  processLine(line: string): void {
    this.lineNumber++

    // Reportar progreso periódicamente
    if (this.lineNumber % 5000 === 0) {
      this.onProgress?.(this.lineNumber, 0, this.totalInsertsParsed)
    }

    // Detectar inicio de INSERT
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
      
      // La línea puede contener VALUES y datos en la misma línea
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
          // Verificar si es un escape '' o cierre de string
          if (i + 1 < chunk.length && chunk[i + 1] === "'") {
            this.currentValue += "'"
            i++ // saltar el siguiente '
          } else {
            this.inString = false
          }
        } else if (ch === '\\' && i + 1 < chunk.length) {
          // MySQL backslash escaping (if sql_mode includes NO_BACKSLASH_ESCAPES)
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
        
        // Verificar si hay más valores o si terminó
        const rest = chunk.substring(i + 1).trim()
        if (rest.startsWith(',')) {
          this.currentRows.push(this.currentRow)
          this.currentRow = []
          this.currentValue = ''
          i += rest.indexOf(',') // saltar la coma
          // Continuar parseando el resto
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

      // Ignorar whitespace entre valores (fuera de strings)
      if (this.parenDepth === 1 || !/\s/.test(ch)) {
        this.currentValue += ch
      }
    }

    // Si terminó la línea y estamos en un string sin cerrar, agregar newline
    if (this.inString) {
      this.currentValue += '\n'
    }
  }

  private flushCurrentInsert(): void {
    if (this.currentTable && this.currentRows.length > 0) {
      this.totalInsertsParsed++
      if (this.onInsert) {
        this.onInsert({
          tableName: this.currentTable,
          columns: this.currentColumns,
          rows: this.currentRows,
        })
      }
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

  getTotalParsed(): number {
    return this.totalInsertsParsed
  }
}

// ============================================================
// TRANSFORMADORES DE DATOS
// ============================================================

interface MigrationContext {
  write: (sql: string) => void
  writeln: (sql?: string) => void
  outStream: import('fs').WriteStream
  photosDir: string
}

/**
 * Convierte un hex string de MySQL (0xABCDEF) a un Buffer
 */
function parseHexString(hexStr: string): Buffer | null {
  if (!hexStr || hexStr === 'NULL') return null
  const cleaned = hexStr.replace(/^0x/i, '')
  if (!cleaned || cleaned.length === 0) return null
  return Buffer.from(cleaned, 'hex')
}

/**
 * Convierte un hex string a base64 (para fotos que se guardarán como archivo)
 */
function hexToBase64(hexStr: string): string | null {
  const buf = parseHexString(hexStr)
  if (!buf) return null
  return buf.toString('base64')
}

/**
 * Parsea un valor del SQL antiguo a su tipo JS
 */
function parseSqlValue(raw: string): unknown {
  if (!raw || raw === 'NULL' || raw === 'null') return null
  if (raw.startsWith('0x')) return raw // hex string, se maneja aparte
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1)
  // NOTA: NO convertir a número para preservar ceros a la izquierda
  // (ej: código de acceso '0212' debe seguir siendo '0212', no 212)
  // Todos los llamados usan String(), parseFloat() o parseInt() explícitamente.
  return raw
}

/**
 * Convierte fecha MySQL (datetime, date) a string ISO
 */
function parseDate(raw: unknown): string | null {
  if (!raw || raw === 'NULL' || raw === 'null') return null
  const str = String(raw).replace(/'/g, '')
  // MySQL datetime: '2024-01-15 10:30:00' o date: '2024-01-15'
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 19).replace('T', ' ')
  }
  return null
}

// ============================================================
// TABLA: estado → (referencia para mapeo de IDs)
// ============================================================

function transformEstado(insert: ParsedInsert, ctx: MigrationContext): void {
  for (const row of insert.rows) {
    const id = parseInt(row[0] || '0', 10)
    const nombre = String(parseSqlValue(row[1]) || '').trim().toLowerCase()
    idMapping.estado.set(id, nombre)
  }
}

// ============================================================
// TABLA: ctipomembresia → (referencia para mapeo de tipos)
// ============================================================

function transformCtipomembresia(insert: ParsedInsert, ctx: MigrationContext): void {
  for (const row of insert.rows) {
    const id = parseInt(row[0] || '0', 10)
    const nombre = String(parseSqlValue(row[1]) || '').trim()
    idMapping.ctipomembresia.set(id, nombre)
  }
}

// ============================================================
// TABLA: socio → clients
// ============================================================

/** Obtener el estado de un socio basado en idEstado */
function getClientStatus(estadoId: number): string {
  const estado = idMapping.estado.get(estadoId) || ''
  switch (estado) {
    case 'activo': return 'active'
    case 'inactivo': return 'inactive'
    default: return 'inactive'
  }
}

function transformSocio(insert: ParsedInsert, ctx: MigrationContext): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  
  // Mapear índices de columnas
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  for (const row of insert.rows) {
    const oldId = parseInt(row[idx['idsocio']] || '0', 10)
    if (!oldId) continue

    const newUuid = newId()
    idMapping.socio.set(oldId, newUuid)

    // Construir full_name
    const nombre = String(parseSqlValue(row[idx['nombre']]) || '')
    const paterno = String(parseSqlValue(row[idx['paterno']]) || '')
    const materno = String(parseSqlValue(row[idx['materno']]) || '')
    const fullName = [nombre, paterno, materno].filter(Boolean).join(' ').trim()

    const phone = String(parseSqlValue(row[idx['telefono']]) || '')
    const email = String(parseSqlValue(row[idx['correo']]) || '')
    const accessCode = String(parseSqlValue(row[idx['clave']]) || '')
    const birthDate = parseDate(row[idx['fechanacimiento']])
    const registrationDate = parseDate(row[idx['fechacreacion']]) || new Date().toISOString().split('T')[0]
    const idEstado = parseInt(row[idx['idestado']] || '1', 10)
    const status = getClientStatus(idEstado)
    const observaciones = String(parseSqlValue(row[idx['observaciones']]) || '')

    // Manejar foto (hex string → archivo)
    let photoPath: string | null = null
    let photoBase64: string | null = null
    const rawPhoto = row[idx['foto']]
    if (rawPhoto && rawPhoto !== 'NULL' && rawPhoto.startsWith('0x')) {
      photoBase64 = hexToBase64(rawPhoto)
      if (photoBase64) {
        const fileName = `${newUuid}.jpg`
        photoPath = join(ctx.photosDir, fileName)
        try {
          if (!existsSync(ctx.photosDir)) {
            mkdirSync(ctx.photosDir, { recursive: true })
          }
          writeFileSync(photoPath, Buffer.from(photoBase64, 'base64'))
          photoPath = fileName // solo el nombre, la ruta completa la maneja la app
        } catch {
          photoPath = null
        }
      }
    }

    ctx.writeln(`INSERT INTO clients (id, full_name, document_id, birth_date, gender, phone, email, address, photo_path, registration_date, access_code, status, emergency_name, emergency_phone, emergency_relationship, emergency_notes, created_at, updated_at) VALUES (`)
    ctx.writeln(`  ${formatValue(newUuid)},`)
    ctx.writeln(`  ${formatValue(fullName)},`)
    ctx.writeln(`  ${formatValue(`OLD-${oldId}`)},`) // document_id from old system
    ctx.writeln(`  ${formatValue(birthDate)},`)
    ctx.writeln(`  'not_specified',`) // gender - no disponible en DB antigua
    ctx.writeln(`  ${formatValue(phone)},`)
    ctx.writeln(`  ${formatValue(email)},`)
    ctx.writeln(`  ${formatValue(observaciones)},`) // address ← observaciones
    ctx.writeln(`  ${formatValue(photoPath)},`)
    ctx.writeln(`  ${formatValue(registrationDate)},`)
    ctx.writeln(`  ${formatValue(accessCode)},`)
    ctx.writeln(`  ${formatValue(status)},`)
    ctx.writeln(`  NULL, NULL, NULL, NULL,`) // emergency contact
    ctx.writeln(`  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP`)
    ctx.writeln(`);`)
  }
}

// ============================================================
// TABLA: membresia + ctipomembresia → membership_plans
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

function calculateDurationDays(idTipo: number, meses: number, semanas: number, dias: number): number {
  switch (idTipo) {
    case 1: return meses * 30 || 30 // mensual
    case 2: return semanas * 7 || 7 // semanal
    case 3: return dias || 1 // días
    default: return 30
  }
}

function transformMembresia(insert: ParsedInsert, ctx: MigrationContext): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  for (const row of insert.rows) {
    const oldId = parseInt(row[idx['idmembresia']] || '0', 10)
    if (!oldId) continue

    const newUuid = newId()
    idMapping.membresia.set(oldId, newUuid)

    const name = String(parseSqlValue(row[idx['nombre']]) || '').trim()
    idMapping.membresia_name.set(oldId, name) // Guardar nombre para resolver plan_name en memberships
    const price = parseFloat(String(parseSqlValue(row[idx['precio']]) || '0'))
    const idTipo = parseInt(row[idx['idtipomembresia']] || '1', 10)
    const meses = parseInt(row[idx['meses']] || '0', 10)
    const semanas = parseInt(row[idx['semanas']] || '0', 10)
    const dias = parseInt(row[idx['dias']] || '0', 10)
    const idEstado = parseInt(row[idx['idestado']] || '1', 10)

    const membershipType = mapMembershipType(idTipo)
    const durationDays = calculateDurationDays(idTipo, meses, semanas, dias)

    ctx.writeln(`INSERT INTO membership_plans (id, name, type, price, duration_days, description, is_active, created_at) VALUES (`)
    ctx.writeln(`  ${formatValue(newUuid)},`)
    ctx.writeln(`  ${formatValue(name)},`)
    ctx.writeln(`  ${formatValue(membershipType)},`)
    ctx.writeln(`  ${price},`)
    ctx.writeln(`  ${durationDays},`)
    ctx.writeln(`  ${formatValue(`Migrado del sistema anterior (Meses:${meses} Semanas:${semanas} Días:${dias})`)},`)
    ctx.writeln(`  ${idEstado === 1 ? 1 : 0},`) // is_active
    ctx.writeln(`  CURRENT_TIMESTAMP`)
    ctx.writeln(`);`)
  }
}

// ============================================================
// TABLA: sociomembresia → memberships
// ============================================================

function transformSociomembresia(insert: ParsedInsert, ctx: MigrationContext): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  for (const row of insert.rows) {
    const oldId = parseInt(row[idx['idsociomembresia']] || '0', 10)
    if (!oldId) continue

    // Filtrar membresías no activas en el sistema antiguo:
    // idEstado 1 = Activo, 2 = Inactivo, 3 = Eliminado.
    // Las eliminadas/inactivas no eran membresías reales (no aparecían
    // en el sistema antiguo) y NO deben importarse ni sus pagos.
    const idEstado = parseInt(row[idx['idestado']] || '1', 10)
    if (idEstado !== 1) {
      console.warn(`  ⚠️  Saltando sociomembresia ${oldId}: idEstado=${idEstado} (no activa en el sistema antiguo)`)
      continue
    }

    const newUuid = newId()
    idMapping.sociomembresia.set(oldId, newUuid)
    idMapping.sociomembresia_client.set(oldId, parseInt(row[idx['idsocio']] || '0', 10)) // Guardar para resolver client_id en pagos

    const oldSocioId = parseInt(row[idx['idsocio']] || '0', 10)
    const oldMembresiaId = parseInt(row[idx['idmembresia']] || '0', 10)
    const newClientId = idMapping.socio.get(oldSocioId) || ''
    const newPlanId = idMapping.membresia.get(oldMembresiaId) || ''

    if (!newClientId || !newPlanId) {
      console.warn(`  ⚠️  Saltando sociomembresia ${oldId}: socio ${oldSocioId} o plan ${oldMembresiaId} no encontrado`)
      continue
    }

    // Resolver plan_name desde el mapeo de membresia
    const planName = idMapping.membresia_name.get(oldMembresiaId) || ''
    const startDate = parseDate(row[idx['fechainiciomembresia']]) || parseDate(row[idx['fechacreacion']])
    const endDate = parseDate(row[idx['vencimiento']])
    const estadoMembresia = String(parseSqlValue(row[idx['estadomembresia']]) || '').trim().toLowerCase()
    
    // Mapear estado
    let status = 'active'
    if (estadoMembresia === 'pagada') {
      status = 'active'
    } else if (estadoMembresia === 'sin pagar') {
      status = 'expired'
    }

    // Si la fecha de vencimiento ya pasó, marcar como expired
    if (endDate) {
      const end = new Date(endDate)
      if (end < new Date() && status === 'active') {
        status = 'expired'
      }
    }

    ctx.writeln(`INSERT INTO memberships (id, client_id, plan_id, plan_name, start_date, end_date, status, created_at) VALUES (`)
    ctx.writeln(`  ${formatValue(newUuid)},`)
    ctx.writeln(`  ${formatValue(newClientId)},`)
    ctx.writeln(`  ${formatValue(newPlanId)},`)
    ctx.writeln(`  ${formatValue(planName)},`)
    ctx.writeln(`  ${formatValue(startDate)},`)
    ctx.writeln(`  ${formatValue(endDate)},`)
    ctx.writeln(`  ${formatValue(status)},`)
    ctx.writeln(`  CURRENT_TIMESTAMP`)
    ctx.writeln(`);`)
  }
}

// ============================================================
// TABLA: sociomembresia_pago → payments
// ============================================================

function transformSociomembresiaPago(insert: ParsedInsert, ctx: MigrationContext): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  for (const row of insert.rows) {
    const oldSocioMembresiaId = parseInt(row[idx['idsociomembresia']] || '0', 10)
    const newMembershipId = idMapping.sociomembresia.get(oldSocioMembresiaId) || ''

    if (!newMembershipId) {
      // Esperado: membresías eliminadas (idEstado=3) se saltan con sus pagos
      console.log(`  ℹ️  Saltando pago de sociomembresia ${oldSocioMembresiaId} (eliminada o inactiva en el sistema antiguo)`)
      continue
    }

    // Resolver client_id: sociomembresia → idSocio → clients.uuid
    const oldSocioId = idMapping.sociomembresia_client.get(oldSocioMembresiaId)
    const clientId = oldSocioId ? (idMapping.socio.get(oldSocioId) || '') : ''

    const newUuid = newId()
    const importe = parseFloat(String(parseSqlValue(row[idx['importe']]) || '0'))
    const fecha = parseDate(row[idx['fecha']])

    ctx.writeln(`INSERT INTO payments (id, client_id, membership_id, amount, discount, method, description, date, notes, created_at) VALUES (`)
    ctx.writeln(`  ${formatValue(newUuid)},`)
    ctx.writeln(`  ${formatValue(clientId || null)},`)
    ctx.writeln(`  ${formatValue(newMembershipId)},`)
    ctx.writeln(`  ${importe},`)
    ctx.writeln(`  0,`) // discount
    ctx.writeln(`  'cash',`) // method - no disponible en DB antigua
    ctx.writeln(`  ${formatValue('Pago migrado del sistema anterior')},`)
    ctx.writeln(`  ${formatValue(fecha)},`)
    ctx.writeln(`  NULL,`)
    ctx.writeln(`  CURRENT_TIMESTAMP`)
    ctx.writeln(`);`)
  }
}

// ============================================================
// TABLA: registro → access_logs
// ============================================================

function transformRegistro(insert: ParsedInsert, ctx: MigrationContext): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  for (const row of insert.rows) {
    const oldSocioId = parseInt(row[idx['idsocio']] || '0', 10)
    const newClientId = idMapping.socio.get(oldSocioId) || ''

    if (!newClientId) continue

    const newUuid = newId()
    const fecha = parseDate(row[idx['fechacreacion']])
    const clientName = '' // No disponible en registro

    ctx.writeln(`INSERT INTO access_logs (id, client_id, client_name, access_code, access_type, result, message, timestamp) VALUES (`)
    ctx.writeln(`  ${formatValue(newUuid)},`)
    ctx.writeln(`  ${formatValue(newClientId)},`)
    ctx.writeln(`  ${formatValue('')},`) // client_name
    ctx.writeln(`  ${formatValue('')},`) // access_code - no disponible
    ctx.writeln(`  'check_in',`)
    ctx.writeln(`  'granted',`)
    ctx.writeln(`  ${formatValue('Migrado del sistema anterior')},`)
    ctx.writeln(`  ${formatValue(fecha)}`)
    ctx.writeln(`);`)
  }
}

// ============================================================
// TABLA: producto → products
// ============================================================

function transformProducto(insert: ParsedInsert, ctx: MigrationContext): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

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

    ctx.writeln(`INSERT INTO products (id, name, category, description, price, cost, stock, min_stock, barcode, is_active, created_at, updated_at) VALUES (`)
    ctx.writeln(`  ${formatValue(newUuid)},`)
    ctx.writeln(`  ${formatValue(name)},`)
    ctx.writeln(`  'other',`) // category - no disponible
    ctx.writeln(`  ${formatValue(descripcion)},`)
    ctx.writeln(`  ${precio},`)
    ctx.writeln(`  ${costo},`)
    ctx.writeln(`  0,`) // stock - no disponible
    ctx.writeln(`  5,`) // min_stock default
    ctx.writeln(`  ${formatValue('')},`) // barcode
    ctx.writeln(`  ${idEstado === 1 ? 1 : 0},`)
    ctx.writeln(`  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP`)
    ctx.writeln(`);`)
  }
}

// ============================================================
// TABLA: socio_muestra → body_measurements
// ============================================================

function transformSocioMuestra(insert: ParsedInsert, ctx: MigrationContext): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  for (const row of insert.rows) {
    const oldId = parseInt(row[idx['id']] || '0', 10)
    if (!oldId) continue

    const oldSocioId = parseInt(row[idx['idsocio']] || '0', 10)
    const newClientId = idMapping.socio.get(oldSocioId) || ''
    if (!newClientId) continue

    const newUuid = newId()
    idMapping.socio_muestra.set(oldId, newUuid)

    const fecha = parseDate(row[idx['fecha']]) || parseDate(row[idx['fechamuestra']])
    const peso = parseFloat(String(parseSqlValue(row[idx['peso']]) || '0')) || null
    const estatura = parseFloat(String(parseSqlValue(row[idx['estatura']]) || '0')) || null
    const grasa = parseFloat(String(parseSqlValue(row[idx['porcentajegrasacorporal']]) || '0')) || null
    const masaMuscular = parseFloat(String(parseSqlValue(row[idx['porcentajemasamuscular']]) || '0')) || null
    const observacion = String(parseSqlValue(row[idx['observacion']]) || '')

    ctx.writeln(`INSERT INTO body_measurements (id, client_id, date, weight, height, body_fat, notes) VALUES (`)
    ctx.writeln(`  ${formatValue(newUuid)},`)
    ctx.writeln(`  ${formatValue(newClientId)},`)
    ctx.writeln(`  ${formatValue(fecha)},`)
    ctx.writeln(`  ${peso !== null ? peso.toString() : 'NULL'},`)
    ctx.writeln(`  ${estatura !== null ? estatura.toString() : 'NULL'},`)
    ctx.writeln(`  ${grasa !== null ? grasa.toString() : 'NULL'},`)
    ctx.writeln(`  ${formatValue(observacion)}`)
    ctx.writeln(`);`)

    // También crear un ClientGoal si hay masa muscular
    if (masaMuscular !== null || observacion) {
      const goalId = newId()
      ctx.writeln(`INSERT INTO client_goals (id, client_id, goal, start_date, notes, is_active, created_at) VALUES (`)
      ctx.writeln(`  ${formatValue(goalId)},`)
      ctx.writeln(`  ${formatValue(newClientId)},`)
      ctx.writeln(`  'maintain',`) // goal por defecto
      ctx.writeln(`  ${formatValue(fecha || new Date().toISOString().split('T')[0])},`)
      ctx.writeln(`  ${formatValue(`Migrado: Peso ${peso || '?'}kg, Grasa ${grasa || '?'}%, Musculo ${masaMuscular || '?'}%. ${observacion}`)},`)
      ctx.writeln(`  1, CURRENT_TIMESTAMP`)
      ctx.writeln(`);`)
    }
  }
}

// ============================================================
// TABLA: configuracion → settings
// ============================================================

function transformConfiguracion(insert: ParsedInsert, ctx: MigrationContext): void {
  if (insert.rows.length === 0) return

  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  const row = insert.rows[0] // Solo una fila de configuración

  const gymName = String(parseSqlValue(row[idx['nombregimnacio']]) || 'BODYFITGYM')
  const address = String(parseSqlValue(row[idx['domicilio']]) || '')
  const phone = String(parseSqlValue(row[idx['telefono']]) || '')
  const mensaje = String(parseSqlValue(row[idx['mensaje']]) || 'Bienvenido, nos complace que seas parte de nuestro equipo.')
  const rfc = String(parseSqlValue(row[idx['rfc']]) || '')
  const ticketFooter = String(parseSqlValue(row[idx['ticketfooter']]) || '')
  const ticketWidth = parseInt(String(parseSqlValue(row[idx['ticketancho']]) || '190'), 10)
  const ticketFontSize = parseInt(String(parseSqlValue(row[idx['ticketfontsize']]) || '12'), 10)
  const ticketFontName = String(parseSqlValue(row[idx['ticketfontname']]) || 'Arial')
  const folderBackup = String(parseSqlValue(row[idx['folderbackup']]) || '')

  ctx.writeln(`-- Configuración del gimnasio migrada`)
  ctx.writeln(`INSERT INTO settings (key, value) VALUES ('gym_name', ${formatValue(gymName)});`)
  ctx.writeln(`INSERT INTO settings (key, value) VALUES ('gym_address', ${formatValue(address)});`)
  ctx.writeln(`INSERT INTO settings (key, value) VALUES ('gym_phone', ${formatValue(phone)});`)
  ctx.writeln(`INSERT INTO settings (key, value) VALUES ('gym_welcome_message', ${formatValue(mensaje)});`)
  ctx.writeln(`INSERT INTO settings (key, value) VALUES ('gym_rfc', ${formatValue(rfc)});`)
  ctx.writeln(`INSERT INTO settings (key, value) VALUES ('ticket_footer', ${formatValue(ticketFooter)});`)
  ctx.writeln(`INSERT INTO settings (key, value) VALUES ('ticket_width', ${formatValue(String(ticketWidth))});`)
  ctx.writeln(`INSERT INTO settings (key, value) VALUES ('ticket_font_size', ${formatValue(String(ticketFontSize))});`)
  ctx.writeln(`INSERT INTO settings (key, value) VALUES ('ticket_font_name', ${formatValue(ticketFontName)});`)

  if (folderBackup) {
    ctx.writeln(`INSERT INTO settings (key, value) VALUES ('backup_folder', ${formatValue(folderBackup)});`)
  }

  // Logo
  const rawLogo = row[idx['logo']]
  if (rawLogo && rawLogo !== 'NULL' && rawLogo.startsWith('0x')) {
    try {
      // Guardar logo como archivo PNG
      const logoFileName = 'gym_logo.png'
      const logoPath = join(ctx.photosDir, logoFileName)
      const logoBuf = parseHexString(rawLogo)
      if (logoBuf) {
        if (!existsSync(ctx.photosDir)) {
          mkdirSync(ctx.photosDir, { recursive: true })
        }
        writeFileSync(logoPath, logoBuf)
        ctx.writeln(`INSERT INTO settings (key, value) VALUES ('gym_logo_path', ${formatValue(logoFileName)});`)
      }
    } catch (e) {
      console.warn('  ⚠️  Error al exportar logo:', e)
    }
  }
}

// ============================================================
// TABLA: usuario → users
// ============================================================

function transformUsuario(insert: ParsedInsert, ctx: MigrationContext): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  for (const row of insert.rows) {
    const oldId = parseInt(row[idx['idusuario']] || '0', 10)
    if (!oldId) continue

    const newUuid = newId()
    idMapping.usuario.set(oldId, newUuid)

    const username = String(parseSqlValue(row[idx['usuario']]) || '').trim()
    const nombre = String(parseSqlValue(row[idx['nombre']]) || '').trim()
    const password = String(parseSqlValue(row[idx['password']]) || '')
    const idEstado = parseInt(row[idx['idestado']] || '1', 10)

    // Nota: La contraseña está en texto plano en la BD antigua.
    // Se asigna contraseña por defecto (admin123). El usuario deberá cambiarla.
    console.warn(`  ⚠️  Usuario "${username}": contraseña en texto plano. Se asignará contraseña por defecto (admin123).`)
    console.warn(`      🔑 El usuario deberá cambiar su contraseña después de la migración.`)
    
    // Hash válido de bcrypt para 'admin123' generado con bcryptjs.hashSync('admin123', 10)
    const passwordHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

    ctx.writeln(`INSERT INTO users (id, username, full_name, password_hash, role, permissions, is_active, created_at, updated_at) VALUES (`)
    ctx.writeln(`  ${formatValue(newUuid)},`)
    ctx.writeln(`  ${formatValue(username.toLowerCase())},`)
    ctx.writeln(`  ${formatValue(nombre)},`)
    ctx.writeln(`  ${formatValue(passwordHash)},`)
    ctx.writeln(`  'admin',`) // role por defecto (se puede ajustar manualmente)
    ctx.writeln(`  '["*"]',`) // permisos totales
    ctx.writeln(`  ${idEstado === 1 ? 1 : 0},`)
    ctx.writeln(`  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP`)
    ctx.writeln(`);`)
  }
}

// ============================================================
// TABLA: entrada + detalleentrada → inventory_movements (type='in')
// ============================================================

// Necesitamos almacenar temporalmente las entradas para vincular con sus detalles
interface TempEntrada {
  id: number
  total: number
  fecha: string | null
}

const tempEntradas: Map<number, TempEntrada> = new Map()

function transformEntrada(insert: ParsedInsert, ctx: MigrationContext): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  for (const row of insert.rows) {
    const id = parseInt(row[idx['identrada']] || '0', 10)
    if (!id) continue

    tempEntradas.set(id, {
      id,
      total: parseFloat(String(parseSqlValue(row[idx['total']]) || '0')),
      fecha: parseDate(row[idx['fechacreacion']]),
    })
  }
}

function transformDetalleentrada(insert: ParsedInsert, ctx: MigrationContext): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  for (const row of insert.rows) {
    const idEntrada = parseInt(row[idx['identrada']] || '0', 10)
    const idProducto = parseInt(row[idx['idproducto']] || '0', 10)
    const newProductId = idMapping.producto.get(idProducto) || ''
    const entrada = tempEntradas.get(idEntrada)

    if (!newProductId || !entrada) continue

    const newUuid = newId()
    const costoUnitario = parseFloat(String(parseSqlValue(row[idx['costounitario']]) || '0'))
    const productName = '' // No disponible en detalle
    const quantity = 1 // No hay cantidad en detalle, asumimos 1
    const total = costoUnitario * quantity

    ctx.writeln(`INSERT INTO inventory_movements (id, product_id, product_name, type, quantity, price, total, description, user_id, user_name, timestamp) VALUES (`)
    ctx.writeln(`  ${formatValue(newUuid)},`)
    ctx.writeln(`  ${formatValue(newProductId)},`)
    ctx.writeln(`  ${formatValue('')},`) // product_name
    ctx.writeln(`  'in',`)
    ctx.writeln(`  ${quantity},`)
    ctx.writeln(`  ${costoUnitario},`)
    ctx.writeln(`  ${total},`)
    ctx.writeln(`  ${formatValue('Migrado del sistema anterior (Entrada)')},`)
    ctx.writeln(`  NULL, NULL,`) // user_id, user_name
    ctx.writeln(`  ${formatValue(entrada.fecha)}`)
    ctx.writeln(`);`)
  }
}

// ============================================================
// TABLA: salida + detallesalida → inventory_movements (type='out')
// ============================================================

interface TempSalida {
  id: number
  total: number
  fecha: string | null
}

const tempSalidas: Map<number, TempSalida> = new Map()

function transformSalida(insert: ParsedInsert, ctx: MigrationContext): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  for (const row of insert.rows) {
    const id = parseInt(row[idx['idsalida']] || '0', 10)
    if (!id) continue

    tempSalidas.set(id, {
      id,
      total: parseFloat(String(parseSqlValue(row[idx['total']]) || '0')),
      fecha: parseDate(row[idx['fechacreacion']]),
    })
  }
}

function transformDetallesalida(insert: ParsedInsert, ctx: MigrationContext): void {
  const cols = insert.columns.map(c => c.toLowerCase())
  const idx: Record<string, number> = {}
  cols.forEach((c, i) => { idx[c] = i })

  for (const row of insert.rows) {
    const idSalida = parseInt(row[idx['idsalida']] || '0', 10)
    const idProducto = parseInt(row[idx['idproducto']] || '0', 10)
    const newProductId = idMapping.producto.get(idProducto) || ''
    const salida = tempSalidas.get(idSalida)

    if (!newProductId || !salida) continue

    const newUuid = newId()
    const precioUnitario = parseFloat(String(parseSqlValue(row[idx['preciounitario']]) || '0'))
    const quantity = 1 // No hay cantidad, asumimos 1

    ctx.writeln(`INSERT INTO inventory_movements (id, product_id, product_name, type, quantity, price, total, description, user_id, user_name, timestamp) VALUES (`)
    ctx.writeln(`  ${formatValue(newUuid)},`)
    ctx.writeln(`  ${formatValue(newProductId)},`)
    ctx.writeln(`  ${formatValue('')},`) // product_name
    ctx.writeln(`  'out',`)
    ctx.writeln(`  ${quantity},`)
    ctx.writeln(`  ${precioUnitario},`)
    ctx.writeln(`  ${precioUnitario},`)
    ctx.writeln(`  ${formatValue('Migrado del sistema anterior (Salida)')},`)
    ctx.writeln(`  NULL, NULL,`) // user_id, user_name
    ctx.writeln(`  ${formatValue(salida.fecha)}`)
    ctx.writeln(`);`)
  }
}

// ============================================================
// DISPATCHER DE TABLAS
// ============================================================

interface TableHandler {
  name: string
  handler: (insert: ParsedInsert, ctx: MigrationContext) => void
  /** Si es true, se procesa después de que todas las tablas dependencies se hayan procesado */
  needsDependencies?: boolean
}

const tableHandlers: TableHandler[] = [
  { name: 'estado', handler: transformEstado },
  { name: 'ctipomembresia', handler: transformCtipomembresia },
  { name: 'socio', handler: transformSocio },
  { name: 'membresia', handler: transformMembresia },
  { name: 'sociomembresia', handler: transformSociomembresia },
  { name: 'sociomembresia_pago', handler: transformSociomembresiaPago },
  { name: 'registro', handler: transformRegistro },
  { name: 'producto', handler: transformProducto },
  { name: 'socio_muestra', handler: transformSocioMuestra },
  { name: 'configuracion', handler: transformConfiguracion },
  { name: 'usuario', handler: transformUsuario },
  { name: 'entrada', handler: transformEntrada },
  { name: 'detalleentrada', handler: transformDetalleentrada },
  { name: 'salida', handler: transformSalida },
  { name: 'detallesalida', handler: transformDetallesalida },
]

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════')
  console.log('  🚀 BodyFitGym - Migración de Datos Legacy')
  console.log('═══════════════════════════════════════════════')
  console.log()
  
  // Verificar que existe el archivo de la BD antigua
  if (!existsSync(OLD_DB_PATH)) {
    console.error(`❌ No se encontró el archivo: ${OLD_DB_PATH}`)
    process.exit(1)
  }

  const stats = existsSync(OLD_DB_PATH) ? (await import('fs')).statSync(OLD_DB_PATH) : null
  console.log(`📂 Base de datos antigua: ${OLD_DB_PATH}`)
  if (stats) {
    console.log(`📏 Tamaño: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
  }
  console.log(`📁 Output: ${OUTPUT_SQL_PATH}`)
  console.log(`🖼️  Fotos: ${PHOTOS_OUTPUT_DIR}`)
  console.log()

  // Preparar directorio de output
  if (!existsSync(dirname(OUTPUT_SQL_PATH))) {
    mkdirSync(dirname(OUTPUT_SQL_PATH), { recursive: true })
  }
  if (!existsSync(PHOTOS_OUTPUT_DIR)) {
    mkdirSync(PHOTOS_OUTPUT_DIR, { recursive: true })
  }

  // Abrir stream de escritura
  const outStream = createWriteStream(OUTPUT_SQL_PATH, { encoding: 'utf-8' })
  const ctx: MigrationContext = {
    write: (sql: string) => outStream.write(sql),
    writeln: (sql?: string) => outStream.write((sql || '') + '\n'),
    outStream,
    photosDir: PHOTOS_OUTPUT_DIR,
  }

  // Escribir header del archivo SQLite
  ctx.writeln('-- ===================================================')
  ctx.writeln('-- BodyFitGym - Datos Migrados del Sistema Anterior')
  ctx.writeln(`-- Generado: ${new Date().toISOString()}`)
  ctx.writeln('-- ===================================================')
  ctx.writeln()
  ctx.writeln('-- PRAGMA foreign_keys = OFF para permitir importación ordenada')
  ctx.writeln('PRAGMA foreign_keys = OFF;')
  ctx.writeln()
  ctx.writeln("-- ===================================================")
  ctx.writeln("-- LIMPIEZA: Eliminar datos migrados previamente (re-ejecución segura)")
  ctx.writeln("-- ===================================================")
  ctx.writeln("DELETE FROM payments;")
  ctx.writeln("DELETE FROM inventory_movements;")
  ctx.writeln("DELETE FROM body_measurements;")
  ctx.writeln("DELETE FROM client_goals;")
  ctx.writeln("DELETE FROM access_logs;")
  ctx.writeln("DELETE FROM memberships;")
  ctx.writeln("DELETE FROM clients;")
  ctx.writeln("DELETE FROM membership_plans;")
  ctx.writeln("DELETE FROM products;")
  ctx.writeln("DELETE FROM settings WHERE key LIKE 'gym_%' OR key LIKE 'ticket_%' OR key = 'backup_folder' OR key = 'gym_logo_path';")
  ctx.writeln("DELETE FROM users WHERE id != 'user_admin';")
  ctx.writeln()

  // Contadores
  const insertCounts: Record<string, number> = {}
  let totalInserts = 0

  // Crear parser y leer el archivo
  const parser = new MysqlInsertParser()

  parser.onInsert = (insert: ParsedInsert) => {
    const tableName = insert.tableName.toLowerCase()
    const handler = tableHandlers.find(h => h.name === tableName)
    
    if (handler) {
      try {
        handler.handler(insert, ctx)
        insertCounts[tableName] = (insertCounts[tableName] || 0) + insert.rows.length
        totalInserts += insert.rows.length
      } catch (err) {
        console.error(`❌ Error procesando tabla ${tableName}:`, err)
      }
    } else {
      // Tabla no mapeada - ignorar silenciosamente
      if (!['clase', 'clase_socio', 'cmodulo', 'rol', 'rol_modulo', 'control_backup', 'control_mail', 'rol_modulo'].includes(tableName)) {
        // Solo mostrar warning para tablas desconocidas
        console.warn(`  ⚠️  Tabla no mapeada: ${tableName} (${insert.rows.length} filas ignoradas)`)
      }
    }
  }

  parser.onProgress = (line: number, _total: number, inserts: number) => {
    if (line % 5000 === 0) {
      console.log(`  📄 Línea ${line.toLocaleString()}... (${inserts} INSERTs procesados)`)
    }
  }

  console.log('⏳ Iniciando parseo y transformación...')
  console.log()

  // Leer el archivo línea por línea
  const rl = createInterface({
    input: createReadStream(OLD_DB_PATH, { encoding: 'utf-8', highWaterMark: 1024 * 1024 }),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    parser.processLine(line)
  }

  parser.finish()

  // Seed para client_number_seq
  ctx.writeln('-- ===================================================')
  ctx.writeln('-- DATOS ADICIONALES')
  ctx.writeln('-- ===================================================')
  ctx.writeln('INSERT OR IGNORE INTO client_number_seq (id, last_number) VALUES (1, 1000);')
  ctx.writeln()

  // Cerrar el stream
  ctx.writeln('PRAGMA foreign_keys = ON;')
  ctx.writeln()
  ctx.writeln('-- ===================================================')
  ctx.writeln('-- Fin de la migración')
  ctx.writeln('-- ===================================================')

  outStream.end()

  console.log()
  console.log('═══════════════════════════════════════════════')
  console.log('  ✅ Migración completada')
  console.log('═══════════════════════════════════════════════')
  console.log()
  console.log('📊 Resumen de datos migrados:')
  console.log()

  // Mostrar resumen ordenado
  const sortedTables = Object.entries(insertCounts).sort((a, b) => b[1] - a[1])
  for (const [table, count] of sortedTables) {
    console.log(`  📦 ${table.padEnd(25)} ${count.toString().padStart(6)} registros`)
  }
  console.log()
  console.log(`  📦 TOTAL${'─'.repeat(17)} ${totalInserts.toString().padStart(6)} registros`)
  console.log()

  // Guardar mapeo de IDs
  const idMapOutput: Record<string, Record<string, string>> = {}
  for (const [table, map] of Object.entries(idMapping)) {
    idMapOutput[table] = Object.fromEntries(map)
  }
  writeFileSync(ID_MAP_PATH, JSON.stringify(idMapOutput, null, 2))
  console.log(`🔗 Mapeo de IDs guardado en: ${ID_MAP_PATH}`)

  const outSize = existsSync(OUTPUT_SQL_PATH) ? (await import('fs')).statSync(OUTPUT_SQL_PATH).size : 0
  console.log(`📁 Archivo generado: ${OUTPUT_SQL_PATH} (${(outSize / 1024 / 1024).toFixed(2)} MB)`)
  console.log()
  console.log('📋 Próximos pasos:')
  console.log('  1. Revisa el archivo generatedo: migrated-data.sql')
  console.log('  2. Verifica el mapeo de IDs en: id_mapping.json')
  console.log('  3. Para importar los datos, usa la función de restore en la app o')
  console.log('     ejecuta: npx tsx scripts/import-migrated-data.ts')
  console.log()
}

main().catch((err) => {
  console.error('❌ Error en la migración:', err)
  process.exit(1)
})
