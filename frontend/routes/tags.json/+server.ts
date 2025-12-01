import type { RequestHandler } from './$types'
import { genPosts, genTags } from '$lib/utils/posts'

import { json } from '@sveltejs/kit'

export const prerender = false
export const trailingSlash = 'never'
export const GET: RequestHandler = async () => json(genTags(genPosts()))
