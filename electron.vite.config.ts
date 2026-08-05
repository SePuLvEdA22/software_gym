import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // Cargar TODAS las variables (sin restringir al prefijo VITE_) desde .env
  // y fusionarlas con las variables de entorno del proceso (p.ej. el secret
  // SENTRY_DSN que GitHub Actions inyecta durante el build).
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
  const sentryDsn = env.SENTRY_DSN || ''

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define: {
        'process.env.SENTRY_DSN': JSON.stringify(sentryDsn),
      },
      build: {
        outDir: 'out/main',
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'src/main/index.ts'),
          },
        },
      },
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        outDir: 'out/preload',
      },
    },
    renderer: {
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src/renderer/src'),
          '@shared': resolve(__dirname, 'src/shared'),
        },
      },
      plugins: [react()],
      define: {
        'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(sentryDsn),
      },
      build: {
        outDir: 'out/renderer',
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'src/renderer/index.html'),
          },
        },
      },
    },
  }
})
