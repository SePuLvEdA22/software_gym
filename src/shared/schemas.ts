import { z } from 'zod'

export const GenderSchema = z.enum(['male', 'female', 'other', 'not_specified'])
export const ClientStatusSchema = z.enum(['active', 'inactive', 'expired', 'suspended'])
export const PaymentMethodSchema = z.enum(['cash', 'transfer', 'card', 'nequi', 'daviplata'])
export const MembershipTypeSchema = z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual'])
export const MembershipStatusSchema = z.enum(['active', 'expired', 'cancelled', 'frozen'])
export const UserRoleSchema = z.enum(['admin', 'reception', 'trainer', 'accounting'])

export const CreateClientSchema = z.object({
  fullName: z.string().min(1, 'Nombre requerido').max(200),
  documentId: z.string().min(1, 'Documento requerido').max(50),
  birthDate: z.string().optional(),
  gender: GenderSchema.optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().or(z.literal('')).optional(),
  address: z.string().max(500).optional(),
  photo: z.string().nullable().optional(),
  accessCode: z.string().min(4).max(10),
  status: ClientStatusSchema.optional(),
  emergencyContact: z.object({
    name: z.string().max(200).optional(),
    phone: z.string().max(20).optional(),
    relationship: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  }).optional(),
})

export const UpdateClientSchema = CreateClientSchema.partial()

export const CreateUserSchema = z.object({
  username: z.string().min(3, 'Usuario debe tener al menos 3 caracteres').max(50),
  fullName: z.string().min(1, 'Nombre requerido').max(200),
  password: z.string().min(4, 'Contraseña debe tener al menos 4 caracteres').max(100),
  role: UserRoleSchema,
  permissions: z.array(z.string()).optional(),
})

export const UpdateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  fullName: z.string().min(1).max(200).optional(),
  role: UserRoleSchema.optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(4).max(100).optional(),
})

export const CreateMembershipSchema = z.object({
  clientId: z.string().uuid(),
  planId: z.string().uuid(),
  planName: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  status: MembershipStatusSchema.optional(),
})

export const RecordPaymentSchema = z.object({
  clientId: z.string().uuid(),
  amount: z.number().positive('El monto debe ser positivo'),
  method: PaymentMethodSchema,
  description: z.string().max(500).optional(),
  membershipId: z.string().optional(),
  notes: z.string().max(1000).optional(),
  discount: z.number().min(0).optional(),
})

export const PageRequestSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().min(1).max(500).optional(),
})
