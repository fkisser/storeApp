import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    env: {
      API_BASE_URL: 'https://api.example.test'
    },
    clearMocks: true,
    restoreMocks: true
  }
})
