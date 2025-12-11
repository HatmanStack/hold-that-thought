<script lang='ts'>
  import { authTokens } from '$lib/auth/auth-store'
  import AuthGuard from '$lib/components/auth/AuthGuard.svelte'
  import LetterUploader from '$lib/components/letters/LetterUploader.svelte'

  function handleUploadComplete(event: CustomEvent<{ uploadId: string }>) {
    console.log('Upload complete, uploadId:', event.detail.uploadId)
  }

  function handleUploadError(event: CustomEvent<{ error: string }>) {
    console.error('Upload error:', event.detail.error)
  }
</script>

<svelte:head>
  <title>Upload Letter</title>
</svelte:head>

<AuthGuard>
  <div class='container mx-auto px-4 py-8 max-w-3xl'>
    <div class='mb-8'>
      <nav class='text-sm breadcrumbs'>
        <ul>
          <li><a href='/letters' class='link link-hover'>Letters</a></li>
          <li>Upload</li>
        </ul>
      </nav>
    </div>

    <div class='flex items-center justify-between mb-2'>
      <h1 class='text-3xl font-bold'>Upload Letter</h1>
      <a href='/letters/drafts' class='btn btn-ghost btn-sm gap-2'>
        <svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
          <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
        </svg>
        View Drafts
      </a>
    </div>
    <p class='text-base-content/70 mb-8'>
      Upload scanned letter images or PDF files. After uploading, the system will process and extract the letter content using AI.
    </p>

    <div class='bg-base-100 border border-base-300 rounded-lg p-6'>
      {#if $authTokens?.idToken}
        <LetterUploader
          authToken={$authTokens.idToken}
          on:uploadComplete={handleUploadComplete}
          on:uploadError={handleUploadError}
        />
      {:else}
        <div class='text-center py-8 text-base-content/60'>
          Loading...
        </div>
      {/if}
    </div>

    <div class='mt-8 p-4 bg-info/10 border border-info/30 rounded-lg'>
      <h3 class='font-semibold text-info mb-2'>How it works</h3>
      <ol class='list-decimal list-inside space-y-1 text-sm text-base-content/80'>
        <li>Upload one or more letter scans (PDF or images)</li>
        <li>The system processes and extracts text using AI</li>
        <li>Review and edit the extracted content on the drafts page</li>
        <li>Publish the letter to make it publicly available</li>
      </ol>
    </div>
  </div>
</AuthGuard>
