import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const { version } = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'))

// Note: we deliberately do NOT load `cloudflare()` or `tanstackStart()` plugins
// here — they boot a Wrangler runtime which breaks Vitest's worker pool.
// Default test environment is `node`. Component/hook tests opt in to happy-dom
// via the `/** @vitest-environment happy-dom */` pragma at the top of the file.

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_ID__: JSON.stringify('test-build'),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': rootDir,
      // Neither plugin below is loaded, so nothing strips server-only modules
      // and `cloudflare:workers` has to resolve to something. See the stub.
      'cloudflare:workers': path.resolve(rootDir, 'tests/stubs/cloudflare-workers.ts'),
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
        inline: ['@tanstack/react-router'],
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
        'start/services/**',
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
