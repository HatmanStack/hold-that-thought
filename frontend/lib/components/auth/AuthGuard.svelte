<script lang='ts'>
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { authLoading, authStore, isAuthenticated } from '$lib/auth/auth-store'
  import { onMount } from 'svelte'

  export let requireAuth = true
  export let redirectTo = '/auth/login'
  export let loadingComponent: any = null

  let mounted = false

  onMount(() => {
    // Initialize auth state from localStorage
    authStore.init()
    mounted = true

    // Set up automatic token refresh
    const unsubscribe = authStore.subscribe((state) => {
      if (mounted && !state.loading) {
        if (requireAuth && !state.isAuthenticated) {
          // Store the current page to redirect back after login
          const returnUrl = $page.url.pathname + $page.url.search
          if (returnUrl !== '/auth/login' && returnUrl !== '/auth/signup') {
            sessionStorage.setItem('auth_return_url', returnUrl)
          }
          goto(redirectTo)
        }
      }
    })

    return unsubscribe
  })
</script>

{#if !mounted || $authLoading}
  {#if loadingComponent}
    <svelte:component this={loadingComponent} />
  {:else}
    <div class='flex items-center justify-center min-h-screen'>
      <div class='loading loading-spinner loading-lg'></div>
    </div>
  {/if}
{:else if requireAuth && !$isAuthenticated}
  <!-- This will be handled by the onMount redirect -->
  <div class='flex items-center justify-center min-h-screen'>
    <div class='loading loading-spinner loading-lg'></div>
  </div>
{:else}
  <slot />
{/if}
