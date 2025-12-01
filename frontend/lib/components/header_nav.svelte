<script lang='ts'>
  import { currentUser, isAuthenticated } from '$lib/auth/auth-store'

  export let nav: { children?: { link: string, text: string }[], link?: string, text: string }[]
  export let path: string
  export let title: string
  export let scrollY: number
  export let pin: boolean

  // Check if user is approved (in ApprovedUsers group)
  $: isUserApproved = $isAuthenticated && $currentUser
    && ($currentUser['cognito:groups']?.includes('ApprovedUsers') || false)
</script>

<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<!-- reference: https://github.com/saadeghi/daisyui/issues/1285 -->
<div class='dropdown lg:hidden'>
  <label class='btn btn-square btn-ghost' for='navbar-dropdown' tabindex='0'>
    <span class='i-heroicons-outline-menu-alt-1' />
  </label>
  <ul
    class='menu dropdown-content bg-base-100 text-base-content rounded-box p-2 menu-compact shadow-lg min-w-max max-w-52'
    class:hidden={!pin}
    id='navbar-dropdown'
    tabindex='0'>
    <!-- Main navigation links -->
    <li>
      <a class:font-bold={path === '/'} href='/'>Home</a>
    </li>
    <li>
      <a class:font-bold={path === '/about'} href='/about'>About</a>
    </li>
    {#if isUserApproved}
      <li>
        <a class:font-bold={path === '/gallery'} href='/gallery'>Gallery</a>
      </li>
    {/if}
    <div class='divider my-1'></div>
    <!-- Original nav items -->
    {#each nav as { children, link, text }}
      {#if link && !children}
        <li>
          <a class:font-bold={link === path} href={link}>{text}</a>
        </li>
      {:else if children}
        <li tabindex='0'>
          <span class='gap-1 justify-between max-w-[13rem]' class:font-bold={children.some(({ link }) => link === path)}>
            {text}
            <span class='mr-2 i-heroicons-solid-chevron-right' />
          </span>
          <ul class='bg-base-100 text-base-content shadow-lg p-2'>
            {#each children as { link, text }}
              <li>
                <a class:font-bold={link === path} href={link}>{text}</a>
              </li>
            {/each}
          </ul>
        </li>
      {/if}
    {/each}
  </ul>
</div>
<div class='hidden swap order-last lg:inline-grid' class:swap-active={scrollY > 32 && title}>
  <button
    class='btn btn-ghost normal-case transition-all swap-on text-base font-normal duration-200'
    class:hidden={scrollY < 32 || !title}
    on:click={() => window.scrollTo(0, 0)}>
    {title}
  </button>
  <ul class='menu swap-off menu-horizontal p-0' class:hidden={scrollY > 64 && title}>
    {#each nav as { children, link, text }}
      {#if link && !children}
        <li>
          <a class='!rounded-btn' class:font-bold={link === path} href={link}>{text}</a>
        </li>
      {:else if children}
        <li>
          <span class='!rounded-btn gap-1' class:font-bold={children.some(({ link }) => link === path)}>
            {text}
            <span class='-mr-1 i-heroicons-solid-chevron-down' />
          </span>
          <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
          <ul class='menu rounded-box bg-base-100 text-base-content shadow-lg p-2' tabindex='0'>
            {#each children as { link, text }}
              <li>
                <a class:font-bold={link === path} href={link}>{text}</a>
              </li>
            {/each}
          </ul>
        </li>
      {/if}
    {/each}
  </ul>
</div>
