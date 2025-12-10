<script lang='ts'>
  import { goto } from '$app/navigation'
  import { authTokens, isAuthenticated } from '$lib/auth/auth-store'
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte'
  import { getLetter, type Letter, updateLetter } from '$lib/services/letters-service'
  import { onMount } from 'svelte'

  export let data: { date: string }

  let letter: Letter | null = null
  let content = ''
  let title = ''
  let saving = false
  let loading = true
  let error = ''

  async function loadLetter() {
    if (!$authTokens?.idToken) {
      loading = false
      return
    }

    try {
      letter = await getLetter(data.date, $authTokens.idToken)
      content = letter.content
      title = letter.title
    }
    catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load letter'
    }
    loading = false
  }

  async function handleSave(event: CustomEvent<{ content: string, title: string }>) {
    if (!$authTokens?.idToken || !letter)
      return

    saving = true
    error = ''

    try {
      await updateLetter(letter.date, event.detail.content, event.detail.title, $authTokens.idToken)
      goto(`/letters/${letter.date}`)
    }
    catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save changes'
      saving = false
    }
  }

  function handleCancel() {
    if (letter) {
      goto(`/letters/${letter.date}`)
    }
    else {
      goto('/letters')
    }
  }

  onMount(() => {
    loadLetter()
  })
</script>

{#if loading}
  <div class='container mx-auto p-4'>
    <div class='flex justify-center p-8'>
      <span class='loading loading-spinner loading-lg'></span>
    </div>
  </div>
{:else if !$isAuthenticated}
  <div class='container mx-auto p-4'>
    <div class='alert alert-warning mb-4'>
      <span>You must be logged in to edit letters.</span>
    </div>
    <a href='/auth/login' class='btn btn-primary'>Log In</a>
  </div>
{:else if letter}
  <div class='container mx-auto p-4'>
    <h1 class='text-2xl font-bold mb-4'>Edit Letter</h1>

    {#if error}
      <div class='alert alert-error mb-4'>
        <span>{error}</span>
      </div>
    {/if}

    <MarkdownEditor
      {content}
      {title}
      {saving}
      on:save={handleSave}
      on:cancel={handleCancel}
    />
  </div>
{:else}
  <div class='container mx-auto p-4'>
    <div class='alert alert-error mb-4'>
      <span>{error || 'Letter not found'}</span>
    </div>
    <a href='/letters' class='btn btn-link'>Back to letters</a>
  </div>
{/if}
