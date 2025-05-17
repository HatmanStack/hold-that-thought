<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { userStore } from '$lib/stores/user'
  
  let error = ''
  let loading = true
  
  onMount(async () => {
    try {
      // Get the authorization code from the URL
      const code = $page.url.searchParams.get('code')
      
      if (!code) {
        error = 'No authorization code found in the URL'
        loading = false
        return
      }
      
      // In a real implementation, you would exchange the code for tokens
      // and then fetch the user profile
      
      // For now, we'll simulate a successful login
      setTimeout(() => {
        // Redirect to home page
        goto('/')
      }, 2000)
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred during authentication'
      loading = false
    }
  })
</script>

<svelte:head>
  <title>Authenticating - Round Robin</title>
  <meta name="description" content="Processing your authentication" />
</svelte:head>

<div class="container mx-auto px-4 py-16">
  <div class="max-w-md mx-auto text-center">
    {#if loading}
      <div class="flex flex-col items-center justify-center">
        <div class="loading loading-spinner loading-lg mb-4"></div>
        <h1 class="text-2xl font-bold mb-2">Authenticating...</h1>
        <p>Please wait while we complete your sign-in process.</p>
      </div>
    {:else if error}
      <div class="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>{error}</span>
      </div>
      <div class="mt-4">
        <a href="/auth" class="btn btn-primary">Back to Login</a>
      </div>
    {/if}
  </div>
</div>