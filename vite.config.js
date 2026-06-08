import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = env.VITE_API_BASE_URL?.trim()

  return {
    plugins: [vue()],
    server: {
      proxy: apiBaseUrl
        ? {
            '/api': {
              target: apiBaseUrl,
              changeOrigin: true,
            },
            '/uploads': {
              target: apiBaseUrl,
              changeOrigin: true,
            },
          }
        : undefined,
    },
  }
})
