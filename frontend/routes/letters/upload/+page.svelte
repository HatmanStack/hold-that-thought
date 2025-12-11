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
      Upload a scanned letter as a PDF or images. After processing, you'll have the opportunity to review and edit the extracted content before publishing.
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
      <ol class='list-decimal list-inside space-y-2 text-sm text-base-content/80'>
        <li><strong>One letter at a time:</strong> Upload a single PDF or multiple images of the same letter</li>
        <li><strong>AI processing:</strong> The system extracts and transcribes the letter content</li>
        <li><strong>Review & edit:</strong> Check the extracted text on the drafts page and make corrections</li>
        <li><strong>Publish:</strong> Add the letter to the collection when ready</li>
      </ol>
      <p class='mt-3 text-xs text-base-content/60'>
        Note: Drafts can be reviewed and edited by any approved user, just like published letters.
      </p>
    </div>
  </div>
</AuthGuard>
