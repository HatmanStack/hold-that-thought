<script lang="ts">
  import { authService } from '$lib/auth/auth-service'
  import { authStore } from '$lib/auth/auth-store'
  
  let email = ''
  let password = ''
  let error = ''
  let loading = false

  async function handleSubmit() {
    if (!email || !password) {
      error = 'Please fill in all fields'
      return
    }

    loading = true
    error = ''

    try {
      await authService.signIn(email, password)
      // Success - user will be redirected by the auth guard
    } catch (err) {
      error = err instanceof Error ? err.message : 'Login failed'
    } finally {
      loading = false
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleSubmit()
    }
  }
</script>

<div class="card w-full max-w-md mx-auto bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title justify-center mb-4">Sign In</h2>
    
    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
      <div class="form-control">
        <label class="label" for="email">
          <span class="label-text">Email</span>
        </label>
        <input
          id="email"
          type="email"
          placeholder="Enter your email"
          class="input input-bordered w-full"
          bind:value={email}
          on:keydown={handleKeydown}
          disabled={loading}
          required
        />
      </div>

      <div class="form-control">
        <label class="label" for="password">
          <span class="label-text">Password</span>
        </label>
        <input
          id="password"
          type="password"
          placeholder="Enter your password"
          class="input input-bordered w-full"
          bind:value={password}
          on:keydown={handleKeydown}
          disabled={loading}
          required
        />
      </div>

      {#if error}
        <div class="alert alert-error">
          <span>{error}</span>
        </div>
      {/if}

      <div class="form-control mt-6">
        <button
          type="submit"
          class="btn btn-primary"
          class:loading
          disabled={loading}
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </div>
    </form>

    <div class="divider">OR</div>
    
    <div class="text-center space-y-2">
      <p class="text-sm">
        Don't have an account?
        <a href="/auth/signup" class="link link-primary">Sign up</a>
      </p>
      <p class="text-sm">
        <a href="/auth/forgot-password" class="link link-secondary">Forgot password?</a>
      </p>
    </div>
  </div>
</div>