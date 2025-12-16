<script lang='ts'>
  import { CheckCircle, ExclamationCircle, Icon, InformationCircle, XCircle } from 'svelte-hero-icons'

  export let title: string | undefined
  export let description: string | undefined
  export let status: 'error' | 'info' | 'success' | 'warning' | undefined
</script>

<div
  class='alert flex-col my-4 shadow-inner'
  class:alert-error={status === 'error'}
  class:alert-info={status === 'info'}
  class:alert-success={status === 'success'}
  class:alert-warning={status === 'warning'}>
  <div class='mr-auto'>
    {#if status === 'success'}
      <Icon src={CheckCircle} class='w-6 h-6' />
    {:else if status === 'warning'}
      <Icon src={ExclamationCircle} class='w-6 h-6' />
    {:else if status === 'error'}
      <Icon src={XCircle} class='w-6 h-6' />
    {:else}
      <Icon src={InformationCircle} class='w-6 h-6' />
    {/if}
    <div>
      <div class:font-bold={description}>{title}</div>
      {#if description}
        <div class='text-xs'>{description}</div>
      {/if}
    </div>
  </div>
  {#if $$slots.default}
    <div class='w-full block'>
      <slot />
    </div>
  {/if}
</div>
