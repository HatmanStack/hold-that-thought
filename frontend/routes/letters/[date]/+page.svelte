<script lang="ts">
  import { onMount } from 'svelte'
  import { marked } from 'marked'
  import { getLetter, getPdfUrl, getVersions, revertToVersion, type Letter, type LetterVersion } from '$lib/services/letters-service'
  import { isAuthenticated, authTokens } from '$lib/auth/auth-store'
  import VersionHistory from '$lib/components/VersionHistory.svelte'

  export let data: { date: string }

  let letter: Letter | null = null
  let loading = true
  let error = ''
  let pdfLoading = false

  let versions: LetterVersion[] = []
  let versionsLoading = false
  let showVersions = false

  function formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  async function loadLetter() {
    if (!$authTokens?.accessToken) {
      loading = false
      return
    }

    try {
      letter = await getLetter(data.date, $authTokens.accessToken)
    }
    catch (e) {
      error = e instanceof Error ? e.message : 'Letter not found'
    }
    loading = false
  }

  async function loadVersions() {
    if (!$authTokens?.accessToken || !letter || letter.versionCount === 0)
      return

    versionsLoading = true
    try {
      versions = await getVersions(letter.date, $authTokens.accessToken)
    }
    catch (e) {
      console.error('Failed to load versions:', e)
    }
    versionsLoading = false
  }

  async function downloadPdf() {
    if (!$authTokens?.accessToken || !letter)
      return

    pdfLoading = true
    try {
      const url = await getPdfUrl(letter.date, $authTokens.accessToken)
      window.open(url, '_blank')
    }
    catch (e) {
      console.error('Failed to get PDF URL:', e)
    }
    pdfLoading = false
  }

  async function handleRevert(event: CustomEvent<{ timestamp: string }>) {
    if (!$authTokens?.accessToken || !letter)
      return

    try {
      await revertToVersion(letter.date, event.detail.timestamp, $authTokens.accessToken)
      // Reload letter and versions
      letter = await getLetter(letter.date, $authTokens.accessToken)
      versions = await getVersions(letter.date, $authTokens.accessToken)
    }
    catch (e) {
      console.error('Failed to revert:', e)
    }
  }

  function toggleVersions() {
    showVersions = !showVersions
    if (showVersions && versions.length === 0) {
      loadVersions()
    }
  }

  onMount(() => {
    loadLetter()
  })

  // Reload when auth state changes
  $: if ($isAuthenticated && $authTokens?.accessToken && !letter && !loading && !error) {
    loadLetter()
  }

  $: htmlContent = letter ? marked(letter.content) : ''
</script>

{#if loading}
  <div class="container mx-auto p-4 max-w-4xl">
    <div class="flex justify-center p-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  </div>
{:else if !$isAuthenticated}
  <div class="container mx-auto p-4 max-w-4xl">
    <div class="alert alert-warning">
      <span>Please log in to view this letter.</span>
    </div>
    <a href="/letters" class="btn btn-link mt-4">Back to letters</a>
  </div>
{:else if error || !letter}
  <div class="container mx-auto p-4 max-w-4xl">
    <div class="alert alert-error mb-4">
      <span>{error || 'Letter not found'}</span>
    </div>
    <a href="/letters" class="btn btn-link">Back to letters</a>
  </div>
{:else}
  <article class="container mx-auto p-4 max-w-4xl">
    <header class="mb-8">
      <h1 class="text-3xl font-bold">{letter.title}</h1>
      <div class="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
        <span>{formatDate(letter.date)}</span>
        {#if letter.versionCount > 0}
          <span>• Edited {letter.versionCount} {letter.versionCount === 1 ? 'time' : 'times'}</span>
        {/if}
      </div>

      <div class="flex flex-wrap gap-2 mt-4">
        {#if letter.pdfKey}
          <button
            class="btn btn-outline btn-sm"
            on:click={downloadPdf}
            disabled={pdfLoading}
          >
            {#if pdfLoading}
              <span class="loading loading-spinner loading-xs"></span>
            {/if}
            Download Original PDF
          </button>
        {/if}

        {#if $isAuthenticated}
          <a href="/letters/{letter.date}/edit" class="btn btn-primary btn-sm">
            Edit Letter
          </a>
        {/if}

        {#if $isAuthenticated && letter.versionCount > 0}
          <button
            class="btn btn-ghost btn-sm"
            on:click={toggleVersions}
          >
            {showVersions ? 'Hide' : 'Show'} Version History ({letter.versionCount})
          </button>
        {/if}
      </div>
    </header>

    {#if showVersions && $isAuthenticated}
      <div class="mb-8">
        <VersionHistory
          {versions}
          loading={versionsLoading}
          on:revert={handleRevert}
        />
      </div>
    {/if}

    <div class="prose max-w-none">
      {@html htmlContent}
    </div>

    <footer class="mt-8 pt-4 border-t">
      <a href="/letters" class="btn btn-ghost btn-sm">
        ← Back to all letters
      </a>
    </footer>
  </article>
{/if}
