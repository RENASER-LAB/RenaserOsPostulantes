import { defineConfig, devices } from '@playwright/test'

/**
 * Configuración de QA para la rama `feat/ranking-orden-y-excel`.
 *
 * ⚠️ **Sin `webServer` a propósito.** El Vite del worktree (5174) y el Spring
 * (8081) ya están levantados por quien encargó la verificación; arrancarlos aquí
 * abriría un segundo backend contra la misma base.
 *
 * **Qué navegador.** Por defecto el Chromium que trae Playwright: va clavado a su
 * versión, así que la suite da el mismo resultado hoy y dentro de seis meses, y
 * corre en una máquina sin escritorio. Con `E2E_CHROME=1` usa el Google Chrome
 * instalado en la máquina, que es lo que hay que hacer para mirar un fallo con
 * los ojos —o para descartar que sea cosa del Chromium empaquetado—:
 *
 *     E2E_CHROME=1 playwright test --headed
 *     E2E_CHROME=1 playwright test --headed --project=escritorio -g "celda a celda"
 *
 * No se pone de fijo a propósito: ataría la suite a la versión de Chrome que
 * cada uno tenga instalada, y en CI no hay ninguna.
 *
 * ⚠️ **Un solo worker y sin paralelo.** El backend y la base (Postgres 5434) son
 * compartidos, y la prueba de avance de etapa MUTA `estado`: en paralelo cambia
 * los contadores de «Está aquí ahora» y los motivos de «por qué no hay nota» de
 * cualquier otra prueba que esté corriendo.
 */
/** El Chrome de la máquina solo si se pide; si no, el Chromium clavado de Playwright. */
const navegador = process.env.E2E_CHROME ? { channel: 'chrome' as const } : {}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
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
