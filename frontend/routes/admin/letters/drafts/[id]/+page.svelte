<script lang='ts'>
  import type { PageData } from './$types'
  import { goto } from '$app/navigation'
  import DraftReviewModal from '$lib/components/letters/DraftReviewModal.svelte'
  import {
    deleteDraft,
    type Draft,
    getDraft,
    getDraftPdfUrl,
    type PublishData,
    publishDraft,
  } from '$lib/services/draft-service'
  import { onMount } from 'svelte'

  export let data: PageData

  let draft: Draft | null = null
  let pdfUrl = ''
  let loading = true
  let error = ''
  let publishing = false
  let deleting = false

  onMount(async () => {
    await loadDraft()
  })

  async function loadDraft() {
    loading = true
    error = ''
    try {
      draft = await getDraft(data.draftId)

      // Try to get PDF URL if available
      if (draft.s3Key) {
        try {
          pdfUrl = await getDraftPdfUrl(draft.s3Key)
        }
 catch {
          // PDF preview not available, that's okay
          console.warn('Could not load PDF preview')
        }
      }
    }
 catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load draft'
    }
 finally {
      loading = false
    }
  }

  async function handlePublish(event: CustomEvent<PublishData>) {
    if (!draft)
return

    publishing = true
    error = ''

    try {
      const result = await publishDraft(data.draftId, event.detail)
      // Redirect to the published letter
      goto(result.path)
    }
 catch (err) {
      error = err instanceof Error ? err.message : 'Failed to publish draft'
      publishing = false
    }
  }

  async function handleDiscard() {
    deleting = true
    error = ''

    try {
      await deleteDraft(data.draftId)
      goto('/admin/letters/drafts')
    }
 catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete draft'
      deleting = false
    }
  }

  function handleClose() {
    goto('/admin/letters/drafts')
  }
</script>

<svelte:head>
  <title>Review Draft | Admin</title>
</svelte:head>

<div class='h-screen flex flex-col bg-base-100'>
  {#if loading}
    <div class='flex-1 flex items-center justify-center'>
      <div class='text-center'>
        <div class='loading loading-spinner loading-lg mb-4'></div>
        <p class='text-base-content/70'>Loading draft...</p>
      </div>
    </div>
  {:else if error && !draft}
    <div class='flex-1 flex items-center justify-center'>
      <div class='text-center max-w-md'>
        <svg xmlns='http://www.w3.org/2000/svg' class='h-16 w-16 mx-auto mb-4 text-error' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
          <path stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
        </svg>
        <h2 class='text-xl font-bold mb-2'>Error Loading Draft</h2>
        <p class='text-base-content/70 mb-4'>{error}</p>
        <div class='flex gap-2 justify-center'>
          <button class='btn btn-outline' on:click={loadDraft}>Retry</button>
          <a href='/admin/letters/drafts' class='btn'>Back to Drafts</a>
        </div>
      </div>
    </div>
  {:else if draft}
    {#if draft.status !== 'REVIEW'}
      <div class='flex-1 flex items-center justify-center'>
        <div class='text-center max-w-md'>
          {#if draft.status === 'PROCESSING'}
            <div class='loading loading-spinner loading-lg mb-4'></div>
            <h2 class='text-xl font-bold mb-2'>Still Processing</h2>
            <p class='text-base-content/70 mb-4'>
              This draft is still being processed. Please wait a moment and try again.
            </p>
          {:else if draft.status === 'ERROR'}
            <svg xmlns='http://www.w3.org/2000/svg' class='h-16 w-16 mx-auto mb-4 text-error' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
            </svg>
            <h2 class='text-xl font-bold mb-2'>Processing Error</h2>
            <p class='text-base-content/70 mb-4'>
              {draft.error || 'An error occurred while processing this letter.'}
            </p>
          {/if}
          <div class='flex gap-2 justify-center'>
            <button class='btn btn-outline' on:click={loadDraft}>Refresh</button>
            <a href='/admin/letters/drafts' class='btn'>Back to Drafts</a>
          </div>
        </div>
      </div>
    {:else}
      {#if error}
        <div class='alert alert-error m-4'>
          <svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
          </svg>
          <span>{error}</span>
        </div>
      {/if}
      <div class='flex-1 overflow-hidden'>
        <DraftReviewModal
          {draft}
          {pdfUrl}
          {publishing}
          {deleting}
          on:publish={handlePublish}
          on:discard={handleDiscard}
          on:close={handleClose}
        />
      </div>
    {/if}
  {/if}
</div>
