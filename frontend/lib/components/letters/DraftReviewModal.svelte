<script lang='ts'>
  import type { Draft, PublishData } from '$lib/services/draft-service'
  import { createEventDispatcher } from 'svelte'

  export let draft: Draft
  export let pdfUrl: string = ''
  export let publishing = false
  export let deleting = false

  const dispatch = createEventDispatcher<{
    publish: PublishData
    discard: void
    close: void
  }>()

  // Clean text for single-line fields (description)
  function cleanText(text: string): string {
    return text.replace(/[\r\n]+/g, ' ').replace(/ {2,}/g, ' ')
  }

  // Handle tab key in content editor
  function handleContentKeydown(event: KeyboardEvent) {
    if (event.key === 'Tab') {
      event.preventDefault()
      const textarea = event.target as HTMLTextAreaElement
      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      // Insert tab at cursor position
      formData.content = `${formData.content.substring(0, start)}\t${formData.content.substring(end)}`

      // Move cursor after the tab
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1
      })
    }
  }

  // Form state pre-filled from parsedData
  const formData: PublishData = {
    date: draft.parsedData?.date || new Date().toISOString().split('T')[0],
    title: draft.parsedData?.title || '',
    content: draft.parsedData?.content || '',
    author: draft.parsedData?.author || '',
    description: cleanText(draft.parsedData?.summary || ''),
  }

  let errors: Partial<Record<keyof PublishData, string>> = {}

  function validate(): boolean {
    errors = {}

    if (!formData.date) {
      errors.date = 'Date is required'
    }
 else if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.date)) {
      errors.date = 'Invalid date format (YYYY-MM-DD)'
    }

    if (!formData.title?.trim()) {
      errors.title = 'Title is required'
    }

    if (!formData.content?.trim()) {
      errors.content = 'Content is required'
    }

    return Object.keys(errors).length === 0
  }

  function handlePublish() {
    if (!validate())
return
    dispatch('publish', formData)
  }

  function handleDiscard() {
    if (confirm('Are you sure you want to discard this draft? This action cannot be undone.')) {
      dispatch('discard')
    }
  }

  function handleClose() {
    dispatch('close')
  }
</script>

<div class='draft-review h-full flex flex-col'>
  <!-- Header -->
  <div class='flex items-center justify-between p-4 border-b border-base-300'>
    <h2 class='text-xl font-bold'>Review Draft</h2>
    <button class='btn btn-sm btn-ghost btn-circle' on:click={handleClose}>
      <svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
        <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
      </svg>
    </button>
  </div>

  <!-- Content -->
  <div class='flex-1 overflow-hidden flex'>
    <!-- Left: PDF Viewer -->
    <div class='w-1/2 border-r border-base-300 bg-base-200 flex flex-col'>
      <div class='p-2 bg-base-300 text-sm font-medium'>Original Document</div>
      <div class='flex-1 overflow-hidden'>
        {#if pdfUrl}
          <iframe
            src={pdfUrl}
            title='Letter PDF'
            class='w-full h-full'
            frameborder='0'
          ></iframe>
        {:else}
          <div class='flex items-center justify-center h-full text-base-content/50'>
            <div class='text-center'>
              <svg xmlns='http://www.w3.org/2000/svg' class='h-12 w-12 mx-auto mb-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
              </svg>
              <p>PDF preview not available</p>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Right: Edit Form -->
    <div class='w-1/2 flex flex-col overflow-hidden'>
      <div class='p-2 bg-base-300 text-sm font-medium'>Extracted Content (Editable)</div>
      <div class='flex-1 overflow-y-auto p-4 space-y-4'>
        <!-- Date -->
        <div class='form-control'>
          <label class='label' for='date'>
            <span class='label-text font-medium'>Date <span class='text-error'>*</span></span>
          </label>
          <input
            type='date'
            id='date'
            bind:value={formData.date}
            class='input input-bordered w-full'
            class:input-error={errors.date}
          />
          {#if errors.date}
            <label class='label'>
              <span class='label-text-alt text-error'>{errors.date}</span>
            </label>
          {/if}
        </div>

        <!-- Title -->
        <div class='form-control'>
          <label class='label' for='title'>
            <span class='label-text font-medium'>Title <span class='text-error'>*</span></span>
          </label>
          <input
            type='text'
            id='title'
            bind:value={formData.title}
            class='input input-bordered w-full'
            class:input-error={errors.title}
            placeholder='Letter title'
          />
          {#if errors.title}
            <label class='label'>
              <span class='label-text-alt text-error'>{errors.title}</span>
            </label>
          {/if}
        </div>

        <!-- Author -->
        <div class='form-control'>
          <label class='label' for='author'>
            <span class='label-text font-medium'>Author</span>
          </label>
          <input
            type='text'
            id='author'
            bind:value={formData.author}
            class='input input-bordered w-full'
            placeholder='Letter author'
          />
        </div>

        <!-- Description / Summary -->
        <div class='form-control'>
          <label class='label' for='description'>
            <span class='label-text font-medium'>Description</span>
          </label>
          <textarea
            id='description'
            bind:value={formData.description}
            class='textarea textarea-bordered w-full h-20'
            placeholder='Brief description of the letter'
          ></textarea>
        </div>

        <!-- Content -->
        <div class='form-control flex-1'>
          <label class='label' for='content'>
            <span class='label-text font-medium'>Content <span class='text-error'>*</span></span>
          </label>
          <p class='text-xs text-base-content/60 mb-1'>Newlines preserved. For formatting changes, publish first then edit.</p>
          <textarea
            id='content'
            bind:value={formData.content}
            class='content-editor textarea textarea-bordered w-full flex-1 min-h-[300px] font-mono text-sm leading-relaxed'
            class:textarea-error={errors.content}
            placeholder='Letter content'
            spellcheck='true'
            on:keydown={handleContentKeydown}
          ></textarea>
          {#if errors.content}
            <label class='label'>
              <span class='label-text-alt text-error'>{errors.content}</span>
            </label>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class='p-4 border-t border-base-300 bg-base-100 flex justify-between'>
    <button
      class='btn btn-error btn-outline'
      on:click={handleDiscard}
      disabled={publishing || deleting}
    >
      {#if deleting}
        <span class='loading loading-spinner loading-sm'></span>
      {/if}
      Discard Draft
    </button>

    <div class='flex gap-2'>
      <button class='btn btn-ghost' on:click={handleClose} disabled={publishing || deleting}>
        Cancel
      </button>
      <button
        class='btn btn-primary'
        on:click={handlePublish}
        disabled={publishing || deleting}
      >
        {#if publishing}
          <span class='loading loading-spinner loading-sm'></span>
          Publishing...
        {:else}
          Publish Letter
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .draft-review {
    min-height: 600px;
  }

  .content-editor {
    white-space: pre-wrap;
    tab-size: 2;
    line-height: 1.6;
  }
</style>
