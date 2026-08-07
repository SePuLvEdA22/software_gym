/**
 * Corrección de mojibake (doble codificación) en textos importados del sistema
 * antiguo.
 *
 * El sistema antiguo guardaba caracteres UTF-8 (ej. Ñ = bytes 0xC3 0x91)
 * interpretándolos como Windows-1252: 0xC3 → "Ã", 0x91 → "'" (comilla tipográfica).
 * El resultado quedó grabado en la BD como "Ã'" en vez de "Ñ".
 *
 * fixMojibake revierte esa transformación: mapea cada carácter a su byte cp1252
 * y decodifica la secuencia como UTF-8. Es idempotente y seguro:
 * - Strings ya correctos (con tildes reales) no se tocan (sus bytes no forman
 *   una secuencia UTF-8 válida tras el mapeo inverso).
 * - Strings con caracteres fuera de cp1252 (emoji, CJK, etc.) no se tocan.
 */

/** Mapeo de los caracteres especiales cp1252 (0x80-0x9F) a su código Unicode */
const CP1252_SPECIAL: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02c6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8a, // Š
  0x2039: 0x8b, // ‹
  0x0152: 0x8c, // Œ
  0x017d: 0x8e, // Ž
  0x2018: 0x91, // '
  0x2019: 0x92, // '
  0x201c: 0x93, // "
  0x201d: 0x94, // "
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9a, // š
  0x203a: 0x9b, // ›
  0x0153: 0x9c, // œ
  0x017e: 0x9e, // ž
  0x0178: 0x9f, // Ÿ
}

const SPECIAL_TO_CP1252: Map<number, number> = new Map(
  Object.entries(CP1252_SPECIAL).map(([code, byte]) => [Number(code), byte]),
)

const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

function charToCp1252Byte(code: number): number | null {
  if (code <= 0x7f) return code
  if (code >= 0xa0 && code <= 0xff) return code // Latin-1 coincide con cp1252
  if (code >= 0x80 && code <= 0x9f) return code // C1 controls (Latin-1 estricto, p. ej. Í = C3 8D)
  const special = SPECIAL_TO_CP1252.get(code)
  return special !== undefined ? special : null
}

/**
 * Revierte la doble codificación cp1252→UTF-8 si el string parece mojibake.
 * Devuelve el string corregido o el original si no aplica.
 */
export function fixMojibake(input: string): string {
  if (!input) return input

  // Rápido: sin caracteres no-ASCII no puede haber mojibake.
  let hasNonAscii = false
  for (let i = 0; i < input.length; i++) {
    if (input.charCodeAt(i) > 0x7f) {
      hasNonAscii = true
      break
    }
  }
  if (!hasNonAscii) return input

  // Mapear cada carácter a su byte cp1252. Si hay un carácter no representable,
  // el string no es mojibake puro → no tocar.
  const bytes: number[] = []
  for (const ch of input) {
    const byte = charToCp1252Byte(ch.codePointAt(0)!)
    if (byte === null) return input
    bytes.push(byte)
  }

  // Decodificar los bytes como UTF-8 estricto. Si falla (secuencia inválida),
  // el texto no era UTF-8 mal leído → no tocar.
  let decoded: string
  try {
    decoded = utf8Decoder.decode(Uint8Array.from(bytes))
  } catch {
    return input
  }

  // Sin cambios reales → no era mojibake (ej. texto ya correcto con tildes).
  if (decoded === input) return input

  return decoded
}
