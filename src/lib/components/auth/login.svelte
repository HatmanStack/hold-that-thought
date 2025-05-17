<script lang="ts">
  import { login } from '$lib/utils/auth'
  import { isLoading, authError } from '$lib/stores/user'
  import { onMount } from 'svelte'
  
  let username = ''
  let password = ''
  let rememberMe = false
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!username || !password) return
    
    await login({ username, password })
  }
  
  // Clear form on mount
  onMount(() => {
    username = ''
    password = ''
  })
</script>

<div class="card w-full bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Login</h2>
    
    {#if $authError}
      <div class="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>{$authError}</span>
      </div>
    {/if}
    
    <form on:submit|preventDefault={handleSubmit}>
      <div class="form-control">
        <label class="label" for="username">
          <span class="label-text">Username or Email</span>
        </label>
        <input 
          type="text" 
          id="username"
          bind:value={username} 
          placeholder="Enter your username or email" 
          class="input input-bordered" 
          required 
        />
      </div>
      
      <div class="form-control mt-4">
        <label class="label" for="password">
          <span class="label-text">Password</span>
        </label>
        <input 
          type="password" 
          id="password"
          bind:value={password} 
          placeholder="Enter your password" 
          class="input input-bordered" 
          required 
        />
        <label class="label">
          <a href="/auth?mode=forgot" class="label-text-alt link link-hover">Forgot password?</a>
        </label>
      </div>
      
      <div class="form-control mt-2">
        <label class="label cursor-pointer justify-start gap-2">
          <input type="checkbox" bind:checked={rememberMe} class="checkbox checkbox-primary" />
          <span class="label-text">Remember me</span>
        </label>
      </div>
      
      <div class="form-control mt-6">
        <button 
          type="submit" 
          class="btn btn-primary" 
          disabled={$isLoading}
        >
          {#if $isLoading}
            <span class="loading loading-spinner"></span>
            Logging in...
          {:else}
            Login
          {/if}
        </button>
      </div>
    </form>
    
    <div class="divider">OR</div>
    
    <div class="text-center">
      <p>Don't have an account?</p>
      <a href="/auth?mode=signup" class="link link-primary">Sign up</a>
    </div>
  </div>
</div>