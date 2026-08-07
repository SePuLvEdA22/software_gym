import { describe, it, expect } from 'vitest'
import {
  CreateClientSchema,
  UpdateClientSchema,
  CreateUserSchema,
  RecordPaymentSchema,
  CreateMembershipSchema,
} from '../../shared/schemas'

const validClient = {
  fullName: 'Juan Pérez',
  documentId: '123456789',
  accessCode: '123456',
}

const validFullClient = {
  fullName: 'Juan Pérez',
  documentId: '123456789',
  birthDate: '1990-05-15',
  gender: 'male',
  phone: '3001234567',
  email: 'juan@example.com',
  address: 'Calle 123 #45-67',
  photo: null,
  accessCode: '123456',
  status: 'active',
  emergencyContact: {
    name: 'María Pérez',
    phone: '3007654321',
    relationship: 'Esposa',
    notes: '',
  },
}

describe('CreateClientSchema', () => {
  it('should accept valid minimal data', () => {
    const result = CreateClientSchema.safeParse(validClient)
    expect(result.success).toBe(true)
  })

  it('should accept valid full data', () => {
    const result = CreateClientSchema.safeParse(validFullClient)
    expect(result.success).toBe(true)
  })

  it('should reject empty fullName', () => {
    const result = CreateClientSchema.safeParse({ ...validClient, fullName: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('fullName'))).toBe(true)
    }
  })

  it('should accept empty documentId (documento opcional)', () => {
    const result = CreateClientSchema.safeParse({ ...validClient, documentId: '' })
    expect(result.success).toBe(true)
  })

  it('should accept short accessCode (códigos legados de 1-3 dígitos)', () => {
    const result = CreateClientSchema.safeParse({ ...validClient, accessCode: '212' })
    expect(result.success).toBe(true)
  })

  it('should accept accessCode de hasta 20 dígitos (límite del formulario/kiosco)', () => {
    const result = CreateClientSchema.safeParse({ ...validClient, accessCode: '1'.repeat(20) })
    expect(result.success).toBe(true)
  })

  it('should reject empty accessCode', () => {
    const result = CreateClientSchema.safeParse({ ...validClient, accessCode: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('accessCode'))).toBe(true)
    }
  })

  it('should reject accessCode de más de 20 dígitos', () => {
    const result = CreateClientSchema.safeParse({ ...validClient, accessCode: '1'.repeat(21) })
    expect(result.success).toBe(false)
  })

  it('should reject invalid email', () => {
    const result = CreateClientSchema.safeParse({ ...validClient, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('should accept empty string email', () => {
    const result = CreateClientSchema.safeParse({ ...validClient, email: '' })
    expect(result.success).toBe(true)
  })

  it('should reject invalid gender', () => {
    const result = CreateClientSchema.safeParse({ ...validClient, gender: 'alien' })
    expect(result.success).toBe(false)
  })

  it('should reject invalid status', () => {
    const result = CreateClientSchema.safeParse({ ...validClient, status: 'unknown' })
    expect(result.success).toBe(false)
  })
})

describe('UpdateClientSchema (partial)', () => {
  it('should accept empty object (all fields optional)', () => {
    const result = UpdateClientSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('should accept undefined values', () => {
    const result = UpdateClientSchema.safeParse({ fullName: undefined, documentId: undefined })
    expect(result.success).toBe(true)
  })

  it('should accept partial update with one field', () => {
    const result = UpdateClientSchema.safeParse({ fullName: 'Nuevo Nombre' })
    expect(result.success).toBe(true)
  })

  it('should reject empty string for fullName', () => {
    const result = UpdateClientSchema.safeParse({ fullName: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Nombre requerido')
    }
  })

  it('should accept empty string for documentId (documento opcional)', () => {
    const result = UpdateClientSchema.safeParse({ documentId: '' })
    expect(result.success).toBe(true)
  })

  it('should accept short accessCode (fix: editar clientes migrados con código corto)', () => {
    const result = UpdateClientSchema.safeParse({ accessCode: '212' })
    expect(result.success).toBe(true)
  })

  it('should reject empty accessCode on update', () => {
    const result = UpdateClientSchema.safeParse({ accessCode: '' })
    expect(result.success).toBe(false)
  })

  it('should accept valid accessCode update', () => {
    const result = UpdateClientSchema.safeParse({ accessCode: 'ABCDEF' })
    expect(result.success).toBe(true)
  })

  it('should accept valid email', () => {
    const result = UpdateClientSchema.safeParse({ email: 'test@example.com' })
    expect(result.success).toBe(true)
  })

  it('should accept empty email string (overrides existing)', () => {
    const result = UpdateClientSchema.safeParse({ email: '' })
    expect(result.success).toBe(true)
  })

  it('should accept null photo', () => {
    const result = UpdateClientSchema.safeParse({ photo: null })
    expect(result.success).toBe(true)
  })

  it('should accept status change', () => {
    const result = UpdateClientSchema.safeParse({ status: 'suspended' })
    expect(result.success).toBe(true)
  })

  it('should accept emergencyContact partial', () => {
    const result = UpdateClientSchema.safeParse({
      emergencyContact: { name: 'Contacto', phone: '3000000000' }
    })
    expect(result.success).toBe(true)
  })
})

describe('CreateUserSchema', () => {
  const validUser = { username: 'testuser', fullName: 'Test User', password: 'test123', role: 'admin' }

  it('should accept valid user', () => {
    const result = CreateUserSchema.safeParse(validUser)
    expect(result.success).toBe(true)
  })

  it('should reject short username', () => {
    const result = CreateUserSchema.safeParse({ ...validUser, username: 'ab' })
    expect(result.success).toBe(false)
  })

  it('should reject short password', () => {
    const result = CreateUserSchema.safeParse({ ...validUser, password: '123' })
    expect(result.success).toBe(false)
  })

  it('should reject invalid role', () => {
    const result = CreateUserSchema.safeParse({ ...validUser, role: 'superadmin' })
    expect(result.success).toBe(false)
  })

  it('should accept optional permissions', () => {
    const result = CreateUserSchema.safeParse({ ...validUser, permissions: ['read', 'write'] })
    expect(result.success).toBe(true)
  })
})

describe('RecordPaymentSchema', () => {
  const validPayment = {
    clientId: '550e8400-e29b-41d4-a716-446655440000',
    amount: 50000,
    method: 'cash',
  }

  it('should accept valid payment', () => {
    const result = RecordPaymentSchema.safeParse(validPayment)
    expect(result.success).toBe(true)
  })

  it('should reject negative amount', () => {
    const result = RecordPaymentSchema.safeParse({ ...validPayment, amount: -100 })
    expect(result.success).toBe(false)
  })

  it('should reject zero amount', () => {
    const result = RecordPaymentSchema.safeParse({ ...validPayment, amount: 0 })
    expect(result.success).toBe(false)
  })

  it('should reject invalid method', () => {
    const result = RecordPaymentSchema.safeParse({ ...validPayment, method: 'bitcoin' })
    expect(result.success).toBe(false)
  })

  it('should accept optional discount', () => {
    const result = RecordPaymentSchema.safeParse({ ...validPayment, discount: 5000 })
    expect(result.success).toBe(true)
  })

  it('should reject negative discount', () => {
    const result = RecordPaymentSchema.safeParse({ ...validPayment, discount: -1 })
    expect(result.success).toBe(false)
  })

  it('should accept description and notes', () => {
    const result = RecordPaymentSchema.safeParse({
      ...validPayment,
      description: 'Pago mensualidad',
      notes: 'Sin novedad',
    })
    expect(result.success).toBe(true)
  })
})

describe('CreateMembershipSchema', () => {
  const valid = {
    clientId: '550e8400-e29b-41d4-a716-446655440000',
    planId: '550e8400-e29b-41d4-a716-446655440001',
    planName: 'Plan Mensual',
    startDate: '2026-06-01',
    endDate: '2026-07-01',
  }

  it('should accept valid membership', () => {
    const result = CreateMembershipSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('should reject non-uuid clientId', () => {
    const result = CreateMembershipSchema.safeParse({ ...valid, clientId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('should reject missing planName', () => {
    const result = CreateMembershipSchema.safeParse({ ...valid, planName: '' })
    expect(result.success).toBe(false)
  })

  it('should accept optional status', () => {
    const result = CreateMembershipSchema.safeParse({ ...valid, status: 'active' })
    expect(result.success).toBe(true)
  })
})
