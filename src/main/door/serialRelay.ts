import { openSync, writeSync, closeSync } from 'fs'
import log from 'electron-log'
import { getDoorConfig } from './config'

export function sendSerialCommand(): Promise<boolean> {
  return new Promise((resolve) => {
    const config = getDoorConfig()
    const portName = config.portName.trim()

    if (!portName) {
      log.warn('[Serial Relay] No port configured')
      resolve(false)
      return
    }

    const command = config.serialCommand || '1'

    log.info(`[Serial Relay] Opening ${portName}`)

    try {
      const fd = openSync(portName, 'wx+')
      const buffer = Buffer.from(command + '\n')
      writeSync(fd, buffer, 0, buffer.length, 0)
      closeSync(fd)
      log.info(`[Serial Relay] Sent command: ${command}`)
      resolve(true)
    } catch (err: any) {
      log.error(`[Serial Relay] Failed to open/write ${portName}: ${err.message}`)
      log.info('[Serial Relay] On Windows, use COM ports like \\\\.\\COM3 for high-numbered ports')
      log.info('[Serial Relay] Consider using an HTTP relay instead for easier setup')
      resolve(false)
    }
  })
}
