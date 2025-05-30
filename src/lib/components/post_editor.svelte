<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let isOpen = false;
  export let content = '';
  export let title = 'Edit Markdown';
  
  const dispatch = createEventDispatcher();
  
  let editableContent = content;
    let showMarkdownHelp = false;
  
  function save() {
    dispatch('save', editableContent);
    isOpen = false;
  }
  
  function cancel() {
    editableContent = content; // Reset to original
    isOpen = false;
  }

  function build() {
    dispatch('build');
    isOpen = false;
  }

function toggleHelp() {
    showMarkdownHelp = !showMarkdownHelp;
  }

  function closeModal() {
    isOpen = false;
    dispatch('close'); // Notify parent component that modal is closed
  }
  
  $: if (isOpen) {
    editableContent = content;
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div class="bg-base-100 p-4 rounded-lg shadow-xl w-11/12 max-w-4xl max-h-[90vh] flex flex-col">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-bold">{title}</h3>
        <button class="btn btn-sm btn-ghost" on:click={cancel}>×</button>
      </div>
      
      <div class="mb-4">
        <button class="btn btn-xs btn-ghost" on:click={toggleHelp}>
          {showMarkdownHelp ? 'Hide Help' : 'Show Help'}
        </button>
        
 
  
      {#if showMarkdownHelp}
        <div class="bg-base-200 p-3 rounded-lg mt-2 text-sm max-h-[60vh] overflow-y-auto">
          <h4 class="font-semibold mb-2">Markdown Reference</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <p><code># Heading 1</code> - Largest heading</p>
              <p><code>## Heading 2</code> - Second level heading</p>
              <p><code>### Heading 3</code> - Third level heading</p>
              <p><code>**Bold text**</code> - <strong>Bold text</strong></p>
              <p><code>*Italic text*</code> - <em>Italic text</em></p>
            </div>
            <div>
              <p><code>[Link text](https://example.com)</code> - <a href="#" class="link">Link text</a></p>
              <p><code>![Alt text](image-url.jpg)</code> - Image</p>
              <p><code>- List item</code> - Bulleted list</p>
              <p><code>1. Numbered item</code> - Numbered list</p>
              <p><code>```code block```</code> - Code block</p>
            </div>
          </div>
          <br>
          <h4 class="font-semibold mb-2">MetaData Reference</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <p><code>---</code> Meta Data Marker </p>
              <p><code>created:</code> Date Letter was Sent </p>
              <p><code>description:</code> Short description of content</p>
              <p><code>published:</code> Author </p>
              <p><code>tags:</code> Can be added for easy Search/Cross-Reference</p>
              <p><code>title:</code> Title of Letter</p>
            </div>
            <div>
              <p>The Items inside of the Meta Data Markers should follow</p>
              <p>the same format but can be edited</p>
              <br>
              <p>Deleting tags is fine and will help clean up the Library</p>
              <br>
              <p>The first Title given by Google's OCR will be the Letter's</p>
              <p>URL but Changes to the title will show up in the feed</p>
              <br>
              <p>Hovering the Date at the top of the Letter Tells you the last time it was edited</p>
            </div>
          </div>
          <div class="mt-2">
            <p class="text-warning">Note: Changes to the markdown won't show up until you rebuild the site.  It can take up to 5 minutes for it to build.  It's not necessary to rebuild the site everytime you save, only when you want your saves to show up on the site. The version of the Letter that is being edited in your window is the Realtime Version and is Version controlled, no content loss.</p>
          </div>
        </div>
      {/if}
    </div>

      <div class="flex-grow overflow-auto">
        <textarea 
          bind:value={editableContent}
          class="w-full h-[60vh] p-2 border rounded font-mono text-sm"
          spellcheck="false"
        ></textarea>
      </div>
      
      <div class="flex flex-col sm:flex-row justify-end gap-2 mt-4">
        <button class="btn btn-outline w-full sm:w-auto" on:click={cancel}>Cancel</button>
        <button class="btn btn-primary w-full sm:w-auto" on:click={save}>Save Changes</button>
        <button class="btn btn-secondary w-full sm:w-auto" on:click={build}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Rebuild Site
        </button>
      </div>
    </div>
  </div>
{/if}