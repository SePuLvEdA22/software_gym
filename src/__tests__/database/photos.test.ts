import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync } from 'fs'
import { Jimp } from 'jimp'
import { initDatabase, closeDatabase, getDatabase } from '../../main/database/index'
import { createClient, getAllClients, getClientById } from '../../main/database/clients'
import { generateThumbnail, scheduleThumbnail } from '../../main/photos'
import type { Client } from '../../shared/types'

const sampleClient: Omit<Client, 'id' | 'registrationDate'> = {
  fullName: 'Cliente Foto',
  documentId: 'FOTO-001',
  birthDate: '1990-05-15',
  gender: 'male',
  phone: '3001112233',
  email: 'foto@example.com',
  address: 'Calle 1',
  photo: null,
  accessCode: '908070',
  status: 'active',
  emergencyContact: { name: '', phone: '', relationship: '', notes: '' },
}

async function makePhotoBase64(width = 640, height = 480): Promise<string> {
  const image = new Jimp({ width, height, color: 0x3366ccff })
  const buffer = await image.getBuffer('image/jpeg', { quality: 90 })
  return buffer.toString('base64')
}

describe('Miniaturas de fotos de clientes', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  it('debería generar una miniatura JPEG de 160px desde la foto completa', async () => {
    const photo = await makePhotoBase64()
    const client = createClient({ ...sampleClient, documentId: `FOTO-${Date.now()}`, photo })
    const db = getDatabase()
    const row = db.prepare('SELECT photo_path FROM clients WHERE id = ?').get(client.id) as {
      photo_path: string
    }

    const thumbPath = await generateThumbnail(row.photo_path, client.id)
    expect(thumbPath).not.toBeNull()
    expect(existsSync(thumbPath!)).toBe(true)

    const thumb = await Jimp.read(thumbPath!)
    expect(thumb.width).toBe(160)
    expect(thumb.height).toBe(160)
  })

  it('debería persistir la miniatura y usarla en los listados', async () => {
    const photo = await makePhotoBase64()
    const client = createClient({
      ...sampleClient,
      documentId: `FOTO-${Date.now()}`,
      accessCode: `F${Date.now()}`,
      photo,
    })

    await scheduleThumbnail(client.id)

    // El detalle usa la foto completa; el listado usa la miniatura.
    const detail = getClientById(client.id)
    const listing = getAllClients(1, 50, 'active').data.find((c) => c.id === client.id)

    expect(detail?.photo).toBe(photo)
    expect(listing?.photo).toBeDefined()
    expect(listing?.photo).not.toBe(photo)

    const originalSize = photo.length
    const thumbSize = (listing?.photo || '').length
    expect(thumbSize).toBeLessThan(originalSize)
  })

  it('debería devolver null si el archivo fuente no existe', async () => {
    const result = await generateThumbnail('/ruta/inexistente.jpg', 'no-existe')
    expect(result).toBeNull()
  })
})
