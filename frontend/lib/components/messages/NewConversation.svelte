<script lang='ts'>
  import type { UserProfile } from '$lib/types/profile'
  import { createConversation } from '$lib/services/messageService'
  import { getAllUsers } from '$lib/services/profileService'
  import { createEventDispatcher, onMount } from 'svelte'

  const dispatch = createEventDispatcher()

  let users: UserProfile[] = []
  let selectedUserIds: string[] = []
  let messageText = ''
  let conversationTitle = ''
  let loading = true
  let sending = false
  let error = ''
  let searchQuery = ''

  $: isGroup = selectedUserIds.length > 1
  $: filteredUsers = users.filter(user =>
    user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    || user.email.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  /**
   * Load all users
   */
  async function loadUsers() {
    loading = true
    error = ''

    const result = await getAllUsers()

    if (result.success && result.data) {
      users = Array.isArray(result.data) ? result.data : [result.data]
    }
    else {
      error = result.error || 'Failed to load users'
    }

    loading = false
  }

  /**
   * Toggle user selection
   */
  function toggleUser(userId: string) {
    if (selectedUserIds.includes(userId)) {
      selectedUserIds = selectedUserIds.filter(id => id !== userId)
    }
    else {
      selectedUserIds = [...selectedUserIds, userId]
    }
  }

  /**
   * Get user display name
   */
  function getUserDisplayName(userId: string): string {
    const user = users.find(u => u.userId === userId)
    return user?.displayName || 'Unknown User'
  }

  /**
   * Create the conversation
   */
  async function handleCreateConversation() {
    // Validate
    if (selectedUserIds.length === 0) {
      error = 'Please select at least one person'
      return
    }

    if (!messageText.trim()) {
      error = 'Please enter a message'
      return
    }

    if (isGroup && !conversationTitle.trim()) {
      error = 'Please enter a group name'
      return
    }

    sending = true
    error = ''

    try {
      const result = await createConversation(
        selectedUserIds,
        messageText.trim(),
        isGroup ? conversationTitle.trim() : undefined,
      )

      if (result.success && result.data) {
        const conversation = Array.isArray(result.data) ? result.data[0] : result.data
        dispatch('conversationCreated', { conversationId: conversation.conversationId })
      }
      else {
        error = result.error || 'Failed to create conversation'
      }
    }
    catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create conversation'
    }
    finally {
      sending = false
    }
  }

  onMount(() => {
    loadUsers()
  })
</script>

<div class='card bg-base-100 shadow-xl mx-auto max-w-2xl'>
  <div class='card-body'>
    <h2 class='card-title mb-4'>New Message</h2>

    {#if loading}
      <!-- Loading state -->
      <div class='space-y-4'>
        <div class='animate-pulse'>
          <div class='h-10 bg-base-300 rounded mb-4'></div>
          <div class='bg-base-300 rounded mb-4 h-40'></div>
          <div class='h-10 bg-base-300 rounded'></div>
        </div>
      </div>
    {:else if error}
      <!-- Error state -->
      <div class='alert alert-error mb-4'>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          class='stroke-current shrink-0 h-6 w-6'
          fill='none'
          viewBox='0 0 24 24'
        >
          <path
            stroke-linecap='round'
            stroke-linejoin='round'
            stroke-width='2'
            d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
          />
        </svg>
        <span>{error}</span>
      </div>
    {/if}

    <div class='space-y-4'>
      <!-- User selection -->
      <div class='form-control'>
        <label class='label'>
          <span class='label-text'>To:</span>
        </label>

        <!-- Selected users -->
        {#if selectedUserIds.length > 0}
          <div class='flex flex-wrap gap-2 mb-2'>
            {#each selectedUserIds as userId}
              <div class='badge badge-primary gap-2'>
                {getUserDisplayName(userId)}
                <button
                  class='btn btn-ghost btn-xs btn-circle'
                  on:click={() => toggleUser(userId)}
                  aria-label='Remove user'
                >
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    class='h-3 w-3'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path
                      stroke-linecap='round'
                      stroke-linejoin='round'
                      stroke-width='2'
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Search input -->
        <input
          type='text'
          bind:value={searchQuery}
          placeholder='Search people...'
          class='input input-bordered w-full'
        />

        <!-- User dropdown -->
        {#if searchQuery}
          <div class='mt-2 overflow-y-auto border-base-300 rounded-lg border max-h-48'>
            {#each filteredUsers as user}
              <button
                class='w-full text-left p-3 hover:bg-base-200 transition-colors flex items-center gap-3'
                on:click={() => {
                  toggleUser(user.userId)
                  searchQuery = ''
                }}
              >
                {#if user.profilePhotoUrl}
                  <div class='avatar'>
                    <div class='rounded-full w-10 h-10'>
                      <img src={user.profilePhotoUrl} alt={user.displayName} />
                    </div>
                  </div>
                {:else}
                  <div class='avatar placeholder'>
                    <div class='bg-neutral text-neutral-content rounded-full w-10 h-10'>
                      <span class='text-sm'>
                        {user.displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                {/if}
                <div class='flex-1'>
                  <p class='font-semibold'>{user.displayName}</p>
                  <p class='text-sm text-base-content/60'>{user.email}</p>
                </div>
                {#if selectedUserIds.includes(user.userId)}
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    class='h-5 w-5 text-primary'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path
                      stroke-linecap='round'
                      stroke-linejoin='round'
                      stroke-width='2'
                      d='M5 13l4 4L19 7'
                    />
                  </svg>
                {/if}
              </button>
            {/each}
            {#if filteredUsers.length === 0}
              <p class='p-3 text-base-content/60 text-center'>No users found</p>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Group title (only for groups) -->
      {#if isGroup}
        <div class='form-control'>
          <label class='label'>
            <span class='label-text'>Group Name:</span>
          </label>
          <input
            type='text'
            bind:value={conversationTitle}
            placeholder='Enter a group name...'
            class='input input-bordered w-full'
            required
          />
        </div>
      {/if}

      <!-- Message text -->
      <div class='form-control'>
        <label class='label'>
          <span class='label-text'>Message:</span>
        </label>
        <textarea
          bind:value={messageText}
          placeholder='Type your message...'
          rows='5'
          class='textarea textarea-bordered w-full'
          required
        ></textarea>
      </div>

      <!-- Actions -->
      <div class='flex gap-2 justify-end'>
        <button
          class='btn btn-ghost'
          on:click={() => dispatch('cancel')}
          disabled={sending}
        >
          Cancel
        </button>
        <button
          class='btn btn-primary'
          on:click={handleCreateConversation}
          disabled={sending || selectedUserIds.length === 0 || !messageText.trim() || (isGroup && !conversationTitle.trim())}
          class:loading={sending}
        >
          {sending ? 'Creating...' : 'Send Message'}
        </button>
      </div>
    </div>
  </div>
</div>
