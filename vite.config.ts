import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite';
import { fileURLToPath, URL } from 'node:url';
import { resolve, dirname } from 'node:path';

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VueI18nPlugin({
      compositionOnly: true,
      include: resolve(dirname(fileURLToPath(import.meta.url)), './src/locale/**'),
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Dev proxy: the app calls same-origin /api/v1 and /ws (its production
    // defaults) and Vite forwards to the backend stack — no CORS involved.
    proxy: {
      '/api': {
        target: 'http://localhost:20714',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:20870',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
