import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Keep the browser cache separate from scripts using Vite's default SSR cache.
  cacheDir: 'node_modules/.vite/dev',
  optimizeDeps: { include: ['maplibre-gl'] },
  plugins: [tailwindcss(), svelte()]
});
