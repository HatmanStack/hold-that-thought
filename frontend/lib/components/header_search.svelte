<script lang='ts'>
  import { header as headerConfig } from '$lib/config/general'
  import { site } from '$lib/config/site'
  import { Icon, MagnifyingGlass } from 'svelte-hero-icons'
</script>

<form
  action={headerConfig?.search?.provider === 'duckduckgo' ? '//duckduckgo.com/' : '//google.com/search'}
  class='flex-1'
  method='get'>
  <input
    class='input input-bordered transition-all w-full h-12 input-ghost xl:bg-base-100 xl:text-base-content'
    name='q'
    type='text' />
  <input
    name={headerConfig?.search?.provider === 'duckduckgo' ? 'sites' : 'sitesearch'}
    type='hidden'
    value={site.protocol + site.domain} />
  <button class='btn btn-square btn-ghost ml-2' type='submit'>
    <Icon src={MagnifyingGlass} class='w-6 h-6' />
  </button>
</form>
