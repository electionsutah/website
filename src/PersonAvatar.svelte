<script lang="ts">
  import Icon from './Icon.svelte';
  import { personImageFor } from './lib/entity-images';

  export let personId: string | undefined;
  /** Size class from the surrounding layout: detail-avatar, card-avatar, mini-avatar, or none (search). */
  export let className = '';
  export let tag: 'span' | 'div' = 'span';

  $: photo = personId ? personImageFor(personId) : undefined;
</script>

<svelte:element this={tag} class="{className} {photo ? 'photo-avatar' : 'icon-avatar'}" aria-hidden="true">{#if photo}<img src={photo.src} alt="" loading="lazy" decoding="async" />{:else}<Icon name="account_circle" />{/if}</svelte:element>
