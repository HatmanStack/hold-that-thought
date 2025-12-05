import type { UserProfile } from '$lib/types/profile'
import { getProfile } from '$lib/services/profileService'
import { get, writable } from 'svelte/store'

interface ProfileCache {
  [userId: string]: {
    profile: UserProfile
    fetchedAt: number
  }
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Store for cached user profiles
 */
export const profileCache = writable<ProfileCache>({})

/**
 * Get a profile from cache or fetch it
 */
export async function getCachedProfile(userId: string): Promise<UserProfile | null> {
  const cache = get(profileCache)
  const cached = cache[userId]

  // Return cached if fresh
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.profile
  }

  // Fetch from API
  try {
    const result = await getProfile(userId)
    if (result.success && result.data) {
      // Handle both single profile and array response
      const profile = Array.isArray(result.data) ? result.data[0] : result.data
      if (profile) {
        profileCache.update(c => ({
          ...c,
          [userId]: {
            profile,
            fetchedAt: Date.now(),
          },
        }))
        return profile
      }
    }
  }
  catch (e) {
    console.error('Error fetching profile:', e)
  }

  return cached?.profile || null
}

/**
 * Prefetch multiple profiles at once
 */
export async function prefetchProfiles(userIds: string[]): Promise<void> {
  const cache = get(profileCache)
  const now = Date.now()

  // Filter to only fetch profiles not in cache or stale
  const toFetch = userIds.filter((id) => {
    const cached = cache[id]
    return !cached || now - cached.fetchedAt >= CACHE_TTL
  })

  // Fetch in parallel
  await Promise.all(toFetch.map(id => getCachedProfile(id)))
}

/**
 * Get profile photo URL from cache (synchronous)
 */
export function getProfilePhotoUrl(userId: string): string | null {
  const cache = get(profileCache)
  return cache[userId]?.profile?.profilePhotoUrl || null
}

/**
 * Clear profile cache
 */
export function clearProfileCache(): void {
  profileCache.set({})
}
