import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api/settings': {
        target: 'https://wt7ddvj5-8080.brs.devtunnels.ms',
        changeOrigin: true,
        rewrite: () => '/api/v1/stores/cafe-del-barrio/settings',
      },
      '/api/products': {
        target: 'https://wt7ddvj5-8080.brs.devtunnels.ms',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/products', '/api/v1/stores/cafe-del-barrio/products'),
      },
      '/api/categories': {
        target: 'https://wt7ddvj5-8080.brs.devtunnels.ms',
        changeOrigin: true,
        rewrite: () => '/api/v1/stores/cafe-del-barrio/categories',
      },
    },
  },
})
