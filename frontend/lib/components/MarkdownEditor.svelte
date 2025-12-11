<script lang='ts'>
  import { createEventDispatcher } from 'svelte'

  export let content: string = ''
  export let title: string = ''
  export let saving: boolean = false

  const dispatch = createEventDispatcher<{
    save: { content: string, title: string }
    cancel: void
  }>()

  function handleSave() {
    dispatch('save', { content, title })
  }

  function handleCancel() {
    dispatch('cancel')
  }
</script>

<div class='flex flex-col h-full'>
  <!-- Title input -->
  <div class='mb-4'>
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

  <!-- Editor -->
  <div class='flex flex-col flex-1 min-h-[500px]'>
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
