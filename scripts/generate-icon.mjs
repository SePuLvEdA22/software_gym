import { writeFileSync, mkdirSync } from 'fs'
import { deflateSync } from 'zlib'

function crc32(buf) {
  let crc = 0xFFFFFFFF
  const table = new Int32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crcData = Buffer.concat([t, data])
  const c = Buffer.alloc(4)
  c.writeUInt32BE(crc32(crcData))
  return Buffer.concat([len, t, data, c])
}

function createPNG(size) {
  const W = size, H = size
  // Raw RGBA
  const raw = Buffer.alloc((W * 4 + 1) * H)
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0
    for (let x = 0; x < W; x++) {
      const o = y * (W * 4 + 1) + 1 + x * 4
      const cx = x - W / 2, cy = y - H / 2, d = Math.sqrt(cx * cx + cy * cy)
      const inCircle = d < W / 2 - 4
      const inBorder = d >= W / 2 - 4 && d <= W / 2
      if (inBorder) {
        raw[o] = 0xFF; raw[o + 1] = 0x6B; raw[o + 2] = 0x00; raw[o + 3] = 0xFF // orange
      } else if (inCircle) {
        raw[o] = 0x1A; raw[o + 1] = 0x1A; raw[o + 2] = 0x2E; raw[o + 3] = 0xFF // dark bg
      } else {
        raw[o] = 0; raw[o + 1] = 0; raw[o + 2] = 0; raw[o + 3] = 0 // transparent
      }
      // Draw "B" letter in orange
      if (inCircle && x > W * 0.3 && x < W * 0.6) {
        const bx = x / W, by = y / H
        const inStem = bx > 0.32 && bx < 0.42
        const inTopLoop = by > 0.15 && by < 0.42 && bx > 0.34 && bx < 0.58
        const inBotLoop = by > 0.55 && by < 0.85 && bx > 0.34 && bx < 0.58
        const isTopLoopHollow = by > 0.22 && by < 0.38 && bx > 0.42 && bx < 0.54
        const isBotLoopHollow = by > 0.62 && by < 0.78 && bx > 0.42 && bx < 0.54
        if ((inStem && inCircle) || (inTopLoop && !isTopLoopHollow) || (inBotLoop && !isBotLoopHollow)) {
          raw[o] = 0xFF; raw[o + 1] = 0x6B; raw[o + 2] = 0x00; raw[o + 3] = 0xFF
        }
      }
    }
  }

  const compressed = deflateSync(raw)
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

mkdirSync('resources', { recursive: true })
writeFileSync('resources/icon.png', createPNG(256))
writeFileSync('resources/icon.ico', createPNG(256))
console.log('Icon created: resources/icon.png, resources/icon.ico')
