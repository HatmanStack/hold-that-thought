<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { authStore } from '$lib/auth/auth-store'
  
  onMount(() => {
    // Clear all JWT-related storage
    if (typeof window !== 'undefined') {
      // Clear all possible JWT storage locations
      localStorage.clear()
      sessionStorage.clear()
      
      // Clear any cookies by setting them to expire
      document.cookie.split(";").forEach(cookie => {
        const eqPos = cookie.indexOf("=")
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
      })
    }
    
    // Clear local auth state
    authStore.clearAuth()
    
    // Redirect to home after a short delay
    setTimeout(() => {
      goto('/')
    }, 2000)
  })
</script>

<svelte:head>
  <title>Signed Out</title>
  <meta name="description" content="You have been signed out" />
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-base-200 px-4">
  <div class="card w-full max-w-md mx-auto bg-base-100 shadow-xl">
    <div class="card-body text-center">
      <h2 class="card-title justify-center">Signed Out Successfully</h2>
      <p class="text-sm opacity-70 mb-4">You have been signed out of your account.</p>
      <p class="text-xs opacity-50">Redirecting to home page...</p>
    </div>
  </div>
</div>