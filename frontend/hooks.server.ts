import type { Handle } from '@sveltejs/kit'
import { getOptionalUser } from '$lib/auth/middleware'
import { site } from '$lib/config/site'

export const handle: Handle = async ({ event, resolve }) => {
  // Add user context to all requests
  event.locals.user = await getOptionalUser(event)

  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace('<html lang="en">', `<html lang="${site.lang ?? 'en'}">`),
  })

  // Basic security headers (CSP removed - overkill for family app)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}
