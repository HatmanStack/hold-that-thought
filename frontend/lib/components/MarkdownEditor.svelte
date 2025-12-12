<script lang='ts'>
  import { createEventDispatcher } from 'svelte'

  export let content: string = ''
  export let title: string = ''
  export let author: string = ''
  export let description: string = ''
  export let date: string = ''
  export let saving: boolean = false

  const dispatch = createEventDispatcher<{
    save: { content: string, title: string, author: string, description: string, date: string }
    cancel: void
  }>()

  function handleSave() {
    dispatch('save', { content, title, author, description, date })
  }

  function handleCancel() {
    dispatch('cancel')
  }
</script>

<div class='flex flex-col h-full'>
  <!-- Title and Date row -->
  <div class='grid grid-cols-1 md:grid-cols-2 gap-4 mb-4'>
    <div>
      <label class='label' for='title-input'>
        <span class='font-medium label-text'>Title</span>
      </label>
      <input
        id='title-input'
        type='text'
        class='input input-bordered w-full'
        bind:value={title}
        placeholder='Letter title'
        disabled={saving}
      />
    </div>
    <div>
      <label class='label' for='date-input'>
        <span class='font-medium label-text'>Date</span>
      </label>
      <input
        id='date-input'
        type='date'
        class='input input-bordered w-full'
        bind:value={date}
        disabled={saving}
      />
    </div>
  </div>

  <!-- Author -->
  <div class='mb-4'>
    <label class='label' for='author-input'>
      <span class='font-medium label-text'>Author</span>
    </label>
    <input
      id='author-input'
      type='text'
      class='input input-bordered w-full'
      bind:value={author}
      placeholder='Letter author'
      disabled={saving}
    />
  </div>

  <!-- Short Description -->
  <div class='mb-4'>
    <label class='label' for='description-input'>
      <span class='font-medium label-text'>Short Description</span>
    </label>
    <textarea
      id='description-input'
      class='textarea textarea-bordered w-full h-20'
      bind:value={description}
      placeholder='Brief description of the letter'
      disabled={saving}
    />
  </div>

  <!-- Content Editor -->
  <div class='flex flex-col flex-1 min-h-[400px]'>
    <label class='label' for='content-editor'>
      <span class='label-text font-medium'>Content</span>
    </label>
    <textarea
      id='content-editor'
      class='flex-1 text-sm textarea textarea-bordered font-mono resize-none'
      bind:value={content}
      placeholder='Write your content...'
      disabled={saving}
    />
  </div>

  <!-- Actions -->
  <div class='flex gap-2 justify-end mt-4'>
    <button
      class='btn btn-ghost'
      on:click={handleCancel}
      disabled={saving}
    >
      Cancel
    </button>
    <button
      class='btn btn-primary'
      on:click={handleSave}
      disabled={saving}
    >
      {#if saving}
        <span class='loading loading-spinner loading-sm'></span>
        Saving...
      {:else}
        Save Changes
      {/if}
    </button>
  </div>
</div>
