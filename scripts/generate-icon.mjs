import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { Jimp } from 'jimp'

const SRC = join('resources', 'logo-original.png')
const OUT_PNG = join('resources', 'icon.png')
const OUT_ICO = join('resources', 'icon.ico')
const ICO_SIZES = [16, 32, 48, 64, 128, 256]
const PNG_MASTER = 512

if (!existsSync(SRC)) {
  console.error(`[icons] No se encontro ${SRC}`)
  console.error('Coloca el logo del gym (PNG, idealmente >=512x512) con ese nombre y vuelve a ejecutar.')
  process.exit(1)
}

function icoFromPngs(entries) {
  const count = entries.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  const dir = Buffer.alloc(16 * count)
  let offset = 6 + 16 * count
  const pngs = []
  for (let i = 0; i < count; i++) {
    const { size, png } = entries[i]
    const e = i * 16
    dir[e] = size >= 256 ? 0 : size
    dir[e + 1] = size >= 256 ? 0 : size
    dir[e + 2] = 0
    dir[e + 3] = 0
    dir.writeUInt16LE(1, e + 4)
    dir.writeUInt16LE(32, e + 6)
    dir.writeUInt32LE(png.length, e + 8)
    dir.writeUInt32LE(offset, e + 12)
    pngs.push(png)
    offset += png.length
  }
  return Buffer.concat([header, dir, ...pngs])
}

const logo = await Jimp.read(SRC)
console.log(`[icons] Logo original: ${logo.bitmap.width}x${logo.bitmap.height}`)

const master = logo.clone().cover({ w: PNG_MASTER, h: PNG_MASTER })
writeFileSync(OUT_PNG, await master.getBuffer('image/png'))
console.log(`[icons] Generado ${OUT_PNG} (${PNG_MASTER}x${PNG_MASTER})`)

const icoEntries = []
for (const size of ICO_SIZES) {
  const resized = master.clone().resize({ w: size, h: size })
  icoEntries.push({ size, png: await resized.getBuffer('image/png') })
}
writeFileSync(OUT_ICO, icoFromPngs(icoEntries))
console.log(`[icons] Generado ${OUT_ICO} (multi-tamano ${ICO_SIZES.join('/')})`)