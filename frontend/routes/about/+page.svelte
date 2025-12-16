<script lang='ts'>
  import { PUBLIC_API_GATEWAY_URL } from '$env/static/public'
  import Head from '$lib/components/head.svelte'

  let selectedImage: string | null = null
  let selectedImageAlt: string | null = null

  // Contact form state
  let showContactModal = false
  let contactEmail = ''
  let contactMessage = ''
  let sending = false
  let sendError = ''
  let sendSuccess = false

  function openImage(src: string, alt: string) {
    selectedImage = src
    selectedImageAlt = alt
  }

  function closeImage() {
    selectedImage = null
    selectedImageAlt = null
  }

  function openContactModal() {
    showContactModal = true
    sendError = ''
    sendSuccess = false
  }

  function closeContactModal() {
    showContactModal = false
    contactEmail = ''
    contactMessage = ''
    sendError = ''
    sendSuccess = false
  }

  async function sendContactMessage() {
    if (!contactEmail || !contactMessage) {
      sendError = 'Please fill in both fields'
      return
    }

    sending = true
    sendError = ''

    try {
      const response = await fetch(`${PUBLIC_API_GATEWAY_URL}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: contactEmail, message: contactMessage }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send message')
      }

      sendSuccess = true
      contactEmail = ''
      contactMessage = ''
    }
    catch (err) {
      sendError = err instanceof Error ? err.message : 'Failed to send message'
    }
    finally {
      sending = false
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeImage()
      closeContactModal()
    }
  }
</script>

<Head />

<svelte:head>
  <title>About - Hold That Thought</title>
  <meta name='description' content='Learn more about Hold That Thought and our mission to preserve family letters and memories.' />
</svelte:head>

<div class='mx-auto px-4 py-8 max-w-4xl container'>
  <div class='prose mx-auto prose-lg'>
    <h1 class='text-4xl font-bold text-center mb-8'>About Hold That Thought</h1>

    <div class='text-center mb-12'>
      <p class='text-xl text-base-content/80'>
        A family archive preserving how our parents, grandparents, and great-grandparents communicated.
      </p>
    </div>

    <div class='grid gap-8 md:gap-12'>

      <!-- How It Works Section -->
      <section>
        <h2 class='text-2xl font-semibold mb-4'>How It Works</h2>
        <div class='bg-base-100 border border-base-300 rounded-lg p-6 mb-4'>
          <h3 class='font-semibold mb-3'>📤 Upload Letters</h3>
          <p class='text-base-content/80 mb-3'>Upload scanned letters or photos of handwritten correspondence:</p>
          <ul class='text-sm text-base-content/80 space-y-1 list-disc list-inside'>
            <li>Multiple images or PDFs for multi-page letters</li>
            <li>Access to original document files</li>
            <li>Automatic AI-powered transcription</li>
          </ul>
        </div>

        <div class='bg-base-100 border border-base-300 rounded-lg p-6 mb-4'>
          <h3 class='font-semibold mb-3'>🤖 AI Transcription</h3>
          <p class='text-base-content/80 mb-3'>
            Letters are automatically transcribed using AI, but handwriting can be challenging to read perfectly.
          </p>
          <p class='text-base-content/80 mb-3'>You can improve transcriptions by:</p>
          <ul class='list-disc list-inside text-sm text-base-content/80 space-y-1'>
            <li>Correcting OCR errors</li>
            <li>Adding context or notes</li>
            <li>Editing metadata (dates, authors)</li>
          </ul>
        </div>

        <div class='bg-base-100 border border-base-300 rounded-lg p-6'>
          <h3 class='font-semibold mb-3'>💬 Comments & Reactions</h3>
          <p class='text-base-content/80'>
            Family members can comment on letters, share memories, and react to content.
            Private messaging is also available for more personal conversations.
          </p>
        </div>
      </section>

      <!-- Family Photos Section -->
      <section class='bg-base-200 rounded-lg p-6 md:p-8'>
        <h2 class='text-2xl font-semibold mb-6 text-center'>Family Memories</h2>

        <div class='grid gap-4 md:grid-cols-2 lg:grid-cols-2'>
          <button type='button' class='bg-base-100 rounded-lg overflow-hidden cursor-pointer text-left p-0 aspect-square border-0' on:click={() => openImage('https://lh3.googleusercontent.com/d/1fukAZoTgC7tUhEMXvak2H9KsY5OLLKrY', 'Family memory 1')}>
            <img
              src='https://lh3.googleusercontent.com/d/1fukAZoTgC7tUhEMXvak2H9KsY5OLLKrY'
              alt='Family memory 1'
              class='w-full h-full object-cover transition-transform duration-300 hover:scale-105'
              loading='lazy'
            />
          </button>
          <button type='button' class='aspect-square bg-base-100 rounded-lg overflow-hidden cursor-pointer text-left p-0 border-0' on:click={() => openImage('https://lh3.googleusercontent.com/d/1S6nR4utenCA14w6Q6K3uJUtkuZZppUfB', 'Family memory 2')}>
            <img
              src='https://lh3.googleusercontent.com/d/1S6nR4utenCA14w6Q6K3uJUtkuZZppUfB'
              alt='Family memory 2'
              class='w-full h-full object-cover hover:scale-105 transition-transform duration-300'
              loading='lazy'
            />
          </button>
          <button type='button' class='aspect-square bg-base-100 rounded-lg overflow-hidden cursor-pointer text-left p-0 border-0' on:click={() => openImage('https://lh3.googleusercontent.com/d/19JL_tiCKAjCoj-m73WEdTFyGWK2NduLT', 'Family memory 3')}>
            <img
              src='https://lh3.googleusercontent.com/d/19JL_tiCKAjCoj-m73WEdTFyGWK2NduLT'
              alt='Family memory 3'
              class='w-full h-full object-cover hover:scale-105 transition-transform duration-300'
              loading='lazy'
            />
          </button>
          <button type='button' class='aspect-square bg-base-100 rounded-lg overflow-hidden cursor-pointer text-left p-0 border-0' on:click={() => openImage('https://lh3.googleusercontent.com/d/1J_9F0Yk9YkBBSKSkVsc9e-oWlEMgCaC1', 'Family memory 4')}>
            <img
              src='https://lh3.googleusercontent.com/d/1J_9F0Yk9YkBBSKSkVsc9e-oWlEMgCaC1'
              alt='Family memory 4'
              class='w-full h-full object-cover hover:scale-105 transition-transform duration-300'
              loading='lazy'
            />
          </button>
        </div>
      </section>

      <!-- Contact Section -->
      <section class='text-center'>
        <h2 class='text-2xl font-semibold mb-4'>Get In Touch</h2>

        <div class='flex flex-col sm:flex-row gap-4 justify-center'>
          <button on:click={openContactModal} class='btn btn-primary'>
            📧 Contact Us
          </button>
          <a href='/letters' class='btn btn-outline'>
            📜 Browse Letters
          </a>
        </div>
      </section>
    </div>
  </div>
</div>

<!-- Image Modal -->
{#if selectedImage}
  <button
    type='button'
    class='fixed inset-0 bg-black flex items-center justify-center z-50 p-4 w-full h-full border-none bg-opacity-75 cursor-default'
    on:click={closeImage}
    on:keydown={handleKeydown}
    aria-label='Close expanded family photo'
  >
    <div
      class='relative max-w-4xl max-h-full'
      role='presentation'
      on:click|stopPropagation={() => {}}
      on:keydown|stopPropagation={() => {}}
    >
      <button
        class='absolute btn btn-circle btn-sm bg-black bg-opacity-50 border-none z-10 top-4 right-4 text-white hover:bg-opacity-75'
        on:click|stopPropagation={closeImage}
        aria-label='Close image'
      >
        <svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
          <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
        </svg>
      </button>

      <img
        src={selectedImage}
        alt={selectedImageAlt || 'Family memory'}
        class='max-w-full max-h-full rounded-lg shadow-2xl object-contain'
      />
    </div>
  </button>
{/if}

<!-- Contact Modal -->
{#if showContactModal}
  <button
    type='button'
    class='fixed inset-0 bg-black flex items-center justify-center z-50 p-4 w-full h-full border-none bg-opacity-50 cursor-default'
    on:click={closeContactModal}
    on:keydown={handleKeydown}
    aria-label='Close contact form'
  >
    <div
      class='bg-base-100 rounded-lg shadow-xl max-w-md w-full p-6'
      role='dialog'
      aria-modal='true'
      on:click|stopPropagation={() => {}}
      on:keydown|stopPropagation={() => {}}
    >
      <div class='flex justify-between items-center mb-4'>
        <h3 class='text-xl font-semibold'>Contact Us</h3>
        <button
          class='btn btn-sm btn-circle btn-ghost'
          on:click={closeContactModal}
          aria-label='Close'
        >
          <svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
          </svg>
        </button>
      </div>

      {#if sendSuccess}
        <div class='text-center py-8'>
          <div class='text-4xl mb-4'>✅</div>
          <p class='text-lg font-medium mb-2'>Message Sent!</p>
          <p class='text-base-content/70 mb-4'>We'll get back to you soon.</p>
          <button class='btn btn-primary' on:click={closeContactModal}>Close</button>
        </div>
      {:else}
        <div class='space-y-4'>
          <div class='form-control'>
            <label class='label' for='contact-email'>
              <span class='label-text'>Your Email</span>
            </label>
            <input
              id='contact-email'
              type='email'
              class='input input-bordered w-full'
              placeholder='you@example.com'
              bind:value={contactEmail}
              disabled={sending}
            />
          </div>

          <div class='form-control'>
            <label class='label' for='contact-message'>
              <span class='label-text'>Message</span>
            </label>
            <textarea
              id='contact-message'
              class='textarea textarea-bordered w-full h-32'
              placeholder='How can we help?'
              bind:value={contactMessage}
              disabled={sending}
            />
          </div>

          {#if sendError}
            <div class='alert alert-error text-sm'>
              <span>{sendError}</span>
            </div>
          {/if}

          <div class='flex gap-2 justify-end'>
            <button class='btn btn-ghost' on:click={closeContactModal} disabled={sending}>
              Cancel
            </button>
            <button class='btn btn-primary' on:click={sendContactMessage} disabled={sending}>
              {#if sending}
                <span class='loading loading-spinner loading-sm'></span>
                Sending...
              {:else}
                Send Message
              {/if}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </button>
{/if}

<svelte:window on:keydown={handleKeydown} />
