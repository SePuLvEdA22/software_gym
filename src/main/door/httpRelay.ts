import { request as httpRequest, RequestOptions } from 'http'
import { request as httpsRequest } from 'https'
import { URL } from 'url'
import log from 'electron-log'
import { getDoorConfig } from './config'

function parseHeaders(headersStr: string): Record<string, string> {
  if (!headersStr.trim()) return {}
  const headers: Record<string, string> = {}
  for (const line of headersStr.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim()
      const value = trimmed.slice(colonIdx + 1).trim()
      if (key && value) {
        headers[key] = value
      }
    }
  }
  return headers
}

export function sendHttpCommand(): Promise<boolean> {
  return new Promise((resolve) => {
    const config = getDoorConfig()
    const urlStr = config.httpUrl.trim()

    if (!urlStr) {
      log.warn('[HTTP Relay] No URL configured')
      resolve(false)
      return
    }

    let url: URL
    try {
      url = new URL(urlStr)
    } catch {
      log.error(`[HTTP Relay] Invalid URL: ${urlStr}`)
      resolve(false)
      return
    }

    const isHttps = url.protocol === 'https:'
    const headers = parseHeaders(config.httpHeaders)

    const options: RequestOptions = {
      hostname: url.hostname,
      port: url.port ? parseInt(url.port) : (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: config.httpMethod,
      headers,
      timeout: 5000
    }

    log.info(`[HTTP Relay] Sending ${config.httpMethod} to ${urlStr}`)

    const requester = isHttps ? httpsRequest : httpRequest
    const req = requester(options, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        log.info(`[HTTP Relay] Response ${res.statusCode}: ${body.slice(0, 200)}`)
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true)
        } else {
          log.warn(`[HTTP Relay] Unexpected status: ${res.statusCode}`)
          resolve(false)
        }
      })
    })

    req.on('error', (err) => {
      log.error(`[HTTP Relay] Request failed: ${err.message}`)
      resolve(false)
    })

    req.on('timeout', () => {
      req.destroy()
      log.error('[HTTP Relay] Request timed out')
      resolve(false)
    })

    if (config.httpBody && config.httpMethod === 'POST') {
      req.write(config.httpBody)
    }

    req.end()
  })
}
