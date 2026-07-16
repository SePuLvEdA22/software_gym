import { execFile } from 'child_process'
import path from 'path'
import log from 'electron-log'
import { getDoorConfig } from './config'

/**
 * Genera un script PowerShell que envía datos al puerto serie.
 * 
 * Usa System.IO.Ports.SerialPort de .NET (incluido en Windows 10/11)
 * en lugar de depender de módulos nativos como `serialport` que
 * requieren `electron-rebuild`.
 */
function buildPowerShellScript(portName: string, baudRate: number, command: string): string {
  // Escapamos portName y command para PowerShell (duplicar comillas simples)
  // COM10+ requiere el prefijo \\.\
  const safePort = (/^COM\d+$/i.test(portName) && parseInt(portName.replace(/^COM/i, '')) >= 10
    ? `\\\\.\\${portName}`
    : portName
  ).replace(/'/g, "''")

  const safeCommand = command.replace(/'/g, "''")

  return `
$ErrorActionPreference = 'Stop'
try {
  $port = new-Object System.IO.Ports.SerialPort('${safePort}', ${baudRate}, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)
  $port.WriteTimeout = 2000
  $port.ReadTimeout = 2000
  $port.Open()
  Start-Sleep -Milliseconds 100
  $port.Write('${safeCommand}')
  Start-Sleep -Milliseconds 200
  $port.Close()
  Write-Output 'OK'
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
`.trim()
}

export function sendSerialCommand(): Promise<boolean> {
  return new Promise((resolve) => {
    const config = getDoorConfig()
    const portName = config.portName.trim()
    const baudRate = config.baudRate || 9600
    const command = config.serialCommand || '@'

    if (!portName) {
      log.warn('[Serial Relay] No port configured')
      resolve(false)
      return
    }

    log.info(`[Serial Relay] Sending '${command}' to ${portName} at ${baudRate} baud via PowerShell`)

    const script = buildPowerShellScript(portName, baudRate, command)
    const powerShellPath = process.env.WINDIR
      ? path.join(process.env.WINDIR, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      : 'powershell.exe'

    const child = execFile(powerShellPath, [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script
    ], {
      timeout: 10000,
      windowsHide: true
    }, (error, stdout, stderr) => {
      if (error) {
        log.error(`[Serial Relay] PowerShell error: ${error.message}`)
        if (stderr) log.error(`[Serial Relay] stderr: ${stderr.trim()}`)
        
        resolve(false)
        return
      }

      const output = stdout.trim()
      if (output === 'OK') {
        log.info(`[Serial Relay] Command '${command}' sent successfully to ${portName}`)
        resolve(true)
      } else {
        log.warn(`[Serial Relay] Unexpected output: ${output}`)
        resolve(false)
      }
    })

    child.on('error', (err) => {
      log.error(`[Serial Relay] Process error: ${err.message}`)
      resolve(false)
    })
  })
}
