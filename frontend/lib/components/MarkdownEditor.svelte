<script lang="ts">
  import { marked } from 'marked'
  import { createEventDispatcher } from 'svelte'

  export let content: string = ''
  export let title: string = ''
  export let saving: boolean = false

  const dispatch = createEventDispatcher<{
    save: { content: string, title: string }
    cancel: void
  }>()

  $: preview = marked(content)

  function handleSave() {
    dispatch('save', { content, title })
  }

  function handleCancel() {
    dispatch('cancel')
  }
</script>

<div class="flex flex-col h-full">
  <!-- Title input -->
  <div class="mb-4">
    <label class="label" for="title-input">
      <span class="label-text font-medium">Title</span>
    </label>
    <input
      id="title-input"
      type="text"
      class="input input-bordered w-full"
      bind:value={title}
      placeholder="Letter title"
      disabled={saving}
    />
  </div>

  <!-- Split view -->
  <div class="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[500px]">
    <!-- Editor pane -->
    <div class="flex flex-col">
      <label class="label" for="content-editor">
        <span class="label-text font-medium">Markdown</span>
      </label>
      <textarea
        id="content-editor"
        class="textarea textarea-bordered flex-1 font-mono text-sm resize-none"
        bind:value={content}
        placeholder="Write your content in markdown..."
        disabled={saving}
      />
    </div>

    <!-- Preview pane -->
    <div class="flex flex-col">
      <div class="label">
        <span class="label-text font-medium">Preview</span>
      </div>
      <div class="border rounded-lg p-4 flex-1 overflow-auto prose max-w-none bg-base-100">
        {#if content}
          {@html preview}
        {:else}
          <p class="text-gray-400 italic">Preview will appear here...</p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="flex justify-end gap-2 mt-4">
    <button
      class="btn btn-ghost"
      on:click={handleCancel}
      disabled={saving}
    >
      Cancel
    </button>
    <button
      class="btn btn-primary"
      on:click={handleSave}
      disabled={saving}
    >
      {#if saving}
        <span class="loading loading-spinner loading-sm"></span>
        Saving...
      {:else}
        Save Changes
      {/if}
    </button>
  </div>
</div>
