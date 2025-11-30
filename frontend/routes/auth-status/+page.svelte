<script lang="ts">
  import type { PageData } from './$types'
  
  export let data: PageData
</script>

<svelte:head>
  <title>Authentication Status</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold mb-6">Authentication Status</h1>
  
  <!-- Cognito Configuration Status -->
  <div class="mb-8">
    <h2 class="text-2xl font-semibold mb-4">Cognito Configuration</h2>
    
    {#if data.cognitoConfig.isConfigured}
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="flex items-center mb-2">
          <span class="text-green-600 text-xl mr-2">✅</span>
          <span class="font-semibold text-green-800">Cognito is configured</span>
        </div>
        <div class="text-sm text-green-700 space-y-1">
          <div><strong>Region:</strong> {data.cognitoConfig.region}</div>
          <div><strong>User Pool ID:</strong> {data.cognitoConfig.userPoolId}</div>
          <div><strong>Client ID:</strong> {data.cognitoConfig.clientId}</div>
        </div>
      </div>
    {:else}
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div class="flex items-center mb-2">
          <span class="text-yellow-600 text-xl mr-2">⚠️</span>
          <span class="font-semibold text-yellow-800">Cognito configuration incomplete</span>
        </div>
        <div class="text-sm text-yellow-700 mb-3">
          <p>The following environment variables need to be set:</p>
        </div>
        <div class="text-sm space-y-1">
          <div class="flex items-center">
            {#if data.cognitoConfig.region}
              <span class="text-green-600 mr-2">✅</span>
            {:else}
              <span class="text-red-600 mr-2">❌</span>
            {/if}
            <code class="bg-gray-100 px-2 py-1 rounded">PUBLIC_AWS_REGION</code>
            {#if data.cognitoConfig.region}
              <span class="ml-2 text-green-600">= {data.cognitoConfig.region}</span>
            {/if}
          </div>
          <div class="flex items-center">
            {#if data.cognitoConfig.userPoolId}
              <span class="text-green-600 mr-2">✅</span>
            {:else}
              <span class="text-red-600 mr-2">❌</span>
            {/if}
            <code class="bg-gray-100 px-2 py-1 rounded">PUBLIC_COGNITO_USER_POOL_ID</code>
            {#if data.cognitoConfig.userPoolId}
              <span class="ml-2 text-green-600">= {data.cognitoConfig.userPoolId}</span>
            {/if}
          </div>
          <div class="flex items-center">
            {#if data.cognitoConfig.clientId}
              <span class="text-green-600 mr-2">✅</span>
            {:else}
              <span class="text-red-600 mr-2">❌</span>
            {/if}
            <code class="bg-gray-100 px-2 py-1 rounded">PUBLIC_COGNITO_USER_POOL_CLIENT_ID</code>
            {#if data.cognitoConfig.clientId}
              <span class="ml-2 text-green-600">= {data.cognitoConfig.clientId}</span>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
  
  <!-- User Authentication Status -->
  <div class="mb-8">
    <h2 class="text-2xl font-semibold mb-4">User Authentication</h2>
    
    {#if data.user}
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="flex items-center mb-2">
          <span class="text-green-600 text-xl mr-2">✅</span>
          <span class="font-semibold text-green-800">User is authenticated and approved</span>
        </div>
        <div class="text-sm text-green-700 space-y-1">
          <div><strong>Email:</strong> {data.user.email}</div>
          <div><strong>Username:</strong> {data.user.username}</div>
          <div><strong>Groups:</strong> 
            {#each data.user.groups as group}
              <span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-1">
                {group}
              </span>
            {/each}
          </div>
          {#if data.user.given_name || data.user.family_name}
            <div><strong>Name:</strong> {data.user.given_name || ''} {data.user.family_name || ''}</div>
          {/if}
        </div>
      </div>
    {:else}
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div class="flex items-center mb-2">
          <span class="text-gray-600 text-xl mr-2">👤</span>
          <span class="font-semibold text-gray-800">No authenticated user</span>
        </div>
        <p class="text-sm text-gray-600">
          User is either not logged in, not in the ApprovedUsers group, or Cognito is not configured.
        </p>
      </div>
    {/if}
  </div>
  
  <!-- Setup Instructions -->
  {#if !data.cognitoConfig.isConfigured}
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 class="font-semibold text-blue-800 mb-2">Setup Instructions</h3>
      <div class="text-blue-700 text-sm space-y-2">
        <p><strong>1. Deploy AWS Infrastructure:</strong></p>
        <pre class="bg-blue-100 p-2 rounded text-xs overflow-x-auto">cd aws-infrastructure
aws cloudformation deploy --template-file cognito-user-pool.yaml --stack-name my-app-cognito --capabilities CAPABILITY_NAMED_IAM</pre>
        
        <p><strong>2. Get the outputs and update your .env file:</strong></p>
        <pre class="bg-blue-100 p-2 rounded text-xs overflow-x-auto">aws cloudformation describe-stacks --stack-name my-app-cognito --query 'Stacks[0].Outputs'</pre>
        
        <p><strong>3. Add users to the ApprovedUsers group:</strong></p>
        <pre class="bg-blue-100 p-2 rounded text-xs overflow-x-auto">node scripts/add-approved-user.js user@example.com</pre>
      </div>
    </div>
  {/if}
  
  <!-- Test Links -->
  {#if data.cognitoConfig.isConfigured}
    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h3 class="font-semibold text-gray-800 mb-2">Test Authentication</h3>
      <div class="space-y-2">
        <div>
          <a href="/admin" class="text-blue-600 hover:text-blue-800 underline">
            Protected Admin Page
          </a>
          <span class="text-sm text-gray-600 ml-2">(requires ApprovedUsers group)</span>
        </div>
        <div>
          <a href="/api/protected" class="text-blue-600 hover:text-blue-800 underline">
            Protected API Endpoint
          </a>
          <span class="text-sm text-gray-600 ml-2">(JSON response, requires Authorization header)</span>
        </div>
      </div>
    </div>
  {/if}
</div>