import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
// src/__tests__/renderer/ -> src/renderer/src/...
const kioskPagePath = resolve(here, '../../renderer/src/pages/KioskPage.tsx')
const fontsDir = resolve(here, '../../renderer/src/assets/fonts')

/**
 * Iconos cubiertos por el subset local
 * `MaterialSymbolsOutlined-kiosk.woff2` (solo funciona sin internet
 * porque la fuente está empaquetada).
 * Si agregas un icono al kiosco, agrégalo aquí Y regenera el subset;
 * de lo contrario el nombre crudo (p. ej. "door_open") se verá como texto.
 */
const SUBSET_ICONS = new Set([
  'door_open',
  'block',
  'warning',
  'error',
  'person',
  'ac_unit',
  'close',
  'check',
  'event_busy',
  'check_circle',
  'payments',
  'calendar_month',
  'fitness_center',
  'directions_run',
  'self_improvement',
  'sports_gymnastics',
  'pool',
  'bed',
])

function collectIconNames(source: string): string[] {
  const names = new Set<string>()
  // <MaterialIcon name="x" ... /> y <MaterialIcon name={... ternarias ...} />
  const elements = source.match(/<MaterialIcon[\s\S]*?\/>/g) ?? []
  for (const el of elements) {
    for (const m of el.matchAll(/['"]([a-z][a-z0-9_]*?)['"]/g)) {
      names.add(m[1])
    }
  }
  // DAYS = [{ key, icon: 'x', ... }]
  for (const m of source.matchAll(/icon:\s*'([a-z][a-z0-9_]*?)'/g)) {
    names.add(m[1])
  }
  return [...names]
}

describe('KioskPage — iconos cubiertos por el subset local de Material Symbols', () => {
  it('todos los iconos del kiosco están en el subset empaquetado', () => {
    const source = readFileSync(kioskPagePath, 'utf8')
    const used = collectIconNames(source)
    expect(used.length).toBeGreaterThan(0)
    const missing = used.filter((n) => !SUBSET_ICONS.has(n))
    expect(
      missing,
      `Iconos sin cobertura offline (regenera el subset): ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('el subset y su @font-face existen y están cableados', () => {
    expect(existsSync(resolve(fontsDir, 'MaterialSymbolsOutlined-kiosk.woff2'))).toBe(true)
    const css = readFileSync(resolve(fontsDir, 'fonts.css'), 'utf8')
    expect(css).toContain('MaterialSymbolsOutlined-kiosk.woff2')
    const indexCss = readFileSync(resolve(fontsDir, '../../index.css'), 'utf8')
    expect(indexCss).toContain('fonts.css')
    expect(indexCss).toContain('.material-symbols-outlined')
  })
})
