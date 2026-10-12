import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // Used only when VITE_API_URL is blank; must match the backend PORT.
        '/api': env.VITE_PROXY_TARGET || 'http://localhost:5000'
      }
    }
  }
})
