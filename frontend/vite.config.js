import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  optimizeDeps: {
    exclude: ['jspdf', 'canvg']
  },
  build: {
    rollupOptions: {
      external: [/^core-js\/.*/, 'canvg', 'html2canvas', 'dompurify']
    }
  }
})
