import { defineConfig, devices } from '@playwright/test'

import { configuracion } from './herramientas/e2e/base-de-datos'

// El preview debe estar arrancado con la API y la base del mismo clon.
const navegador = process.env.E2E_CHROME ? { channel: 'chrome' as const } : {}
const portal = configuracion().E2E_PORTAL

export default defineConfig({
  globalSetup: './herramientas/e2e/preparar-entorno.ts',
  testDir: './herramientas/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: portal,
    trace: 'off',
    screenshot: 'only-on-failure',
    locale: 'es-PE',
  },
  projects: [
    // El archivo de móvil lo corre SOLO el proyecto `movil`: sus medidas
    // (375 px) no significan nada en una ventana de escritorio.
    {
      name: 'escritorio',
      use: { ...devices['Desktop Chrome'], ...navegador },
      testIgnore: /movil\.spec\.ts/,
    },
    {
      name: 'movil',
      use: { ...devices['Desktop Chrome'], ...navegador, viewport: { width: 375, height: 812 } },
      testMatch: /movil\.spec\.ts/,
    },
  ],
})
