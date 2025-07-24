<script lang="ts">
  import { onMount } from 'svelte'
  import { cognitoConfig, isCognitoConfigured } from '$lib/auth/cognito-config'
  
  let status = 'Loading...'
  let configStatus = false
  
  onMount(() => {
    try {
      configStatus = isCognitoConfigured()
      status = configStatus ? 'Cognito is configured!' : 'Cognito not configured (this is normal in development)'
    } catch (error) {
      status = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  })
</script>

<svelte:head>
  <title>Auth Test</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-4">Authentication Test</h1>
  
  <div class="space-y-4">
    <div class="p-4 border rounded">
      <h2 class="font-semibold mb-2">Configuration Status</h2>
      <p class={configStatus ? 'text-green-600' : 'text-yellow-600'}>
        {status}
      </p>
    </div>
    
    <div class="p-4 border rounded">
      <h2 class="font-semibold mb-2">Config Values</h2>
      <pre class="text-sm bg-gray-100 p-2 rounded overflow-x-auto">{JSON.stringify(cognitoConfig, null, 2)}</pre>
    </div>
    
    <div class="p-4 border rounded">
      <h2 class="font-semibold mb-2">Test Links</h2>
      <div class="space-y-2">
        <div><a href="/auth-status" class="text-blue-600 hover:underline">Auth Status Page</a></div>
        <div><a href="/admin" class="text-blue-600 hover:underline">Protected Admin Page</a></div>
        <div><a href="/api/protected" class="text-blue-600 hover:underline">Protected API</a></div>
      </div>
    </div>
  </div>
</div>