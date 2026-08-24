import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import log from 'electron-log'
import type { Migration } from './types'

export const m008MigratePhotosToFiles: Migration = {
  name: '008_migrate_photos_to_files',
  run: (db) => {
    const columns = db.prepare('PRAGMA table_info(clients)').all() as Array<{ name: string }>
    const hasPhoto = columns.some(c => c.name === 'photo')
    const hasPhotoPath = columns.some(c => c.name === 'photo_path')

    if (!hasPhotoPath) {
      db.exec('ALTER TABLE clients ADD COLUMN photo_path TEXT')
    }

    if (hasPhoto && hasPhotoPath) {
      const photosDir = join(app.getPath('userData'), 'photos')
      if (!existsSync(photosDir)) {
        mkdirSync(photosDir, { recursive: true })
      }

      const clientsWithPhoto = db.prepare("SELECT id, photo FROM clients WHERE photo IS NOT NULL").all() as Array<{ id: string; photo: Buffer }>

      for (const client of clientsWithPhoto) {
        try {
          const fileName = `${client.id}.jpg`
          const filePath = join(photosDir, fileName)
          writeFileSync(filePath, client.photo)
          db.prepare('UPDATE clients SET photo_path = ? WHERE id = ?').run(filePath, client.id)
        } catch (err) {
          log.error(`Failed to export photo for client ${client.id}:`, err)
        }
      }

      const photoCount = clientsWithPhoto.length
      log.info(`Exported ${photoCount} client photos to ${photosDir}`)
    }
  }
}
