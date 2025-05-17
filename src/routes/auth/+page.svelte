<script lang="ts">
  import { page } from '$app/stores'
  import { isAuthenticated } from '$lib/stores/user'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  
  import Login from '$lib/components/auth/login.svelte'
  import Signup from '$lib/components/auth/signup.svelte'
  import Reset from '$lib/components/auth/reset.svelte'
  import Confirm from '$lib/components/auth/confirm.svelte'
  
  // Get the mode from the URL query parameter
  let mode = $page.url.searchParams.get('mode') || 'login'
  let username = $page.url.searchParams.get('username') || ''
  let confirmed = $page.url.searchParams.get('confirmed') === 'true'
  let reset = $page.url.searchParams.get('reset') === 'true'
  
  // Redirect to home if already authenticated
  $: if ($isAuthenticated) {
    goto('/')
  }
  
  // Update the URL when the mode changes
  const updateMode = (newMode: string) => {
    mode = newMode
    const url = new URL(window.location.href)
    url.searchParams.set('mode', newMode)
    window.history.pushState({}, '', url)
  }
  
  onMount(() => {
    // Set the mode based on the URL
    mode = $page.url.searchParams.get('mode') || 'login'
  })
</script>

<svelte:head>
  <title>Authentication - Round Robin</title>
  <meta name="description" content="Sign in to your Round Robin account" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="max-w-md mx-auto">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold">Welcome to Round Robin</h1>
      <p class="text-base-content/70">Sharing letters, one typo at a time</p>
    </div>
    
    {#if confirmed}
      <div class="alert alert-success mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>Your account has been confirmed! You can now log in.</span>
      </div>
    {/if}
    
    {#if reset}
      <div class="alert alert-success mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>Your password has been reset! You can now log in with your new password.</span>
      </div>
    {/if}
    
    <div class="tabs tabs-boxed mb-4">
      <a 
        class="tab {mode === 'login' ? 'tab-active' : ''}" 
        on:click={() => updateMode('login')}
      >
        Login
      </a>
      <a 
        class="tab {mode === 'signup' ? 'tab-active' : ''}" 
        on:click={() => updateMode('signup')}
      >
        Sign Up
      </a>
      <a 
        class="tab {mode === 'forgot' || mode === 'reset' ? 'tab-active' : ''}" 
        on:click={() => updateMode('forgot')}
      >
        Reset Password
      </a>
    </div>
    
    {#if mode === 'login'}
      <Login />
    {:else if mode === 'signup'}
      <Signup />
    {:else if mode === 'forgot'}
      <Reset mode="forgot" />
    {:else if mode === 'reset'}
      <Reset mode="reset" {username} />
    {:else if mode === 'confirm'}
      <Confirm {username} />
    {/if}
  </div>
</div>