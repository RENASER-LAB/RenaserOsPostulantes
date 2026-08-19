import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // El backend contra el que se trabaja. Por orden: lo que venga en la linea de
  // comandos, luego `.env.local`, y si no hay nada, el Spring de casa.
  //
  // Apuntarlo a Render sirve para probar en local contra el backend desplegado,
  // que es lo mismo que hace `vercel.json` en produccion.
  const entorno = loadEnv(mode, process.cwd(), '')
  const backend = process.env.API_URL ?? entorno.API_URL ?? 'http://localhost:8080'

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5174,
      // Asi el navegador solo habla con Vite y no hay CORS que configurar,
      // igual que la reescritura de Vercel en produccion.
      proxy: {
        '/api': {
          target: backend,
          changeOrigin: true,
        },
      },
    },
  }
})
