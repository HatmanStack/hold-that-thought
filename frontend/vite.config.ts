import { sveltekit } from '@sveltejs/kit/vite'
import { SvelteKitPWA as pwa } from '@vite-pwa/sveltekit'
import postcssLightningcss from 'postcss-lightningcss'
import TailwindCSS from 'tailwindcss'
import { defineConfig } from 'vite'
import { imagetools } from 'vite-imagetools'

import tailwindConfig from './tailwind.config'

export default defineConfig({
  css: {
    postcss: {
      plugins: [
        TailwindCSS(tailwindConfig),
        postcssLightningcss({
          browsers: '>= .25%',
          lightningcssOptions: {
            drafts: {
              customMedia: true,
            },
            errorRecovery: true,
          },
        }),
      ],
    },
  },
  envPrefix: 'URARA_',
  plugins: [
    imagetools(),
    sveltekit(),
    pwa({
      manifest: false,
      registerType: 'autoUpdate',
      scope: '/',
      workbox: {
        globIgnores: ['**/sw*', '**/workbox-*'],
        globPatterns: ['posts.json', '**/*.{js,css,html,svg,ico,png,webp,avif}'],
      },
    }),
  ],
  server: {
    fs: {
      allow: ['.', 'static', 'node_modules', '.svelte-kit'],
    },
  },
})
