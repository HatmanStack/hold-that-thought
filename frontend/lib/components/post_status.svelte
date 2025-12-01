<script lang='ts'>
  import { date } from '$lib/config/general'

  export let post: Urara.Post
  export let preview: boolean = false

  const stringPublished = new Date(post.created).toLocaleString(date.locales, date.options)
  const stringUpdated = new Date(post.updated ?? post.created).toLocaleString(date.locales, date.options)
  const jsonPublished = new Date(post.created).toJSON()
  const jsonUpdated = new Date(post.updated ?? post.created).toJSON()

</script>

<div class='flex font-semibold gap-1.5' class:md:mb-4={!preview && post.type !== 'article'}>

  <a
    class='opacity-75 hover:text-primary duration-500 ease-in-out p-author h-card hover:opacity-100'
    class:hidden={preview}
    href='/'
    rel='author'>
    {post.published}
  </a>
  <span class='opacity-50' class:hidden={preview}>/</span>
  <a class='u-url u-uid swap group/time' href={post.path}>
    <time
      class='font-semibold opacity-75 duration-500 ease-in-out mr-auto group-hover/time:opacity-0 dt-published'
      datetime={jsonPublished}
      itemprop='datePublished'>
      {stringPublished}
    </time>
    <time
      class='font-semibold text-primary duration-500 ease-in-out mr-auto opacity-0 group-hover/time:opacity-100 dt-updated'
      datetime={jsonUpdated}
      itemprop='dateModified'>
      {stringUpdated}
    </time>
  </a>
</div>
