// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Vite por defecto
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Tu backend en puerto 3000
        changeOrigin: true,
        secure: false
      }
    }
  }
})