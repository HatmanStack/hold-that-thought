<script lang='ts'>
  import type { Message } from '$lib/types/message'
  import { getMessages, markAsRead } from '$lib/services/messageService'
  import { afterUpdate, onMount, tick } from 'svelte'

  export let conversationId: string
  export let currentUserId: string

  let messages: Message[] = []
  let loading = true
  let error = ''
  let lastEvaluatedKey: string | undefined
  let loadingMore = false
  let hasMore = false
  let messagesContainer: HTMLDivElement
  let shouldScroll = true

  /**
   * Format timestamp
   */
  function formatTime(timestamp: string): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      // Today - show time
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    }
    else if (diffDays === 1) {
      // Yesterday
      return `Yesterday ${date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })}`
    }
    else {
      // Older - show date
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    }
  }

  /**
   * Scroll to bottom of messages
   */
  function scrollToBottom() {
    if (messagesContainer && shouldScroll) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    }
  }

  /**
   * Load initial messages
   */
  async function loadMessages() {
    loading = true
    error = ''

    const result = await getMessages(conversationId, 50)

    if (result.success && result.data) {
      messages = Array.isArray(result.data) ? result.data : [result.data]
      // Sort chronologically (oldest first)
      messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      lastEvaluatedKey = result.lastEvaluatedKey
      hasMore = !!result.lastEvaluatedKey
    }
    else {
      error = result.error || 'Failed to load messages'
    }

    loading = false

    // Scroll to bottom after messages load
    await tick()
    scrollToBottom()

    // Mark conversation as read
    markAsRead(conversationId)
  }

  /**
   * Load older messages (pagination)
   */
  async function loadOlderMessages() {
    if (!lastEvaluatedKey || loadingMore)
      return

    loadingMore = true
    error = ''
    shouldScroll = false // Don't scroll when loading older messages

    const result = await getMessages(conversationId, 50, lastEvaluatedKey)

    if (result.success && result.data) {
      const olderMessages = Array.isArray(result.data) ? result.data : [result.data]
      // Prepend older messages
      messages = [...olderMessages, ...messages]
      lastEvaluatedKey = result.lastEvaluatedKey
      hasMore = !!result.lastEvaluatedKey
    }
    else {
      error = result.error || 'Failed to load older messages'
    }

    loadingMore = false
    shouldScroll = true
  }

  /**
   * Add new message to thread (for real-time updates)
   */
  export function addMessage(message: Message) {
    messages = [...messages, message]
    shouldScroll = true
  }

  onMount(() => {
    loadMessages()
  })

  afterUpdate(() => {
    scrollToBottom()
  })
</script>

<div class='flex flex-col h-full'>
  {#if loading}
    <!-- Loading skeleton -->
    <div class='flex-1 overflow-y-auto p-4 space-y-4'>
      {#each Array.from({ length: 5 }) as _, i}
        <div class='animate-pulse flex gap-3' class:flex-row-reverse={i % 2 === 0}>
          <div class='w-10 h-10 bg-base-300 rounded-full'></div>
          <div class='flex-1 max-w-xs'>
            <div class='h-3 bg-base-300 rounded w-1/4 mb-2'></div>
            <div class='h-16 bg-base-300 rounded'></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if error}
    <!-- Error state -->
    <div class='flex-1 flex items-center justify-center p-4'>
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
    </div>
  {:else}
    <!-- Messages container -->
    <div class='flex-1 overflow-y-auto p-4 space-y-4' bind:this={messagesContainer} id='messages-container'>
      <!-- Load older messages button -->
      {#if hasMore}
        <div class='text-center'>
          <button
            class='btn btn-outline btn-sm'
            class:loading={loadingMore}
            on:click={loadOlderMessages}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load Older Messages'}
          </button>
        </div>
      {/if}

      {#if messages.length === 0}
        <!-- Empty state -->
        <div class='text-center py-8'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            class='h-16 w-16 mx-auto mb-4 text-base-content/20'
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
          <p class='text-base-content/60'>No messages yet. Start the conversation!</p>
        </div>
      {:else}
        <!-- Messages list -->
        {#each messages as message}
          {@const isOwnMessage = message.senderId === currentUserId}
          <div class='flex gap-2 sm:gap-3' class:flex-row-reverse={isOwnMessage} class:justify-end={isOwnMessage}>
            <!-- Avatar -->
            <div class='avatar placeholder flex-shrink-0 hidden sm:block'>
              <div class='bg-neutral text-neutral-content rounded-full w-8 h-8 sm:w-10 sm:h-10'>
                <span class='text-sm'>
                  {message.senderName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>

            <!-- Message content -->
            <div class='flex flex-col w-full sm:max-w-xs md:max-w-md'>
              <!-- Sender name -->
              {#if !isOwnMessage}
                <span class='text-xs text-base-content/60 mb-1 px-2'>
                  {message.senderName}
                </span>
              {/if}

              <!-- Message bubble -->
              <div
                class='rounded-lg py-2 px-3 sm:px-4 max-w-full'
                class:bg-primary={isOwnMessage}
                class:text-primary-content={isOwnMessage}
                class:bg-base-200={!isOwnMessage}
                class:text-base-content={!isOwnMessage}
              >
                <!-- Message text -->
                <p class='whitespace-pre-wrap break-words'>{message.messageText}</p>

                <!-- Attachments -->
                {#if message.attachments && message.attachments.length > 0}
                  <div class='mt-2 space-y-2'>
                    {#each message.attachments as attachment}
                      {#if attachment.contentType.startsWith('image/')}
                        <!-- Image attachment -->
                        <div class='rounded overflow-hidden'>
                          <img
                            src={attachment.thumbnailUrl || attachment.url}
                            alt={attachment.filename}
                            class='max-w-full h-auto'
                          />
                        </div>
                      {:else}
                        <!-- Other file attachment -->
                        <a
                          href={attachment.url}
                          download={attachment.filename}
                          class='flex items-center gap-2 p-2 rounded transition-colors bg-base-100/20 hover:bg-base-100/30'
                        >
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
                              d='M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                            />
                          </svg>
                          <span class='text-sm'>{attachment.filename}</span>
                        </a>
                      {/if}
                    {/each}
                  </div>
                {/if}
              </div>

              <!-- Timestamp -->
              <span
                class='text-xs text-base-content/60 mt-1 px-2'
                class:text-right={isOwnMessage}
              >
                {formatTime(message.createdAt)}
              </span>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>
