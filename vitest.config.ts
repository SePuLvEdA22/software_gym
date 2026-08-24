import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/__tests__/setup.ts'],
    alias: [
      { find: '@shared', replacement: path.resolve(__dirname, 'src/shared') },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, 'src/renderer/src') + '/$1' },
    ],
  },
})
