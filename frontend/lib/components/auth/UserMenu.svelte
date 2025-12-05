<script lang='ts'>
  import { goto } from '$app/navigation'
  import { authService } from '$lib/auth/auth-service'
  import { currentUser, isAuthenticated } from '$lib/auth/auth-store'
  import { googleOAuth } from '$lib/auth/google-oauth'
  import { unreadCount, updateUnreadCount } from '$lib/stores/messages'
  import { getProfile } from '$lib/services/profileService'
  import { onDestroy, onMount } from 'svelte'

  let showDropdown = false
  let updateInterval: number | null = null
  let userProfilePhotoUrl: string | null = null

  async function handleSignOut() {
    try {
      // Check if user was authenticated via OAuth (has picture or identities claim)
      const isOAuthUser = $currentUser?.picture || $currentUser?.identities

      if (isOAuthUser) {
        // For OAuth users, use hosted UI logout
        googleOAuth.logoutViaHostedUI()
      }
      else {
        // For regular users, use standard logout
        await authService.signOut()
        goto('/')
      }
    }
    catch (error) {
      console.error('Sign out error:', error)
      // Fallback to local logout
      await authService.signOut()
      goto('/')
    }
  }

  function toggleDropdown() {
    showDropdown = !showDropdown
  }

  function closeDropdown() {
    showDropdown = false
  }

  onMount(async () => {
    // Update unread count immediately
    if ($isAuthenticated) {
      updateUnreadCount()

      // Fetch user's profile to get their profile photo
      if ($currentUser?.sub) {
        try {
          const result = await getProfile($currentUser.sub)
          if (result.success && result.data) {
            const profile = Array.isArray(result.data) ? result.data[0] : result.data
            if (profile?.profilePhotoUrl) {
              userProfilePhotoUrl = profile.profilePhotoUrl
            }
          }
        } catch (e) {
          // Silently fail - will fall back to OAuth picture or initials
        }
      }

      // Update every 60 seconds
      updateInterval = window.setInterval(() => {
        if ($isAuthenticated) {
          updateUnreadCount()
        }
      }, 60000)
    }
  })

  onDestroy(() => {
    if (updateInterval) {
      clearInterval(updateInterval)
    }
  })
</script>

{#if $isAuthenticated && $currentUser}
  <div class='dropdown dropdown-end'>
    <div tabindex='0' role='button' class='btn btn-ghost btn-circle avatar' on:click={toggleDropdown}>
      <div class='w-10 rounded-full overflow-hidden'>
        {#if userProfilePhotoUrl}
          <img src={userProfilePhotoUrl} alt='Profile' class='w-full h-full object-cover' />
        {:else if $currentUser.picture}
          <img src={$currentUser.picture} alt='Profile' class='w-full h-full object-cover' />
        {:else}
          <div class='w-full h-full flex items-center justify-center bg-primary text-primary-content'>
            <span class='text-sm font-medium'>
              {$currentUser.email?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
        {/if}
      </div>
    </div>

    {#if showDropdown}
      <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
      <ul tabindex='0' class='bg-base-100 menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow rounded-box w-52'>
        <li class='menu-title'>
          <span class='text-xs truncate'>{$currentUser.email}</span>
        </li>
        <li>
          <a href='/profile/{$currentUser.sub}' on:click={closeDropdown}>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              class='h-4 w-4'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
              />
            </svg>
            My Profile
          </a>
        </li>
        <li>
          <a href='/messages' on:click={closeDropdown} class='relative'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              class='h-4 w-4'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
              />
            </svg>
            <span class='flex items-center gap-2'>
              Messages
              {#if $unreadCount > 0}
                <span class='badge badge-primary badge-sm'>{$unreadCount}</span>
              {/if}
            </span>
          </a>
        </li>
        <li>
          <a href='/profile/settings' on:click={closeDropdown}>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              class='h-4 w-4'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
              />
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
              />
            </svg>
            Settings
          </a>
        </li>
        <div class='divider my-0'></div>
        <li>
          <button type='button' on:click={handleSignOut} class='text-error'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              class='h-4 w-4'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
              />
            </svg>
            Sign Out
          </button>
        </li>
      </ul>
    {/if}
  </div>
{:else}
  <!-- No buttons shown for unauthenticated users since they'll be redirected to login -->
{/if}

<style>
  .dropdown:focus-within .dropdown-content {
    display: block;
  }
</style>
