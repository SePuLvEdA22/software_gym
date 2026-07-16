import log from 'electron-log'

export type ConnectionType = 'mock' | 'http' | 'serial'

export interface DoorConfig {
  connectionType: ConnectionType
  openDuration: number
  httpUrl: string
  httpMethod: 'GET' | 'POST'
  httpHeaders: string
  httpBody: string
  portName: string
  baudRate: number
  serialCommand: string
}

let config: DoorConfig = {
  connectionType: 'mock',
  openDuration: 5000,
  httpUrl: '',
  httpMethod: 'GET',
  httpHeaders: '',
  httpBody: '',
  portName: 'COM3',
  baudRate: 9600,
  serialCommand: '@'
}

export function getDoorConfig(): DoorConfig {
  return { ...config }
}

export function updateDoorConfig(newConfig: Partial<DoorConfig>): void {
  config = { ...config, ...newConfig }
  const safeConfig = { ...config, httpHeaders: config.httpHeaders ? '***' : '' }
  log.info('Door config updated:', safeConfig)
}

export function setDoorConfig(raw: string): void {
  try {
    const parsed = JSON.parse(raw)
    config = { ...config, ...parsed }
    log.info('Door config restored from DB')
  } catch (error) {
    log.error('Error parsing door config:', error)
  }
}

export function getDoorConfigJson(): string {
  return JSON.stringify(config)
}
