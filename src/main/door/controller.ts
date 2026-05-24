import { v4 as uuidv4 } from 'uuid'
import { formatISO } from 'date-fns'
import log from 'electron-log'
import { getDatabase } from '../database'
import { DoorEvent, DoorEventType, DoorEventTrigger } from '../../shared/types'

type DoorStatus = 'closed' | 'open' | 'error'

interface DoorConfig {
  openDuration: number
  mockMode: boolean
  portName: string
  baudRate: number
}

let doorStatus: DoorStatus = 'closed'
let doorOpenTimer: NodeJS.Timeout | null = null
let config: DoorConfig = {
  openDuration: 5000,
  mockMode: true,
  portName: 'COM3',
  baudRate: 9600
}

type DoorCallback = (event: DoorEvent) => void
const callbacks: DoorCallback[] = []

export function registerDoorCallback(callback: DoorCallback): void {
  callbacks.push(callback)
}

function emitDoorEvent(eventType: DoorEventType, trigger: DoorEventTrigger, notes?: string): void {
  const event: DoorEvent = {
    id: uuidv4(),
    eventType,
    trigger,
    timestamp: formatISO(new Date()),
    notes: notes || ''
  }
  
  try {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO door_events (id, event_type, trigger, timestamp, notes)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(event.id, event.eventType, event.trigger, event.timestamp, event.notes)
  } catch (error) {
    log.error('Error saving door event:', error)
  }
  
  for (const callback of callbacks) {
    try {
      callback(event)
    } catch (error) {
      log.error('Error in door callback:', error)
    }
  }
  
  log.info(`Door event: ${eventType} (${trigger})`)
}

export function getDoorStatus(): { status: DoorStatus; mockMode: boolean } {
  return {
    status: doorStatus,
    mockMode: config.mockMode
  }
}

export async function openDoor(trigger: DoorEventTrigger = 'access_code'): Promise<boolean> {
  if (doorStatus === 'open') {
    log.warn('Door is already open')
    return false
  }
  
  log.info(`Opening door (trigger: ${trigger})`)
  
  if (config.mockMode) {
    return performMockOpen(trigger)
  } else {
    return performHardwareOpen(trigger)
  }
}

function performMockOpen(trigger: DoorEventTrigger): boolean {
  doorStatus = 'open'
  emitDoorEvent('open', trigger, 'Mock mode')
  
  if (doorOpenTimer) {
    clearTimeout(doorOpenTimer)
  }
  
  doorOpenTimer = setTimeout(() => {
    closeDoor('auto_close')
  }, config.openDuration)
  
  return true
}

async function performHardwareOpen(trigger: DoorEventTrigger): Promise<boolean> {
  try {
    const success = await sendOpenSignalToHardware()
    
    if (success) {
      doorStatus = 'open'
      emitDoorEvent('open', trigger)
      
      if (doorOpenTimer) {
        clearTimeout(doorOpenTimer)
      }
      
      doorOpenTimer = setTimeout(() => {
        closeDoor('auto_close')
      }, config.openDuration)
      
      return true
    }
    
    doorStatus = 'error'
    emitDoorEvent('denied', trigger, 'Hardware error')
    return false
  } catch (error: any) {
    log.error('Hardware open error:', error)
    doorStatus = 'error'
    return false
  }
}

function closeDoor(trigger: DoorEventTrigger): void {
  if (doorStatus === 'closed') {
    return
  }
  
  doorStatus = 'closed'
  emitDoorEvent('close', trigger)
  
  if (!config.mockMode) {
    sendCloseSignalToHardware().catch(error => {
      log.error('Error sending close signal:', error)
    })
  }
  
  log.info('Door closed')
}

export function manualOpen(): boolean {
  return openDoor('manual')
}

export function manualClose(): void {
  if (doorOpenTimer) {
    clearTimeout(doorOpenTimer)
    doorOpenTimer = null
  }
  closeDoor('manual')
}

async function sendOpenSignalToHardware(): Promise<boolean> {
  log.warn('Hardware integration not implemented - using mock mode')
  return true
}

async function sendCloseSignalToHardware(): Promise<boolean> {
  log.warn('Hardware integration not implemented - using mock mode')
  return true
}

export function updateDoorConfig(newConfig: Partial<DoorConfig>): void {
  config = { ...config, ...newConfig }
  log.info('Door config updated:', config)
}

export function getDoorConfig(): DoorConfig {
  return { ...config }
}

export async function initializeDoorController(): Promise<void> {
  log.info('Initializing door controller...')
  log.info('Mode:', config.mockMode ? 'Mock' : 'Hardware')
  
  if (!config.mockMode) {
    try {
      log.info(`Connecting to ${config.portName} at ${config.baudRate} baud...`)
    } catch (error: any) {
      log.error('Failed to initialize hardware:', error)
      log.info('Falling back to mock mode')
      config.mockMode = true
    }
  }
  
  doorStatus = 'closed'
  log.info('Door controller initialized')
}
