import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // El backend contra el que se trabaja. Por orden: lo que venga en la linea de
  // comandos, luego `.env.local`, y si no hay nada, el Spring de casa.
  //
  // ⚠️ El Spring local escucha en el 8081: en el 8080 vive el adminer de Postgres,
  // que responde 200 y hace creer que el backend esta arriba.
  //
  // Apuntarlo al de AWS (el mismo destino que `vercel.json`) prueba en local
  // contra el desplegado, y escribe en la base de produccion.
  const entorno = loadEnv(mode, process.cwd(), '')
  const backend = process.env.API_URL ?? entorno.API_URL ?? 'http://localhost:8081'

  return {
    // Tailwind, solo para las piezas de shadcn/ui (desde el 01/10/2026): ver `src/estilos/tailwind.css`.
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
      /*
       * ⚠️ Sin esto, `motion` resuelve SU copia de React y todo componente que
       * use un hook suyo revienta con «Invalid hook call... more than one copy
       * of React». Costo una tarde: el sintoma aparece en el componente propio,
       * no en la libreria.
       */
      dedupe: ['react', 'react-dom'],
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
