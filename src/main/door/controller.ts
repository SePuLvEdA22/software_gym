import { v4 as uuidv4 } from 'uuid'
import { formatISO } from 'date-fns'
import log from 'electron-log'
import { getDatabase } from '../database'
import { DoorEvent, DoorEventType, DoorEventTrigger } from '../../shared/types'
import { getDoorConfig } from './config'
import { sendHttpCommand } from './httpRelay'
import { sendSerialCommand } from './serialRelay'

type DoorStatus = 'closed' | 'open' | 'error'

let doorStatus: DoorStatus = 'closed'
let doorOpenTimer: NodeJS.Timeout | null = null

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
  const config = getDoorConfig()
  return {
    status: doorStatus,
    mockMode: config.connectionType === 'mock'
  }
}

export async function testDoorConnection(): Promise<boolean> {
  const config = getDoorConfig()
  if (config.connectionType === 'http') {
    return sendHttpCommand()
  }
  if (config.connectionType === 'serial') {
    return sendSerialCommand()
  }
  return true
}

export async function openDoor(trigger: DoorEventTrigger = 'access_code'): Promise<boolean> {
  if (doorStatus === 'open') {
    log.warn('Door is already open')
    return false
  }

  log.info(`Opening door (trigger: ${trigger})`)

  const config = getDoorConfig()

  switch (config.connectionType) {
    case 'mock':
      return performMockOpen(trigger)
    case 'http':
      return performHttpOpen(trigger)
    case 'serial':
      return performSerialOpen(trigger)
    default:
      return performMockOpen(trigger)
  }
}

function performMockOpen(trigger: DoorEventTrigger): boolean {
  doorStatus = 'open'
  emitDoorEvent('open', trigger, 'Mock mode')

  if (doorOpenTimer) {
    clearTimeout(doorOpenTimer)
  }

  const config = getDoorConfig()
  doorOpenTimer = setTimeout(() => {
    try {
      closeDoor('auto_close')
    } catch (e) {
      log.error('Auto-close failed:', e)
    }
  }, config.openDuration)

  return true
}

async function performHttpOpen(trigger: DoorEventTrigger): Promise<boolean> {
  try {
    const config = getDoorConfig()
    const success = await sendHttpCommand()

    if (success) {
      doorStatus = 'open'
      emitDoorEvent('open', trigger)

      if (doorOpenTimer) {
        clearTimeout(doorOpenTimer)
      }

      doorOpenTimer = setTimeout(() => {
        try {
          closeDoor('auto_close')
        } catch (e) {
          log.error('Auto-close failed:', e)
        }
      }, config.openDuration)

      return true
    }

    doorStatus = 'error'
    emitDoorEvent('denied', trigger, 'HTTP relay error')
    return false
  } catch (error: any) {
    log.error('HTTP open error:', error)
    doorStatus = 'error'
    return false
  }
}

async function performSerialOpen(trigger: DoorEventTrigger): Promise<boolean> {
  try {
    const config = getDoorConfig()
    const success = await sendSerialCommand()

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
    emitDoorEvent('denied', trigger, 'Serial relay error')
    return false
  } catch (error: any) {
    log.error('Serial open error:', error)
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

  log.info('Door closed')
}

export function manualOpen(): Promise<boolean> {
  // Devuelve el Promise real de openDoor; antes se casteaba a boolean y
  // cualquier llamada síncrona recibía un Promise (siempre truthy).
  return openDoor('manual')
}

export function manualClose(): void {
  if (doorOpenTimer) {
    clearTimeout(doorOpenTimer)
    doorOpenTimer = null
  }
  closeDoor('manual')
}

export async function initializeDoorController(): Promise<void> {
  const config = getDoorConfig()
  log.info('Initializing door controller...')
  log.info(`Connection type: ${config.connectionType}`)

  if (config.connectionType === 'http') {
    log.info(`HTTP relay URL: ${config.httpUrl}`)
  } else if (config.connectionType === 'serial') {
    log.info(`Serial port: ${config.portName} at ${config.baudRate} baud`)
  } else {
    log.info('Mock mode - no hardware connection')
  }

  doorStatus = 'closed'
  log.info('Door controller initialized')
}
