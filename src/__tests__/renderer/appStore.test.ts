// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useAppStore } from '../../renderer/src/store/appStore'
import type { AppState } from '../../renderer/src/store/appStore'
import type { Client, MembershipPlan, AccessLog, DashboardMetrics } from '../../shared/types'

const initialState = useAppStore.getState() as unknown as AppState

describe('appStore — slice UI', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    useAppStore.setState(initialState, true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('estado inicial: sin toasts, tema oscuro por defecto en jsdom', () => {
    const state = useAppStore.getState()
    expect(state.toasts).toEqual([])
    expect(state.theme).toBe('dark')
    expect(state.loading).toBe(false)
  })

  it('setLoading / setSearchQuery / toggleSidebar actualizan su campo', () => {
    const s = useAppStore.getState()
    s.setLoading(true)
    expect(useAppStore.getState().loading).toBe(true)
    s.setSearchQuery('juan')
    expect(useAppStore.getState().searchQuery).toBe('juan')
    s.toggleSidebar()
    expect(useAppStore.getState().sidebarCollapsed).toBe(true)
    s.toggleSidebar()
    expect(useAppStore.getState().sidebarCollapsed).toBe(false)
  })

  it('showToast añade un toast y removeToast lo elimina', () => {
    const s = useAppStore.getState()
    s.showToast('success', 'Guardado', 'OK')
    const { toasts } = useAppStore.getState()
    expect(toasts).toHaveLength(1)
    expect(toasts[0].type).toBe('success')
    expect(toasts[0].message).toBe('Guardado')
    expect(toasts[0].title).toBe('OK')

    useAppStore.getState().removeToast(toasts[0].id)
    expect(useAppStore.getState().toasts).toHaveLength(0)
  })

  it('showToast auto-elimina el toast a los 5 segundos', () => {
    vi.useFakeTimers()
    useAppStore.getState().showToast('error', 'Fallo')
    expect(useAppStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(5000)
    expect(useAppStore.getState().toasts).toHaveLength(0)
  })

  it('showToast genera ids únicos para cada toast', () => {
    useAppStore.getState().showToast('info', 'uno')
    useAppStore.getState().showToast('info', 'dos')
    const toasts = useAppStore.getState().toasts
    expect(toasts).toHaveLength(2)
    expect(toasts[0].id).not.toBe(toasts[1].id)
  })

  it('setTheme persiste en localStorage y refleja el atributo data-theme', () => {
    useAppStore.getState().setTheme('light')
    expect(localStorage.getItem('bodyfitgym-theme')).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(useAppStore.getState().theme).toBe('light')
  })

  it('confirm devuelve promesa que resuelve resolveConfirm(true)', async () => {
    const promise = useAppStore.getState().confirm({ title: 'Borrar', message: '¿Seguro?' })
    expect(useAppStore.getState().confirmDialog?.title).toBe('Borrar')

    useAppStore.getState().resolveConfirm(true)
    await expect(promise).resolves.toBe(true)
    expect(useAppStore.getState().confirmDialog).toBeNull()
    expect(useAppStore.getState().confirmResolve).toBeNull()
  })

  it('resolveConfirm(false) resuelve la promesa con false', async () => {
    const promise = useAppStore.getState().confirm({ title: 'T', message: 'M' })
    useAppStore.getState().resolveConfirm(false)
    await expect(promise).resolves.toBe(false)
  })

  it('resolveConfirm sin diálogo pendiente no lanza', () => {
    expect(() => useAppStore.getState().resolveConfirm(true)).not.toThrow()
  })
})

describe('appStore — slice data', () => {
  const clientA = { id: 'a', fullName: 'Ana' } as unknown as Client
  const clientB = { id: 'b', fullName: 'Bruno' } as unknown as Client

  beforeEach(() => {
    useAppStore.setState(initialState, true)
  })

  it('addClient añade al final sin mutar el arreglo previo', () => {
    useAppStore.getState().setClients([clientA])
    const before = useAppStore.getState().clients
    useAppStore.getState().addClient(clientB)
    const after = useAppStore.getState().clients
    expect(after).toEqual([clientA, clientB])
    expect(before).toEqual([clientA])
  })

  it('updateClientInState reemplaza solo el cliente coincidente', () => {
    useAppStore.getState().setClients([clientA, clientB])
    useAppStore.getState().updateClientInState({ ...clientA, fullName: 'Ana López' } as Client)
    const clients = useAppStore.getState().clients
    expect(clients).toHaveLength(2)
    expect(clients[0].fullName).toBe('Ana López')
    expect(clients[1].fullName).toBe('Bruno')
  })

  it('removeClient elimina por id', () => {
    useAppStore.getState().setClients([clientA, clientB])
    useAppStore.getState().removeClient('b')
    expect(useAppStore.getState().clients).toEqual([clientA])
  })

  it('setAccessLogs y setPlans reemplazan el estado', () => {
    const logs = [{ id: 'l1' }] as unknown as AccessLog[]
    const plans = [{ id: 'p1' }] as unknown as MembershipPlan[]
    useAppStore.getState().setAccessLogs(logs)
    useAppStore.getState().setPlans(plans)
    expect(useAppStore.getState().accessLogs).toEqual(logs)
    expect(useAppStore.getState().plans).toEqual(plans)
  })
})

describe('appStore — slice dashboard', () => {
  beforeEach(() => {
    useAppStore.setState(initialState, true)
  })

  it('arranca con métricas en cero y setDashboardMetrics las reemplaza', () => {
    expect(useAppStore.getState().dashboardMetrics.totalClients).toBe(0)
    const metrics = { ...useAppStore.getState().dashboardMetrics, totalClients: 42, todayRevenue: 150000 }
    useAppStore.getState().setDashboardMetrics(metrics as DashboardMetrics)
    expect(useAppStore.getState().dashboardMetrics.totalClients).toBe(42)
    expect(useAppStore.getState().dashboardMetrics.todayRevenue).toBe(150000)
  })
})
