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

/**
 * El portal contra el que se corre. Igual que `E2E_API` en `ayuda.ts`: cada
 * worktree levanta el suyo en otro puerto, y sin esto la suite apuntaba siempre
 * al 5174 —el de otra rama— sin que nada lo dijera. Los tres van juntos:
 *
 *     E2E_PORTAL=http://localhost:5212 E2E_API=http://localhost:8088/api/v1 \
 *     E2E_PG=renaser-pg-perfil npx playwright test
 *
 * ⚠️ **`E2E_PG` casi nunca es el valor por defecto, y sin el la limpieza no
 * corre.** Su defecto es `renaser-verifica`, el Postgres desechable del 5434,
 * que en la maquina de desarrollo normal **no existe**: las pruebas pasan
 * igual, avisan «No se pudo borrar la cuenta …» en una linea que se pierde
 * entre la salida, y **cada pasada deja cuentas de prueba en la base**. El
 * contenedor que sostiene al backend de casa se llama `renaser-postgres`:
 *
 *     E2E_PG=renaser-postgres E2E_PORTAL=http://localhost:5204 npx playwright test
 *
 * ⚠️ Una cuenta **con postulacion** no se borra ni asi: `transicion_estado` es
 * inmutable por trigger y el `delete` revienta ahi. Es a proposito —es el
 * historial de personas reales— y por eso esas cuentas se quedan.
 *
 * ⚠️ **`E2E_EQUIPO` es el tercero que casi nunca es su defecto.** El `dev-login`
 * del panel exige que el id **ya exista** en la base; si no, el backend responde
 * **400 «Ese id de RENASER OS no esta registrado»**, que se lee como si el
 * `dev-login` estuviera apagado —y no lo esta—. El defecto es `dev-equipo`, pero
 * cada base trae los usuarios de equipo que trae. Para ver cuales hay:
 *
 *     docker exec -i renaser-postgres psql -U postgres -d renaser_db \
 *       -c "select usuario_renaser_os_id from usuario where es_equipo;"
 *
 * La invocacion completa de esta maquina, con los cuatro:
 *
 *     E2E_EQUIPO=andy-dev E2E_PG=renaser-postgres \
 *     E2E_PORTAL=http://localhost:5204 npx playwright test
 */
const portal = process.env.E2E_PORTAL ?? 'http://localhost:5174'

export default defineConfig({
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
