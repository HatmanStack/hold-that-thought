<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { 
    uploadMediaFile, 
    uploadMultipleFiles, 
    validateFile, 
    determineMediaType,
    formatFileSize,
    getUploadStats,
    SUPPORTED_FILE_TYPES,
    type UploadResult,
    type UploadProgress 
  } from '$lib/services/media-upload-service'

  // Props
  export let allowMultiple = true
  export let acceptedTypes: ('pictures' | 'videos' | 'documents')[] = ['pictures', 'videos', 'documents']
  export let maxFiles = 10
  export let disabled = false

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    uploadStart: { files: File[] }
    uploadProgress: { fileIndex: number; progress: UploadProgress }
    uploadComplete: { results: UploadResult[] }
    uploadError: { error: string }
  }>()

  // State
  let fileInput: HTMLInputElement
  let dragActive = false
  let uploading = false
  let uploadResults: UploadResult[] = []
  let currentUploads: { file: File; progress: UploadProgress; result?: UploadResult }[] = []

  // Computed values
  $: acceptString = getAcceptString()
  $: uploadStats = getUploadStats(uploadResults)

  function getAcceptString(): string {
    const extensions: string[] = []
    const mimeTypes: string[] = []

    acceptedTypes.forEach(type => {
      const config = SUPPORTED_FILE_TYPES[type]
      extensions.push(...config.extensions.map(ext => `.${ext}`))
      mimeTypes.push(...config.mimeTypes)
    })

    return [...extensions, ...mimeTypes].join(',')
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement
    if (target.files) {
      handleFiles(Array.from(target.files))
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    dragActive = false

    if (event.dataTransfer?.files) {
      handleFiles(Array.from(event.dataTransfer.files))
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault()
    dragActive = true
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault()
    dragActive = false
  }

  async function handleFiles(files: File[]) {
    if (disabled || uploading) return

    // Limit number of files
    if (files.length > maxFiles) {
      dispatch('uploadError', { error: `Maximum ${maxFiles} files allowed` })
      return
    }

    // Validate all files first
    const validationErrors: string[] = []
    const validFiles: File[] = []

    files.forEach((file, index) => {
      const validation = validateFile(file)
      if (!validation.valid) {
        validationErrors.push(`${file.name}: ${validation.message}`)
      } else {
        const mediaType = determineMediaType(file)
        if (mediaType && acceptedTypes.includes(mediaType)) {
          validFiles.push(file)
        } else {
          validationErrors.push(`${file.name}: File type not accepted for this upload`)
        }
      }
    })

    if (validationErrors.length > 0) {
      dispatch('uploadError', { error: validationErrors.join('\n') })
      return
    }

    if (validFiles.length === 0) {
      dispatch('uploadError', { error: 'No valid files to upload' })
      return
    }

    // Start upload
    uploading = true
    uploadResults = []
    currentUploads = validFiles.map(file => ({
      file,
      progress: { loaded: 0, total: file.size, percentage: 0 }
    }))

    dispatch('uploadStart', { files: validFiles })

    try {
      const results = await uploadMultipleFiles(
        validFiles,
        (fileIndex, progress) => {
          currentUploads[fileIndex].progress = progress
          currentUploads = [...currentUploads] // Trigger reactivity
          dispatch('uploadProgress', { fileIndex, progress })
        },
        (fileIndex, result) => {
          currentUploads[fileIndex].result = result
          currentUploads = [...currentUploads] // Trigger reactivity
        }
      )

      uploadResults = results
      dispatch('uploadComplete', { results })

    } catch (error) {
      dispatch('uploadError', { 
        error: error instanceof Error ? error.message : 'Upload failed' 
      })
    } finally {
      uploading = false
    }
  }

  function clearResults() {
    uploadResults = []
    currentUploads = []
    if (fileInput) {
      fileInput.value = ''
    }
  }

  function triggerFileSelect() {
    if (!disabled && !uploading) {
      fileInput?.click()
    }
  }
</script>

<div class="media-upload">
  <!-- Hidden file input -->
  <input
    bind:this={fileInput}
    type="file"
    {acceptString}
    multiple={allowMultiple}
    class="hidden"
    on:change={handleFileSelect}
    {disabled}
  />

  <!-- Drop zone -->
  <div
    class="drop-zone border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200"
    class:border-primary={dragActive}
    class:bg-primary/5={dragActive}
    class:border-base-300={!dragActive}
    class:cursor-pointer={!disabled && !uploading}
    class:opacity-50={disabled}
    on:drop={handleDrop}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:click={triggerFileSelect}
    role="button"
    tabindex="0"
    on:keydown={(e) => e.key === 'Enter' && triggerFileSelect()}
  >
    {#if uploading}
      <div class="text-primary">
        <div class="loading loading-spinner loading-lg mb-4"></div>
        <h3 class="text-lg font-semibold mb-2">Uploading Files...</h3>
        <p class="text-sm text-base-content/70">
          {currentUploads.filter(u => u.result?.success).length} of {currentUploads.length} files completed
        </p>
      </div>
    {:else}
      <div class="text-base-content/70">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <h3 class="text-lg font-semibold mb-2">Upload Media Files</h3>
        <p class="text-sm mb-4">
          Drag and drop files here, or click to select files
        </p>
        <div class="text-xs space-y-1">
          <p><strong>Accepted types:</strong> {acceptedTypes.join(', ')}</p>
          <p><strong>Max files:</strong> {maxFiles}</p>
          <p><strong>Max size:</strong> 500MB per file</p>
        </div>
      </div>
    {/if}
  </div>

  <!-- Upload progress -->
  {#if currentUploads.length > 0}
    <div class="mt-6 space-y-3">
      <h4 class="font-semibold">Upload Progress</h4>
      {#each currentUploads as upload, index}
        <div class="bg-base-200 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium truncate flex-1 mr-4">{upload.file.name}</span>
            <span class="text-xs text-base-content/60">{formatFileSize(upload.file.size)}</span>
          </div>
          
          <div class="flex items-center gap-3">
            <div class="flex-1">
              <div class="w-full bg-base-300 rounded-full h-2">
                <div 
                  class="h-2 rounded-full transition-all duration-300"
                  class:bg-primary={!upload.result}
                  class:bg-success={upload.result?.success}
                  class:bg-error={upload.result && !upload.result.success}
                  style="width: {upload.progress.percentage}%"
                ></div>
              </div>
            </div>
            
            <div class="text-xs text-base-content/60 min-w-[3rem] text-right">
              {upload.progress.percentage}%
            </div>
            
            <div class="min-w-[1.5rem]">
              {#if upload.result?.success}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              {:else if upload.result && !upload.result.success}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              {:else if uploading}
                <div class="loading loading-spinner loading-xs"></div>
              {/if}
            </div>
          </div>
          
          {#if upload.result && !upload.result.success}
            <div class="mt-2 text-xs text-error">
              {upload.result.message}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Upload results summary -->
  {#if uploadResults.length > 0 && !uploading}
    <div class="mt-6 p-4 bg-base-200 rounded-lg">
      <h4 class="font-semibold mb-3">Upload Summary</h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div class="text-base-content/60">Total Files</div>
          <div class="font-semibold">{uploadStats.total}</div>
        </div>
        <div>
          <div class="text-base-content/60">Successful</div>
          <div class="font-semibold text-success">{uploadStats.successful}</div>
        </div>
        <div>
          <div class="text-base-content/60">Failed</div>
          <div class="font-semibold text-error">{uploadStats.failed}</div>
        </div>
        <div>
          <div class="text-base-content/60">Total Size</div>
          <div class="font-semibold">{uploadStats.totalSize}</div>
        </div>
      </div>
      
      <div class="mt-4 flex gap-2">
        <button class="btn btn-sm btn-outline" on:click={clearResults}>
          Clear Results
        </button>
        {#if uploadStats.failed > 0}
          <button class="btn btn-sm btn-error btn-outline" on:click={() => handleFiles(currentUploads.filter(u => !u.result?.success).map(u => u.file))}>
            Retry Failed
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .drop-zone {
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>