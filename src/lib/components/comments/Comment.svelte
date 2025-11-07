<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import { updateComment, deleteComment, adminDeleteComment } from '$lib/services/commentService'
  import { toggleReaction } from '$lib/services/reactionService'
  import type { Comment } from '$lib/types/comment'

  export let comment: Comment
  export let currentUserId: string
  export let isAdmin: boolean = false

  const dispatch = createEventDispatcher<{
    commentUpdated: Comment
    commentDeleted: string
  }>()

  let editing = false
  let editText = ''
  let saving = false
  let deleting = false
  let showDeleteModal = false
  let error = ''

  // Reaction state
  let reactionCount = comment.reactionCount
  let isReacting = false
  let hasReacted = comment.userHasReacted ?? false

  // Update reaction state when comment prop changes
  $: hasReacted = comment.userHasReacted ?? false
  $: reactionCount = comment.reactionCount

  $: isOwner = comment.userId === currentUserId
  $: canEdit = isOwner && !comment.isDeleted
  $: canDelete = (isOwner || isAdmin) && !comment.isDeleted

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

    if (diffSec < 60) return 'just now'
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`
    if (diffDay < 30) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`

    return then.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  function startEditing() {
    editText = comment.commentText
    editing = true
    tick().then(() => {
      document.getElementById(`edit-textarea-${comment.commentId}`)?.focus()
    })
  }

  function cancelEditing() {
    editing = false
    editText = ''
    error = ''
  }

  async function saveEdit() {
    if (editText.trim().length === 0 || editText.trim() === comment.commentText) {
      cancelEditing()
      return
    }

    saving = true
    error = ''

    const result = await updateComment(comment.itemId, comment.commentId, editText.trim())

    if (result.success && result.data) {
      dispatch('commentUpdated', result.data as Comment)
      editing = false
    } else {
      error = result.error || 'Failed to update comment'
    }

    saving = false
  }

  async function handleDelete() {
    deleting = true
    error = ''

    const result = isAdmin
      ? await adminDeleteComment(comment.commentId)
      : await deleteComment(comment.itemId, comment.commentId)

    if (result.success) {
      dispatch('commentDeleted', comment.commentId)
      showDeleteModal = false
    } else {
      error = result.error || 'Failed to delete comment'
      showDeleteModal = false
    }

    deleting = false
  }

  async function handleReactionToggle() {
    if (isReacting) return

    isReacting = true

    // Optimistic update
    const previousCount = reactionCount
    const previousHasReacted = hasReacted
    hasReacted = !hasReacted
    reactionCount += hasReacted ? 1 : -1

    const result = await toggleReaction(comment.commentId)

    if (!result.success) {
      // Revert on error
      hasReacted = previousHasReacted
      reactionCount = previousCount
      error = result.error || 'Failed to toggle reaction'
    }

    isReacting = false
  }

  function handleKeydown(event: KeyboardEvent) {
    if (editing && event.key === 'Escape') {
      cancelEditing()
    }
  }
</script>

<div class="comment-item py-4" on:keydown={handleKeydown}>
  <div class="flex gap-3">
    <!-- Avatar -->
    <div class="flex-shrink-0">
      {#if comment.userPhotoUrl}
        <img
          src={comment.userPhotoUrl}
          alt={comment.userName}
          class="w-10 h-10 rounded-full"
        />
      {:else}
        <div class="avatar placeholder">
          <div class="bg-neutral text-neutral-content rounded-full w-10">
            <span class="text-lg">{comment.userName.charAt(0).toUpperCase()}</span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Comment content -->
    <div class="flex-1 min-w-0">
      <!-- Header -->
      <div class="flex items-center gap-2 mb-1">
        <span class="font-semibold text-sm">{comment.userName}</span>
        <span class="text-xs text-base-content/60">
          {formatRelativeTime(comment.createdAt)}
        </span>
        {#if comment.isEdited}
          <span
            class="badge badge-xs"
            title={comment.updatedAt
              ? `Last edited ${formatRelativeTime(comment.updatedAt)}`
              : 'Edited'}
          >
            edited
          </span>
        {/if}
      </div>

      <!-- Comment text or edit form -->
      {#if editing}
        <div class="form-control mb-2">
          <textarea
            id="edit-textarea-{comment.commentId}"
            class="textarea textarea-bordered textarea-sm"
            bind:value={editText}
            disabled={saving}
            rows="3"
          />
          <div class="flex gap-2 mt-2">
            <button
              class="btn btn-sm btn-primary"
              class:loading={saving}
              disabled={saving || editText.trim().length === 0}
              on:click={saveEdit}
            >
              Save
            </button>
            <button class="btn btn-sm btn-ghost" on:click={cancelEditing} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      {:else}
        <p class="text-sm whitespace-pre-wrap break-words">{comment.commentText}</p>
      {/if}

      {#if error}
        <div class="alert alert-error alert-sm mt-2">
          <span class="text-xs">{error}</span>
        </div>
      {/if}

      <!-- Actions -->
      {#if !editing && !comment.isDeleted}
        <div class="flex items-center gap-3 mt-2">
          <!-- Reaction button -->
          <button
            class="btn btn-xs btn-ghost gap-1"
            class:btn-active={hasReacted}
            on:click={handleReactionToggle}
            disabled={isReacting}
            aria-label={hasReacted ? 'Unlike this comment' : 'Like this comment'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill={hasReacted ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            {reactionCount}
          </button>

          {#if canEdit}
            <button class="btn btn-xs btn-ghost" on:click={startEditing} aria-label="Edit comment">
              Edit
            </button>
          {/if}

          {#if canDelete}
            <button
              class="btn btn-xs btn-ghost text-error"
              on:click={() => (showDeleteModal = true)}
              aria-label="Delete comment"
            >
              {isAdmin && !isOwner ? 'Admin Delete' : 'Delete'}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Delete confirmation modal -->
{#if showDeleteModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Delete Comment?</h3>
      <p class="py-4">
        Are you sure you want to delete this comment? This action cannot be undone.
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" on:click={() => (showDeleteModal = false)} disabled={deleting}>
          Cancel
        </button>
        <button
          class="btn btn-error"
          class:loading={deleting}
          on:click={handleDelete}
          disabled={deleting}
        >
          Delete
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .comment-item {
    border-bottom: 1px solid hsl(var(--b3) / 0.2);
  }

  .comment-item:last-child {
    border-bottom: none;
  }
</style>
