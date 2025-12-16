import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.{js,ts}',
      'tests/integration/**/*.test.{js,ts}',
      'backend/**/*.test.{js,ts}',
    ],
    exclude: [
      '**/node_modules/**',
      'frontend',
      '.svelte-kit',
      'tests/integration/**',
      '**/.aws-sam/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['backend/**/index.js'],
    },
    testTimeout: 10000,
  },
})
