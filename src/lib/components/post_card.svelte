<script lang='ts'>
  import { browser } from '$app/environment'
  import Comment from '$lib/components/post_comment.svelte'
  import Pagination from '$lib/components/post_pagination.svelte'
  import Reply from '$lib/components/post_reply.svelte'
  import Status from '$lib/components/post_status.svelte'
  import Image from '$lib/components/prose/img.svelte'
  import MarkdownEditorModal from '$lib/components/post_editor.svelte'
  import { post as postConfig } from '$lib/config/post'
  import { posts as storedPosts } from '$lib/stores/posts'
  import { title as storedTitle } from '$lib/stores/title'
  import { downloadSourcePdf } from '$lib/utils/s3Client'
  import { getMarkdownContent, saveMarkdownContent } from '$lib/services/markdown'

  let isDownloading = false;
  let isModifying = false;
  let isEditorOpen = false;
  let markdownContent = '';
  export let post: Urara.Post
  export let preview: boolean = false
  export let loading: 'eager' | 'lazy' = 'lazy'
  export let decoding: 'async' | 'auto' | 'sync' = 'async'
  // pagination
  let index: number
  let prev: undefined | Urara.Post
  let next: undefined | Urara.Post
  if (browser && !preview) {
    storedPosts.subscribe((storedPosts: Urara.Post[]) => {
      index = storedPosts.findIndex(storedPost => storedPost.path === post.path)
      prev = storedPosts
        .slice(0, index)
        .reverse()
        .find(post => !post.flags?.includes('unlisted'))
      next = storedPosts.slice(index + 1).find(post => !post.flags?.includes('unlisted'))
      storedTitle.set(post.title ?? post.path.slice(1))
    })
  }

  async function openMarkdownEditor() {
    isModifying = true;
    try {
      if (post.path) {
        console.log('Opening editor for path:', post.path);
        // Load the original markdown content
        markdownContent = await getMarkdownContent(post.path);
        console.log('Loaded content length:', markdownContent?.length);
        if (!markdownContent) {
          throw new Error('Failed to load content');
        }
        isEditorOpen = true;
      }
    } catch (error) {
      console.error('Error loading markdown content:', error);
      alert('Failed to load content: ' + error.message);
    } finally {
      isModifying = false;
    }
  }

  async function handleSave(event) {
    isModifying = true;
    try {
      const updatedContent = event.detail;
      if (!updatedContent) {
        throw new Error('No content to save');
      }
      
      console.log('Saving content for path:', post.path);
      console.log('Content length:', updatedContent.length);
      console.log('Content preview:', updatedContent.substring(0, 100) + '...');
      
      const success = await saveMarkdownContent(post.path, updatedContent);
      
      if (success) {
        console.log('Save successful, reloading page');
        window.location.reload();
      } else {
        throw new Error('Save returned false');
      }
    } catch (error) {
      console.error('Error saving markdown content:', error);
      alert('Failed to save content: ' + error.message);
    } finally {
      isModifying = false;
    }
  }
</script>

<svelte:element
  class='h-entry card bg-base-100 rounded-none md:rounded-box md:shadow-xl overflow-hidden z-10'
  class:before:!rounded-none={preview && post.image}
  class:group={preview}
  class:image-full={preview && post.type === 'article' && post.image}
  class:lg:mb-16={!preview}
  class:md:mb-8={!preview}
  itemprop='blogPost'
  itemscope
  itemtype='https://schema.org/BlogPosting'
  this={post.type === 'article' ? 'article' : 'div'}>
  {#if !preview && postConfig.bridgy}
    <div class='hidden' id='bridgy'>
      {#each post.flags?.some(flag => flag.startsWith('bridgy')) ? post.flags.flatMap(flag => (flag.startsWith('bridgy') ? flag.slice(7) : [])) : [...(postConfig.bridgy.post ?? []), ...(postConfig.bridgy[post.type] ?? [])] as target}
        {#if target === 'fed'}
          <a href='https://fed.brid.gy/'>fed</a>
        {:else}
          <a href='https://brid.gy/publish/{target}'>{target}</a>
        {/if}
      {/each}
    </div>
  {/if}
  {#if post.in_reply_to}
    <Reply class='mt-4 mx-4' in_reply_to={post.in_reply_to} />
  {/if}
  {#if post.image && preview}
    <figure class='!block'>
      <Image
        alt={post.alt ?? post.image}
        class={post.type === 'article'
          ? 'u-featured object-center h-full w-full absolute group-hover:scale-105 transition-transform duration-500 ease-in-out'
          : 'u-photo rounded-xl md:rounded-b-none -mb-6 md:-mb-2'}
        {decoding}
        {loading}
        src={post.image} />
    </figure>
  {/if}
  <div
    class={`card-body gap-0 ${
      preview && post.type === 'article' && post.image ? 'md:col-start-1 md:row-start-1 md:text-neutral-content md:z-20' : ''
    }`}>
    <div class='flex flex-col gap-2'>
      {#if post.image && !preview}
        <figure
          class={`md:order-last rounded-box shadow-xl mb-4 ${
            post.type === 'article' ? 'flex-col gap-2 -mx-4 -mt-8 md:mt-0' : 'flex-col -mx-8'
          }`}>
          <Image
            alt={post.alt ?? post.image}
            class={`${post.type === 'article' ? 'u-featured' : 'u-photo'}`}
            {decoding}
            {loading}
            src={post.image} />
        </figure>
      {/if}
      <Status {post} {preview} />
      {#if post.title}
        {#if preview}
          <h2
            class='card-title text-3xl mr-auto bg-[length:100%_0%] bg-[position:0_88%] underline decoration-4 decoration-transparent group-hover:decoration-primary hover:bg-[length:100%_100%] hover:text-primary-content bg-gradient-to-t from-primary to-primary bg-no-repeat transition-all ease-in-out duration-300'
            itemprop='name headline'>
            <a class='u-url p-name' href={post.path} itemprop='url'>{post.title ?? post.path.slice(1)}</a>
          </h2>
        {:else}
          <h1 class='card-title text-3xl mb-8 p-name' itemprop='name headline'>{post.title ?? post.path.slice(1)}</h1>
        {/if}
      {/if}
      {#if post.published && preview}
        <span class="p-author" itemprop="author">{post.published}</span>

      {/if}
    </div>
    <main class='urara-prose prose e-content' class:mt-4={post.type !== 'article'} itemprop='articleBody'>
      {#if !preview}
        <slot />
      {:else if post.html}
        {@html post.html}
      {/if}
    </main>
    {#if !preview && post.tags}
      <div class='divider mt-4 mb-0' />
      <div>
        {#each post.tags as tag}
          <a class='btn btn-sm btn-ghost normal-case mt-2 mr-2 p-category' href='/?tags={tag}'>
            #{tag}
          </a>
        {/each}
      </div>
    {/if}
    {#if !preview && post.title}
      <div class='divider mt-4 mb-0' />
      <div class="mt-2 mb-4 flex flex-wrap items-center"> 
        
        <button
          class='btn btn-sm btn-outline gap-2'
          disabled={isDownloading || isModifying} 
          on:click={async () => {
            isDownloading = true;
            try {
              await downloadSourcePdf();
            } catch (error) {
              console.error('Download failed:', error);
              alert(`Download failed: ${error.message}`);
            } finally {
              isDownloading = false;
            }
          }}>
          {#if isDownloading}
            <span class="loading loading-spinner loading-xs"></span>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          {/if}
          Download Original Letter
        </button>

        
       <button
          class='btn btn-sm btn-outline gap-2 ml-2' 
          disabled={isDownloading || isModifying} 
          on:click={openMarkdownEditor}>
          {#if isModifying}
            <span class="loading loading-spinner loading-xs"></span>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          {/if}
          Modify Letter
        </button>
      </div>
    {/if}
    <MarkdownEditorModal 
      bind:isOpen={isEditorOpen}
      content={markdownContent}
      title={`Edit: ${post.title || post.path}`}
      on:save={handleSave}
      on:close={() => isEditorOpen = false}
    />
  </div>
  {#if !preview}
    {#if (prev || next) && !post.flags?.includes('pagination-disabled') && !post.flags?.includes('unlisted')}
      <Pagination {next} {prev} />
    {/if}
    {#if browser && postConfig.comment && !post.flags?.includes('comment-disabled')}
      <Comment config={postConfig.comment} {post} />
    {/if}
  {/if}
</svelte:element>
