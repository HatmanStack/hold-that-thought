<script lang="ts">
  import { authService } from '$lib/auth/auth-service'
  import { googleOAuth } from '$lib/auth/google-oauth'
  import { currentUser, isAuthenticated } from '$lib/auth/auth-store'
  import { goto } from '$app/navigation'

  let showDropdown = false

  async function handleSignOut() {
    try {
      // Check if user was authenticated via OAuth (has picture or identities claim)
      const isOAuthUser = $currentUser?.picture || $currentUser?.identities
      
      if (isOAuthUser) {
        // For OAuth users, use hosted UI logout
        googleOAuth.logoutViaHostedUI()
      } else {
        // For regular users, use standard logout
        await authService.signOut()
        goto('/')
      }
    } catch (error) {
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
</script>

{#if $isAuthenticated && $currentUser}
  <div class="dropdown dropdown-end">
    <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar" on:click={toggleDropdown}>
      <div class="w-10 rounded-full overflow-hidden">
        {#if $currentUser.picture}
          <img src={$currentUser.picture} alt="Profile" class="w-full h-full object-cover" />
        {:else}
          <div class="w-full h-full bg-primary text-primary-content flex items-center justify-center">
            <span class="text-sm font-medium">
              {$currentUser.email?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
        {/if}
      </div>
    </div>
    
    {#if showDropdown}
      <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
      <ul tabindex="0" class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
        <li class="menu-title">
          <span class="text-xs truncate">{$currentUser.email}</span>
        </li>
        <li><a href="/profile" on:click={closeDropdown}>Profile</a></li>
        <li><a href="/settings" on:click={closeDropdown}>Settings</a></li>
        <div class="divider my-1"></div>
        <li>
          <button type="button" on:click={handleSignOut} class="text-error">
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
