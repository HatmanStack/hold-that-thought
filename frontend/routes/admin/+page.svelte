<script lang="ts">
  import type { PageData } from './$types'
  import { authenticatedFetch } from '$lib/auth/client'
  import { onMount } from 'svelte'
  
  export let data: PageData
  
  let apiResponse: any = null
  let loading = false
  let error: string | null = null
  
  async function testProtectedAPI() {
    loading = true
    error = null
    
    try {
      const response = await authenticatedFetch('/api/protected')
      if (response.ok) {
        apiResponse = await response.json()
      } else {
        const errorData = await response.json()
        error = errorData.message || 'API request failed'
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Network error'
    } finally {
      loading = false
    }
  }
</script>

<svelte:head>
  <title>Admin Dashboard</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold mb-6">Admin Dashboard</h1>
  
  <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
    <h2 class="text-lg font-semibold text-green-800 mb-2">✅ Access Granted</h2>
    <p class="text-green-700">You are successfully authenticated and authorized to access this page.</p>
  </div>
  
  <div class="grid gap-6 md:grid-cols-2">
    <!-- User Information -->
    <div class="bg-white border border-gray-200 rounded-lg p-6">
      <h2 class="text-xl font-semibold mb-4">User Information</h2>
      <dl class="space-y-2">
        <div>
          <dt class="font-medium text-gray-600">Name:</dt>
          <dd class="text-gray-900">{data.user.name}</dd>
        </div>
        <div>
          <dt class="font-medium text-gray-600">Email:</dt>
          <dd class="text-gray-900">{data.user.email}</dd>
        </div>
        <div>
          <dt class="font-medium text-gray-600">Username:</dt>
          <dd class="text-gray-900">{data.user.username}</dd>
        </div>
        <div>
          <dt class="font-medium text-gray-600">User ID:</dt>
          <dd class="text-gray-900 font-mono text-sm">{data.user.id}</dd>
        </div>
        <div>
          <dt class="font-medium text-gray-600">Groups:</dt>
          <dd class="text-gray-900">
            {#each data.user.groups as group}
              <span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-1">
                {group}
              </span>
            {/each}
          </dd>
        </div>
      </dl>
    </div>
    
    <!-- API Test -->
    <div class="bg-white border border-gray-200 rounded-lg p-6">
      <h2 class="text-xl font-semibold mb-4">Protected API Test</h2>
      <p class="text-gray-600 mb-4">Test the protected API endpoint that requires ApprovedUsers group membership.</p>
      
      <button 
        on:click={testProtectedAPI}
        disabled={loading}
        class="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded transition-colors"
      >
        {loading ? 'Testing...' : 'Test Protected API'}
      </button>
      
      {#if error}
        <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
          <strong>Error:</strong> {error}
        </div>
      {/if}
      
      {#if apiResponse}
        <div class="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
          <h3 class="font-medium mb-2">API Response:</h3>
          <pre class="text-sm overflow-x-auto">{JSON.stringify(apiResponse, null, 2)}</pre>
        </div>
      {/if}
    </div>
  </div>
  
  <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h3 class="font-semibold text-blue-800 mb-2">Implementation Notes</h3>
    <ul class="text-blue-700 space-y-1 text-sm">
      <li>• This page uses <code>requireApprovedUser()</code> in the server load function</li>
      <li>• Users not in the ApprovedUsers group will get a 403 error</li>
      <li>• The API endpoint also validates group membership on each request</li>
      <li>• JWT tokens are verified server-side using Cognito's public keys</li>
    </ul>
  </div>
</div>