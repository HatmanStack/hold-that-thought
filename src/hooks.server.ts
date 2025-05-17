import type { Handle } from '@sveltejs/kit'
import { site } from '$lib/config/site'
import { getCurrentUser, getSession } from '$lib/utils/cognitoClient'

export const handle: Handle = async ({ event, resolve }) => {
  // Get the session cookie
  const session = await getSession()
  
  if (session?.isValid()) {
    try {
      // Get the current user
      const user = await getCurrentUser()
      
      if (user) {
        // Set the user in the locals object
        event.locals.user = user
        event.locals.token = session.getIdToken().getJwtToken()
      }
    } catch (error) {
      console.error('Error getting user:', error)
    }
  }
  
  return await resolve(event, {
    transformPageChunk: ({ html }) => html.replace('<html lang="en">', `<html lang="${site.lang ?? 'en'}">`),
  })
}
