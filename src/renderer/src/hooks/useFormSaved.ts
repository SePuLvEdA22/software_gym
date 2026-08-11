import { useEffect, useRef } from 'react'

/**
 * Escucha el evento `form:saved:<type>` que el proceso main emite cuando una
 * ventana-formulario guarda datos. Usa el patrón "latest ref" (actualizado en
 * un efecto) para que el handler siempre sea la versión más reciente del render
 * actual, evitando closures obsoletos con el estado del panel (p. ej. la
 * página o el filtro actuales).
 */
export function useFormSaved(type: string, handler: (message?: string) => void): void {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    const unsubscribe = window.electronAPI.window.onFormSaved(type, (message) => {
      handlerRef.current(message)
    })
    return unsubscribe
  }, [type])
}
