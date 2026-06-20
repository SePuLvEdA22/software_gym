import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const TestSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  age: z.number().positive(),
})

const PartialSchema = TestSchema.partial()

function validateOrThrow(schema: z.ZodType, data: unknown): void {
  const result = schema.safeParse(data)
  if (!result.success) {
    const messages = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
    throw new Error(`Datos inválidos: ${messages}`)
  }
}

describe('validateOrThrow', () => {
  it('should not throw for valid data', () => {
    expect(() => validateOrThrow(TestSchema, { name: 'Juan', age: 25 })).not.toThrow()
  })

  it('should throw with formatted message for invalid data', () => {
    expect(() => validateOrThrow(TestSchema, { name: '', age: -1 })).toThrow('Datos inválidos')
    expect(() => validateOrThrow(TestSchema, { name: '', age: -1 })).toThrow('name: Nombre requerido')
    expect(() => validateOrThrow(TestSchema, { name: '', age: -1 })).toThrow('age: Too small')
  })

  it('should join multiple errors with semicolon', () => {
    expect(() => validateOrThrow(TestSchema, { name: '', age: -1 })).toThrow(';')
  })

  it('should handle nested path in error messages', () => {
    const NestedSchema = z.object({
      contact: z.object({
        email: z.string().email('Email inválido'),
      }),
    })
    expect(() => validateOrThrow(NestedSchema, { contact: { email: 'bad' } })).toThrow('contact.email: Email inválido')
  })

  it('should not throw for empty object with partial schema', () => {
    expect(() => validateOrThrow(PartialSchema, {})).not.toThrow()
  })

  it('should not throw for undefined values with partial schema', () => {
    expect(() => validateOrThrow(PartialSchema, { name: undefined })).not.toThrow()
  })

  it('should throw for empty string even with partial schema (Zod v4 behavior)', () => {
    expect(() => validateOrThrow(PartialSchema, { name: '' })).toThrow('Datos inválidos')
    expect(() => validateOrThrow(PartialSchema, { name: '' })).toThrow('Nombre requerido')
  })

  it('should accept null for nullable fields', () => {
    const NullableSchema = z.object({ photo: z.string().nullable() })
    expect(() => validateOrThrow(NullableSchema, { photo: null })).not.toThrow()
  })

  it('should throw for completely wrong types', () => {
    expect(() => validateOrThrow(TestSchema, 'not-an-object')).toThrow('Datos inválidos')
  })

  it('should throw for null data', () => {
    expect(() => validateOrThrow(TestSchema, null)).toThrow('Datos inválidos')
  })

  it('should throw for undefined data', () => {
    expect(() => validateOrThrow(TestSchema, undefined)).toThrow('Datos inválidos')
  })
})

describe('result.error.issues (Zod v4)', () => {
  it('should have issues property on failed safeParse', () => {
    const result = TestSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(Array.isArray(result.error.issues)).toBe(true)
      expect(result.error.issues.length).toBeGreaterThan(0)
      expect(result.error.issues[0]).toHaveProperty('path')
      expect(result.error.issues[0]).toHaveProperty('message')
      expect(result.error.issues[0]).toHaveProperty('code')
    }
  })

  it('should have issues for each invalid field', () => {
    const result = TestSchema.safeParse({ name: '', age: 0 })
    if (!result.success) {
      expect(result.error.issues.length).toBe(2)
    }
  })
})
