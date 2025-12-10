<script lang='ts'>
  import { browser } from '$app/environment'
  import Footer from '$lib/components/footer.svelte'
  import Head from '$lib/components/head.svelte'
  import Action from '$lib/components/post_action.svelte'
  import Card from '$lib/components/post_card.svelte'
  import Toc from '$lib/components/post_toc.svelte'
  import { fly } from 'svelte/transition'

  export let post: Urara.Post
</script>

<Head {post} />

<div class='flex flex-col flex-nowrap justify-center xl:flex-row xl:flex-wrap'>
  <div
    class='flex-1 w-full mx-auto order-first ease-out transform xl:mr-0 xl:ml-0'
    in:fly={{ delay: 500, duration: 300, x: 25 }}
    out:fly={{ duration: 300, x: 25 }}>
    {#if browser}
      <Action {post} />
    {/if}
  </div>
  <div
    class='flex-1 w-full ease-out transform mx-auto xl:ml-0 xl:mr-0 xl:order-last'
    in:fly={{ delay: 500, duration: 300, x: -25 }}
    out:fly={{ duration: 300, x: -25 }}>
    {#if browser && post.toc}
      <div class='h-full hidden xl:block'>
        <Toc toc={post.toc} />
      </div>
    {/if}
  </div>
  <div class='w-full mx-auto flex-none max-w-screen-md xl:mx-0'>
    <Card {post}>
      <slot />
    </Card>
    <Footer sticky={true} />
  </div>
</div>
