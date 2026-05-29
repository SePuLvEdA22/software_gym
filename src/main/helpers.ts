import log from 'electron-log'

const SQL_ERROR_MAP: Record<string, string> = {
  'UNIQUE constraint failed: clients.document_id': 'Ya existe un cliente con ese documento de identidad',
  'UNIQUE constraint failed: clients.access_code': 'Ya existe un cliente con ese código de acceso',
  'UNIQUE constraint failed: membership_plans.name': 'Ya existe un plan con ese nombre',
  'FOREIGN KEY constraint failed': 'Operación no permitida: el registro está siendo usado por otros datos'
}

export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message
    for (const [sqlMsg, userMsg] of Object.entries(SQL_ERROR_MAP)) {
      if (msg.includes(sqlMsg)) return userMsg
    }
    return 'Error en la operación'
  }
  return 'Error desconocido'
}

export function safeResult<T>(fn: () => T): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = fn()
    return { success: true, data }
  } catch (error: unknown) {
    const msg = sanitizeError(error)
    log.error('Operation failed:', error)
    return { success: false, error: msg }
  }
}

export function safeAsyncResult<T>(fn: () => Promise<T>): Promise<{ success: true; data: T } | { success: false; error: string }> {
  return fn().then(
    (data) => ({ success: true, data }),
    (error: unknown) => {
      const msg = sanitizeError(error)
      log.error('Async operation failed:', error)
      return { success: false, error: msg }
    }
  )
}

export function validateRequired(value: unknown, name: string): string | null {
  if (value === undefined || value === null || value === '') {
    return `El campo ${name} es obligatorio`
  }
  return null
}

export function validateString(value: unknown, name: string, maxLength = 255): string | null {
  if (typeof value !== 'string') return `El campo ${name} debe ser texto`
  if (value.length > maxLength) return `El campo ${name} no puede exceder ${maxLength} caracteres`
  return null
}

export function validateNumber(value: unknown, name: string, min?: number, max?: number): string | null {
  if (typeof value !== 'number' || isNaN(value)) return `El campo ${name} debe ser un número`
  if (min !== undefined && value < min) return `El campo ${name} debe ser mayor o igual a ${min}`
  if (max !== undefined && value > max) return `El campo ${name} debe ser menor o igual a ${max}`
  return null
}

export function validateEmail(email: unknown): string | null {
  if (typeof email !== 'string' || email === '') return null
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(email)) return 'El email no es válido'
  return null
}

export function validatePhone(phone: unknown): string | null {
  if (typeof phone !== 'string' || phone === '') return null
  const re = /^\+?[\d\s\-()]{7,20}$/
  if (!re.test(phone)) return 'El teléfono no es válido'
  return null
}
