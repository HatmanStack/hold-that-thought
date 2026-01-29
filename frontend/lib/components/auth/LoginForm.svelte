<script lang='ts'>
  import { authService } from '$lib/auth/auth-service'
  import { isCognitoConfigured, isGuestLoginEnabled } from '$lib/auth/cognito-config'
  import { googleOAuth } from '$lib/auth/google-oauth'

  let email = ''
  let password = ''
  let newPassword = ''
  let confirmPassword = ''
  let error = ''
  let loading = false
  let guestLoading = false

  // For NEW_PASSWORD_REQUIRED challenge
  let pendingChallenge: { session: string, email: string } | null = null

  const guestEnabled = isGuestLoginEnabled()

  async function handleEmailLogin() {
    if (!email || !password) {
      error = 'Please enter email and password'
      return
    }

    loading = true
    error = ''

    try {
      if (!isCognitoConfigured()) {
        error = 'Authentication is not configured'
        return
      }

      const result = await authService.signIn(email, password)

      if (!result.success && result.challengeName === 'NEW_PASSWORD_REQUIRED') {
        pendingChallenge = { session: result.session, email: result.email }
        password = '' // Clear temp password
      }

      // Success - redirect handled by parent page via auth store subscription
    }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      if (message.includes('Incorrect username or password')) {
        error = 'Invalid email or password'
      }
 else if (message.includes('User does not exist')) {
        error = 'No account found with this email'
      }
 else if (message.includes('Password attempts exceeded')) {
        error = 'Too many failed attempts. Please try again later.'
      }
 else {
        error = message
      }
    }
    finally {
      loading = false
    }
  }

  async function handleSetNewPassword() {
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
    error = ''

    try {
      if (!pendingChallenge) {
        error = 'Session expired. Please try logging in again.'
        return
      }

      await authService.completeNewPasswordChallenge(
        pendingChallenge.email,
        newPassword,
        pendingChallenge.session,
      )

      // Success - redirect handled by parent page
    }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set password'
      if (message.includes('Password does not conform')) {
        error = 'Password must include uppercase, lowercase, and numbers'
      }
 else {
        error = message
      }
    }
    finally {
      loading = false
    }
  }

  async function handleGoogleLogin() {
    try {
      if (!isCognitoConfigured()) {
        error = 'Authentication is not configured'
        return
      }
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

  function cancelChallenge() {
    pendingChallenge = null
    newPassword = ''
    confirmPassword = ''
    error = ''
  }
</script>

<div class='w-full bg-base-100 card mx-auto shadow-xl max-w-md'>
  <div class='card-body'>
    <h2 class='justify-center mb-4 card-title'>
      {#if pendingChallenge}
        Set New Password
      {:else}
        Sign In
      {/if}
    </h2>

    {#if pendingChallenge}
      <!-- New Password Form (first login with temp password) -->
      <form on:submit|preventDefault={handleSetNewPassword} class='space-y-4'>
        <p class='text-sm text-base-content/70'>
          Please set a new password for your account.
        </p>

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

        <button
          type='submit'
          class='w-full btn btn-primary'
          disabled={loading}
        >
          {#if loading}
            <span class='loading loading-spinner'></span>
            Setting password...
          {:else}
            Set Password
          {/if}
        </button>

        <button
          type='button'
          class='w-full btn btn-ghost btn-sm'
          on:click={cancelChallenge}
          disabled={loading}
        >
          Cancel
        </button>
      </form>
    {:else}
      <!-- Standard Login Form -->
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

        <form on:submit|preventDefault={handleEmailLogin} class='space-y-4'>
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
            <label class='label' for='password'>
              <span class='label-text'>Password</span>
            </label>
            <input
              id='password'
              type='password'
              bind:value={password}
              class='input input-bordered w-full'
              placeholder='Enter your password'
              disabled={loading}
              autocomplete='current-password'
            />
            <label class='label'>
              <a href='/auth/forgot-password' class='label-text-alt link link-hover'>
                Forgot password?
              </a>
            </label>
          </div>

          <button
            type='submit'
            class='w-full btn btn-primary'
            disabled={loading}
          >
            {#if loading}
              <span class='loading loading-spinner'></span>
              Signing in...
            {:else}
              Sign In
            {/if}
          </button>
        </form>

        <div class='divider'>or</div>

        <button
          type='button'
          class='w-full btn btn-outline gap-2'
          on:click={handleGoogleLogin}
        >
          <svg class='w-5 h-5' viewBox='0 0 24 24'>
            <path fill='currentColor' d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z' />
            <path fill='currentColor' d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' />
            <path fill='currentColor' d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z' />
            <path fill='currentColor' d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z' />
          </svg>
          Continue with Google
        </button>
      </div>
    {/if}

    {#if error}
      <div class='mt-4 alert alert-error'>
        <span>{error}</span>
      </div>
    {/if}

  </div>
</div>
