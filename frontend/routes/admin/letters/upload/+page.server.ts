import type { PageServerLoad } from './$types'
import { requireApprovedUser } from '$lib/auth/middleware'

export const load: PageServerLoad = async (event) => {
  await requireApprovedUser(event)
  return {}
}
