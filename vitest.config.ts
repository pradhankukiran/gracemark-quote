import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/domain/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
