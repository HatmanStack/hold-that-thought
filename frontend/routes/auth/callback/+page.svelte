<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { googleOAuth } from '$lib/auth/google-oauth'
  
  let loading = true
  let error = ''
  let success = false

  onMount(async () => {
    const code = $page.url.searchParams.get('code')
    const errorParam = $page.url.searchParams.get('error')
    const errorDescription = $page.url.searchParams.get('error_description')

    if (errorParam) {
      error = errorDescription || errorParam
      loading = false
      return
    }

    if (!code) {
      error = 'No authorization code received'
      loading = false
      return
    }

    try {
      const result = await googleOAuth.handleOAuthCallback(code)
      
      if (result.success && result.user) {
        success = true
        
        // Check if user is in ApprovedUsers group
        const isApproved = result.user['cognito:groups']?.includes('ApprovedUsers') || false
        
        if (!isApproved) {
          // User is authenticated but not approved - redirect to pending approval page
          setTimeout(() => goto('/auth/pending-approval'), 1500)
          return
        }
        
        // User is approved - proceed with normal redirect
        const returnUrl = sessionStorage.getItem('auth_return_url')
        if (returnUrl) {
          sessionStorage.removeItem('auth_return_url')
          setTimeout(() => goto(returnUrl), 1500)
        } else {
          setTimeout(() => goto('/'), 1500)
        }
      } else {
        error = result.error?.message || 'Authentication failed'
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Authentication failed'
    } finally {
      loading = false
    }
  })
</script>

<svelte:head>
  <title>Authentication Callback</title>
  <meta name="description" content="Processing authentication..." />
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-base-200 px-4">
  <div class="card w-full max-w-md mx-auto bg-base-100 shadow-xl">
    <div class="card-body text-center">
      {#if loading}
        <div class="loading loading-spinner loading-lg mx-auto mb-4"></div>
        <h2 class="card-title justify-center">Processing Authentication...</h2>
        <p class="text-sm opacity-70">Please wait while we sign you in.</p>
      {:else if success}
        <div class="text-success text-6xl mb-4">✓</div>
        <h2 class="card-title justify-center text-success">Authentication Successful!</h2>
        <p class="text-sm opacity-70">Redirecting you to the home page...</p>
      {:else if error}
        <div class="text-error text-6xl mb-4">✗</div>
        <h2 class="card-title justify-center text-error">Authentication Failed</h2>
        <div class="alert alert-error">
          <span>{error}</span>
        </div>
        <div class="card-actions justify-center mt-4">
          <a href="/auth/login" class="btn btn-primary">Try Again</a>
          <a href="/" class="btn btn-ghost">Go Home</a>
        </div>
      {/if}
    </div>
  </div>
</div>