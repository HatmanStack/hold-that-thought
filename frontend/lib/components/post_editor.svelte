<script lang='ts'>
  import { createEventDispatcher } from 'svelte'

  export let isOpen = false
  export let content = ''
  export let title = 'Edit Markdown'

  const dispatch = createEventDispatcher()

  let editableContent = content
  let showMarkdownHelp = false

  function save() {
    dispatch('save', editableContent)
    isOpen = false
  }

  function cancel() {
    editableContent = content // Reset to original
    isOpen = false
  }

  function toggleHelp() {
    showMarkdownHelp = !showMarkdownHelp
  }

  function closeModal() {
    isOpen = false
    dispatch('close') // Notify parent component that modal is closed
  }

  $: if (isOpen) {
    editableContent = content
  }
</script>

{#if isOpen}
  <div class='fixed z-50 flex items-center justify-center inset-0 bg-black bg-opacity-50'>
    <div class='bg-base-100 p-4 rounded-lg shadow-xl flex flex-col w-11/12 max-w-4xl max-h-[90vh]'>
      <div class='flex justify-between items-center mb-4'>
        <h3 class='font-bold text-xl'>{title}</h3>
        <button class='btn btn-sm btn-ghost' on:click={cancel}>×</button>
      </div>

      <div class='mb-4'>
        <button class='btn btn-xs btn-ghost' on:click={toggleHelp}>
          {showMarkdownHelp ? 'Hide Help' : 'Show Help'}
        </button>

        {#if showMarkdownHelp}
          <div class='bg-base-200 p-3 rounded-lg mt-2 text-sm overflow-y-auto max-h-[60vh]'>
            <h4 class='font-semibold mb-2'>Markdown Reference</h4>
            <div class='grid gap-2 grid-cols-1 md:grid-cols-2'>
              <div>
                <p><code># Heading 1</code> - Largest heading</p>
                <p><code>## Heading 2</code> - Second level heading</p>
                <p><code>### Heading 3</code> - Third level heading</p>
                <p><code>**Bold text**</code> - <strong>Bold text</strong></p>
                <p><code>*Italic text*</code> - <em>Italic text</em></p>
              </div>
              <div>
                <p><code>[Link text](https://example.com)</code> - <a href='#' class='link'>Link text</a></p>
                <p><code>![Alt text](image-url.jpg)</code> - Image</p>
                <p><code>- List item</code> - Bulleted list</p>
                <p><code>1. Numbered item</code> - Numbered list</p>
                <p><code>```code block```</code> - Code block</p>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class='overflow-auto flex-grow'>
        <textarea
          bind:value={editableContent}
          class='w-full p-2 border rounded text-sm font-mono h-[60vh]'
          spellcheck='false'
        ></textarea>
      </div>

      <div class='flex flex-col justify-end gap-2 mt-4 sm:flex-row'>
        <button class='btn btn-outline w-full sm:w-auto' on:click={cancel}>Cancel</button>
        <button class='btn btn-primary w-full sm:w-auto' on:click={save}>Save Changes</button>
      </div>
    </div>
  </div>
{/if}
