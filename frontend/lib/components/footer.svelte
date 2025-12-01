<script lang='ts'>
  import { footer as footerConfig } from '$lib/config/general'
  import { site } from '$lib/config/site'

  let className: string | undefined
  export { className as class }
  export let sticky: boolean = false
  export let rounded: boolean = false
</script>

<footer
  class="shadow-inner footer footer-center bg-base-300 text-base-content p-8{rounded
    ? 'rounded-box'
    : 'md:rounded-box'} {sticky ? 'sticky bottom-0 z-0 md:static' : ''} {className ?? ''}"
  id='footer'>
  <div class='prose'>
    <p>

      Copyright © {footerConfig.since && footerConfig.since !== new Date().toJSON().substring(0, 4)
        ? `${footerConfig.since} - ${new Date().toJSON().substring(0, 4)}`
        : new Date().toJSON().substring(0, 4)}
      {site.author.name}

      {#if footerConfig.html}
        {@html footerConfig.html}
      {/if}
    </p>
  </div>
</footer>
