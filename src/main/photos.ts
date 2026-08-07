import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { readFile } from 'fs/promises'
import { Jimp } from 'jimp'
import log from 'electron-log'
import { getDatabase } from './database'

const THUMB_SIZE = 160

export function getThumbsDir(): string {
  const dir = join(app.getPath('userData'), 'photos', 'thumbs')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Genera una miniatura cuadrada (cover) JPEG de 160px a partir de la foto
 * completa. Retorna la ruta del archivo generado o null si falla.
 */
export async function generateThumbnail(
  sourcePath: string,
  clientId: string,
): Promise<string | null> {
  try {
    if (!sourcePath || !existsSync(sourcePath)) return null
    const buffer = await readFile(sourcePath)
    const image = await Jimp.read(buffer)
    image.cover({ w: THUMB_SIZE, h: THUMB_SIZE })
    const thumbBuffer = await image.getBuffer('image/jpeg', { quality: 70 })
    const destPath = join(getThumbsDir(), `${clientId}.jpg`)
    writeFileSync(destPath, thumbBuffer)
    return destPath
  } catch (err) {
    log.warn(`Failed to generate thumbnail for client ${clientId}:`, err)
    return null
  }
}

/**
 * Genera (y persiste) la miniatura de un cliente concreto. Se dispara en
 * segundo plano tras guardar/actualizar una foto, sin bloquear el guardado.
 */
export async function scheduleThumbnail(clientId: string): Promise<void> {
  try {
    const db = getDatabase()
    const row = db.prepare('SELECT photo_path FROM clients WHERE id = ?').get(clientId) as
      { photo_path: string | null } | undefined
    if (!row?.photo_path) return
    const destPath = await generateThumbnail(row.photo_path, clientId)
    if (destPath) {
      db.prepare('UPDATE clients SET thumbnail_path = ? WHERE id = ?').run(destPath, clientId)
    }
  } catch (err) {
    log.warn(`scheduleThumbnail failed for client ${clientId}:`, err)
  }
}

/**
 * Backfill en segundo plano: genera las miniaturas faltantes (fotos migradas
 * del sistema anterior). Cede el event loop entre clientes para no bloquear
 * el proceso main. Retorna cuántas miniaturas generó.
 */
export async function ensureThumbnails(): Promise<number> {
  try {
    const db = getDatabase()
    const rows = db
      .prepare(
        `
      SELECT id, photo_path FROM clients
      WHERE photo_path IS NOT NULL AND photo_path != ''
        AND (thumbnail_path IS NULL OR thumbnail_path = '')
    `,
      )
      .all() as { id: string; photo_path: string }[]

    let generated = 0
    for (const row of rows) {
      const destPath = await generateThumbnail(row.photo_path, row.id)
      if (destPath) {
        db.prepare('UPDATE clients SET thumbnail_path = ? WHERE id = ?').run(destPath, row.id)
        generated++
      }
      await new Promise((resolve) => setImmediate(resolve))
    }
    if (generated > 0) {
      log.info(`Generated ${generated} missing client thumbnails`)
    }
    return generated
  } catch (err) {
    log.error('ensureThumbnails error:', err)
    return 0
  }
}
