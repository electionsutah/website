import { writable } from 'svelte/store';

export const notification = writable<{ id: number; message: string } | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;
let sequence = 0;

export function dismissNotification() {
  clearTimeout(timer);
  notification.set(null);
}

export function notify(message: string) {
  clearTimeout(timer);
  notification.set({ id: ++sequence, message });
  timer = setTimeout(dismissNotification, 6000);
}
