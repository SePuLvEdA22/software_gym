/// <reference types="vite/client" />
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'
import * as Sentry from '@sentry/electron/renderer'

// El DSN se hornea en el bundle en tiempo de build (ver electron.vite.config.ts).
// import.meta.env.VITE_SENTRY_DSN es reemplazado estáticamente por Vite; la
// variable global __SENTRY_DSN__ se mantiene como fallback.
const sentryDsn =
  import.meta.env.VITE_SENTRY_DSN || (window as { __SENTRY_DSN__?: string }).__SENTRY_DSN__

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
  })
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

const root = createRoot(rootElement)

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
