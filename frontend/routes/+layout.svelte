<script lang='ts'>
  import type { LayoutData } from './$types'
  import { browser, dev } from '$app/environment'
  import { authStore } from '$lib/auth/auth-store'
  import Head from '$lib/components/head_static.svelte'
  import Header from '$lib/components/header.svelte'
  import Transition from '$lib/components/transition.svelte'
  import { posts, tags } from '$lib/stores/posts'
  import { genTags } from '$lib/utils/posts'
  import { onMount } from 'svelte'
  import { registerSW } from 'virtual:pwa-register'

  import '../app.pcss'

  export let data: LayoutData
  export let params: unknown = undefined
  void params

  let { path, res } = data

  $: if (data)
    path = data.path

  posts.set(res)
  tags.set(genTags(res))
  onMount(
    () => {
      // Initialize authentication state
      if (browser) {
        authStore.init()
      }

      // Register service worker
      !dev
      && browser
        && registerSW({
          immediate: true,
          onRegistered: r => r && setInterval(async () => await r.update(), 198964),
          onRegisterError: error => console.error(error),
        })
    },
  )
</script>

<Head />

<Header {path} />

<Transition {path}>
  <slot />
</Transition>
