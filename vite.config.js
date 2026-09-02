import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Split the big, rarely-changing vendor libs into their own chunks so they
    // stay cached across app deploys instead of being re-downloaded every time
    // a page changes.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'supabase'
          if (
            id.includes('react-router') ||
            id.includes('/react-dom/') ||
            id.includes('/react/')
          ) return 'react-vendor'
        },
      },
    },
  },
})
