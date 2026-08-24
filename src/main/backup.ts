import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import log from 'electron-log'
import { getDatabase, backupDatabase } from './database'
import type { BackupConfig } from '../shared/types'
import { toErrorMessage } from '../shared/errors'

const DEFAULT_RETENTION = 7

function getSetting(key: string): string | undefined {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    { value: string } | undefined
  return row?.value
}

function setSetting(key: string, value: string): void {
  const db = getDatabase()
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value)
}

export function getBackupDir(): string {
  return join(app.getPath('userData'), 'backups')
}

export function getBackupConfig(): BackupConfig {
  const backupDir = getBackupDir()
  // Solo cuentan los respaldos propios (prefijo backup-) para que el conteo
  // coincida con lo que pruneOldBackups puede eliminar.
  const files = existsSync(backupDir)
    ? readdirSync(backupDir).filter((f) => f.startsWith('backup-') && f.endsWith('.db'))
    : []
  return {
    enabled: getSetting('auto_backup_enabled') !== '0',
    retention:
      Number.parseInt(getSetting('auto_backup_retention') ?? String(DEFAULT_RETENTION), 10) ||
      DEFAULT_RETENTION,
    lastBackupAt: getSetting('auto_backup_last') ?? null,
    backupDir,
    count: files.length,
  }
}

export function setBackupConfig(config: { enabled: boolean; retention: number }): void {
  const retention = Math.max(
    1,
    Math.min(30, Number.isFinite(config.retention) ? config.retention : DEFAULT_RETENTION),
  )
  setSetting('auto_backup_enabled', config.enabled ? '1' : '0')
  setSetting('auto_backup_retention', String(retention))
}

/**
 * Elimina los respaldos más antiguos conservando los `retention` más recientes.
 * Los nombres usan formato cronológico (backup-YYYY-MM-DDTHH-MM-SS.db), por lo
 * que el orden lexicográfico equivale al orden temporal.
 */
export function pruneOldBackups(retention: number): number {
  const backupDir = getBackupDir()
  if (!existsSync(backupDir)) return 0
  const files = readdirSync(backupDir)
    .filter((f) => f.startsWith('backup-') && f.endsWith('.db'))
    .sort()
  const toDelete = files.slice(0, Math.max(0, files.length - retention))
  for (const file of toDelete) {
    try {
      unlinkSync(join(backupDir, file))
    } catch (err) {
      log.error(`Failed to delete old backup ${file}:`, err)
    }
  }
  if (toDelete.length > 0) {
    log.info(
      `Backup pruning: kept ${Math.min(files.length, retention)}, deleted ${toDelete.length}`,
    )
  }
  return toDelete.length
}

export function performAutoBackup(): { success: boolean; filePath?: string; error?: string } {
  try {
    const backupDir = getBackupDir()
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true })
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filePath = join(backupDir, `backup-${timestamp}.db`)
    const ok = backupDatabase(filePath)
    if (!ok) {
      return { success: false, error: 'No se pudo exportar la base de datos' }
    }
    setSetting('auto_backup_last', new Date().toISOString())
    const config = getBackupConfig()
    pruneOldBackups(config.retention)
    log.info(`Auto-backup created: ${filePath}`)
    return { success: true, filePath }
  } catch (error) {
    log.error('Auto-backup error:', error)
    return { success: false, error: toErrorMessage(error) }
  }
}
