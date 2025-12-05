<script lang='ts'>
  import type { LetterVersion } from '$lib/services/letters-service'
  import { createEventDispatcher } from 'svelte'

  export let versions: LetterVersion[] = []
  export let loading: boolean = false

  const dispatch = createEventDispatcher<{
    revert: { timestamp: string }
  }>()

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  function handleRevert(version: LetterVersion) {
    if (confirm(`Revert to version from ${formatDate(version.editedAt)}?\n\nThis will create a new version with the current content before reverting.`)) {
      dispatch('revert', { timestamp: version.timestamp })
    }
  }
</script>

<div class='bg-base-200 rounded-lg p-4'>
  <h3 class='text-lg font-semibold mb-4'>Version History</h3>

  {#if loading}
    <div class='flex items-center gap-2 text-gray-500'>
      <span class='loading loading-spinner loading-sm'></span>
      <span>Loading versions...</span>
    </div>
  {:else if versions.length === 0}
    <p class='text-gray-500'>No previous versions</p>
  {:else}
    <ul class='space-y-2'>
      {#each versions as version}
        <li class='flex justify-between items-center p-3 bg-base-100 rounded-lg'>
          <div>
            <span class='font-medium'>Version {version.versionNumber}</span>
            <span class='text-sm text-gray-500 ml-2'>
              {formatDate(version.editedAt)}
            </span>
          </div>
          <button
            class='btn btn-sm btn-outline'
            on:click={() => handleRevert(version)}
          >
            Revert
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
