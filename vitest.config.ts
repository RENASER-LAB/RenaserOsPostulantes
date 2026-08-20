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
    include: ['src/**/*.test.{ts,tsx}'],
    // Sin `globals`: cada prueba importa lo que usa, y asi el tipado del
    // proyecto sigue funcionando sin añadir tipos sueltos al tsconfig.
    globals: false,
    restoreMocks: true,
  },
})
