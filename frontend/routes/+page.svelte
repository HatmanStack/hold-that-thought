<script lang='ts'>
  import { browser } from '$app/environment'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import Footer from '$lib/components/footer.svelte'
  import Head from '$lib/components/head.svelte'
  import Profile from '$lib/components/index_profile.svelte'
  import Post from '$lib/components/post_card.svelte'
  import { posts as storedPosts, tags as storedTags } from '$lib/stores/posts'
  import { title as storedTitle } from '$lib/stores/title'
  import { isAuthenticated, authLoading } from '$lib/auth/auth-store'
  import { onMount } from 'svelte'
  import { fly } from 'svelte/transition'
  import { addLetterLambda } from '$lib/utils/s3Client'
  import { tick } from 'svelte';

  let allPosts: Urara.Post[]
  let allTags: string[]
  let loaded: boolean
  let [posts, tags, years]: [Urara.Post[], string[], number[]] = [[], [], []]
  let isProcessing = false
  let fileInput: HTMLInputElement;
  let cognitoConfigured = false
  let developmentMode = false
  
  // Pagination variables
  let displayedPosts: Urara.Post[] = []
  let currentPage = 0
  let postsPerPage = 10
  let isLoadingMore = false
  let hasMorePosts = true

  storedTitle.set('')

  $: storedPosts.subscribe(storedPosts => (allPosts = storedPosts.filter(post => !post.flags?.includes('unlisted'))))

  $: storedTags.subscribe(storedTags => (allTags = storedTags as string[]))

  $: if (posts.length > 1)
    years = [new Date(posts[0].created).getFullYear()]

  $: if (tags) {
    posts = !tags ? allPosts : allPosts.filter(post => tags.every(tag => post.tags?.includes(tag)))
    if (browser && window.location.pathname === '/')
      goto(tags.length > 0 ? `?tags=${tags.toString()}` : `/`, { replaceState: true })
    
    // Reset pagination when tags change
    resetPagination()
  }

  // Reset pagination and load first batch
  function resetPagination() {
    currentPage = 0
    displayedPosts = []
    hasMorePosts = true
    loadMorePosts()
  }

  // Load more posts (10 at a time)
  function loadMorePosts() {
    if (isLoadingMore || !hasMorePosts) return
    
    isLoadingMore = true
    
    // Simulate a small delay for better UX
    setTimeout(() => {
      const startIndex = currentPage * postsPerPage
      const endIndex = startIndex + postsPerPage
      const newPosts = posts.slice(startIndex, endIndex)
      
      if (newPosts.length === 0) {
        hasMorePosts = false
      } else {
        displayedPosts = [...displayedPosts, ...newPosts]
        currentPage++
        hasMorePosts = endIndex < posts.length
      }
      
      isLoadingMore = false
    }, 300)
  }

  // Watch for posts changes and reset pagination
  $: if (posts && posts.length > 0 && displayedPosts.length === 0) {
    resetPagination()
  }

async function addLetter() {
  if (isProcessing) return;
  
  // Create a file input element if it doesn't exist yet
  if (!fileInput && browser) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*,.pdf';
    
    fileInput.onchange = async (e) => {
      const files = fileInput.files;
      if (!files || files.length === 0) {
        isProcessing = false;
        return;
      }
      
      isProcessing = true;
      
      try {
        // Convert FileList to Array
        const filesArray = Array.from(files);
        
        console.log(`Processing batch of ${filesArray.length} files`);
        filesArray.forEach(file => {
          console.log(`- ${file.name} (${Math.round(file.size / 1024)} KB)`);
        });
        
        // Send ALL files to addLetterLambda at once as an array
        const result = await addLetterLambda(filesArray);
        
        // Inform user of results
        alert(result)
        
      } catch (error) {
        console.error('Error in file upload process:', error);
        alert(`Error: ${error.message}`);
      } finally {
        isProcessing = false;
        alert(`Successfully processed file!`);
        // Reset the file input value so the same files can be selected again if needed
        fileInput.value = '';
      }
    };
    
    // Append to body to ensure it works in all browsers, but hide it
    document.body.appendChild(fileInput);
    fileInput.style.display = 'none';
  }
  
  // Trigger the file selection dialog
  if (fileInput) {
    fileInput.click();
  }
}

  onMount(() => {
    if (browser) {
      // Check if Cognito is configured
      import('$lib/auth/cognito-config').then(({ isCognitoConfigured }) => {
        cognitoConfigured = isCognitoConfigured()
        
        if (!cognitoConfigured) {
          // Cognito not configured - show content without authentication
          console.warn('⚠️  Cognito not configured - running in development mode')
          developmentMode = true
          if ($page.url.searchParams.get('tags'))
            tags = $page.url.searchParams.get('tags')?.split(',') ?? []
          loaded = true
          return
        }
        
        // Cognito is configured - check authentication and approval
        const unsubscribe = isAuthenticated.subscribe(authenticated => {
          if (!$authLoading && !authenticated) {
            goto('/auth/login')
            return
          }
          
          // Check if user is authenticated and approved
          if (authenticated) {
            // Check user's groups from the auth store
            import('$lib/auth/auth-store').then(({ currentUser }) => {
              const userUnsubscribe = currentUser.subscribe(user => {
                if (user) {
                  const isApproved = user['cognito:groups']?.includes('ApprovedUsers') || false
                  
                  if (!isApproved) {
                    // User is authenticated but not approved
                    goto('/auth/pending-approval')
                    return
                  }
                  
                  // User is approved - load content
                  if ($page.url.searchParams.get('tags'))
                    tags = $page.url.searchParams.get('tags')?.split(',') ?? []
                  loaded = true
                }
              })
              
              return userUnsubscribe
            })
          }
        })

        return unsubscribe
      })
    }
  })
</script>

<Head />

{#if $authLoading && cognitoConfigured}
  <div class="flex items-center justify-center min-h-screen">
    <div class="loading loading-spinner loading-lg"></div>
  </div>
{:else if $isAuthenticated || developmentMode}
  <!-- Show development mode banner if Cognito isn't configured -->
  {#if developmentMode}
    <div class="alert alert-warning mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <div>
        <h3 class="font-bold">Development Mode</h3>
        <div class="text-sm">Cognito authentication not configured. Visit <a href="/auth-status" class="link">auth status</a> for setup instructions.</div>
      </div>
    </div>
  {/if}
  
  <div class='flex flex-col flex-nowrap justify-center xl:flex-row xl:flex-wrap h-feed'>
 

  <div
    class='flex-1 w-full max-w-screen-md order-first mx-auto xl:mr-0 xl:ml-8 xl:max-w-md'
    in:fly={{ delay: 500, duration: 300, x: 25 }}
    out:fly={{ duration: 300, x: 25 }}>
    <Profile />
  </div>
  <div
    class='flex-1 w-full max-w-screen-md xl:order-last mx-auto xl:ml-0 xl:mr-8 xl:max-w-md'
    in:fly={{ delay: 500, duration: 300, x: -25 }}
    out:fly={{ duration: 300, x: -25 }}>
    {#if allTags && Object.keys(allTags).length > 0}
    <div class='flex justify-end px-8 pt-4'>
      <button 
        class='btn btn-sm btn-ghost gap-1'
        class:hidden={tags.length === 0}
        on:click={() => tags = []}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Clear Tags
      </button>
    </div>
      <div
        class='flex xl:flex-wrap gap-2 overflow-x-auto xl:overflow-x-hidden overflow-y-hidden max-h-24 my-auto xl:max-h-fit max-w-fit xl:max-w-full pl-8 md:px-0 xl:pl-8 xl:pt-8'>
        {#each allTags as tag}
          <button
            class='btn btn-sm btn-ghost normal-case border-dotted border-base-content/20 border-2 mt-4 mb-8 xl:m-0'
            class:!btn-secondary={tags.includes(tag)}
            class:shadow-lg={tags.includes(tag)}
            id={tag}
            on:click={() => (tags.includes(tag) ? (tags = tags.filter(tagName => tagName != tag)) : (tags = [...tags, tag]))}>
            #{tag}
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <div class='flex-none w-full max-w-screen-md mx-auto xl:mx-0'>
   <!-- <div 
    class='flex justify-center mb-4'
    in:fly={{ delay: 500, duration: 300, y: -25 }}
    out:fly={{ duration: 300, y: -25 }}>
    <button 
      class='btn btn-secondary gap-2' 
      on:click={addLetter}
      disabled={isProcessing}>
      {#if isProcessing}
        <span class="loading loading-spinner loading-xs"></span>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      {/if}
      Add Letter
    </button>
  </div> -->

    {#key posts}
      <!-- {:else} is not used because there is a problem with the transition -->
      {#if loaded && posts.length === 0}
        <div
          class='bg-base-300 text-base-content shadow-inner text-center md:rounded-box p-10 -mb-2 md:mb-0 relative z-10'
          in:fly={{ delay: 500, duration: 300, x: 100 }}
          out:fly={{ duration: 300, x: -100 }}>
          <div class='prose items-center'>
            <h2>
              Not found: [{#each tags as tag, i}
                '{tag}'{#if i + 1 < tags.length},{/if}
              {/each}]
            </h2>
            <button class='btn btn-secondary' on:click={() => (tags = [])}>
              <span class='i-heroicons-outline-trash mr-2' />
              tags = []
            </button>
          </div>
        </div>
      {/if}
      <main
        class='flex flex-col relative bg-base-100 md:bg-transparent md:gap-8 z-10'
        itemprop='mainEntityOfPage'
        itemscope
        itemtype='https://schema.org/Blog'>
        {#each displayedPosts as post, index}
          {@const year = new Date(post.created).getFullYear()}
          {#if !years.includes(year)}
            <div
              class='divider my-4 md:my-0'
              in:fly={{ delay: 500, duration: 300, x: index % 2 ? 100 : -100 }}
              out:fly={{ duration: 300, x: index % 2 ? -100 : 100 }}>
              {years.push(year) && year}
            </div>
          {/if}
          <div
            class='rounded-box transition-all duration-500 ease-in-out hover:z-30 hover:shadow-lg md:shadow-xl md:hover:shadow-2xl md:hover:-translate-y-0.5'
            in:fly={{ delay: 500, duration: 300, x: index % 2 ? 100 : -100 }}
            out:fly={{ duration: 300, x: index % 2 ? -100 : 100 }}>
            <Post decoding={index < 5 ? 'auto' : 'async'} loading={index < 5 ? 'eager' : 'lazy'} {post} preview={true} />
          </div>
        {/each}
      </main>
      
      <!-- Load More Button -->
      {#if loaded && displayedPosts.length > 0 && hasMorePosts}
        <div class="flex justify-center my-8">
          <button 
            class="btn btn-primary btn-lg gap-2"
            class:loading={isLoadingMore}
            disabled={isLoadingMore}
            on:click={loadMorePosts}
          >
            {#if isLoadingMore}
              <span class="loading loading-spinner loading-sm"></span>
              Loading...
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              Load More Letters
            {/if}
          </button>
        </div>
      {/if}
      
      <!-- End of Posts Message -->
      {#if loaded && displayedPosts.length > 0 && !hasMorePosts}
        <div class="text-center my-8 p-6 bg-base-200 rounded-lg">
          <div class="text-base-content/60">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="font-medium">You've reached the end!</p>
            <p class="text-sm mt-1">All {posts.length} letters have been loaded.</p>
          </div>
        </div>
      {/if}
      
      <div
        class='sticky bottom-0 md:static md:mt-8'
        class:hidden={!loaded}
        in:fly={{ delay: 500, duration: 300, x: posts.length + (1 % 2) ? 100 : -100 }}
        out:fly={{ duration: 300, x: posts.length + (1 % 2) ? -100 : 100 }}>
        <div class='divider mt-0 mb-8 hidden lg:flex' />
        <Footer />
      </div>
    {/key}
  </div>
  </div>
{:else}
  <!-- This should not show due to redirect, but just in case -->
  <div class="flex items-center justify-center min-h-screen">
    <div class="loading loading-spinner loading-lg"></div>
  </div>
{/if}
