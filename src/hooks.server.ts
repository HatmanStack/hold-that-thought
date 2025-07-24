import type { Handle } from '@sveltejs/kit'
import { site } from '$lib/config/site'
import { getOptionalUser } from '$lib/auth/middleware'

export const handle: Handle = async ({ event, resolve }) => {
  // Add user context to all requests
  event.locals.user = await getOptionalUser(event)
  
  return await resolve(event, {
    transformPageChunk: ({ html }) => html.replace('<html lang="en">', `<html lang="${site.lang ?? 'en'}">`),
  })
}
