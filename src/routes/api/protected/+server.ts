import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireApprovedUser } from '$lib/auth/middleware'

export const GET: RequestHandler = async (event) => {
  // This will throw a 401/403 error if user is not authenticated or not in ApprovedUsers group
  const user = await requireApprovedUser(event)
  
  return json({
    message: 'Hello from protected API endpoint!',
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      groups: user.groups,
      name: user.given_name && user.family_name 
        ? `${user.given_name} ${user.family_name}` 
        : user.given_name || user.family_name || user.username
    },
    timestamp: new Date().toISOString()
  })
}

export const POST: RequestHandler = async (event) => {
  const user = await requireApprovedUser(event)
  const body = await event.request.json()
  
  return json({
    message: 'Data received successfully',
    user: {
      id: user.id,
      email: user.email,
      groups: user.groups
    },
    data: body,
    timestamp: new Date().toISOString()
  })
}