import adapterAuto from '@sveltejs/adapter-auto'
import adapterNode from '@sveltejs/adapter-node'
import adapterStatic from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { mdsvex } from 'mdsvex'

import mdsvexConfig from './mdsvex.config.js'

const adapter = {
  auto: adapterAuto(),
  node: adapterNode(),
  static: adapterStatic({
    assets: 'build',
    fallback: undefined,
    pages: 'build',
    strict: false
  }),
}

/** @type {import("@sveltejs/kit").Config} */
export default {
  extensions: ['.svelte', ...(mdsvexConfig.extensions ?? [])],
  kit: {
    adapter:
      process.env.ADAPTER
        // @ts-expect-error adapter types
        ? adapter[process.env.ADAPTER.toLowerCase()]
        : Object.keys(process.env).some(key => ['NETLIFY', 'VERCEL'].includes(key))
          ? adapter.auto
          : adapter.static,
    csp: {
      directives: {
        'style-src': ['self', 'unsafe-inline', 'https://giscus.app'],
      },
      mode: 'auto',
    },
    prerender: {
      handleMissingId: 'warn',
      handleHttpError: ({ path, referrer, message }) => {
        // Ignore double-slash paths during prerendering
        if (path.includes('//') && referrer) {
          console.warn(`Ignoring double-slash path: ${message}`);
          return;
        }
        
        // For other errors, throw to fail the build
        throw new Error(message);
      }
    },
  },
  preprocess: [mdsvex(mdsvexConfig), vitePreprocess()],
}

