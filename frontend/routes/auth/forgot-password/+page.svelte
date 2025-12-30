<script lang='ts'>
  import { goto } from '$app/navigation'
  import { authService } from '$lib/auth/auth-service'

  let email = ''
  let error = ''
  let loading = false
  let submitted = false

  async function handleSubmit() {
    if (!email) {
      error = 'Please enter your email address'
      return
    }

    loading = true
    error = ''

    try {
      await authService.forgotPassword(email)
      submitted = true
      // Store email for the reset page
      sessionStorage.setItem('reset_password_email', email)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset code'
      if (message.includes('User does not exist')) {
        // Don't reveal if user exists - just show success
        submitted = true
        sessionStorage.setItem('reset_password_email', email)
      }
 else if (message.includes('Attempt limit exceeded')) {
        error = 'Too many attempts. Please try again later.'
      }
 else {
        error = message
      }
    }
    finally {
      loading = false
    }
  }

  function goToReset() {
    goto('/auth/reset-password')
  }
</script>

<svelte:head>
  <title>Forgot Password</title>
  <meta name='description' content='Reset your password' />
</svelte:head>

<div class='min-h-screen flex items-center justify-center bg-base-200 px-4'>
  <div class='w-full bg-base-100 card mx-auto shadow-xl max-w-md'>
    <div class='card-body'>
      <h2 class='justify-center mb-4 card-title'>Forgot Password</h2>

      {#if submitted}
        <div class='space-y-4'>
          <div class='alert alert-success'>
            <svg xmlns='http://www.w3.org/2000/svg' class='stroke-current shrink-0 h-6 w-6' fill='none' viewBox='0 0 24 24'>
              <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />
            </svg>
            <span>If an account exists for {email}, a reset code has been sent.</span>
          </div>

          <p class='text-sm text-base-content/70'>
            Check your email for a verification code, then click below to reset your password.
          </p>

          <button
            type='button'
            class='w-full btn btn-primary'
            on:click={goToReset}
          >
            Enter Reset Code
          </button>

          <button
            type='button'
            class='w-full btn btn-ghost btn-sm'
            on:click={() => {
              submitted = false
              error = ''
            }}
          >
            Try a different email
          </button>
        </div>
      {:else}
        <form on:submit|preventDefault={handleSubmit} class='space-y-4'>
          <p class='text-sm text-base-content/70'>
            Enter your email address and we'll send you a code to reset your password.
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
              Sending...
            {:else}
              Send Reset Code
            {/if}
          </button>

          <div class='text-center'>
            <a href='/auth/login' class='link link-hover text-sm'>
              Back to Sign In
            </a>
          </div>
        </form>
      {/if}
    </div>
  </div>
</div>
