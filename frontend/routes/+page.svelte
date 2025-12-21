<script lang='ts'>
  import { browser } from '$app/environment'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { authLoading, isAuthenticated } from '$lib/auth/auth-store'
  import Footer from '$lib/components/footer.svelte'
  import Head from '$lib/components/head.svelte'
  import Post from '$lib/components/post_card.svelte'
  import { posts as storedPosts } from '$lib/stores/posts'
  import { title as storedTitle } from '$lib/stores/title'
  import { addLetterLambda } from '$lib/utils/s3Client'
  import { onMount, tick } from 'svelte'
  import { fly } from 'svelte/transition'
  import { PUBLIC_RAGSTACK_CHAT_URL } from '$env/static/public'

  let allPosts: Urara.Post[]
  let loaded: boolean
  let [posts, tags, years]: [Urara.Post[], string[], number[]] = [[], [], []]
  let isProcessing = false
  let fileInput: HTMLInputElement
  let cognitoConfigured = false
  let developmentMode = false

  // Pagination variables
  let displayedPosts: Urara.Post[] = []
  let currentPage = 0
  const postsPerPage = 10
  let isLoadingMore = false
  let hasMorePosts = true

  storedTitle.set('')

  $: storedPosts.subscribe(storedPosts => (allPosts = storedPosts.filter(post => !post.flags?.includes('unlisted'))))

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
  async function loadMorePosts() {
    if (isLoadingMore || !hasMorePosts)
      return

    isLoadingMore = true

    // Wait for DOM to update so in:fly animations trigger
    await tick()

    const startIndex = currentPage * postsPerPage
    const endIndex = startIndex + postsPerPage
    const newPosts = posts.slice(startIndex, endIndex)

    if (newPosts.length === 0) {
      hasMorePosts = false
    }
    else {
      displayedPosts = [...displayedPosts, ...newPosts]
      currentPage++
      hasMorePosts = endIndex < posts.length
    }

    isLoadingMore = false
  }

  // Watch for posts changes and reset pagination
  $: if (posts && posts.length > 0 && displayedPosts.length === 0) {
    resetPagination()
  }

  async function addLetter() {
    if (isProcessing)
      return

    // Create a file input element if it doesn't exist yet
    if (!fileInput && browser) {
      fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.multiple = true
      fileInput.accept = 'image/*,.pdf'

      fileInput.onchange = async (e) => {
        const files = fileInput.files
        if (!files || files.length === 0) {
          isProcessing = false
          return
        }

        isProcessing = true

        try {
          // Convert FileList to Array
          const filesArray = Array.from(files)

          console.log(`Processing batch of ${filesArray.length} files`)
          filesArray.forEach((file) => {
            console.log(`- ${file.name} (${Math.round(file.size / 1024)} KB)`)
          })

          // Send ALL files to addLetterLambda at once as an array
          const result = await addLetterLambda(filesArray)

          // Inform user of results
          alert(result)
        }
        catch (error) {
          console.error('Error in file upload process:', error)
          const message = error instanceof Error ? error.message : 'Unknown error'
          alert(`Error: ${message}`)
        }
        finally {
          isProcessing = false
          alert(`Successfully processed file!`)
          // Reset the file input value so the same files can be selected again if needed
          fileInput.value = ''
        }
      }

      // Append to body to ensure it works in all browsers, but hide it
      document.body.appendChild(fileInput)
      fileInput.style.display = 'none'
    }

    // Trigger the file selection dialog
    if (fileInput) {
      fileInput.click()
    }
  }

  onMount(() => {
    if (browser) {
      // Load ragstack chat widget
      if (PUBLIC_RAGSTACK_CHAT_URL) {
        const script = document.createElement('script')
        script.src = PUBLIC_RAGSTACK_CHAT_URL
        script.onload = () => {
          const container = document.getElementById('ragstack-chat-container')
          if (container) {
            const chat = document.createElement('ragstack-chat')
            chat.setAttribute('conversation-id', 'hold-that-thought')
            chat.setAttribute('header-text', 'Family Chat')
            chat.setAttribute('header-subtitle', ' ')
            container.appendChild(chat)
          }
        }
        document.head.appendChild(script)
      }
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
        const unsubscribe = isAuthenticated.subscribe((authenticated) => {
          if (!$authLoading && !authenticated) {
            goto('/auth/login')
            return
          }

          // Check if user is authenticated and approved
          if (authenticated) {
            // Check user's groups from the auth store
            import('$lib/auth/auth-store').then(({ currentUser }) => {
              const userUnsubscribe = currentUser.subscribe((user) => {
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
  <div class='flex items-center justify-center min-h-screen'>
    <div class='loading loading-spinner loading-lg'></div>
  </div>
{:else if $isAuthenticated || developmentMode}
  <!-- Show development mode banner if Cognito isn't configured -->
  {#if developmentMode}
    <div class='alert mb-4 alert-warning'>
      <svg xmlns='http://www.w3.org/2000/svg' class='stroke-current shrink-0 h-6 w-6' fill='none' viewBox='0 0 24 24'>
        <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z' />
      </svg>
      <div>
        <h3 class='font-bold'>Development Mode</h3>
        <div class='text-sm'>Cognito authentication not configured. Visit <a href='/auth-status' class='link'>auth status</a> for setup instructions.</div>
      </div>
    </div>
  {/if}

  <div class='flex flex-col flex-nowrap justify-center xl:flex-row xl:flex-wrap h-feed'>

    <div id='ragstack-chat-container' class='w-full max-w-screen-md mx-auto my-4'></div>
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
        <main
          class='flex flex-col relative bg-base-100 z-10 md:bg-transparent md:gap-8'
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
              class='rounded-box transition-all duration-500 ease-in-out md:shadow-xl hover:z-30 hover:shadow-lg md:hover:shadow-2xl md:hover:-translate-y-0.5'
              in:fly={{ delay: 500, duration: 300, x: index % 2 ? 100 : -100 }}
              out:fly={{ duration: 300, x: index % 2 ? -100 : 100 }}>
              <Post decoding={index < 5 ? 'auto' : 'async'} loading={index < 5 ? 'eager' : 'lazy'} {post} preview={true} />
            </div>
          {/each}
        </main>

        <!-- Load More Button -->
        {#if loaded && displayedPosts.length > 0 && hasMorePosts}
          <div class='flex justify-center my-8'>
            <button
              class='btn btn-primary btn-lg gap-2'
              class:loading={isLoadingMore}
              disabled={isLoadingMore}
              on:click={loadMorePosts}
            >
              {#if isLoadingMore}
                <span class='loading loading-spinner loading-sm'></span>
                Loading...
              {:else}
                <svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                  <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 14l-7 7m0 0l-7-7m7 7V3' />
                </svg>
                Load More Letters
              {/if}
            </button>
          </div>
        {/if}

        <!-- End of Posts Message -->
        {#if loaded && displayedPosts.length > 0 && !hasMorePosts}
          <div class='text-center my-8 bg-base-200 rounded-lg p-6'>
            <div class='text-base-content/60'>
              <svg xmlns='http://www.w3.org/2000/svg' class='h-8 w-8 mx-auto mb-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />
              </svg>
              <p class='font-medium'>You've reached the end!</p>
              <p class='text-sm mt-1'>All {posts.length} letters have been loaded.</p>
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
  <div class='flex items-center justify-center min-h-screen'>
    <div class='loading loading-spinner loading-lg'></div>
  </div>
{/if}
