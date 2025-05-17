<script lang="ts">
  import { confirm } from '$lib/utils/auth'
  import { isLoading, authError } from '$lib/stores/user'
  import { onMount } from 'svelte'
  
  export let username = ''
  
  let code = ''
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!username || !code) return
    
    await confirm(username, code)
  }
  
  // Clear form on mount
  onMount(() => {
    code = ''
  })
</script>

<div class="card w-full bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Confirm Your Account</h2>
    
    <p class="text-sm mb-4">
      We've sent a verification code to your email address. 
      Please enter the code below to verify your account.
    </p>
    
    {#if $authError}
      <div class="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>{$authError}</span>
      </div>
    {/if}
    
    <form on:submit|preventDefault={handleSubmit}>
      <div class="form-control">
        <label class="label" for="username">
          <span class="label-text">Username</span>
        </label>
        <input 
          type="text" 
          id="username"
          bind:value={username} 
          placeholder="Enter your username" 
          class="input input-bordered" 
          required 
          readonly={!!username}
        />
      </div>
      
      <div class="form-control mt-4">
        <label class="label" for="code">
          <span class="label-text">Verification Code</span>
        </label>
        <input 
          type="text" 
          id="code"
          bind:value={code} 
          placeholder="Enter verification code" 
          class="input input-bordered" 
          required 
        />
      </div>
      
      <div class="form-control mt-6">
        <button 
          type="submit" 
          class="btn btn-primary" 
          disabled={$isLoading}
        >
          {#if $isLoading}
            <span class="loading loading-spinner"></span>
            Verifying...
          {:else}
            Verify Account
          {/if}
        </button>
      </div>
    </form>
    
    <div class="divider">OR</div>
    
    <div class="text-center">
      <p>Already verified?</p>
      <a href="/auth?mode=login" class="link link-primary">Login</a>
    </div>
  </div>
</div>