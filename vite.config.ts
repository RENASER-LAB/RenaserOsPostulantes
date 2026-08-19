import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El backend de Spring corre en el 8080. Se puede cambiar con API_URL.
const backend = process.env.API_URL ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5174,
    // Asi el navegador solo habla con Vite y no hay CORS que configurar.
    proxy: { '/api': { target: backend, changeOrigin: true } },
  },
})
