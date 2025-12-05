<script lang="ts">
  import { onMount } from 'svelte'
  import { listLetters, type LetterListItem } from '$lib/services/letters-service'
  import { isAuthenticated, authTokens } from '$lib/auth/auth-store'

  let letters: LetterListItem[] = []
  let nextCursor: string | null = null
  let loading = true
  let loadingMore = false
  let error = ''

  function formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  async function loadLetters() {
    if (!$authTokens?.accessToken) {
      loading = false
      return
    }

    try {
      const result = await listLetters($authTokens.accessToken, 50)
      letters = result.items
      nextCursor = result.nextCursor
    }
    catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load letters'
    }
    loading = false
  }

  async function loadMore() {
    if (!nextCursor || loadingMore || !$authTokens?.accessToken)
      return

    loadingMore = true
    try {
      const result = await listLetters($authTokens.accessToken, 50, nextCursor)
      letters = [...letters, ...result.items]
      nextCursor = result.nextCursor
    }
    catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load more letters'
    }
    loadingMore = false
  }

  onMount(() => {
    loadLetters()
  })

  // Reload when auth state changes
  $: if ($isAuthenticated && $authTokens?.accessToken && letters.length === 0 && !loading) {
    loadLetters()
  }
</script>

<div class="container mx-auto p-4 max-w-4xl">
  <h1 class="text-3xl font-bold mb-6">Family Letters</h1>

  {#if loading}
    <div class="flex justify-center p-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if !$isAuthenticated}
    <div class="alert alert-warning">
      <span>Please log in to view the family letters.</span>
    </div>
  {:else if error}
    <div class="alert alert-error mb-4">
      <span>{error}</span>
    </div>
  {:else if letters.length === 0}
    <div class="text-center text-gray-500 p-8">
      <p>No letters found.</p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each letters as letter}
        <a
          href="/letters/{letter.date}"
          class="block p-4 border rounded-lg hover:bg-base-200 transition-colors"
        >
          <div class="flex justify-between items-start">
            <h2 class="text-xl font-medium">{letter.title}</h2>
            <span class="text-sm text-gray-500 whitespace-nowrap ml-4">
              {formatDate(letter.date)}
            </span>
          </div>
          {#if letter.originalTitle && letter.originalTitle !== letter.title}
            <p class="text-sm text-gray-400 mt-1">
              Originally: {letter.originalTitle}
            </p>
          {/if}
        </a>
      {/each}
    </div>

    {#if nextCursor}
      <div class="flex justify-center mt-6">
        <button
          class="btn btn-primary"
          on:click={loadMore}
          disabled={loadingMore}
        >
          {#if loadingMore}
            <span class="loading loading-spinner loading-sm"></span>
            Loading...
          {:else}
            Load More
          {/if}
        </button>
      </div>
    {/if}
  {/if}
</div>
