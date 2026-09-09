import log from 'electron-log'
import { activateScheduledMemberships } from './memberships'

let midnightTimer: NodeJS.Timeout | null = null
let dailyInterval: NodeJS.Timeout | null = null

function msUntilNextMidnight(): number {
  const now = new Date()
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  return next.getTime() - now.getTime()
}

function runActivation(reason: string): void {
  try {
    const count = activateScheduledMemberships()
    if (count > 0) log.info(`Scheduled activator (${reason}): ${count} activated`)
    else log.info(`Scheduled activator (${reason}): no pending`)
  } catch (e) {
    log.error(`Scheduled activator (${reason}) error:`, e)
  }
}

export function startScheduledActivator(): void {
  stopScheduledActivator()
  // Activación inmediata al arrancar (cubre app que se abre ya pasado el día de inicio)
  runActivation('startup')

  const delay = msUntilNextMidnight()
  midnightTimer = setTimeout(() => {
    runActivation('midnight')
    dailyInterval = setInterval(() => runActivation('daily'), 24 * 60 * 60 * 1000)
  }, delay)

  // Unref para no bloquear el cierre de la app en tests
  if (midnightTimer && typeof (midnightTimer as unknown as { unref?: () => void }).unref === 'function') {
    ;(midnightTimer as unknown as { unref: () => void }).unref()
  }
  log.info(`Scheduled activator armed, next run in ${Math.round(delay / 1000)}s`)
}

export function stopScheduledActivator(): void {
  if (midnightTimer) {
    clearTimeout(midnightTimer)
    midnightTimer = null
  }
  if (dailyInterval) {
    clearInterval(dailyInterval)
    dailyInterval = null
  }
}

export function restartScheduledActivator(): void {
  startScheduledActivator()
}
