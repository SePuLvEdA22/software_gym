/**
 * 🔧 Script de Reparación de Mojibake en la Base de Datos de BodyFitGym
 *
 * Corrige los caracteres con doble codificación ("Ã'" en vez de "Ñ", "Ã¡" en vez
 * de "á", etc.) heredados de la migración del sistema antiguo.
 *
 * Uso:
 *   npx tsx scripts/fix-mojibake-db.ts                          # BD de la app (userData)
 *   npx tsx scripts/fix-mojibake-db.ts --db ./path/bodyfitgym.db  # BD específica
 *   npx tsx scripts/fix-mojibake-db.ts --dry-run                # Solo contar sin escribir
 *
 * Requisitos:
 *   - La app BodyFitGym NO debe estar corriendo (la BD estaría en uso).
 */

import { readFileSync, existsSync, writeFileSync, copyFileSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'
import initSqlJs from 'sql.js'
import { fixMojibake } from '../src/shared/encoding'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')

// ============================================================
// ARGUMENTOS
// ============================================================

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const dbArgIndex = args.indexOf('--db')

function defaultAppDbPath(): string {
  // userData de Electron en Windows: %APPDATA%/bodyfitgym/bodyfitgym.db
  const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
  return join(appData, 'bodyfitgym', 'bodyfitgym.db')
}

const dbPath =
  dbArgIndex >= 0 && dbArgIndex + 1 < args.length ? args[dbArgIndex + 1] : defaultAppDbPath()

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════')
  console.log('  🔧 BodyFitGym - Reparación de Mojibake')
  console.log('═══════════════════════════════════════════════')
  console.log()

  if (!existsSync(dbPath)) {
    console.error(`❌ No se encontró la base de datos: ${dbPath}`)
    process.exit(1)
  }

  const size = (statSync(dbPath).size / 1024 / 1024).toFixed(2)
  console.log(`📂 Base de datos: ${dbPath} (${size} MB)`)
  console.log(isDryRun ? '🏁 Modo DRY RUN — no se escribirán cambios' : '')
  console.log()

  // Backup (solo en modo real)
  let backupPath: string | null = null
  if (!isDryRun) {
    backupPath = `${dbPath}.backup-mojibake-${Date.now()}`
    copyFileSync(dbPath, backupPath)
    console.log(`💾 Backup creado: ${backupPath}`)
    console.log()
  }

  // Abrir BD
  const Sql = await initSqlJs()
  const db = new Sql.Database(readFileSync(dbPath))

  // Listar tablas
  const tablesResult = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  ) as { values: unknown[][] }[]
  const tables = tablesResult[0]?.values.map((r) => String(r[0])) || []
  console.log(`📋 Tablas encontradas: ${tables.length}`)
  console.log()

  let totalFixed = 0
  let totalChanged = 0
  const perTable: Record<string, number> = {}

  for (const table of tables) {
    // Obtener columnas y sus tipos
    const colsResult = db.exec(`PRAGMA table_info("${table}")`) as { values: unknown[][] }[]
    const cols = (colsResult[0]?.values || []).map((r) => ({
      name: String(r[1]),
      type: String(r[2] || '').toUpperCase(),
      pk: Number(r[5]) === 1,
    }))

    // Solo columnas de texto (TEXT, VARCHAR, CHAR, o sin tipo explícito en SQLite)
    const textCols = cols.filter(
      (c) =>
        !c.pk &&
        (c.type.includes('TEXT') ||
          c.type.includes('CHAR') ||
          c.type === '' ||
          c.type.includes('CLOB')),
    )

    if (textCols.length === 0) continue

    // Leer todos los valores de esas columnas
    const colList = textCols.map((c) => `"${c.name}"`).join(', ')
    const rowsResult = db.exec(`SELECT rowid, ${colList} FROM "${table}"`) as {
      values: unknown[][]
    }[]
    const rows = rowsResult[0]?.values || []

    let tableFixed = 0
    for (const row of rows) {
      const rowid = row[0]
      const updates: string[] = []
      const params: (string | number)[] = []

      for (let i = 0; i < textCols.length; i++) {
        const raw = row[i + 1]
        if (raw === null || raw === undefined) continue
        const value = String(raw)
        const fixed = fixMojibake(value)
        if (fixed !== value) {
          updates.push(`"${textCols[i].name}" = ?`)
          params.push(fixed)
          tableFixed++
        }
      }

      if (updates.length > 0) {
        params.push(rowid)
        db.run(`UPDATE "${table}" SET ${updates.join(', ')} WHERE rowid = ?`, params)
        totalChanged++
      }
    }

    if (tableFixed > 0) {
      perTable[table] = tableFixed
      totalFixed += tableFixed
      console.log(
        `  ✏️  ${table.padEnd(25)} ${tableFixed.toString().padStart(4)} valores corregidos`,
      )
    }
  }

  console.log()
  console.log('═══════════════════════════════════════════════')
  if (totalFixed === 0) {
    console.log('  ✅ No se encontraron caracteres con mojibake')
  } else {
    console.log(`  ✅ ${totalFixed} valores corregidos en ${totalChanged} registros`)
    console.log(`  📊 ${JSON.stringify(perTable)}`)
  }
  console.log('═══════════════════════════════════════════════')
  console.log()

  if (isDryRun) {
    console.log('🏁 DRY RUN finalizado — no se guardaron cambios.')
    console.log('   Ejecuta sin --dry-run para aplicar la reparación.')
  } else {
    // Guardar BD
    const data = db.export()
    writeFileSync(dbPath, Buffer.from(data))
    const newSize = (Buffer.from(data).length / 1024 / 1024).toFixed(2)
    console.log(`💾 Base de datos guardada: ${newSize} MB`)
    if (backupPath) {
      console.log(`   Backup disponible en: ${backupPath}`)
    }
    console.log()
    console.log('📋 Al reiniciar BodyFitGym verás los nombres corregidos.')
  }

  db.close()
}

main().catch((err) => {
  console.error('❌ Error en la reparación:', err)
  process.exit(1)
})
