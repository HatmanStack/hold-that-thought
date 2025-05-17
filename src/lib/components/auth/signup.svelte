<script lang="ts">
  import { register } from '$lib/utils/auth'
  import { isLoading, authError } from '$lib/stores/user'
  import { onMount } from 'svelte'
  
  let username = ''
  let email = ''
  let password = ''
  let confirmPassword = ''
  let givenName = ''
  let familyName = ''
  let passwordError = ''
  
  // Validate password match
  $: {
    if (password && confirmPassword && password !== confirmPassword) {
      passwordError = "Passwords don't match"
    } else {
      passwordError = ''
    }
  }
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!username || !email || !password || password !== confirmPassword) return
    
    await register({ 
      username, 
      password, 
      email,
      given_name: givenName || undefined,
      family_name: familyName || undefined
    })
  }
  
  // Clear form on mount
  onMount(() => {
    username = ''
    email = ''
    password = ''
    confirmPassword = ''
    givenName = ''
    familyName = ''
  })
</script>

<div class="card w-full bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Create an Account</h2>
    
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
          placeholder="Choose a username" 
          class="input input-bordered" 
          required 
        />
      </div>
      
      <div class="form-control mt-4">
        <label class="label" for="email">
          <span class="label-text">Email</span>
        </label>
        <input 
          type="email" 
          id="email"
          bind:value={email} 
          placeholder="Enter your email" 
          class="input input-bordered" 
          required 
        />
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div class="form-control">
          <label class="label" for="givenName">
            <span class="label-text">First Name</span>
          </label>
          <input 
            type="text" 
            id="givenName"
            bind:value={givenName} 
            placeholder="First name" 
            class="input input-bordered" 
          />
        </div>
        
        <div class="form-control">
          <label class="label" for="familyName">
            <span class="label-text">Last Name</span>
          </label>
          <input 
            type="text" 
            id="familyName"
            bind:value={familyName} 
            placeholder="Last name" 
            class="input input-bordered" 
          />
        </div>
      </div>
      
      <div class="form-control mt-4">
        <label class="label" for="password">
          <span class="label-text">Password</span>
        </label>
        <input 
          type="password" 
          id="password"
          bind:value={password} 
          placeholder="Create a password" 
          class="input input-bordered" 
          required 
        />
      </div>
      
      <div class="form-control mt-4">
        <label class="label" for="confirmPassword">
          <span class="label-text">Confirm Password</span>
        </label>
        <input 
          type="password" 
          id="confirmPassword"
          bind:value={confirmPassword} 
          placeholder="Confirm your password" 
          class="input input-bordered" 
          class:input-error={passwordError}
          required 
        />
        {#if passwordError}
          <label class="label">
            <span class="label-text-alt text-error">{passwordError}</span>
          </label>
        {/if}
      </div>
      
      <div class="form-control mt-6">
        <button 
          type="submit" 
          class="btn btn-primary" 
          disabled={$isLoading || !!passwordError}
        >
          {#if $isLoading}
            <span class="loading loading-spinner"></span>
            Creating account...
          {:else}
            Sign Up
          {/if}
        </button>
      </div>
    </form>
    
    <div class="divider">OR</div>
    
    <div class="text-center">
      <p>Already have an account?</p>
      <a href="/auth?mode=login" class="link link-primary">Login</a>
    </div>
  </div>
</div>