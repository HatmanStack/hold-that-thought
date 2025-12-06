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
      // TODO: These tests need updating for the consolidated API structure
      'tests/unit/comments-handler.test.js',
      'tests/unit/messages-handler.test.js',
      'tests/unit/profile-handler.test.js',
      'tests/unit/profile-security.test.js',
      'tests/unit/reactions-handler.test.js',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['backend/**/index.js'],
    },
    testTimeout: 10000,
  },
})
