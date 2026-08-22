// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePersistentState } from '../../renderer/src/hooks/usePersistentState'

describe('usePersistentState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('usa el valor inicial cuando no hay nada en localStorage', () => {
    const { result } = renderHook(() => usePersistentState('k1', 'inicial'))
    expect(result.current[0]).toBe('inicial')
  })

  it('restaura el valor guardado de una sesión anterior', () => {
    localStorage.setItem('k2', JSON.stringify({ page: 3, filter: 'activos' }))
    const { result } = renderHook(() => usePersistentState('k2', { page: 1, filter: '' }))
    expect(result.current[0]).toEqual({ page: 3, filter: 'activos' })
  })

  it('cae al valor inicial si el JSON almacenado está corrupto', () => {
    localStorage.setItem('k3', '{json-roto')
    const { result } = renderHook(() => usePersistentState('k3', 'fallback'))
    expect(result.current[0]).toBe('fallback')
  })

  it('persiste cada cambio en localStorage', () => {
    const { result } = renderHook(() => usePersistentState<string>('k4', ''))
    act(() => result.current[1]('nuevo-valor'))
    expect(result.current[0]).toBe('nuevo-valor')
    expect(JSON.parse(localStorage.getItem('k4')!)).toBe('nuevo-valor')

    act(() => result.current[1]('otro'))
    expect(JSON.parse(localStorage.getItem('k4')!)).toBe('otro')
  })

  it('acepta actualizador funcional como setState', () => {
    const { result } = renderHook(() => usePersistentState<number>('k5', 10))
    act(() => result.current[1]((prev) => prev + 5))
    expect(result.current[0]).toBe(15)
    expect(JSON.parse(localStorage.getItem('k5')!)).toBe(15)
  })
})
