import { expect, test, type Page } from '@playwright/test'
import { entrarAlPanel } from './ayuda'
import { empresaB, retirarLoSembrado } from './ayuda-prueba-propia'

/**
 * La sección «Pruebas» del panel se retiró (spec `fuga-del-catalogo-de-preguntas`).
 *
 * Leía el catálogo de preguntas de toda la plataforma —el examen de cualquier
 * empresa— nada más abrir una versión. Las vacantes nuevas arman su prueba en su
 * propio editor, así que la sección se fue entera. Lo que se protege aquí, con una
 * sesión de RENASER y otra de una segunda empresa:
 *
 *   - AC-01: el menú ya no ofrece «Pruebas», ni a quien tiene los permisos de pruebas;
 *   - AC-02: las direcciones guardadas, `/admin/pruebas` y
 *     `/admin/pruebas/versiones/5`, llevan a la lista de vacantes sin error;
 *   - y por el camino, el navegador no pide el catálogo de preguntas.
 *
 * El cierre del catálogo en la API (AC-03 a AC-06) lo prueba el backend con dos
 * empresas (`CatalogoDePreguntasSoloPlataformaIT`), no este archivo.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo: la empresa B de `ayuda-prueba-propia`, que
 * `afterAll` retira.
 */

test.describe.configure({ mode: 'serial' })

const correos: string[] = []
let tokenEmpresaB = ''

test.beforeAll(async () => {
  tokenEmpresaB = (await empresaB(correos)).token
})

test.afterAll(() => {
  retirarLoSembrado(correos)
})

const menu = (page: Page) => page.getByRole('navigation', { name: 'Menú del panel' })

async function entrarComoEmpresaB(page: Page) {
  await page.addInitScript(
    ([clave, valor]) => window.localStorage.setItem(clave as string, valor as string),
    ['renaser_panel_token', tokenEmpresaB],
  )
}

/** Cualquier petición al catálogo de preguntas: la pantalla retirada lo pedía al abrirse. */
function vigilarElCatalogo(page: Page): string[] {
  const pedidas: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/plantillas-prueba/preguntas')) pedidas.push(r.url())
  })
  return pedidas
}

const SESIONES = [
  { quien: 'RENASER', entrar: entrarAlPanel },
  { quien: 'otra empresa', entrar: entrarComoEmpresaB },
] as const

for (const { quien, entrar } of SESIONES) {
  test(`AC-01 · ${quien}: el menú no muestra «Pruebas», aunque tenga los permisos de pruebas`, async ({ page }) => {
    await entrar(page)
    await page.goto('/admin')
    // «Colaboradores» depende de la sesión: cuando sale, el menú ya es el de los
    // permisos de esta persona y no el de reserva mientras carga.
    await expect(menu(page).getByRole('link', { name: 'Colaboradores', exact: true })).toBeVisible()
    for (const nombre of ['Vacantes', 'Simulación', 'Configuración']) {
      await expect(menu(page).getByRole('link', { name: nombre, exact: true })).toBeVisible()
    }
    await expect(menu(page).getByRole('link', { name: 'Pruebas', exact: true })).toHaveCount(0)
    await expect(page.locator('a[href^="/admin/pruebas"]')).toHaveCount(0)
  })

  for (const vieja of ['/admin/pruebas', '/admin/pruebas/versiones/5']) {
    test(`AC-02 · ${quien}: ${vieja} lleva a la lista de vacantes sin error`, async ({ page }) => {
      const catalogo = vigilarElCatalogo(page)
      await entrar(page)
      await page.goto(vieja)

      await expect(page).toHaveURL(/\/admin\/?$/)
      await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()
      await expect(menu(page).getByRole('link', { name: 'Vacantes', exact: true }))
        .toHaveAttribute('aria-current', 'page')
      await expect(menu(page).getByRole('link', { name: 'Pruebas', exact: true })).toHaveCount(0)

      // Recargar —la pestaña que quedó abierta con la pantalla vieja— da lo mismo.
      await page.reload()
      await expect(page).toHaveURL(/\/admin\/?$/)
      await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()

      expect(catalogo, 'el panel no debe pedir el catálogo de preguntas').toEqual([])
    })
  }
}
