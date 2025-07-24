<script lang="ts">
  import Head from '$lib/components/head.svelte'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { isAuthenticated, authLoading, currentUser } from '$lib/auth/auth-store'
  import { browser } from '$app/environment'
  import type { PageData } from './$types'
  import { uploadMedia, getMediaItems, type MediaItem } from '$lib/services/media-service'
  
  export let data: PageData
  
  let selectedSection: 'pictures' | 'videos' | 'documents' = 'pictures'
  let mediaItems: MediaItem[] = []
  let loading = false
  let error = ''
  let selectedItem: MediaItem | null = null
  let showModal = false
  let uploading = false
  let uploadError = ''
  
  // Load media items for the selected section
  async function loadMediaItems(section: 'pictures' | 'videos' | 'documents') {
    loading = true
    error = ''
    
    try {
      mediaItems = await getMediaItems(section)
    } catch (err) {
      console.error(`Error loading ${section}:`, err)
      error = err instanceof Error ? err.message : `Failed to load ${section}`
      mediaItems = []
    } finally {
      loading = false
    }
  }

  // Handle file upload
  async function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement
    if (!input.files?.length) return

    uploading = true
    uploadError = ''

    try {
      const file = input.files[0]
      const newItem = await uploadMedia(file)
      
      // Add the new item to the list if it matches the current section
      if (newItem.category === selectedSection) {
        mediaItems = [...mediaItems, newItem]
      }

      // Clear the input
      input.value = ''
    } catch (err) {
      console.error('Upload error:', err)
      uploadError = err instanceof Error ? err.message : 'Upload failed'
    } finally {
      uploading = false
    }
  }
  
  // Handle section change
  function changeSection(section: 'pictures' | 'videos' | 'documents') {
    selectedSection = section
    loadMediaItems(section)
  }
  
  // Open media item in modal
  function openMediaItem(item: MediaItem) {
    selectedItem = item
    showModal = true
  }
  
  // Close modal
  function closeModal() {
    selectedItem = null
    showModal = false
  }
  
  // Format file size
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  
  // Format date
  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }
  
  // Load initial data
  onMount(() => {
    if (browser) {
      // If Cognito is not configured, show content in development mode
      if (!data.cognitoConfigured) {
        console.warn('⚠️  Cognito not configured - running in development mode')
        loadMediaItems(selectedSection)
        return
      }
      
      // Cognito is configured - check authentication and approval
      const unsubscribe = isAuthenticated.subscribe(authenticated => {
        if (!$authLoading && !authenticated) {
          goto('/auth/login')
          return
        }
        
        // Check if user is authenticated and approved
        if (authenticated) {
          // Check user's groups from the auth store
          const userUnsubscribe = currentUser.subscribe(user => {
            if (user) {
              const isApproved = user['cognito:groups']?.includes('ApprovedUsers') || false
              
              if (!isApproved) {
                // User is authenticated but not approved
                goto('/auth/pending-approval')
                return
              }
              
              // User is approved - load gallery content
              loadMediaItems(selectedSection)
            }
          })
          
          return userUnsubscribe
        }
      })

      return unsubscribe
    }
  })
</script>

<Head />

<svelte:head>
  <title>Gallery - Hold That Thought</title>
  <meta name="description" content="Explore our collection of preserved family letters, memories, and historical correspondence." />
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Development Mode Banner -->
  {#if data.developmentMode}
    <div class="alert alert-warning mb-8">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <div>
        <h3 class="font-bold">Development Mode</h3>
        <div class="text-sm">Gallery is in development mode. Authentication not configured. Visit <a href="/auth-status" class="link">auth status</a> for setup instructions.</div>
      </div>
    </div>
  {/if}

  <div class="text-center mb-8">
    <h1 class="text-4xl font-bold mb-4">Family Gallery</h1>
    <p class="text-xl text-base-content/80 max-w-2xl mx-auto">
      Explore our collection of family pictures, videos, and documents preserved through the years.
    </p>
  </div>

  <!-- Upload Section -->
  <div class="mb-8 text-center">
    <input
      type="file"
      id="fileUpload"
      class="hidden"
      on:change={handleFileUpload}
      accept={selectedSection === 'pictures' ? 'image/*' : 
             selectedSection === 'videos' ? 'video/*' : 
             '.pdf,.doc,.docx,.txt'}
    />
    <label
      for="fileUpload"
      class="btn btn-primary"
      class:loading={uploading}
      class:disabled={uploading}
    >
      {uploading ? 'Uploading...' : `Upload ${selectedSection.slice(0, -1)}`}
    </label>
    
    {#if uploadError}
      <div class="alert alert-error mt-4">
        <span>{uploadError}</span>
      </div>
    {/if}
  </div>

  <!-- Section Tabs -->
  <div class="flex justify-center mb-8">
    <div class="tabs tabs-boxed">
      <button 
        class="tab tab-lg"
        class:tab-active={selectedSection === 'pictures'}
        on:click={() => changeSection('pictures')}
      >
        📸 Pictures
      </button>
      <button 
        class="tab tab-lg"
        class:tab-active={selectedSection === 'videos'}
        on:click={() => changeSection('videos')}
      >
        🎥 Videos
      </button>
      <button 
        class="tab tab-lg"
        class:tab-active={selectedSection === 'documents'}
        on:click={() => changeSection('documents')}
      >
        📄 Documents
      </button>
    </div>
  </div>

  <!-- Loading State -->
  {#if loading}
    <div class="flex justify-center items-center py-12">
      <div class="loading loading-spinner loading-lg"></div>
      <span class="ml-4 text-lg">Loading {selectedSection}...</span>
    </div>
  {:else if error}
    <!-- Error State -->
    <div class="alert alert-error max-w-md mx-auto">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div>
        <h3 class="font-bold">Error Loading {selectedSection}</h3>
        <div class="text-xs">{error}</div>
      </div>
      <button class="btn btn-sm" on:click={() => loadMediaItems(selectedSection)}>
        Retry
      </button>
    </div>
  {:else if mediaItems.length === 0}
    <!-- Empty State -->
    <div class="text-center py-12">
      <div class="text-6xl mb-4">
        {#if selectedSection === 'pictures'}📸
        {:else if selectedSection === 'videos'}🎥
        {:else}📄{/if}
      </div>
      <h3 class="text-xl font-semibold mb-2">No {selectedSection} found</h3>
      <p class="text-base-content/60">Upload your first {selectedSection.slice(0, -1)} using the button above.</p>
    </div>
  {:else}
    <!-- Media Grid -->
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each mediaItems as item (item.id)}
        <div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer" on:click={() => openMediaItem(item)}>
          <figure class="aspect-square bg-base-200 relative overflow-hidden">
            {#if selectedSection === 'pictures'}
              {#if item.thumbnailUrl}
                <img src={item.thumbnailUrl} alt={item.title} class="w-full h-full object-cover" loading="lazy" />
              {:else}
                <img src={item.signedUrl} alt={item.title} class="w-full h-full object-cover" loading="lazy" />
              {/if}
            {:else if selectedSection === 'videos'}
              {#if item.thumbnailUrl}
                <div class="relative w-full h-full">
                  <img src={item.thumbnailUrl} alt={item.title} class="w-full h-full object-cover" loading="lazy" />
                  <div class="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div class="bg-white/90 rounded-full p-3">
                      <svg class="w-8 h-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                </div>
              {:else}
                <div class="w-full h-full flex items-center justify-center text-base-content/40">
                  <div class="text-center">
                    <div class="text-4xl mb-2">🎥</div>
                    <div class="text-sm">Video</div>
                  </div>
                </div>
              {/if}
            {:else}
              <div class="w-full h-full flex items-center justify-center text-base-content/40">
                <div class="text-center">
                  <div class="text-4xl mb-2">
                    {#if item.contentType.includes('pdf')}📄
                    {:else if item.contentType.includes('word')}📝
                    {:else if item.contentType.includes('text')}📃
                    {:else}📄{/if}
                  </div>
                  <div class="text-sm">{item.contentType.split('/')[1]?.toUpperCase() || 'DOC'}</div>
                </div>
              </div>
            {/if}
            
            <!-- File size badge -->
            <div class="absolute top-2 right-2 badge badge-sm bg-black/50 text-white border-none">
              {formatFileSize(item.fileSize)}
            </div>
          </figure>
          
          <div class="card-body p-4">
            <h3 class="card-title text-sm line-clamp-2">{item.title}</h3>
            {#if item.description}
              <p class="text-xs text-base-content/70 line-clamp-2">{item.description}</p>
            {/if}
            <div class="text-xs text-base-content/60 mt-2">
              {formatDate(item.uploadDate)}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Media Modal -->
{#if showModal && selectedItem}
  <div class="modal modal-open">
    <div class="modal-box max-w-4xl">
      <div class="flex justify-between items-start mb-4">
        <div>
          <h3 class="font-bold text-lg">{selectedItem.title}</h3>
          <p class="text-sm text-base-content/70">{selectedItem.filename}</p>
        </div>
        <button class="btn btn-sm btn-circle btn-ghost" on:click={closeModal}>✕</button>
      </div>
      
      <div class="mb-4">
        {#if selectedSection === 'pictures'}
          <img src={selectedItem.signedUrl} alt={selectedItem.title} class="w-full max-h-96 object-contain rounded-lg" />
        {:else if selectedSection === 'videos'}
          <video controls class="w-full max-h-96 rounded-lg">
            <source src={selectedItem.signedUrl} type={selectedItem.contentType}>
            Your browser does not support the video tag.
          </video>
        {:else}
          <div class="bg-base-200 rounded-lg p-8 text-center">
            <div class="text-6xl mb-4">
              {#if selectedItem.contentType.includes('pdf')}📄
              {:else if selectedItem.contentType.includes('word')}📝
              {:else if selectedItem.contentType.includes('text')}📃
              {:else}📄{/if}
            </div>
            <p class="text-lg font-semibold mb-2">{selectedItem.title}</p>
            <p class="text-sm text-base-content/70 mb-4">
              {selectedItem.contentType} • {formatFileSize(selectedItem.fileSize)}
            </p>
            <a href={selectedItem.signedUrl} target="_blank" class="btn btn-primary">
              📥 Download & View
            </a>
          </div>
        {/if}
      </div>
      
      {#if selectedItem.description}
        <div class="mb-4">
          <h4 class="font-semibold mb-2">Description</h4>
          <p class="text-sm text-base-content/80">{selectedItem.description}</p>
        </div>
      {/if}
      
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span class="font-semibold">Upload Date:</span>
          <span class="text-base-content/70">{formatDate(selectedItem.uploadDate)}</span>
        </div>
        <div>
          <span class="font-semibold">File Size:</span>
          <span class="text-base-content/70">{formatFileSize(selectedItem.fileSize)}</span>
        </div>
      </div>
      
      <div class="modal-action">
        <button class="btn" on:click={closeModal}>Close</button>
        <a href={selectedItem.signedUrl} target="_blank" class="btn btn-primary">
          {#if selectedSection === 'documents'}
            📥 Download
          {:else}
            🔗 Open Full Size
          {/if}
        </a>
      </div>
    </div>
  </div>
{/if}
