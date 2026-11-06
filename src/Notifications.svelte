<script lang="ts">
  import { notification, dismissNotification } from './lib/notifications';
  import Icon from './Icon.svelte';
</script>

<div class="notification-region">
  <div aria-live="polite" aria-atomic="true">
    {#if $notification}
      {#key $notification.id}<div class="notification-message">{$notification.message}</div>{/key}
    {/if}
  </div>
  {#if $notification}
    <button class="notification-dismiss" type="button" aria-label="Dismiss notification" onclick={dismissNotification}><Icon name="close" /></button>
  {/if}
</div>

<style>
  .notification-region { position: fixed; bottom: max(var(--space-5), env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); width: min(var(--size-notification-max), calc(100% - var(--space-8))); z-index: 2000; pointer-events: none; }
  .notification-message { padding: var(--space-4) calc(var(--size-touch-target) + var(--space-4)) var(--space-4) var(--space-5); background: var(--color-paper); color: var(--color-text); border: 1px solid var(--color-rule-strong); border-left: var(--border-width-emphasis) solid var(--color-blue); box-shadow: var(--shadow-md); font: 500 var(--text-md)/1.5 var(--font-sans); }
  .notification-dismiss { position: absolute; top: var(--space-1); right: var(--space-1); pointer-events: auto; width: var(--size-touch-target); height: var(--size-touch-target); display: grid; place-items: center; border: 0; background: transparent; color: var(--color-blue); font-size: var(--text-xl); cursor: pointer; }
  .notification-dismiss:hover { background: var(--color-blue-tint); }
  .notification-dismiss:focus-visible { outline: var(--border-width-emphasis) solid var(--color-blue); outline-offset: calc(-1 * var(--space-1)); }
</style>
