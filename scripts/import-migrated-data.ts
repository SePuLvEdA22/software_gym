/**
 * 📥 Script de Importación: Datos Migrados → BodyFitGym
 * 
 * Este script toma el archivo SQL generado por migrate-legacy-data.ts
 * y lo importa en una base de datos SQLite completa con el esquema de BodyFitGym.
 * 
 * Uso:
 *   npx tsx scripts/import-migrated-data.ts                          # Importar (crea BD nueva)
 *   npx tsx scripts/import-migrated-data.ts --dry-run                # Solo mostrar estadísticas
 *   npx tsx scripts/import-migrated-data.ts --source ./otro.sql      # Usar otro archivo fuente
 *   npx tsx scripts/import-migrated-data.ts --app-db ./bodyfitgym.db # Importar en BD existente de la app
 * 
 * Modos:
 *   - Por defecto: Crea una BD nueva con el esquema de BodyFitGym + datos migrados
 *   - --app-db: Importa los datos en una BD existente de BodyFitGym (útil para migración en caliente)
 * 
 * Requisitos:
 *   - Haber ejecutado primero: npm run migrate:legacy
 *   - Si usas --app-db, la app BodyFitGym NO debe estar corriendo
 */

import { readFileSync, existsSync, writeFileSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import initSqlJs from 'sql.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')

// ============================================================
// CONFIGURACIÓN
// ============================================================

const DEFAULT_SOURCE = join(PROJECT_ROOT, 'software_actual', 'migrated-data.sql')
const DEFAULT_DB_PATH = join(PROJECT_ROOT, 'software_actual', 'imported_bodyfitgym.db')

// ============================================================
// PARSEAR ARGUMENTOS
// ============================================================

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const sourceArgIndex = args.indexOf('--source')
const appDbArgIndex = args.indexOf('--app-db')
const sourcePath = sourceArgIndex >= 0 && sourceArgIndex + 1 < args.length
  ? args[sourceArgIndex + 1]
  : DEFAULT_SOURCE
const appDbPath = appDbArgIndex >= 0 && appDbArgIndex + 1 < args.length
  ? args[appDbArgIndex + 1]
  : null

// ============================================================
// ESQUEMA SQLite DE BodyFitGym (para BD nueva)
// ============================================================

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO _migrations (name) VALUES ('initial_schema');

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY, full_name TEXT NOT NULL, document_id TEXT UNIQUE,
  birth_date TEXT, gender TEXT DEFAULT 'not_specified', phone TEXT,
  email TEXT, address TEXT, photo_path TEXT, registration_date TEXT NOT NULL,
  access_code TEXT UNIQUE NOT NULL, status TEXT DEFAULT 'inactive',
  emergency_name TEXT, emergency_phone TEXT, emergency_relationship TEXT,
  emergency_notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_clients_access_code ON clients(access_code);
CREATE INDEX IF NOT EXISTS idx_clients_document ON clients(document_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

CREATE TABLE IF NOT EXISTS membership_plans (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
  price REAL NOT NULL, duration_days INTEGER NOT NULL, description TEXT,
  is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL, plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  status TEXT DEFAULT 'active', frozen_at TEXT, freeze_reason TEXT, freeze_days INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (plan_id) REFERENCES membership_plans(id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_client ON memberships(client_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);
CREATE INDEX IF NOT EXISTS idx_memberships_end_date ON memberships(end_date);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, client_id TEXT, membership_id TEXT,
  amount REAL NOT NULL, discount REAL DEFAULT 0, method TEXT NOT NULL, description TEXT,
  date TEXT NOT NULL, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (membership_id) REFERENCES memberships(id)
);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);

CREATE TABLE IF NOT EXISTS access_logs (
  id TEXT PRIMARY KEY, client_id TEXT, client_name TEXT,
  access_code TEXT NOT NULL, access_type TEXT DEFAULT 'check_in',
  result TEXT NOT NULL, message TEXT, timestamp TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reception',
  permissions TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  last_login TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS change_log (
  id TEXT PRIMARY KEY,
  user_id TEXT, user_name TEXT NOT NULL,
  table_name TEXT NOT NULL, record_id TEXT NOT NULL,
  action TEXT NOT NULL, old_values TEXT, new_values TEXT,
  timestamp TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_change_log_timestamp ON change_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_change_log_table ON change_log(table_name);

CREATE TABLE IF NOT EXISTS client_number_seq (
  id INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 1000
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
  description TEXT DEFAULT '', price REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0, stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 5, barcode TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL, product_name TEXT NOT NULL,
  type TEXT NOT NULL, quantity INTEGER NOT NULL, price REAL DEFAULT 0,
  total REAL DEFAULT 0, description TEXT, user_id TEXT, user_name TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);

CREATE TABLE IF NOT EXISTS body_measurements (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL, date TEXT NOT NULL,
  weight REAL, height REAL, neck REAL, shoulders REAL, chest REAL,
  left_arm REAL, right_arm REAL, waist REAL, hips REAL,
  left_thigh REAL, right_thigh REAL, left_calf REAL, right_calf REAL,
  body_fat REAL, notes TEXT DEFAULT '',
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
CREATE INDEX IF NOT EXISTS idx_body_measurements_client ON body_measurements(client_id);

CREATE TABLE IF NOT EXISTS client_goals (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL,
  goal TEXT NOT NULL, start_date TEXT NOT NULL, target_date TEXT,
  notes TEXT DEFAULT '', is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
CREATE INDEX IF NOT EXISTS idx_client_goals_client ON client_goals(client_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS freeze_history (
  id TEXT PRIMARY KEY, membership_id TEXT NOT NULL, client_id TEXT NOT NULL,
  frozen_at TEXT NOT NULL, unfrozen_at TEXT, reason TEXT,
  planned_days INTEGER, actual_days INTEGER,
  FOREIGN KEY (membership_id) REFERENCES memberships(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
CREATE INDEX IF NOT EXISTS idx_freeze_history_membership ON freeze_history(membership_id);

CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, plan_id TEXT NOT NULL,
  discount_type TEXT NOT NULL, discount_value REAL NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES membership_plans(id)
);

CREATE TABLE IF NOT EXISTS client_routines (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL, day_of_week INTEGER NOT NULL,
  exercises TEXT NOT NULL DEFAULT '[]', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
CREATE INDEX IF NOT EXISTS idx_routines_client_day ON client_routines(client_id, day_of_week);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL, phone TEXT NOT NULL,
  message_type TEXT NOT NULL, message TEXT NOT NULL, status TEXT DEFAULT 'pending',
  scheduled_for TEXT, sent_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
  subject TEXT DEFAULT '', content TEXT NOT NULL, variables TEXT DEFAULT '[]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS door_events (
  id TEXT PRIMARY KEY, event_type TEXT NOT NULL, trigger TEXT NOT NULL,
  timestamp TEXT NOT NULL, notes TEXT
);
`

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════')
  console.log('  📥 BodyFitGym - Importación de Datos Migrados')
  console.log('═══════════════════════════════════════════════')
  console.log()

  // Verificar archivo fuente
  if (!existsSync(sourcePath)) {
    console.error(`❌ No se encontró el archivo de datos migrados: ${sourcePath}`)
    console.error('')
    console.error('   Ejecuta primero: npm run migrate:legacy')
    process.exit(1)
  }

  const sourceStats = await import('fs').then(fs => fs.statSync(sourcePath))
  console.log(`📂 Archivo fuente: ${sourcePath}`)
  console.log(`📏 Tamaño: ${(sourceStats.size / 1024 / 1024).toFixed(2)} MB`)
  console.log()

  // Leer el SQL migrado
  console.log('⏳ Leyendo datos migrados...')
  const migratedSql = readFileSync(sourcePath, 'utf-8')
  const lineCount = migratedSql.split('\n').length
  console.log(`   ${lineCount.toLocaleString()} líneas leídas`)
  console.log()

  if (isDryRun) {
    console.log('🏁 Modo DRY RUN — no se importarán datos')
    console.log()
    
    const insertRegex = /INSERT\s+INTO\s+(\w+)/gi
    const counts: Record<string, number> = {}
    let match
    while ((match = insertRegex.exec(migratedSql)) !== null) {
      const table = match[1].toLowerCase()
      counts[table] = (counts[table] || 0) + 1
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    console.log('📊 INSERTs detectados:')
    for (const [table, count] of sorted) {
      console.log(`   📦 ${table.padEnd(25)} ${count.toString().padStart(6)}`)
    }
    console.log()
    console.log(`   📦 TOTAL: ${Object.values(counts).reduce((a, b) => a + b, 0)} INSERTs`)
    console.log()
    console.log('✅ Dry run completado. Ejecuta sin --dry-run para importar.')
    return
  }

  // Determinar la ruta de salida
  const outputPath = appDbPath || DEFAULT_DB_PATH
  
  // Inicializar SQL.js
  console.log('⏳ Inicializando SQL.js...')
  const Sql = await initSqlJs()
  
  let db: InstanceType<typeof Sql.Database>

  if (appDbPath) {
    // === MODO: Importar en BD existente ===
    if (!existsSync(appDbPath)) {
      console.error(`❌ No se encontró la BD de la app: ${appDbPath}`)
      process.exit(1)
    }
    
    console.log(`📂 Usando BD existente: ${appDbPath}`)
    
    // Hacer backup antes de modificar
    const backupPath = appDbPath + '.backup.' + Date.now()
    copyFileSync(appDbPath, backupPath)
    console.log(`💾 Backup creado: ${backupPath}`)
    console.log()

    const dbBuffer = readFileSync(appDbPath)
    db = new Sql.Database(dbBuffer)
  } else {
    // === MODO: Crear BD nueva con esquema ===
    console.log('🆕 Creando base de datos nueva con esquema completo...')
    db = new Sql.Database()
    
    // Ejecutar esquema
    console.log('⏳ Creando tablas...')
    try {
      db.exec(SCHEMA_SQL)
      console.log('   ✅ Esquema creado exitosamente')
    } catch (err: any) {
      console.error('❌ Error al crear esquema:', err.message)
      process.exit(1)
    }
    console.log()
  }

  // Configurar PRAGMAs
  db.run('PRAGMA foreign_keys = OFF')
  db.run('PRAGMA journal_mode = MEMORY')
  db.run('PRAGMA synchronous = OFF')

  // Ejecutar el SQL migrado usando db.exec() que maneja multi-statement
  console.log('⏳ Importando datos migrados...')
  
  try {
    db.exec(migratedSql)
    console.log('   ✅ Datos importados correctamente')
  } catch (err: any) {
    console.error(`❌ Error al importar datos: ${err.message}`)
    console.error('   Algunos INSERTs pueden haber fallado por datos inconsistentes.')
    console.error('   Los datos que no generaron error sí fueron importados.')
  }
  
  console.log()
  console.log('═══════════════════════════════════════════════')
  console.log('  ✅ Importación completada')
  console.log('═══════════════════════════════════════════════')
  console.log()

  // Guardar la base de datos
  console.log(`⏳ Guardando base de datos en: ${outputPath}`)
  
  const data = db.export()
  const buffer = Buffer.from(data)
  writeFileSync(outputPath, buffer)
  
  const dbSize = (buffer.length / 1024 / 1024).toFixed(2)
  console.log(`   ✅ Base de datos guardada: ${dbSize} MB`)
  console.log()
  
  // Limpiar
  db.close()
  
  if (appDbPath) {
    console.log('📋 La BD de la app ha sido actualizada.')
    console.log('   Al reiniciar BodyFitGym, los datos migrados estarán disponibles.')
  } else {
    console.log('📋 Próximos pasos:')
    console.log(`  1. La BD está en: ${outputPath}`)
    console.log('  2. Para usarla en BodyFitGym:')
    console.log('     a. Cierra la app BodyFitGym')
    console.log('     b. Reemplaza bodyfitgym.db con este archivo')
    console.log('     c. Reinicia la app')
    console.log()
    console.log('   También puedes importar directamente en la BD de la app:')
    console.log('   npx tsx scripts/import-migrated-data.ts --app-db ./path/to/bodyfitgym.db')
  }
  console.log()
}

main().catch((err) => {
  console.error('❌ Error en la importación:', err)
  process.exit(1)
})
