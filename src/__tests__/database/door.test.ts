import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { initDatabase, closeDatabase, getDatabase } from '../../main/database/index'
import {
  getDoorStatus,
  openDoor,
  manualClose,
  manualOpen,
  initializeDoorController,
  registerDoorCallback,
  testDoorConnection,
} from '../../main/door/controller'
import { getDoorConfig } from '../../main/door/config'

describe('Controlador de puerta (modo mock)', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  beforeEach(async () => {
    await initializeDoorController()
    manualClose()
  })

  function lastDoorEvent(): { event_type: string; trigger: string } | undefined {
    const row = getDatabase().prepare('SELECT event_type, trigger FROM door_events ORDER BY timestamp DESC, rowid DESC LIMIT 1').get()
    return row as { event_type: string; trigger: string } | undefined
  }

  it('estado inicial: cerrada y en modo mock', () => {
    expect(getDoorConfig().connectionType).toBe('mock')
    const status = getDoorStatus()
    expect(status.status).toBe('closed')
    expect(status.mockMode).toBe(true)
  })

  it('abre la puerta en modo mock y registra el evento', async () => {
    const ok = await openDoor('manual')
    expect(ok).toBe(true)
    expect(getDoorStatus().status).toBe('open')
    const event = lastDoorEvent()
    expect(event?.event_type).toBe('open')
    expect(event?.trigger).toBe('manual')
  })

  it('NO reabre si la puerta ya está abierta', async () => {
    await openDoor('manual')
    const second = await openDoor('access_code')
    expect(second).toBe(false)
    expect(getDoorStatus().status).toBe('open')
  })

  it('cierra manualmente y registra el evento de cierre', async () => {
    await openDoor('manual')
    manualClose()
    expect(getDoorStatus().status).toBe('closed')
    expect(lastDoorEvent()?.event_type).toBe('close')
  })

  it('manualOpen abre con trigger manual', async () => {
    expect(await manualOpen()).toBe(true)
    expect(getDoorStatus().status).toBe('open')
  })

  it('se cierra automáticamente después de openDuration', async () => {
    vi.useFakeTimers()
    try {
      await openDoor('manual')
      expect(getDoorStatus().status).toBe('open')

      vi.advanceTimersByTime(getDoorConfig().openDuration)
      expect(getDoorStatus().status).toBe('closed')
      expect(lastDoorEvent()?.trigger).toBe('auto_close')
    } finally {
      vi.useRealTimers()
    }
  })

  it('testDoorConnection en modo mock devuelve true sin abrir la puerta', async () => {
    expect(await testDoorConnection()).toBe(true)
    expect(getDoorStatus().status).toBe('closed')
  })

  it('notifica a los callbacks registrados', async () => {
    const events: string[] = []
    // registerDoorCallback no devuelve desuscripción: los callbacks son
    // globales del módulo y se acumulan entre tests (solo uno por archivo).
    registerDoorCallback((e) => events.push(e.eventType))
    await openDoor('manual')
    expect(events).toContain('open')
  })
})
