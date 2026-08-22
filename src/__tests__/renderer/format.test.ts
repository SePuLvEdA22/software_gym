import { describe, it, expect } from 'vitest'
import { formatCurrency } from '../../renderer/src/utils/format'

describe('formatCurrency', () => {
  it('formatea enteros en pesos colombianos sin decimales', () => {
    const result = formatCurrency(50000)
    expect(result).toContain('50.000')
    expect(result).toContain('$')
  })

  it('maneja cero', () => {
    expect(formatCurrency(0)).toContain('0')
  })

  it('agrupa miles correctamente para valores grandes', () => {
    const result = formatCurrency(1234567)
    expect(result.replace(/[^\d]/g, '')).toBe('1234567')
    expect(result).toContain('.')
  })
})
