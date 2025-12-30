<script lang='ts'>
  import { goto } from '$app/navigation'
  import { authService } from '$lib/auth/auth-service'
  import { onMount } from 'svelte'

  let email = ''
  let code = ''
  let newPassword = ''
  let confirmPassword = ''
  let error = ''
  let loading = false
  let success = false

  onMount(() => {
    // Get email from session storage (set by forgot-password page)
    const storedEmail = sessionStorage.getItem('reset_password_email')
    if (storedEmail) {
      email = storedEmail
    }
  })

  async function handleSubmit() {
    error = ''

    if (!email) {
      error = 'Please enter your email address'
      return
    }

    if (!code) {
      error = 'Please enter the verification code'
      return
    }

    if (!newPassword || !confirmPassword) {
      error = 'Please enter and confirm your new password'
      return
    }

    if (newPassword !== confirmPassword) {
      error = 'Passwords do not match'
      return
    }

    if (newPassword.length < 8) {
      error = 'Password must be at least 8 characters'
      return
    }

    loading = true

    try {
      await authService.resetPassword(email, code, newPassword)
      success = true
      sessionStorage.removeItem('reset_password_email')
    }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password'
      if (message.includes('Invalid verification code')) {
        error = 'Invalid or expired verification code'
      } else if (message.includes('Password does not conform')) {
        error = 'Password must include uppercase, lowercase, and numbers'
      } else if (message.includes('Attempt limit exceeded')) {
        error = 'Too many attempts. Please request a new code.'
      } else {
        error = message
      }
    }
    finally {
      loading = false
    }
  }

  function goToLogin() {
    goto('/auth/login')
  }
</script>

<svelte:head>
  <title>Reset Password</title>
  <meta name='description' content='Reset your password' />
</svelte:head>

<div class='min-h-screen flex items-center justify-center bg-base-200 px-4'>
  <div class='w-full bg-base-100 card mx-auto shadow-xl max-w-md'>
    <div class='card-body'>
      <h2 class='justify-center mb-4 card-title'>Reset Password</h2>

      {#if success}
        <div class='space-y-4'>
          <div class='alert alert-success'>
            <svg xmlns='http://www.w3.org/2000/svg' class='stroke-current shrink-0 h-6 w-6' fill='none' viewBox='0 0 24 24'>
              <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />
            </svg>
            <span>Your password has been reset successfully!</span>
          </div>

          <button
            type='button'
            class='w-full btn btn-primary'
            on:click={goToLogin}
          >
            Sign In
          </button>
        </div>
      {:else}
        <form on:submit|preventDefault={handleSubmit} class='space-y-4'>
          <p class='text-sm text-base-content/70'>
            Enter the verification code from your email and your new password.
          </p>

          <div class='form-control'>
            <label class='label' for='email'>
              <span class='label-text'>Email</span>
            </label>
            <input
              id='email'
              type='email'
              bind:value={email}
              class='input input-bordered w-full'
              placeholder='Enter your email'
              disabled={loading}
              autocomplete='email'
            />
          </div>

          <div class='form-control'>
            <label class='label' for='code'>
              <span class='label-text'>Verification Code</span>
            </label>
            <input
              id='code'
              type='text'
              bind:value={code}
              class='input input-bordered w-full'
              placeholder='Enter 6-digit code'
              disabled={loading}
              autocomplete='one-time-code'
              inputmode='numeric'
              maxlength='6'
            />
          </div>

          <div class='form-control'>
            <label class='label' for='newPassword'>
              <span class='label-text'>New Password</span>
            </label>
            <input
              id='newPassword'
              type='password'
              bind:value={newPassword}
              class='input input-bordered w-full'
              placeholder='Enter new password'
              disabled={loading}
              autocomplete='new-password'
            />
          </div>

          <div class='form-control'>
            <label class='label' for='confirmPassword'>
              <span class='label-text'>Confirm Password</span>
            </label>
            <input
              id='confirmPassword'
              type='password'
              bind:value={confirmPassword}
              class='input input-bordered w-full'
              placeholder='Confirm new password'
              disabled={loading}
              autocomplete='new-password'
            />
          </div>

          <p class='text-xs text-base-content/60'>
            Password must be at least 8 characters with uppercase, lowercase, and numbers.
          </p>

          {#if error}
            <div class='alert alert-error'>
              <span>{error}</span>
            </div>
          {/if}

          <button
            type='submit'
            class='w-full btn btn-primary'
            disabled={loading}
          >
            {#if loading}
              <span class='loading loading-spinner'></span>
              Resetting...
            {:else}
              Reset Password
            {/if}
          </button>

          <div class='flex justify-between text-sm'>
            <a href='/auth/forgot-password' class='link link-hover'>
              Request new code
            </a>
            <a href='/auth/login' class='link link-hover'>
              Back to Sign In
            </a>
          </div>
        </form>
      {/if}
    </div>
  </div>
</div>
