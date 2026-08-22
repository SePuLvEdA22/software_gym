import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initDatabase, closeDatabase, getDatabase } from '../../main/database/index'
import {
  getDoorConfig,
  updateDoorConfig,
  setDoorConfig,
  getDoorConfigJson,
  persistDoorConfig,
  type DoorConfig,
} from '../../main/door/config'

const DEFAULTS: DoorConfig = {
  connectionType: 'mock',
  openDuration: 5000,
  httpUrl: '',
  httpMethod: 'GET',
  httpHeaders: '',
  httpBody: '',
  portName: 'COM3',
  baudRate: 9600,
  serialCommand: '@',
}

describe('Configuración de puerta (caracterización)', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  beforeEach(() => {
    updateDoorConfig(DEFAULTS)
    getDatabase().prepare("DELETE FROM settings WHERE key = 'door_config'").run()
  })

  it('devuelve los valores por defecto sin configuración previa', () => {
    expect(getDoorConfig()).toEqual(DEFAULTS)
  })

  it('getDoorConfig devuelve una copia, no la referencia interna', () => {
    const copy = getDoorConfig()
    copy.openDuration = 99999
    expect(getDoorConfig().openDuration).toBe(5000)
  })

  it('updateDoorConfig mezcla parcial sin perder el resto', () => {
    updateDoorConfig({ connectionType: 'http', httpUrl: 'http://192.168.1.50/on' })
    const config = getDoorConfig()
    expect(config.connectionType).toBe('http')
    expect(config.httpUrl).toBe('http://192.168.1.50/on')
    expect(config.openDuration).toBe(5000)
    expect(config.portName).toBe('COM3')
  })

  it('setDoorConfig restaura desde el JSON serializado', () => {
    updateDoorConfig({ connectionType: 'serial', portName: 'COM7', baudRate: 115200 })
    const serialized = getDoorConfigJson()

    updateDoorConfig(DEFAULTS)
    expect(getDoorConfig().connectionType).toBe('mock')

    setDoorConfig(serialized)
    const restored = getDoorConfig()
    expect(restored.connectionType).toBe('serial')
    expect(restored.portName).toBe('COM7')
    expect(restored.baudRate).toBe(115200)
  })

  it('setDoorConfig con JSON inválido mantiene la configuración previa sin lanzar', () => {
    updateDoorConfig({ openDuration: 7000 })
    expect(() => setDoorConfig('{json-roto')).not.toThrow()
    expect(getDoorConfig().openDuration).toBe(7000)
    expect(getDoorConfig().connectionType).toBe('mock')
  })

  it('round-trip completo: persistDoorConfig en settings y restaurar como hace main/index.ts al arrancar', () => {
    // Reproduce lo que hace el handler ipc door:saveConfig vía persistDoorConfig()
    updateDoorConfig({ connectionType: 'http', httpUrl: 'http://10.0.0.2/relay', openDuration: 3000 })
    persistDoorConfig()

    // Simula reinicio de la app (main/index.ts líneas 756-758)
    updateDoorConfig(DEFAULTS)
    const saved = getDatabase()
      .prepare("SELECT value FROM settings WHERE key = 'door_config'")
      .get() as { value: string } | undefined

    expect(saved?.value).toBeDefined()
    if (saved) setDoorConfig(saved.value)

    const restored = getDoorConfig()
    expect(restored.connectionType).toBe('http')
    expect(restored.httpUrl).toBe('http://10.0.0.2/relay')
    expect(restored.openDuration).toBe(3000)
  })

  it('persistDoorConfig actualiza el registro existente (upsert)', () => {
    updateDoorConfig({ openDuration: 1000 })
    persistDoorConfig()
    updateDoorConfig({ openDuration: 2000 })
    persistDoorConfig()

    const count = getDatabase()
      .prepare("SELECT COUNT(*) as n FROM settings WHERE key = 'door_config'")
      .get() as { n: number }
    expect(count.n).toBe(1)

    const row = getDatabase()
      .prepare("SELECT value FROM settings WHERE key = 'door_config'")
      .get() as { value: string }
    expect(JSON.parse(row.value).openDuration).toBe(2000)
  })
})
