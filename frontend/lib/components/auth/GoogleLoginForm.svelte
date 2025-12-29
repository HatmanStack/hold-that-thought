<script lang='ts'>
  import { googleOAuth } from '$lib/auth/google-oauth'
  import { authService } from '$lib/auth/auth-service'
  import { isGuestLoginEnabled } from '$lib/auth/cognito-config'

  let error = ''
  let guestLoading = false

  const guestEnabled = isGuestLoginEnabled()

  async function handleGoogleLogin() {
    try {
      const { isCognitoConfigured } = await import('$lib/auth/cognito-config')

      if (!isCognitoConfigured()) {
        error = 'Cognito authentication is not configured. Please set up your environment variables.'
        return
      }

      // Go directly to Google OAuth
      googleOAuth.loginWithGoogle()
    }
    catch (err) {
      error = err instanceof Error ? err.message : 'Google login failed'
    }
  }

  async function handleGuestLogin() {
    guestLoading = true
    error = ''
    try {
      await authService.signInAsGuest()
    }
    catch (err) {
      error = err instanceof Error ? err.message : 'Guest login failed'
    }
    finally {
      guestLoading = false
    }
  }
</script>

<div class='w-full bg-base-100 card mx-auto shadow-xl max-w-md'>
  <div class='card-body'>
    <h2 class='justify-center mb-4 card-title'>Sign In</h2>

    <div class='space-y-4'>
      {#if guestEnabled}
        <button
          type='button'
          class='w-full btn btn-primary gap-2 text-lg py-4 h-auto'
          on:click={handleGuestLogin}
          disabled={guestLoading}
        >
          {#if guestLoading}
            <span class='loading loading-spinner'></span>
            Signing in...
          {:else}
            <svg class='w-6 h-6' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'>
              <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
              <circle cx='12' cy='7' r='4' />
            </svg>
            Continue as Guest
          {/if}
        </button>
        <div class='divider'>or</div>
      {/if}
      <button
        type='button'
        class='w-full btn btn-outline gap-2 text-lg py-4 h-auto'
        on:click={handleGoogleLogin}
      >
        <svg class='w-6 h-6' viewBox='0 0 24 24'>
          <path fill='currentColor' d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z' />
          <path fill='currentColor' d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' />
          <path fill='currentColor' d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z' />
          <path fill='currentColor' d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z' />
        </svg>
        Continue with Google
      </button>
    </div>

    {#if error}
      <div class='mt-4 alert alert-error'>
        <span>{error}</span>
      </div>
    {/if}

    <div class='divider'>Access Information</div>

    <div class='space-y-2 text-center'>
      <div class='alert alert-info'>
        <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' class='w-6 h-6 stroke-current shrink-0'>
          <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'></path>
        </svg>
        <div class='text-sm'>
          <p><strong>Restricted Access:</strong> Only authorized users can sign in</p>
          <p class='mt-1'>• Google OAuth users with approved email domains</p>
          <p>• Users manually added by administrators</p>
        </div>
      </div>

      <div class='mt-4'>
        <p class='text-xs opacity-70'>
          Need access? Contact your administrator to authorize your email address.
        </p>
      </div>
    </div>
  </div>
</div>
