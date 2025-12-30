<script lang='ts'>
  import { goto } from '$app/navigation'
  import { isAuthenticated } from '$lib/auth/auth-store'
  import LoginForm from '$lib/components/auth/LoginForm.svelte'
  import { onMount } from 'svelte'

  onMount(() => {
    // Redirect if already authenticated
    const unsubscribe = isAuthenticated.subscribe((authenticated) => {
      if (authenticated) {
        // Check if there's a return URL
        const returnUrl = sessionStorage.getItem('auth_return_url')
        if (returnUrl) {
          sessionStorage.removeItem('auth_return_url')
          goto(returnUrl)
        }
        else {
          goto('/')
        }
      }
    })

    return unsubscribe
  })
</script>

<svelte:head>
  <title>Sign In</title>
  <meta name='description' content='Sign in to your account' />
</svelte:head>

<div class='min-h-screen flex items-center justify-center bg-base-200 px-4'>
  <LoginForm />
</div>
