import type { Handle } from '@sveltejs/kit'
import { getOptionalUser } from '$lib/auth/middleware'
import { site } from '$lib/config/site'

export const handle: Handle = async ({ event, resolve }) => {
  // Add user context to all requests
  event.locals.user = await getOptionalUser(event)

  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace('<html lang="en">', `<html lang="${site.lang ?? 'en'}">`),
  })

  // Add security headers
  response.headers.set(
    'Content-Security-Policy',
    [
      'default-src \'self\'',
      'script-src \'self\' \'unsafe-inline\' \'unsafe-eval\'', // unsafe-inline/eval needed for Svelte hydration and dev
      'style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com',
      'img-src \'self\' https://*.amazonaws.com https://s3.amazonaws.com data: blob:',
      'font-src \'self\' https://fonts.gstatic.com',
      'connect-src \'self\' https://*.amazonaws.com https://*.execute-api.*.amazonaws.com',
      'frame-ancestors \'none\'',
      'base-uri \'self\'',
      'form-action \'self\'',
    ].join('; '),
  )

  // Additional security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

  return response
}
