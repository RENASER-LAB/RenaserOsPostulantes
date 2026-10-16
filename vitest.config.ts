/**
 * La configuracion de las pruebas, aparte de `vite.config.ts`.
 *
 * Se separa porque `vite.config.ts` monta el proxy hacia el backend y no tiene
 * nada que decir aqui: las pruebas no hablan con nadie, el modulo de la API se
 * sustituye por uno de mentira.
 */

import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    // Lo que jsdom no trae: ver el archivo.
    setupFiles: ['./herramientas/arranque-de-pruebas.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'herramientas/pruebas-e2e/**/*.test.ts'],
    // Sin `globals`: cada prueba importa lo que usa, y asi el tipado del
    // proyecto sigue funcionando sin añadir tipos sueltos al tsconfig.
    globals: false,
    restoreMocks: true,
    // Desde Node 25, `localStorage`, `sessionStorage` y `Storage` son globales
    // de Node, y vitest no los pisa con los de jsdom: `localStorage` queda en
    // `undefined` sin `--localstorage-file` y las pruebas que lo usan revientan.
    // Se apagan para que jsdom ponga los suyos, como en Node 22 (el del CI).
    // Node 20 no conoce la opcion y se niega a arrancar con ella: de ahi el `has`.
    poolOptions: {
      forks: {
        execArgv: process.allowedNodeEnvironmentFlags.has('--no-experimental-webstorage')
          ? ['--no-experimental-webstorage']
          : [],
      },
    },
  },
})
