<script lang="ts">
  import { apiClient } from '$lib/auth/api-client'
  
  let loading = false
  let response: any = null
  let error = ''

  async function callProtectedApi() {
    loading = true
    error = ''
    response = null
    
    try {
      // This will automatically include the JWT token in the Authorization header
      const result = await apiClient.get('/protected/example')
      response = result
    } catch (err) {
      error = err instanceof Error ? err.message : 'API call failed'
    } finally {
      loading = false
    }
  }

  async function callPublicApi() {
    loading = true
    error = ''
    response = null
    
    try {
      // This call doesn't require authentication
      const result = await apiClient.get('/public/health', { requireAuth: false })
      response = result
    } catch (err) {
      error = err instanceof Error ? err.message : 'API call failed'
    } finally {
      loading = false
    }
  }
</script>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">API Integration Example</h2>
    <p class="text-sm opacity-75 mb-4">
      Test your JWT authentication with protected API endpoints
    </p>
    
    <div class="flex gap-2 mb-4">
      <button 
        class="btn btn-primary" 
        class:loading 
        disabled={loading}
        on:click={callProtectedApi}
      >
        Call Protected API
      </button>
      
      <button 
        class="btn btn-secondary" 
        class:loading 
        disabled={loading}
        on:click={callPublicApi}
      >
        Call Public API
      </button>
    </div>

    {#if error}
      <div class="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{error}</span>
      </div>
    {/if}

    {#if response}
      <div class="alert alert-success">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>API call successful!</span>
      </div>
      
      <div class="mockup-code">
        <pre data-prefix="$"><code>curl -H "Authorization: Bearer [JWT_TOKEN]" {response.endpoint || 'API_ENDPOINT'}</code></pre>
        <pre data-prefix=">" class="text-success"><code>{JSON.stringify(response, null, 2)}</code></pre>
      </div>
    {/if}

    <div class="divider">How it works</div>
    
    <div class="text-sm space-y-2">
      <p><strong>Protected API:</strong> Requires valid JWT token in Authorization header</p>
      <p><strong>Public API:</strong> No authentication required</p>
      <p><strong>Auto-refresh:</strong> Tokens are automatically refreshed before expiration</p>
      <p><strong>Error handling:</strong> Automatic retry on token expiration</p>
    </div>
  </div>
</div>