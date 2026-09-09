import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, readFileSync, rmSync, createWriteStream } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { Jimp } from 'jimp'
import * as yazl from 'yazl'
import * as yauzl from 'yauzl'
import { initDatabase, closeDatabase, getDatabase } from '../../main/database/index'
import { createClient } from '../../main/database/clients'
import { createFullBackup, restoreFullBackup } from '../../main/fullBackup'
import { getPhotosDir } from '../../main/photos'
import type { Client } from '../../shared/types'

const sampleClient = (
  overrides: Partial<Omit<Client, 'id' | 'registrationDate'>>,
): Omit<Client, 'id' | 'registrationDate'> => ({
  fullName: 'Cliente Backup',
  documentId: 'BKP-001',
  birthDate: '1990-05-15',
  gender: 'male',
  phone: '3001112233',
  email: 'backup@example.com',
  address: 'Calle 1',
  photo: null,
  accessCode: '123456',
  status: 'active',
  emergencyContact: { name: '', phone: '', relationship: '', notes: '' },
  ...overrides,
})

async function makePhotoBase64(): Promise<string> {
  const image = new Jimp({ width: 32, height: 32, color: 0x3366ccff })
  const buffer = await image.getBuffer('image/jpeg', { quality: 60 })
  return buffer.toString('base64')
}

function listZipEntries(zipPath: string): Promise<string[]> {
  return new Promise((resolvePromise, reject) => {
    const entries: string[] = []
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error('No se pudo abrir el ZIP'))
        return
      }
      zipfile.on('error', reject)
      zipfile.on('end', () => resolvePromise(entries))
      zipfile.on('entry', (entry) => {
        entries.push(entry.fileName)
        zipfile.readEntry()
      })
      zipfile.readEntry()
    })
  })
}

describe('Respaldo completo (BD + fotos)', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  it('round-trip: crea un zip con BD + fotos de clientes actuales y restaura ambos', async () => {
    // Estado inicial: A y B con foto, C sin foto (solo estos 3 clientes).
    const photoA = await makePhotoBase64()
    const photoB = await makePhotoBase64()
    const clientA = createClient(sampleClient({ fullName: 'A Con Foto', documentId: `A-${Date.now()}`, accessCode: `A${Date.now()}`.slice(-6), photo: photoA }))
    const clientB = createClient(sampleClient({ fullName: 'B Con Foto', documentId: `B-${Date.now()}`, accessCode: `B${Date.now()}`.slice(-6), photo: photoB }))
    const clientC = createClient(sampleClient({ fullName: 'C Sin Foto', documentId: `C-${Date.now()}`, accessCode: `C${Date.now()}`.slice(-6), photo: null }))

    const zipPath = join(tmpdir(), `bfg-full-${randomUUID()}.zip`)
    const created = await createFullBackup(zipPath)
    expect(created.success).toBe(true)
    expect(created.photoCount).toBe(2)
    expect(existsSync(zipPath)).toBe(true)

    const entries = await listZipEntries(zipPath)
    expect(entries).toContain('bodyfitgym.db')
    const photoEntries = entries.filter((e) => e.startsWith('photos/'))
    expect(photoEntries.sort()).toEqual([`photos/${clientA.id}.jpg`, `photos/${clientB.id}.jpg`].sort())

    // Tras el respaldo: se crea D con foto y se borra la foto de A.
    const photoD = await makePhotoBase64()
    const clientD = createClient(sampleClient({ fullName: 'D Posterior', documentId: `D-${Date.now()}`, accessCode: `D${Date.now()}`.slice(-6), photo: photoD }))
    const photosDir = getPhotosDir()
    const aPhotoPath = join(photosDir, `${clientA.id}.jpg`)
    rmSync(aPhotoPath, { force: true })

    const restored = await restoreFullBackup(zipPath, { regenerateThumbnails: false })
    expect(restored.success).toBe(true)
    expect(restored.photoCount).toBe(2)

    const db = getDatabase()
    const allIds = (db.prepare('SELECT id FROM clients').all() as { id: string }[]).map((r) => r.id)
    expect(allIds.sort()).toEqual([clientA.id, clientB.id, clientC.id].sort())
    expect(allIds).not.toContain(clientD.id)

    // La foto de A se restauró byte a byte; D (creado después) quedó fuera.
    expect(existsSync(aPhotoPath)).toBe(true)
    expect(readFileSync(aPhotoPath).equals(Buffer.from(photoA, 'base64'))).toBe(true)
    expect(existsSync(join(photosDir, `${clientD.id}.jpg`))).toBe(false)

    rmSync(zipPath, { force: true })
  })

  it('createFullBackup devuelve error si la ruta destino no existe', async () => {
    const badPath = join(tmpdir(), 'no-existe', 'sub', 'backup.zip')
    const result = await createFullBackup(badPath)
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('restoreFullBackup rechaza un archivo inexistente', async () => {
    const result = await restoreFullBackup(join(tmpdir(), 'no-existe.zip'), { regenerateThumbnails: false })
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('restoreFullBackup rechaza un zip que no contiene bodyfitgym.db', async () => {
    const zipPath = join(tmpdir(), `bfg-bad-${randomUUID()}.zip`)
    const zipfile = new yazl.ZipFile()
    zipfile.addBuffer(Buffer.from('foto'), 'photos/abc.jpg', { compress: false })
    await new Promise<void>((resolvePromise, reject) => {
      const out = createWriteStream(zipPath)
      zipfile.outputStream.pipe(out)
      out.on('error', reject)
      out.on('close', () => resolvePromise())
      zipfile.end()
    })

    const result = await restoreFullBackup(zipPath, { regenerateThumbnails: false })
    expect(result.success).toBe(false)
    expect(result.error).toContain('bodyfitgym.db')

    rmSync(zipPath, { force: true })
  })
})
