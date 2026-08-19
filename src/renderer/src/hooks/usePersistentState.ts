import { useState, useEffect, Dispatch, SetStateAction } from 'react'

/**
 * Hook de estado persistente respaldado por localStorage.
 * Interfaz idéntica a useState: los filtros de selección de cada sección
 * sobreviven al cambio de sección y al reinicio de la app.
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) return JSON.parse(stored) as T
    } catch {
      /* storage no disponible o valor corrupto: usa el inicial */
    }
    return initialValue
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage no disponible: solo afecta a la sesión actual */
    }
  }, [key, value])

  return [value, setValue]
}
