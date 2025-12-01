import type { PageServerLoad } from './$types'
import { requireApprovedUser } from '$lib/auth/middleware'

export const load: PageServerLoad = async (event) => {
  // This will automatically redirect to error page if user is not approved
  const user = await requireApprovedUser(event)

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      groups: user.groups,
      name: user.given_name && user.family_name
        ? `${user.given_name} ${user.family_name}`
        : user.given_name || user.family_name || user.username,
    },
  }
}
