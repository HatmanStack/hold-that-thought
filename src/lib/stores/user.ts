import { writable, derived } from 'svelte/store'
import type { AuthState } from '$lib/types/auth'

// Initial state
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  refreshToken: null,
  error: null,
  isLoading: false
}

// Create the writable store
export const userStore = writable<AuthState>(initialState)

// Derived stores for convenience
export const isAuthenticated = derived(
  userStore,
  $userStore => $userStore.isAuthenticated
)

export const user = derived(
  userStore,
  $userStore => $userStore.user
)

export const isLoading = derived(
  userStore,
  $userStore => $userStore.isLoading
)

export const authError = derived(
  userStore,
  $userStore => $userStore.error
)