<script lang='ts'>
  import type { Conversation } from '$lib/types/message'
  import { getConversations } from '$lib/services/messageService'
  import { createEventDispatcher, onMount } from 'svelte'

  const dispatch = createEventDispatcher()

  let conversations: Conversation[] = []
  let loading = true
  let error = ''
  let lastEvaluatedKey: string | undefined
  let loadingMore = false
  let hasMore = false

  /**
   * Format timestamp as relative time (e.g., "2 hours ago")
   */
  function formatRelativeTime(timestamp: string): string {
    const now = new Date()
    const then = new Date(timestamp)
    const diffMs = now.getTime() - then.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffSec < 60)
      return 'just now'
    if (diffMin < 60)
      return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`
    if (diffHour < 24)
      return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`
    if (diffDay < 30)
      return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`

    return then.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  /**
   * Truncate message preview to snippet length
   */
  function truncateMessage(text: string | undefined, maxLength: number = 50): string {
    if (!text)
      return 'No messages yet'
    if (text.length <= maxLength)
      return text
    return `${text.substring(0, maxLength).trim()}...`
  }

  /**
   * Get conversation display name
   */
  function getConversationName(conversation: Conversation): string {
    if (conversation.conversationTitle) {
      return conversation.conversationTitle
    }
    return conversation.participantNames.join(', ')
  }

  /**
   * Handle conversation click
   */
  function handleConversationClick(conversation: Conversation) {
    dispatch('conversationSelected', { conversationId: conversation.conversationId })
  }

  /**
   * Load initial conversations
   */
  async function loadConversations() {
    loading = true
    error = ''

    const result = await getConversations(50)

    if (result.success && result.data) {
      conversations = Array.isArray(result.data) ? result.data : [result.data]
      // Sort by most recent
      conversations.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
      lastEvaluatedKey = result.lastEvaluatedKey
      hasMore = !!result.lastEvaluatedKey
    }
    else {
      error = result.error || 'Failed to load conversations'
    }

    loading = false
  }

  /**
   * Load more conversations (pagination)
   */
  async function loadMoreConversations() {
    if (!lastEvaluatedKey || loadingMore)
      return

    loadingMore = true
    error = ''

    const result = await getConversations(50, lastEvaluatedKey)

    if (result.success && result.data) {
      const newConversations = Array.isArray(result.data) ? result.data : [result.data]
      conversations = [...conversations, ...newConversations]
      lastEvaluatedKey = result.lastEvaluatedKey
      hasMore = !!result.lastEvaluatedKey
    }
    else {
      error = result.error || 'Failed to load more conversations'
    }

    loadingMore = false
  }

  onMount(() => {
    loadConversations()
  })
</script>

<div class='card bg-base-100 shadow-xl'>
  <div class='card-body'>
    <div class='flex justify-between items-center mb-4'>
      <h2 class='card-title'>Messages</h2>
      <button class='btn btn-primary btn-sm' on:click={() => dispatch('newMessage')}>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          class='h-5 w-5'
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
        >
          <path
            stroke-linecap='round'
            stroke-linejoin='round'
            stroke-width='2'
            d='M12 4v16m8-8H4'
          />
        </svg>
        New Message
      </button>
    </div>

    {#if loading}
      <!-- Loading skeleton -->
      <div class='space-y-3'>
        {#each Array.from({ length: 5 }) as _}
          <div class='flex gap-3 animate-pulse p-3'>
            <div class='w-12 h-12 bg-base-300 rounded-full'></div>
            <div class='flex-1'>
              <div class='h-4 bg-base-300 mb-2 rounded w-1/3'></div>
              <div class='bg-base-300 rounded w-full mb-1 h-3'></div>
              <div class='h-3 bg-base-300 rounded w-1/4'></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if error}
      <!-- Error state -->
      <div class='alert alert-error'>
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
    {:else if conversations.length === 0}
      <!-- Empty state -->
      <div class='text-center py-8'>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          class='mx-auto mb-4 h-16 w-16 text-base-content/20'
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
        <p class='text-base-content/60 mb-4'>No conversations yet</p>
        <button class='btn btn-primary btn-sm' on:click={() => dispatch('newMessage')}>
          Start a Conversation
        </button>
      </div>
    {:else}
      <!-- Conversations list -->
      <div class='space-y-2'>
        {#each conversations as conversation}
          <button
            class='w-full text-left p-3 rounded-lg flex gap-2 relative sm:p-4 hover:bg-base-200 active:bg-base-300 transition-colors sm:gap-3 items-start min-h-[3.5rem]'
            on:click={() => handleConversationClick(conversation)}
          >
            <!-- Avatar placeholder -->
            <div class='avatar placeholder flex-shrink-0'>
              <div class='bg-primary text-primary-content rounded-full w-10 h-10 sm:w-12 sm:h-12'>
                <span class='text-lg'>
                  {getConversationName(conversation).charAt(0).toUpperCase()}
                </span>
              </div>
            </div>

            <!-- Conversation details -->
            <div class='flex-1 min-w-0'>
              <!-- Name and time -->
              <div class='flex justify-between items-start mb-1'>
                <h3 class='font-semibold text-sm truncate flex-1 sm:text-base'>
                  {getConversationName(conversation)}
                </h3>
                <span class='text-xs text-base-content/60 ml-2 flex-shrink-0'>
                  {formatRelativeTime(conversation.lastMessageAt)}
                </span>
              </div>

              <!-- Last message preview -->
              <p class='text-sm truncate text-base-content/70'>
                {truncateMessage(conversation.lastMessagePreview)}
              </p>

              <!-- Conversation type badge -->
              {#if conversation.conversationType === 'group'}
                <span class='badge badge-xs mt-1 badge-ghost'>Group</span>
              {/if}
            </div>

            <!-- Unread count badge -->
            {#if conversation.unreadCount > 0}
              <div class='badge badge-primary badge-xs absolute sm:badge-sm top-3 right-3'>
                {conversation.unreadCount}
              </div>
            {/if}
          </button>
        {/each}
      </div>

      <!-- Load more button -->
      {#if hasMore}
        <div class='text-center mt-4'>
          <button
            class='btn btn-outline btn-sm'
            class:loading={loadingMore}
            on:click={loadMoreConversations}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>
