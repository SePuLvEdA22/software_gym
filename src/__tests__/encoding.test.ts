import { describe, it, expect } from 'vitest'
import { fixMojibake } from '../shared/encoding'

describe('fixMojibake', () => {
  it('debería corregir la doble codificación de la Ñ', () => {
    // "Ã'" = bytes UTF-8 de Ñ (0xC3 0x91) leídos como cp1252
    expect(fixMojibake('PEQUEÃ\u2018A')).toBe('PEQUEÑA')
  })

  it('debería corregir vocales acentuadas', () => {
    expect(fixMojibake('MÃ©xico')).toBe('México') // é
    expect(fixMojibake('MarÃ\u00ada')).toBe('María') // í
    expect(fixMojibake('CanciÃ³n')).toBe('Canción') // ó
    expect(fixMojibake('CÃ¡diz')).toBe('Cádiz') // á
    expect(fixMojibake('JesÃºs')).toBe('Jesús') // ú
  })

  it('debería corregir la ñ en minúscula y mayúscula', () => {
    expect(fixMojibake('NiÃ±o')).toBe('Niño')
    expect(fixMojibake('Ã\u2018ANDU')).toBe('ÑANDU')
  })

  it('debería corregir signos de puntuación doble-codificados', () => {
    expect(fixMojibake('Â¿CÃ³mo estÃ¡s?')).toBe('¿Cómo estás?')
    expect(fixMojibake('Â¡Hola!')).toBe('¡Hola!')
  })

  it('debería dejar intactos los strings ya correctos', () => {
    expect(fixMojibake('José María')).toBe('José María')
    expect(fixMojibake('Ñandú')).toBe('Ñandú')
    expect(fixMojibake('Hello world')).toBe('Hello world')
    expect(fixMojibake('')).toBe('')
  })

  it('debería dejar intactos strings con caracteres no representables en cp1252', () => {
    // Emoji y caracteres CJK no son mojibake cp1252 → no tocar
    expect(fixMojibake('Hola 👋')).toBe('Hola 👋')
    expect(fixMojibake('日本語')).toBe('日本語')
  })

  it('debería ser idempotente (aplicar dos veces = una vez)', () => {
    const once = fixMojibake('PEQUEÃ\u2018A')
    expect(fixMojibake(once)).toBe(once)
    expect(once).toBe('PEQUEÑA')
  })

  it('debería corregir strings mixtos', () => {
    // La É (0xC3 0x89) doble-codificada se ve como Ã‰ (‰ = U+2030)
    expect(fixMojibake('CAFÃ\u2030 SOLUBLE 250g')).toBe('CAFÉ SOLUBLE 250g')
  })

  it('debería corregir acentos con C1 controls (Latin-1 estricto)', () => {
    // La Í (0xC3 0x8D) leída como Latin-1 queda como Ã + U+008D (C1 control)
    expect(fixMojibake('MARIA DEL PÃ\u008DLAR CUADROS')).toBe('MARIA DEL PÍLAR CUADROS')
    // La Á (0xC3 0x81) queda como Ã + U+0081
    expect(fixMojibake('ALCALÃ\u0081')).toBe('ALCALÁ')
  })
})
