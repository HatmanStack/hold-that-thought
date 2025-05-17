<script lang="ts">
  import { user, isAuthenticated, isLoading } from '$lib/stores/user'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  
  // Form fields
  let givenName = $user?.given_name || ''
  let familyName = $user?.family_name || ''
  let email = $user?.email || ''
  let currentPassword = ''
  let newPassword = ''
  let confirmPassword = ''
  let passwordError = ''
  let updateSuccess = false
  let updateError = ''
  
  // Validate password match
  $: {
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      passwordError = "Passwords don't match"
    } else {
      passwordError = ''
    }
  }
  
  // Handle profile update
  const handleProfileUpdate = async () => {
    try {
      // This would call an API to update the user's profile
      // For now, we'll just simulate success
      updateSuccess = true
      updateError = ''
      
      // Reset after 3 seconds
      setTimeout(() => {
        updateSuccess = false
      }, 3000)
    } catch (error) {
      updateError = error instanceof Error ? error.message : 'Failed to update profile'
      updateSuccess = false
    }
  }
  
  // Handle password update
  const handlePasswordUpdate = async () => {
    if (!currentPassword || !newPassword || newPassword !== confirmPassword) return
    
    try {
      // This would call an API to update the user's password
      // For now, we'll just simulate success
      updateSuccess = true
      updateError = ''
      
      // Reset form and success message after 3 seconds
      currentPassword = ''
      newPassword = ''
      confirmPassword = ''
      
      setTimeout(() => {
        updateSuccess = false
      }, 3000)
    } catch (error) {
      updateError = error instanceof Error ? error.message : 'Failed to update password'
      updateSuccess = false
    }
  }
  
  // Redirect to login if not authenticated
  onMount(() => {
    if (!$isAuthenticated) {
      goto('/auth?mode=login')
    }
    
    // Initialize form values
    if ($user) {
      givenName = $user.given_name || ''
      familyName = $user.family_name || ''
      email = $user.email || ''
    }
  })
</script>

<svelte:head>
  <title>Settings - Round Robin</title>
  <meta name="description" content="Manage your Round Robin account settings" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="max-w-2xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">Account Settings</h1>
    
    {#if updateSuccess}
      <div class="alert alert-success mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>Your settings have been updated successfully!</span>
      </div>
    {/if}
    
    {#if updateError}
      <div class="alert alert-error mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>{updateError}</span>
      </div>
    {/if}
    
    {#if $isAuthenticated && $user}
      <div class="card bg-base-100 shadow-xl mb-8">
        <div class="card-body">
          <h2 class="card-title">Profile Information</h2>
          
          <form on:submit|preventDefault={handleProfileUpdate}>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div class="form-control">
                <label class="label" for="givenName">
                  <span class="label-text">First Name</span>
                </label>
                <input 
                  type="text" 
                  id="givenName"
                  bind:value={givenName} 
                  placeholder="First name" 
                  class="input input-bordered" 
                />
              </div>
              
              <div class="form-control">
                <label class="label" for="familyName">
                  <span class="label-text">Last Name</span>
                </label>
                <input 
                  type="text" 
                  id="familyName"
                  bind:value={familyName} 
                  placeholder="Last name" 
                  class="input input-bordered" 
                />
              </div>
            </div>
            
            <div class="form-control mt-4">
              <label class="label" for="email">
                <span class="label-text">Email</span>
              </label>
              <input 
                type="email" 
                id="email"
                bind:value={email} 
                placeholder="Email address" 
                class="input input-bordered" 
                readonly
              />
              <label class="label">
                <span class="label-text-alt">Email cannot be changed directly. Contact support for assistance.</span>
              </label>
            </div>
            
            <div class="card-actions justify-end mt-6">
              <button 
                type="submit" 
                class="btn btn-primary" 
                disabled={$isLoading}
              >
                {#if $isLoading}
                  <span class="loading loading-spinner"></span>
                  Updating...
                {:else}
                  Update Profile
                {/if}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Change Password</h2>
          
          <form on:submit|preventDefault={handlePasswordUpdate}>
            <div class="form-control mt-4">
              <label class="label" for="currentPassword">
                <span class="label-text">Current Password</span>
              </label>
              <input 
                type="password" 
                id="currentPassword"
                bind:value={currentPassword} 
                placeholder="Enter current password" 
                class="input input-bordered" 
                required 
              />
            </div>
            
            <div class="form-control mt-4">
              <label class="label" for="newPassword">
                <span class="label-text">New Password</span>
              </label>
              <input 
                type="password" 
                id="newPassword"
                bind:value={newPassword} 
                placeholder="Enter new password" 
                class="input input-bordered" 
                required 
              />
            </div>
            
            <div class="form-control mt-4">
              <label class="label" for="confirmPassword">
                <span class="label-text">Confirm New Password</span>
              </label>
              <input 
                type="password" 
                id="confirmPassword"
                bind:value={confirmPassword} 
                placeholder="Confirm new password" 
                class="input input-bordered" 
                class:input-error={passwordError}
                required 
              />
              {#if passwordError}
                <label class="label">
                  <span class="label-text-alt text-error">{passwordError}</span>
                </label>
              {/if}
            </div>
            
            <div class="card-actions justify-end mt-6">
              <button 
                type="submit" 
                class="btn btn-primary" 
                disabled={$isLoading || !!passwordError || !currentPassword || !newPassword || !confirmPassword}
              >
                {#if $isLoading}
                  <span class="loading loading-spinner"></span>
                  Updating...
                {:else}
                  Change Password
                {/if}
              </button>
            </div>
          </form>
        </div>
      </div>
    {:else}
      <div class="alert alert-warning">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <span>You need to be logged in to access settings.</span>
      </div>
    {/if}
  </div>
</div>