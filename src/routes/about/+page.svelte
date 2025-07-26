<script lang="ts">
  import Head from '$lib/components/head.svelte'
  
  let selectedImage: string | null = null
  let selectedImageAlt: string | null = null
  
  function openImage(src: string, alt: string) {
    selectedImage = src
    selectedImageAlt = alt
  }
  
  function closeImage() {
    selectedImage = null
    selectedImageAlt = null
  }
  
  // Close modal when clicking outside or pressing Escape
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeImage()
    }
  }
</script>

<Head />

<svelte:head>
  <title>About - Hold That Thought</title>
  <meta name="description" content="Learn more about Hold That Thought and our mission to preserve family letters and memories." />
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  <div class="prose prose-lg mx-auto">
    <h1 class="text-4xl font-bold text-center mb-8">About Hold That Thought</h1>
    
    <div class="text-center mb-12">
      <p class="text-xl text-base-content/80">
        An archive to see how our parents, grandparents, and great-grandparents communicated.
      </p>
      <p class="text-base-content/90 leading-relaxed mb-4">
          Don't share media or letters through social media but feel free to modify any letters that didn't get parsed correctly.
        Adding letters will come soon. 
          
        </p>
    </div>

    <div class="grid gap-8 md:gap-12">
      

      <!-- How It Works Section -->
      <section>
        <h2 class="text-2xl font-semibold mb-4">How It Works</h2>
        <div class="bg-base-100 border border-base-300 rounded-lg p-6 mb-4">
          <h3 class="font-semibold mb-3">📤 Upload Letters</h3>
          <p class="text-base-content/80 mb-3">The system supports:</p>
          <ul class="list-disc list-inside text-sm text-base-content/80 space-y-1">
            <li>Multiple images or PDFs for multi-page letters</li>
            <li>Access to original document files</li>
            <li>One letter submission at a time</li>
          </ul>
          
        </div>
        
        <div class="bg-base-100 border border-base-300 rounded-lg p-6 mb-4">
          <h3 class="font-semibold mb-3">🔍 OCR Technology</h3>
          <p class="text-base-content/80 mb-3">
           Google's OCR (Optical Content Recognition) to parse the letters, but it's not perfect and some handwriting can be challenging to read.
          </p>
          <p class="text-base-content/80 mb-3">You can improve existing letters by:</p>
          <ul class="list-disc list-inside text-sm text-base-content/80 space-y-1">
            <li>Correcting transcriptions</li>
            <li>Adding or refining tags</li>
            <li>Providing additional context or photos</li>
          </ul>
          <p class="text-xs text-base-content/60 mt-3">
            Check the help section when modifying a letter for guidance on Markdown formatting.
          </p>
        </div>

        <div class="bg-base-100 border border-base-300 rounded-lg p-6">
          <h3 class="font-semibold mb-3">📷 Sharing Pictures</h3>
          <p class="text-base-content/80 mb-3">
            To share pictures from Google Drive, use this format:
          </p>
          <div class="bg-base-200 rounded p-3 font-mono text-sm">
            ![image](https://lh3.googleusercontent.com/d/&lt;picture id&gt;)
          </div>
        </div>
      </section>

      <!-- Family Photos Section -->
      <section class="bg-base-200 rounded-lg p-6 md:p-8">
        <h2 class="text-2xl font-semibold mb-6 text-center">Family Memories</h2>
        
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          <div class="aspect-square bg-base-100 rounded-lg overflow-hidden cursor-pointer" on:click={() => openImage('https://lh3.googleusercontent.com/d/1fukAZoTgC7tUhEMXvak2H9KsY5OLLKrY', 'Family memory 1')}>
            <img 
              src="https://lh3.googleusercontent.com/d/1fukAZoTgC7tUhEMXvak2H9KsY5OLLKrY" 
              alt="Family memory 1" 
              class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </div>
          <div class="aspect-square bg-base-100 rounded-lg overflow-hidden cursor-pointer" on:click={() => openImage('https://lh3.googleusercontent.com/d/1S6nR4utenCA14w6Q6K3uJUtkuZZppUfB', 'Family memory 2')}>
            <img 
              src="https://lh3.googleusercontent.com/d/1S6nR4utenCA14w6Q6K3uJUtkuZZppUfB" 
              alt="Family memory 2" 
              class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </div>
          <div class="aspect-square bg-base-100 rounded-lg overflow-hidden cursor-pointer" on:click={() => openImage('https://lh3.googleusercontent.com/d/19JL_tiCKAjCoj-m73WEdTFyGWK2NduLT', 'Family memory 3')}>
            <img 
              src="https://lh3.googleusercontent.com/d/19JL_tiCKAjCoj-m73WEdTFyGWK2NduLT" 
              alt="Family memory 3" 
              class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </div>
          <div class="aspect-square bg-base-100 rounded-lg overflow-hidden cursor-pointer" on:click={() => openImage('https://lh3.googleusercontent.com/d/1J_9F0Yk9YkBBSKSkVsc9e-oWlEMgCaC1', 'Family memory 4')}>
            <img 
              src="https://lh3.googleusercontent.com/d/1J_9F0Yk9YkBBSKSkVsc9e-oWlEMgCaC1" 
              alt="Family memory 4" 
              class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <!-- Contact Section -->
      <section class="text-center">
        <h2 class="text-2xl font-semibold mb-4">Get In Touch</h2>
        
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="mailto:gemenielabs@gmail.com" class="btn btn-primary">
            📧 Contact Us
          </a>
          <a href="/gallery" class="btn btn-outline">
            🖼️ View Gallery
          </a>
        </div>
      </section>
    </div>
  </div>
</div>

<!-- Image Modal -->
{#if selectedImage}
  <div 
    class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
    on:click={closeImage}
    on:keydown={handleKeydown}
    tabindex="0"
    role="dialog"
    aria-modal="true"
    aria-label="Expanded family photo"
  >
    <div class="relative max-w-4xl max-h-full">
      <!-- Close button -->
      <button 
        class="absolute top-4 right-4 btn btn-circle btn-sm bg-black bg-opacity-50 text-white border-none hover:bg-opacity-75 z-10"
        on:click|stopPropagation={closeImage}
        aria-label="Close image"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      <!-- Expanded image -->
      <img 
        src={selectedImage} 
        alt={selectedImageAlt || 'Family memory'}
        class="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        on:click|stopPropagation
      />
    </div>
  </div>
{/if}

<!-- Add keyboard event listener to window -->
<svelte:window on:keydown={handleKeydown} />