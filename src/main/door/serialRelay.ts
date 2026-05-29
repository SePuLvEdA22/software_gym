import { open, write, close } from 'fs'
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
    const data = Buffer.from(command, 'utf-8')

    log.info(`[Serial Relay] Opening ${portName} at ${config.baudRate} baud`)

    open(portName, 'w', (err, fd) => {
      if (err) {
        log.error(`[Serial Relay] Failed to open ${portName}: ${err.message}`)
        log.info('[Serial Relay] On Windows, use COM ports like \\\\.\\COM3 for high-numbered ports')
        log.info('[Serial Relay] Consider using an HTTP relay instead for easier setup')
        resolve(false)
        return
      }

      write(fd, data, 0, data.length, null, (writeErr) => {
        close(fd, () => {})

        if (writeErr) {
          log.error(`[Serial Relay] Write error: ${writeErr.message}`)
          resolve(false)
          return
        }

        log.info(`[Serial Relay] Sent command: ${command}`)
        resolve(true)
      })
    })
  })
}
