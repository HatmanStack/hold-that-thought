<script lang="ts">
  import { user, isAuthenticated } from '$lib/stores/user'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  
  // Redirect to login if not authenticated
  onMount(() => {
    if (!$isAuthenticated) {
      goto('/auth?mode=login')
    }
  })
</script>

<svelte:head>
  <title>Profile - Round Robin</title>
  <meta name="description" content="Your Round Robin profile" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="max-w-2xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">Your Profile</h1>
    
    {#if $isAuthenticated && $user}
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <div class="flex flex-col md:flex-row gap-6 items-center">
            <div class="avatar">
              <div class="w-24 rounded-full bg-primary text-primary-content grid place-items-center">
                {#if $user.picture}
                  <img src={$user.picture} alt="Profile" />
                {:else}
                  <span class="text-3xl">{$user.given_name?.[0] || $user.username?.[0] || 'U'}</span>
                {/if}
              </div>
            </div>
            
            <div class="flex-1">
              <h2 class="text-2xl font-bold">
                {$user.given_name && $user.family_name 
                  ? `${$user.given_name} ${$user.family_name}` 
                  : $user.username}
              </h2>
              <p class="text-base-content/70">{$user.email}</p>
            </div>
          </div>
          
          <div class="divider"></div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 class="font-semibold mb-2">Username</h3>
              <p>{$user.username}</p>
            </div>
            
            <div>
              <h3 class="font-semibold mb-2">Email</h3>
              <p>{$user.email}</p>
              {#if $user.email_verified}
                <span class="badge badge-success">Verified</span>
              {:else}
                <span class="badge badge-warning">Not Verified</span>
              {/if}
            </div>
            
            {#if $user.given_name}
              <div>
                <h3 class="font-semibold mb-2">First Name</h3>
                <p>{$user.given_name}</p>
              </div>
            {/if}
            
            {#if $user.family_name}
              <div>
                <h3 class="font-semibold mb-2">Last Name</h3>
                <p>{$user.family_name}</p>
              </div>
            {/if}
          </div>
          
          <div class="card-actions justify-end mt-6">
            <a href="/settings" class="btn btn-primary">Edit Profile</a>
          </div>
        </div>
      </div>
    {:else}
      <div class="alert alert-warning">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <span>You need to be logged in to view your profile.</span>
      </div>
    {/if}
  </div>
</div>