<script lang='ts'>
  import { sendMessage, uploadAttachment } from '$lib/services/messageService'
  import { createEventDispatcher } from 'svelte'

  export let conversationId: string

  const dispatch = createEventDispatcher()

  let messageText = ''
  let sending = false
  let error = ''
  let fileInput: HTMLInputElement
  let selectedFiles: File[] = []

  /**
   * Handle keyboard events
   */
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendMessage()
    }
  }

  /**
   * Handle file selection
   */
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement
    if (target.files) {
      const newFiles = Array.from(target.files)
      // Validate file sizes (max 25MB per file)
      const invalidFiles = newFiles.filter(file => file.size > 25 * 1024 * 1024)
      if (invalidFiles.length > 0) {
        error = 'Some files are too large. Maximum file size is 25MB.'
        return
      }
      selectedFiles = [...selectedFiles, ...newFiles]
      error = ''
    }
  }

  /**
   * Remove selected file
   */
  function removeFile(index: number) {
    selectedFiles = selectedFiles.filter((_, i) => i !== index)
  }

  /**
   * Format file size
   */
  function formatFileSize(bytes: number): string {
    if (bytes < 1024)
      return `${bytes} B`
    if (bytes < 1024 * 1024)
      return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  /**
   * Validate and send message
   */
  async function handleSendMessage() {
    // Validate
    const trimmedText = messageText.trim()
    if (!trimmedText && selectedFiles.length === 0) {
      return // Nothing to send
    }

    sending = true
    error = ''

    try {
      // Upload attachments first if there are any
      const attachments: Array<{ s3Key: string, filename: string, contentType: string, size: number }> = []

      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const uploadResult = await uploadAttachment(file)

          if (uploadResult.success && uploadResult.data) {
            attachments.push({
              s3Key: uploadResult.data.s3Key,
              filename: file.name,
              contentType: file.type,
              size: file.size,
            })
          }
          else {
            error = uploadResult.error || `Failed to upload ${file.name}`
            sending = false
            return
          }
        }
      }

      // Send message with attachments
      const result = await sendMessage(conversationId, trimmedText, attachments.length > 0 ? attachments : undefined)

      if (result.success && result.data) {
        // Clear input
        messageText = ''
        selectedFiles = []
        if (fileInput)
          fileInput.value = ''

        // Emit event with new message
        const message = Array.isArray(result.data) ? result.data[0] : result.data
        dispatch('messageSent', message)
      }
      else {
        error = result.error || 'Failed to send message'
      }
    }
    catch (err) {
      error = err instanceof Error ? err.message : 'Failed to send message'
    }
    finally {
      sending = false
    }
  }
</script>

<div class='border-t border-base-300 bg-base-100 p-4 flex-shrink-0'>
  {#if error}
    <div class='alert alert-error mb-2 text-sm'>
      <span>{error}</span>
    </div>
  {/if}

  <!-- File previews -->
  {#if selectedFiles.length > 0}
    <div class='mb-2 space-y-1'>
      {#each selectedFiles as file, index}
        <div class='flex items-center gap-2 p-2 bg-base-200 rounded text-sm'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            class='h-5 w-5 text-base-content/60'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              stroke-linecap='round'
              stroke-linejoin='round'
              stroke-width='2'
              d='M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13'
            />
          </svg>
          <span class='flex-1 truncate'>{file.name}</span>
          <span class='text-base-content/60'>{formatFileSize(file.size)}</span>
          <button
            class='btn btn-ghost btn-xs btn-circle'
            on:click={() => removeFile(index)}
            aria-label='Remove file'
          >
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
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Input area -->
  <div class='flex gap-1 sm:gap-2 items-end'>
    <!-- Attachment button -->
    <input
      type='file'
      bind:this={fileInput}
      on:change={handleFileSelect}
      multiple
      class='hidden'
      accept='image/*,.pdf,.doc,.docx,.txt'
    />
    <button
      class='btn btn-ghost btn-circle btn-sm sm:btn-md'
      on:click={() => fileInput.click()}
      disabled={sending}
      aria-label='Attach file'
    >
      <svg
        xmlns='http://www.w3.org/2000/svg'
        class='h-6 w-6'
        fill='none'
        viewBox='0 0 24 24'
        stroke='currentColor'
      >
        <path
          stroke-linecap='round'
          stroke-linejoin='round'
          stroke-width='2'
          d='M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13'
        />
      </svg>
    </button>

    <!-- Textarea -->
    <textarea
      bind:value={messageText}
      on:keydown={handleKeyDown}
      placeholder='Type a message...'
      rows='1'
      class='textarea textarea-bordered textarea-sm flex-1 sm:textarea-md resize-none'
      disabled={sending}
      style='min-height: 2.5rem; max-height: 8rem;'
      on:input={(e) => {
        const target = e.target
        if (target instanceof HTMLTextAreaElement) {
          target.style.height = 'auto'
          target.style.height = `${Math.min(target.scrollHeight, 128)}px`
        }
      }}
    ></textarea>

    <!-- Send button -->
    <button
      class='btn btn-primary btn-sm sm:btn-md'
      on:click={handleSendMessage}
      disabled={sending || (!messageText.trim() && selectedFiles.length === 0)}
      class:loading={sending}
    >
      {#if !sending}
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
            d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8'
          />
        </svg>
      {/if}
      Send
    </button>
  </div>

  <!-- Helper text -->
  <div class='text-xs text-base-content/60 mt-2'>
    Press Enter to send, Shift+Enter for new line
  </div>
</div>
