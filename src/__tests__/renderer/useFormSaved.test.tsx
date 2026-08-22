// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFormSaved } from '../../renderer/src/hooks/useFormSaved'

type SavedHandler = (message?: string) => void

function setElectronAPIMock(mock: unknown): void {
  ;(window as { electronAPI?: unknown }).electronAPI = mock
}

function installElectAPIMock() {
  const handlers: Record<string, SavedHandler> = {}
  setElectronAPIMock({
    window: {
      onFormSaved: vi.fn((type: string, handler: SavedHandler) => {
        handlers[type] = handler
        return () => {
          delete handlers[type]
        }
      }),
    },
  })
  return { handlers }
}

describe('useFormSaved', () => {
  beforeEach(() => {
    delete (window as { electronAPI?: unknown }).electronAPI
  })

  it('registra el listener para el tipo indicado y lo elimina al desmontar', () => {
    const { handlers } = installElectAPIMock()
    const { unmount } = renderHook(() => useFormSaved('client', vi.fn()))
    expect(handlers['client']).toBeTypeOf('function')
    unmount()
    expect(handlers['client']).toBeUndefined()
  })

  it('invoca al handler más reciente (patrón latest-ref), no al del primer render', () => {
    const { handlers } = installElectAPIMock()
    const first = vi.fn()
    const latest = vi.fn()
    const { rerender } = renderHook(({ h }) => useFormSaved('product', h), {
      initialProps: { h: first },
    })
    rerender({ h: latest })

    handlers['product']('guardado')
    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledWith('guardado')
  })

  it('propaga el mensaje opcional al handler', () => {
    const { handlers } = installElectAPIMock()
    const handler = vi.fn()
    renderHook(() => useFormSaved('movement', handler))
    handlers['movement']()
    expect(handler).toHaveBeenCalledWith(undefined)
    handlers['movement']('ok')
    expect(handler).toHaveBeenLastCalledWith('ok')
  })

  it('re-registra el listener si cambia el tipo', () => {
    const { handlers } = installElectAPIMock()
    const handler = vi.fn()
    const { rerender } = renderHook(({ t }) => useFormSaved(t, handler), {
      initialProps: { t: 'plan' },
    })
    expect(handlers['plan']).toBeTypeOf('function')

    rerender({ t: 'promo' })
    expect(handlers['promo']).toBeTypeOf('function')
    // El tipo anterior queda sin handler tras re-suscribirse
    expect(handlers['plan']).toBeUndefined()
  })
})
