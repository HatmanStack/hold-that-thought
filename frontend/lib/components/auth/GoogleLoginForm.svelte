<script lang='ts'>
  import { googleOAuth } from '$lib/auth/google-oauth'

  let error = ''

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
</script>

<div class='card w-full max-w-md mx-auto bg-base-100 shadow-xl'>
  <div class='card-body'>
    <h2 class='justify-center card-title mb-4'>Sign In</h2>

    <!-- Google OAuth Only -->
    <div class='space-y-4'>
      <button
        type='button'
        class='w-full btn btn-primary gap-2 text-lg py-4 h-auto'
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
      <div class='alert alert-error mt-4'>
        <span>{error}</span>
      </div>
    {/if}

    <div class='divider'>Access Information</div>

    <div class='text-center space-y-2'>
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
