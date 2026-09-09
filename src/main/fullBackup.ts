import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  rmSync,
  statSync
} from 'fs'
import { tmpdir } from 'os'
import { join, resolve, basename, dirname, sep } from 'path'
import { randomUUID } from 'crypto'
import log from 'electron-log'
import * as yazl from 'yazl'
import * as yauzl from 'yauzl'
import { getDatabase, restoreDatabase } from './database'
import { getPhotosDir, resolvePhotoPath, ensureThumbnails } from './photos'
import { toErrorMessage } from '../shared/errors'

const DB_ENTRY = 'bodyfitgym.db'
const PHOTOS_PREFIX = 'photos/'

/** Fotografías gestionadas por la app: siempre <clientId>.jpg (UUID v4). */
const CLIENT_PHOTO_FILE = /^[0-9a-fA-F-]{36}\.jpg$/

export interface FullBackupResult {
  success: boolean
  error?: string
  /** Ruta del archivo generado (solo al crear). */
  filePath?: string
  /** Cantidad de fotos incluidas (crear) o restauradas (restaurar). */
  photoCount: number
}

function writeZipFile(zipfile: yazl.ZipFile, destPath: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const out = createWriteStream(destPath)
    out.on('error', reject)
    out.on('close', () => resolvePromise())
    zipfile.on('error', reject)
    zipfile.outputStream.pipe(out)
    zipfile.end()
  })
}

/**
 * Respaldo COMPLETO manual: un solo .zip con la base de datos (snapshot
 * consistente vía db.export(), igual que los respaldos .db) más las fotos de
 * los clientes actuales (userData/photos/<id>.jpg). Las miniaturas no se
 * incluyen: se regeneran automáticamente tras restaurar.
 *
 * Se usa streaming con método STORE (los JPEG ya vienen comprimidos) para no
 * cargar cientos de MB en memoria ni bloquear el proceso main.
 */
export async function createFullBackup(destZipPath: string): Promise<FullBackupResult> {
  try {
    const db = getDatabase()
    const zipfile = new yazl.ZipFile()
    zipfile.addBuffer(db.export(), DB_ENTRY, { compress: false })

    let photoCount = 0
    const added = new Set<string>()
    const rows = db
      .prepare(
        "SELECT id, photo_path FROM clients WHERE photo_path IS NOT NULL AND photo_path != ''",
      )
      .all() as { id: string; photo_path: string }[]

    for (const row of rows) {
      const filePath = resolvePhotoPath(row.photo_path)
      if (!filePath || added.has(filePath)) continue
      added.add(filePath)
      zipfile.addFile(filePath, `${PHOTOS_PREFIX}${basename(filePath)}`, { compress: false })
      photoCount++
    }

    await writeZipFile(zipfile, destZipPath)
    log.info(`Full backup created: ${destZipPath} (${photoCount} photos)`)
    return { success: true, filePath: destZipPath, photoCount }
  } catch (error) {
    log.error('Full backup error:', error)
    return { success: false, error: toErrorMessage(error), photoCount: 0 }
  }
}

/** Extrae el zip a un directorio temporal validando nombres de entrada. */
function extractBackupZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    let settled = false
    const fail = (err: Error): void => {
      if (!settled) {
        settled = true
        reject(err)
      }
    }
    yauzl.open(zipPath, { lazyEntries: true }, (openErr, zipfile) => {
      if (openErr || !zipfile) {
        fail(openErr ?? new Error('No se pudo abrir el archivo ZIP'))
        return
      }
      zipfile.on('error', fail)
      zipfile.on('end', () => {
        if (!settled) {
          settled = true
          resolvePromise()
        }
      })
      zipfile.on('entry', (entry) => {
        const name = entry.fileName
        // Solo nos interesan la base de datos y las fotos; evita path traversal.
        if (name !== DB_ENTRY && !name.startsWith(PHOTOS_PREFIX)) {
          zipfile.readEntry()
          return
        }
        if (/\/$/.test(name)) {
          zipfile.readEntry()
          return
        }
        const target = resolve(destDir, name)
        if (!target.startsWith(destDir + sep)) {
          zipfile.readEntry()
          return
        }
        zipfile.openReadStream(entry, (streamErr, stream) => {
          if (streamErr || !stream) {
            fail(streamErr ?? new Error('No se pudo leer una entrada del ZIP'))
            return
          }
          mkdirSync(dirname(target), { recursive: true })
          const out = createWriteStream(target)
          out.on('error', fail)
          out.on('close', () => zipfile.readEntry())
          stream.pipe(out)
        })
      })
      zipfile.readEntry()
    })
  })
}

/**
 * Reemplaza las fotos de clientes del directorio photos/ por las del respaldo.
 * Solo toca lo que la app gestiona (fotos <uuid>.jpg y la carpeta thumbs):
 * archivos ajenos (p. ej. el logo) se conservan.
 */
function replaceClientPhotos(photosSrcDir: string): number {
  const photosDir = getPhotosDir()
  let removed = 0
  try {
    rmSync(join(photosDir, 'thumbs'), { recursive: true, force: true })
  } catch {
    /* noop */
  }
  for (const file of readdirSync(photosDir)) {
    if (CLIENT_PHOTO_FILE.test(file)) {
      try {
        rmSync(join(photosDir, file), { force: true })
        removed++
      } catch {
        /* noop */
      }
    }
  }
  let count = 0
  for (const file of readdirSync(photosSrcDir)) {
    const src = join(photosSrcDir, file)
    if (!statSync(src).isFile()) continue
    copyFileSync(src, join(photosDir, file))
    count++
  }
  if (removed > 0 || count > 0) {
    log.info(`Photos replaced: removed ${removed}, restored ${count}`)
  }
  return count
}

/**
 * Restaura un respaldo completo (.zip generado por createFullBackup): repone
 * la base de datos (misma lógica que restoreDatabase) y, si el zip trae
 * fotos, reemplaza las fotos de clientes por las del respaldo e invalida las
 * miniaturas para que el backfill las regenere en segundo plano.
 */
export async function restoreFullBackup(
  srcZipPath: string,
  options: { regenerateThumbnails?: boolean } = {},
): Promise<FullBackupResult> {
  const regenerateThumbnails = options.regenerateThumbnails ?? true
  if (!existsSync(srcZipPath)) {
    return { success: false, error: 'El archivo de respaldo no existe', photoCount: 0 }
  }
  const tmpDir = join(tmpdir(), `bodyfitgym-restore-${randomUUID()}`)
  mkdirSync(tmpDir, { recursive: true })
  try {
    await extractBackupZip(srcZipPath, tmpDir)

    const dbSnapshot = join(tmpDir, DB_ENTRY)
    if (!existsSync(dbSnapshot)) {
      return {
        success: false,
        error: 'El respaldo no contiene la base de datos (bodyfitgym.db)',
        photoCount: 0
      }
    }

    const restored = await restoreDatabase(dbSnapshot)
    if (!restored) {
      return { success: false, error: 'No se pudo restaurar la base de datos', photoCount: 0 }
    }

    // Si el zip no trae fotos (respaldo creado por otra herramienta), se
    // conservan las fotos actuales sin tocar.
    const photosSrc = join(tmpDir, 'photos')
    const photoCount = existsSync(photosSrc) ? replaceClientPhotos(photosSrc) : 0

    // Las miniaturas apuntan a rutas de la máquina de origen; se invalidan
    // para que ensureThumbnails las regenere desde las fotos restauradas.
    try {
      getDatabase().prepare('UPDATE clients SET thumbnail_path = NULL').run()
    } catch (e) {
      log.warn('Could not clear thumbnail paths after restore:', e)
    }
    if (regenerateThumbnails) {
      ensureThumbnails().catch(() => {})
    }

    log.info(`Full backup restored: ${srcZipPath} (${photoCount} photos)`)
    return { success: true, photoCount }
  } catch (error) {
    log.error('Full restore error:', error)
    return { success: false, error: toErrorMessage(error), photoCount: 0 }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}
