import type { Icon } from '$lib/types/icon'

export const favicon: Icon = {
  sizes: '48x48',
  src: '/favicon.png',
  type: 'image/png',
}

export const any: { [key: number]: Icon } = {
  180: {
    sizes: '180x180',
    src: '/assets/any@180.png',
    type: 'image/png',
  },
  192: {
    sizes: '192x192',
    src: '/assets/any@192.png',
    type: 'image/png',
  },
  512: {
    sizes: '512x512',
    src: '/assets/any@512.png',
    type: 'image/png',
  },
}

export const maskable: { [key: number]: Icon } = {
  192: {
    sizes: '192x192',
    src: '/assets/maskable@192.png',
    type: 'image/png',
  },
  512: {
    sizes: '512x512',
    src: '/assets/maskable@512.png',
    type: 'image/png',
  },
}
