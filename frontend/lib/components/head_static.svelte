<script lang='ts'>
  import Icon from '$lib/components/head_icon.svelte'
  import { head } from '$lib/config/general'
  import { post } from '$lib/config/post'
</script>

<svelte:head>
  {#if head.me}
    {#each head.me as href}
      <link {href} rel='me' />
    {/each}
  {/if}
  <!-- Force override any Netlify favicon -->
  <link rel='icon' href='/favicon.png' type='image/png'>
  <link rel='shortcut icon' href='/favicon.png' type='image/png'>
  <!-- Add this for Apple devices -->
  <link rel='apple-touch-icon' href='/favicon.png'>
</svelte:head>

<Icon />
