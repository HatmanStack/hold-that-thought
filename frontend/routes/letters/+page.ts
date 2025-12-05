import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
  // Data is loaded client-side in +page.svelte to access auth store
  return {}
}
