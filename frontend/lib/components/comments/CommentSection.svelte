<script lang='ts'>
  import type { Comment as CommentType } from '$lib/types/comment'
  import { currentUser } from '$lib/auth/auth-store'
  import { getComments } from '$lib/services/comment-service'
  import { onDestroy, onMount } from 'svelte'
  import Comment from './Comment.svelte'
  import CommentForm from './CommentForm.svelte'

  export let itemId: string
  export let itemType: 'letter' | 'media'
  export let itemTitle: string

  let comments: CommentType[] = []
  let loading = true
  let loadingMore = false
  let error = ''
  let lastKey: string | undefined
  let hasMore = false
  let pollInterval: NodeJS.Timeout | null = null

  $: currentUserId = $currentUser?.sub || ''
  $: isAdmin = $currentUser?.['cognito:groups']?.includes('Admins') || false

  async function loadComments(append: boolean = false) {
    if (append) {
      loadingMore = true
    }
    else {
      loading = true
    }
    error = ''

    const result = await getComments(itemId, 50, append ? lastKey : undefined)

    if (result.success && Array.isArray(result.data)) {
      if (append) {
        comments = [...comments, ...result.data]
      }
      else {
        comments = result.data
      }
      lastKey = result.lastEvaluatedKey
      hasMore = !!result.lastEvaluatedKey
    }
    else {
      error = result.error || 'Failed to load comments'
      if (!append) {
        comments = []
      }
    }

    loading = false
    loadingMore = false
  }

  /**
   * Poll for new comments (every 30 seconds)
   */
  async function pollNewComments() {
    // Skip if tab is hidden
    if (typeof document !== 'undefined' && document.hidden) {
      return
    }

    // Fetch latest 10 comments
    const result = await getComments(itemId, 10)

    if (result.success && Array.isArray(result.data)) {
      // Check for new comments not in current list
      const currentIds = new Set(comments.map(c => c.commentId))
      const newComments = result.data.filter(c => !currentIds.has(c.commentId))

      if (newComments.length > 0) {
        // Prepend new comments
        comments = [...newComments, ...comments]
      }
    }
  }

  function handleCommentCreated(event: CustomEvent<CommentType>) {
    // Prepend new comment to list (optimistic update)
    comments = [event.detail, ...comments]
  }

  function handleCommentUpdated(event: CustomEvent<CommentType>) {
    // Update comment in list
    const updatedComment = event.detail
    comments = comments.map(c =>
      c.commentId === updatedComment.commentId ? updatedComment : c,
    )
  }

  function handleCommentDeleted(event: CustomEvent<string>) {
    // Remove comment from list
    const deletedCommentId = event.detail
    comments = comments.filter(c => c.commentId !== deletedCommentId)
  }

  onMount(() => {
    // Initial load
    loadComments()

    // Start polling for new comments every 30 seconds
    pollInterval = setInterval(pollNewComments, 30000)
  })

  onDestroy(() => {
    // Clean up polling interval
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  })
</script>

<div class='comment-section mt-8 pt-8 border-t border-base-300' id='comments'>
  <h2 class='font-bold text-2xl mb-6'>Comments</h2>

  <!-- Comments list -->
  {#if loading}
    <div class='flex justify-center items-center py-12'>
      <span class='loading loading-spinner loading-lg'></span>
      <span class='text-lg ml-4'>Loading comments...</span>
    </div>
  {:else if error}
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
      <div>
        <h3 class='font-bold'>Error loading comments</h3>
        <div class='text-sm'>{error}</div>
      </div>
      <button class='btn btn-sm' on:click={() => loadComments()}>Retry</button>
    </div>
  {:else if comments.length === 0}
    <div class='py-12 text-center'>
      <div class='mb-4 text-4xl'>💬</div>
      <h3 class='text-lg font-semibold mb-2'>No comments yet</h3>
      <p class='text-base-content/60'>Be the first to share your thoughts!</p>
    </div>
  {:else}
    <div class='comments-list space-y-0 mb-8'>
      {#each comments as comment (comment.commentId)}
        <Comment
          {comment}
          {currentUserId}
          {isAdmin}
          on:commentUpdated={handleCommentUpdated}
          on:commentDeleted={handleCommentDeleted}
        />
      {/each}
    </div>

    {#if hasMore}
      <div class='text-center mb-8'>
        <button
          class='btn btn-outline'
          class:loading={loadingMore}
          on:click={() => loadComments(true)}
          disabled={loadingMore}
        >
          {loadingMore ? 'Loading...' : 'Load More Comments'}
        </button>
      </div>
    {/if}
  {/if}

  <!-- Comment form -->
  {#if currentUserId}
    <CommentForm {itemId} {itemType} {itemTitle} on:commentCreated={handleCommentCreated} />
  {:else}
    <div class='alert alert-info'>
      <svg
        xmlns='http://www.w3.org/2000/svg'
        fill='none'
        viewBox='0 0 24 24'
        class='stroke-current shrink-0 w-6 h-6'
      >
        <path
          stroke-linecap='round'
          stroke-linejoin='round'
          stroke-width='2'
          d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
        />
      </svg>
      <span>Please <a href='/auth/login' class='link'>sign in</a> to leave a comment.</span>
    </div>
  {/if}
</div>
