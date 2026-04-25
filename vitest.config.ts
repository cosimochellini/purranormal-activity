import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// Note: we deliberately do NOT load `cloudflare()` or `tanstackStart()` plugins
// here — they boot a Wrangler runtime which breaks Vitest's worker pool.
// Default test environment is `node`. Component/hook tests opt in to happy-dom
// via the `/** @vitest-environment happy-dom */` pragma at the top of the file.

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test-setup.ts'],
    include: [
      'utils/**/*.test.{ts,tsx}',
      'services/**/*.test.{ts,tsx}',
      'hooks/**/*.test.{ts,tsx}',
      'env/**/*.test.{ts,tsx}',
      'tests/**/*.test.{ts,tsx}',
    ],
    server: {
      deps: {
        inline: ['@tanstack/react-router', 'nuqs'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'utils/**',
        'services/**',
        'hooks/**',
        'components/**',
        'start/routes/api/**',
        'env/**',
      ],
      exclude: [
        '**/*.test.*',
        '**/*.d.ts',
        'dist/**',
        'drizzle/**',
        'static/**',
        '**/routeTree.gen.ts',
        'tests/**',
        'instances/**',
        'images/**',
      ],
      thresholds: {
        lines: 50,
        branches: 50,
        functions: 50,
        statements: 50,
      },
    },
  },
})
