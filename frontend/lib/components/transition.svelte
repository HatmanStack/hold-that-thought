<script lang='ts'>
  import { fly } from 'svelte/transition'
  import { onMount } from 'svelte'

  export let path: string = ''

  $: console.log('[Transition] path changed to:', path)

  function handleIntroStart() {
    console.log('[Transition] in:fly START for path:', path)
  }

  function handleIntroEnd() {
    console.log('[Transition] in:fly END for path:', path)
  }

  function handleOutroStart() {
    console.log('[Transition] out:fly START for path:', path)
  }

  function handleOutroEnd() {
    console.log('[Transition] out:fly END for path:', path)
  }
</script>

{#key path}
  <div
    class='bg-base-100 min-h-screen md:bg-base-200 pt-16 md:pb-8 lg:pb-16'
    in:fly={{ delay: 300, duration: 300, y: 100 }}
    out:fly={{ duration: 300, y: -100 }}
    on:introstart={handleIntroStart}
    on:introend={handleIntroEnd}
    on:outrostart={handleOutroStart}
    on:outroend={handleOutroEnd}>
    <slot />
  </div>
{/key}
