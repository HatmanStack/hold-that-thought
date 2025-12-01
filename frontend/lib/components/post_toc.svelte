<script context='module' lang='ts'>
  export const prerender = true
</script>

<script lang='ts'>
  import { onDestroy, onMount } from 'svelte'

  export let toc: Urara.Post.Toc[]

  let intersecting: string[] = []
  let intersectingArticle: boolean = true
  let bordered: string[] = []
  let headingsObserver: IntersectionObserver | undefined
  let articleObserver: IntersectionObserver | undefined

  onMount(() => {
    if (window.screen.availWidth >= 1280) {
      headingsObserver = new IntersectionObserver(
        headings =>
          headings.forEach(heading =>
            heading.isIntersecting
              ? intersecting.push(heading.target.id)
              : (intersecting = intersecting.filter(h => h !== heading.target.id)),
          ),
        { rootMargin: '-64px 0px 0px 0px' },
      )
      articleObserver = new IntersectionObserver(article => (intersectingArticle = article[0].isIntersecting))
      Array.from(document.querySelectorAll('main h2, main h3, main h4, main h5, main h6')).forEach(element =>
        headingsObserver?.observe(element),
      )
      articleObserver.observe(document.getElementsByTagName('main')[0])
    }
  })

  onDestroy(() => {
    headingsObserver?.disconnect()
    articleObserver?.disconnect()
  })

  $: if (intersecting.length > 0)
    bordered = intersecting
  $: if (intersectingArticle === false)
    bordered = []
  $: if (bordered) {
    toc.forEach(heading =>
      bordered.includes(heading.slug!)
        ? document.getElementById(`toc-link-${heading.slug}`)?.classList.add('!border-accent')
        : document.getElementById(`toc-link-${heading.slug}`)?.classList.remove('!border-accent'),
    )
  }
</script>

<aside class='sticky py-8 top-16'>
  <nav
    aria-label='TableOfContent'
    class='max-h-[calc(100vh-12rem)] overflow-y-hidden hover:overflow-y-auto'
    dir='rtl'
    id='post-toc'>
    <ul dir='ltr' id='toc-list-root'>
      {#each toc as { depth, slug, title }}
        <li class='flex flex-col' id={`toc-item-${slug}`}>
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <span
            class="border-transparent transition-all cursor-pointer border-l-4 hover:border-primary hover:bg-base-content hover:bg-opacity-10 active:bg-primary active:text-primary-content active:font-bold pr-4{depth
              <= 2
              ? 'py-3'
              : 'py-2'}"
            class:pl-4={depth <= 2}
            class:pl-8={depth === 3}
            class:pl-12={depth === 4}
            class:pl-16={depth === 5}
            class:pl-20={depth === 6}
            dir='ltr'
            id={`toc-link-${slug}`}
            role='button'
            tabindex='0'
            on:click={() =>
              // @ts-ignore Object is possibly 'null'. ts(2531)
              document.getElementById(slug).scrollIntoView({ behavior: 'smooth' })}>
            {title}
          </span>
        </li>
      {/each}
    </ul>
  </nav>
</aside>
