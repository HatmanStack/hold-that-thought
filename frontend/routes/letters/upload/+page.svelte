<script lang='ts'>
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

    <h1 class='text-3xl font-bold mb-2'>Upload Letter</h1>
    <p class='text-base-content/70 mb-8'>
      Upload scanned letter images or PDF files. After uploading, the system will process and extract the letter content using AI.
    </p>

    <div class='bg-base-100 border border-base-300 rounded-lg p-6'>
      <LetterUploader
        on:uploadComplete={handleUploadComplete}
        on:uploadError={handleUploadError}
      />
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
