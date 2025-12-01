import antfu from '@antfu/eslint-config'

export default antfu({
  svelte: true,
  typescript: true,
  unocss: true,
  ignores: [
    'backend/**/*.js',
    'tests/**/*.js',
    'tests/**/*.ts',
    'urara.js',
    'urara.ts',
    'mdsvex.config.js',
    'docs/**/*',
    '**/*.md',
    'frontend/lib/components/MediaUpload.svelte',
  ],
  rules: {
    'no-console': 'off',
    'no-alert': 'off',
    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
    'svelte/no-at-html-tags': 'off',
    'no-use-before-define': 'off',
    'unused-imports/no-unused-vars': 'warn',
    'no-unused-vars': 'warn',
    'prefer-const': 'warn',
    'svelte/indent': 'off',
    'style/indent-binary-ops': 'off',
    'regexp/no-super-linear-backtracking': 'off',
    'eqeqeq': 'warn',
    'no-undef-init': 'off', // Required for Svelte optional props with undefined default
  },
})
