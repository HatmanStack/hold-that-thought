<script lang="ts">
  import { forgotPasswordRequest, resetPasswordConfirm } from '$lib/utils/auth'
  import { isLoading, authError } from '$lib/stores/user'
  import { onMount } from 'svelte'
  
  export let mode: 'forgot' | 'reset' = 'forgot'
  export let username = ''
  
  let email = ''
  let code = ''
  let newPassword = ''
  let confirmPassword = ''
  let passwordError = ''
  
  // Validate password match
  $: {
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      passwordError = "Passwords don't match"
    } else {
      passwordError = ''
    }
  }
  
  // Handle forgot password form submission
  const handleForgotSubmit = async () => {
    if (!email) return
    
    await forgotPasswordRequest({ username: email })
  }
  
  // Handle reset password form submission
  const handleResetSubmit = async () => {
    if (!username || !code || !newPassword || newPassword !== confirmPassword) return
    
    await resetPasswordConfirm({ 
      username, 
      code, 
      newPassword 
    })
  }
  
  // Clear form on mount
  onMount(() => {
    if (mode === 'forgot') {
      email = ''
    } else {
      code = ''
      newPassword = ''
      confirmPassword = ''
    }
  })
</script>

<div class="card w-full bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">
      {#if mode === 'forgot'}
        Forgot Password
      {:else}
        Reset Password
      {/if}
    </h2>
    
    {#if $authError}
      <div class="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>{$authError}</span>
      </div>
    {/if}
    
    {#if mode === 'forgot'}
      <p class="text-sm mb-4">Enter your email address and we'll send you a code to reset your password.</p>
      
      <form on:submit|preventDefault={handleForgotSubmit}>
        <div class="form-control">
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
        
        <div class="form-control mt-6">
          <button 
            type="submit" 
            class="btn btn-primary" 
            disabled={$isLoading}
          >
            {#if $isLoading}
              <span class="loading loading-spinner"></span>
              Sending code...
            {:else}
              Send Reset Code
            {/if}
          </button>
        </div>
      </form>
    {:else}
      <p class="text-sm mb-4">Enter the code you received and create a new password.</p>
      
      <form on:submit|preventDefault={handleResetSubmit}>
        <div class="form-control">
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
        
        <div class="form-control mt-4">
          <label class="label" for="newPassword">
            <span class="label-text">New Password</span>
          </label>
          <input 
            type="password" 
            id="newPassword"
            bind:value={newPassword} 
            placeholder="Create a new password" 
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
            placeholder="Confirm your new password" 
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
              Resetting password...
            {:else}
              Reset Password
            {/if}
          </button>
        </div>
      </form>
    {/if}
    
    <div class="divider">OR</div>
    
    <div class="text-center">
      <p>Remember your password?</p>
      <a href="/auth?mode=login" class="link link-primary">Back to Login</a>
    </div>
  </div>
</div>