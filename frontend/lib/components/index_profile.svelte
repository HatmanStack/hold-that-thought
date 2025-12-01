<script lang='ts'>
  import { site } from '$lib/config/site'
</script>

<div
  class='flex flex-col gap-4 card card-body p-4 border-base-content/10 h-card sticky top-24 items-right xl:border-2 xl:py-8 xl:ml-auto xl:mr-8 xl:max-w-xs'>
  <a class='hidden u-url u-uid' href={site.protocol + site.domain}>{site.author.name}</a>
  <figure class='relative mx-auto group'>
    {#if site.author.avatar}
      <img
        alt={site.author.name}
        class='rounded-full shadow-xl u-photo hover:shadow-2xl transition-shadow z-10 w-24 h-24 md:w-32 md:h-32'
        src={site.author.avatar} />
    {/if}
    {#if site.author.status}
      <div
        class='rounded-full bg-base-100 shadow-xl text-lg text-center absolute z-20 w-8 h-8 md:w-10 md:h-10 bottom-0 right-0 md:text-xl py-0.5 md:py-1.5'>
        {site.author.status}
      </div>
    {/if}
  </figure>
  <div class='text-center flex flex-col gap-2'>
    <h2 class='text-2xl font-bold mt-0 mb-2 p-name'>{site.author.name}</h2>
    <p class='opacity-75 p-note'>{@html site.author.bio}</p>
    {#if site.author.metadata}
      <div class='flex gap-1 justify-center flex-wrap'>
        {#each site.author.metadata as { icon, link, rel, text }}
          {#if link}
            <a
              class='btn btn-sm btn-ghost normal-case gap-2 u-url'
              class:btn-square={!text}
              href={link}
              rel={rel ?? 'me noopener noreferrer external'}
              target='_blank'>
              {#if icon}
                <span class='{icon} !w-5 !h-5'>{icon}</span>
              {/if}
              {#if text}
                {text}
              {/if}
            </a>
          {:else}
            <button class='btn btn-sm btn-ghost normal-case gap-2' class:btn-square={!text}>
              {#if icon}
                <span class='{icon} !w-5 !h-5'>{icon}</span>
              {/if}
              {#if text}
                {text}
              {/if}
            </button>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>
