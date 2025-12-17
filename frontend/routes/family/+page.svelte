<script lang='ts'>
  import { goto } from '$app/navigation'
  import { currentUser } from '$lib/auth/auth-store'
  import Head from '$lib/components/head.svelte'
  import { getAllUsers } from '$lib/services/profile-service'
  import type { UserProfile } from '$lib/types/profile'
  import { onMount } from 'svelte'

  // SvelteKit passes these props to all pages
  export let data: unknown = undefined
  export let params: unknown = undefined
  // Suppress unused variable warnings
  void data
  void params

  let users: UserProfile[] = []
  let loading = true
  let error = ''

  onMount(async () => {
    if (!$currentUser) {
      goto('/auth/login')
      return
    }

    const result = await getAllUsers()

    if (result.success && result.data) {
      users = Array.isArray(result.data) ? result.data : [result.data]
    }
    else {
      error = result.error || 'Failed to load family members'
    }

    loading = false
  })
</script>

<Head />

<svelte:head>
  <title>Family</title>
  <meta name='description' content='View all family members' />
</svelte:head>

<div class='container mx-auto px-4 py-8 max-w-6xl'>
  <h1 class='text-3xl font-bold text-center mb-8'>Family</h1>

  {#if loading}
    <div class='flex justify-center py-12'>
      <span class='loading loading-spinner loading-lg'></span>
    </div>
  {:else if error}
    <div class='alert alert-error max-w-md mx-auto'>
      <span>{error}</span>
    </div>
  {:else if users.length === 0}
    <p class='text-center text-base-content/60'>No family members found.</p>
  {:else}
    <div class='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4'>
      {#each users as user}
        <a
          href='/profile/{user.userId}'
          class='card bg-base-100 shadow hover:shadow-lg transition-shadow'
        >
          <div class='card-body items-center text-center p-4'>
            {#if user.profilePhotoUrl}
              <div class='avatar'>
                <div class='w-20 h-20 rounded-full'>
                  <img src={user.profilePhotoUrl} alt={user.displayName} />
                </div>
              </div>
            {:else}
              <div class='avatar placeholder'>
                <div class='bg-neutral text-neutral-content rounded-full w-20 h-20'>
                  <span class='text-2xl'>
                    {user.displayName?.charAt(0).toUpperCase() || '?'}
                  </span>
                </div>
              </div>
            {/if}
            <p class='font-medium mt-2 text-sm truncate w-full'>{user.displayName}</p>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
