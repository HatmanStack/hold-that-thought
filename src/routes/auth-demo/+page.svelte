<script lang="ts">
  import { currentUser, isAuthenticated } from '$lib/auth/auth-store'
  import ApiExample from '$lib/components/examples/ApiExample.svelte'
  import AuthGuard from '$lib/components/auth/AuthGuard.svelte'
</script>

<svelte:head>
  <title>Authentication Demo</title>
  <meta name="description" content="Complete authentication workflow demonstration" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="max-w-4xl mx-auto">
    <div class="hero bg-gradient-to-r from-primary to-secondary text-primary-content rounded-box mb-8">
      <div class="hero-content text-center">
        <div class="max-w-md">
          <h1 class="mb-5 text-5xl font-bold">🔐 Auth Demo</h1>
          <p class="mb-5">
            Complete AWS Cognito + JWT authentication workflow for SvelteKit
          </p>
        </div>
      </div>
    </div>

    {#if $isAuthenticated}
      <AuthGuard>
        <div class="grid gap-6">
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <h2 class="card-title">👤 Authenticated User</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p><strong>Email:</strong> {$currentUser?.email}</p>
                  <p><strong>User ID:</strong> {$currentUser?.sub}</p>
                </div>
                <div>
                  <p><strong>Token Issued:</strong> {new Date($currentUser?.iat * 1000).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          <ApiExample />
        </div>
      </AuthGuard>
    {:else}
      <div class="text-center space-y-6">
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h2 class="card-title justify-center">🔒 Restricted Access</h2>
            <p>This application requires authorized access. Please sign in with an approved method.</p>
            
            <div class="alert alert-info mt-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div>
                <p><strong>Google OAuth Authentication Only</strong></p>
                <p>Sign in with your Google account to access the application</p>
              </div>
            </div>
            
            <div class="card-actions justify-center mt-4">
              <a href="/auth/login" class="btn btn-primary">Sign In</a>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>