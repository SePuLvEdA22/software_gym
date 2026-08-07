interface CacheEntry {
  data: unknown
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

/**
 * Cache simple con TTL para consultas de lectura costosas que cambian poco
 * (p. ej. clientes inactivos, cumpleaños del mes). Evita re-ejecutar
 * subconsultas correlacionadas en cada carga/refetch del dashboard.
 */
export function cached<T>(key: string, ttlMs: number, fn: () => T): T {
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return hit.data as T
  }
  const data = fn()
  cache.set(key, { data, expiresAt: Date.now() + ttlMs })
  return data
}

export function clearQueryCache(): void {
  cache.clear()
}
