<script lang='ts'>
  import { apiClient } from '$lib/auth/api-client'
  import { currentUser } from '$lib/auth/auth-store'
  import AuthGuard from '$lib/components/auth/AuthGuard.svelte'
  import { onMount } from 'svelte'

  let apiResponse: any = null
  let loading = false
  let error = ''

  async function testProtectedApi() {
    loading = true
    error = ''

    try {
      const response = await apiClient.get('/protected/example')
      apiResponse = response
    }
    catch (err) {
      error = err instanceof Error ? err.message : 'API call failed'
      console.error('API Error:', err)
    }
    finally {
      loading = false
    }
  }

  onMount(() => {
    // Automatically test the API when the component mounts
    testProtectedApi()
  })
</script>

<svelte:head>
  <title>Dashboard</title>
  <meta name='description' content='Protected dashboard page' />
</svelte:head>

<AuthGuard>
  <div class='container mx-auto px-4 py-8'>
    <div class='max-w-4xl mx-auto'>
      <h1 class='text-3xl font-bold mb-8'>Dashboard</h1>

      {#if $currentUser}
        <div class='card bg-base-100 shadow-xl mb-8'>
          <div class='card-body'>
            <h2 class='card-title'>Welcome back!</h2>
            <div class='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <p><strong>Email:</strong> {$currentUser.email}</p>
                <p><strong>User ID:</strong> {$currentUser.sub}</p>
                <p><strong>Email Verified:</strong> {$currentUser.email_verified ? 'Yes' : 'No'}</p>
              </div>
              <div>
                {#if $currentUser.given_name || $currentUser.family_name}
                  <p><strong>Name:</strong> {$currentUser.given_name || ''} {$currentUser.family_name || ''}</p>
                {/if}
                <p><strong>Account Created:</strong> {new Date($currentUser.iat * 1000).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <div class='card bg-base-100 shadow-xl'>
        <div class='card-body'>
          <h2 class='card-title'>Protected API Test</h2>
          <p class='mb-4'>This section tests your JWT token authentication with the backend API.</p>

          <div class='flex gap-4 mb-4'>
            <button
              class='btn btn-primary'
              class:loading
              disabled={loading}
              on:click={testProtectedApi}
            >
              {loading ? 'Testing...' : 'Test Protected API'}
            </button>
          </div>

          {#if error}
            <div class='alert alert-error'>
              <span>Error: {error}</span>
            </div>
          {/if}

          {#if apiResponse}
            <div class='alert alert-success'>
              <span>✅ API call successful!</span>
            </div>

            <div class='mt-4 mockup-code'>
              <pre><code>{JSON.stringify(apiResponse, null, 2)}</code></pre>
            </div>
          {/if}
        </div>
      </div>

      <div class='card bg-base-100 shadow-xl mt-8'>
        <div class='card-body'>
          <h2 class='card-title'>Authentication Flow Summary</h2>
          <div class='space-y-4'>
            <div class='steps steps-vertical lg:steps-horizontal'>
              <div class='step step-primary'>User Registration</div>
              <div class='step step-primary'>Email Verification</div>
              <div class='step step-primary'>Sign In</div>
              <div class='step step-primary'>JWT Token Issued</div>
              <div class='step step-primary'>Protected API Access</div>
            </div>

            <div class='mt-6'>
              <h3 class='text-lg font-semibold mb-2'>How it works:</h3>
              <ul class='list-disc list-inside space-y-2 text-sm'>
                <li>Users sign up with email and password through AWS Cognito</li>
                <li>Email verification is required before account activation</li>
                <li>Upon successful login, Cognito issues JWT tokens (Access, ID, Refresh)</li>
                <li>JWT tokens are automatically included in API requests via Authorization header</li>
                <li>API Gateway validates JWT tokens using Cognito User Pool Authorizer</li>
                <li>Lambda functions receive validated user claims in the event context</li>
                <li>Tokens are automatically refreshed before expiration</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</AuthGuard>
