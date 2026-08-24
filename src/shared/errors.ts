/**
 * Utilidades para manejo seguro de errores desconocidos (catch sin tipado).
 */

/** Extrae el mensaje de un valor capturado en un try/catch de forma segura. */
export function toErrorMessage(error: unknown, fallback = 'Error desconocido'): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}

/** Indica si el mensaje del error contiene el fragmento indicado (p. ej. errores SQL). */
export function errorMessageIncludes(error: unknown, fragment: string): boolean {
  return error instanceof Error && error.message.includes(fragment)
}
