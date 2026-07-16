/// <reference types="vite/client" />
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'
import * as Sentry from '@sentry/electron/renderer'

if ((import.meta as any).env?.VITE_SENTRY_DSN || (window as any).__SENTRY_DSN__) {
  Sentry.init({
    dsn: ((import.meta as any).env?.VITE_SENTRY_DSN as string) || (window as any).__SENTRY_DSN__,
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
  </StrictMode>
)
