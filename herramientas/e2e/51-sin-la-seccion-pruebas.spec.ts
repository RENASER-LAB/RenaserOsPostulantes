import { expect, test, type Page } from '@playwright/test'
import { entrarAlPanel } from './ayuda'
import { empresaB, retirarLoSembrado } from './ayuda-prueba-propia'

/**
 * La sección «Pruebas» de las plantillas se retiró (spec `fuga-del-catalogo-de-preguntas`).
 *
 * Leía el catálogo de preguntas de toda la plataforma —el examen de cualquier
 * empresa— nada más abrir una versión. Desde la spec `pruebas-indice-de-la-empresa`,
 * `/admin/pruebas` es otra cosa: el índice de lo que cada empresa escribió en
 * sus propias vacantes. Lo que se protege aquí, con una sesión de RENASER y otra
 * de una segunda empresa:
 *
 *   - el menú ofrece «Pruebas» —el índice— a quien tiene `ver_vacantes`;
 *   - `/admin/pruebas` abre el índice, y la empresa B, sin nada escrito, ve su
 *     estado vacío y nada de RENASER;
 *   - la dirección de una versión de la sección retirada,
 *     `/admin/pruebas/versiones/5`, sigue llevando a la lista de vacantes;
 *   - y por el camino, el navegador no pide el catálogo de preguntas.
 *
 * El cierre del catálogo en la API lo prueba el backend con dos empresas
 * (`CatalogoDePreguntasSoloPlataformaIT`), no este archivo.
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
  test(`${quien}: el menú ofrece «Pruebas», el índice de la empresa`, async ({ page }) => {
    await entrar(page)
    await page.goto('/admin')
    // «Colaboradores» depende de la sesión: cuando sale, el menú ya es el de los
    // permisos de esta persona y no el de reserva mientras carga.
    await expect(menu(page).getByRole('link', { name: 'Colaboradores', exact: true })).toBeVisible()
    for (const nombre of ['Vacantes', 'Pruebas', 'Simulación', 'Configuración']) {
      await expect(menu(page).getByRole('link', { name: nombre, exact: true })).toBeVisible()
    }
    await expect(menu(page).getByRole('link', { name: 'Pruebas', exact: true })).toHaveAttribute('href', '/admin/pruebas')
  })

  test(`${quien}: /admin/pruebas abre el índice y no pide el catálogo de preguntas`, async ({ page }) => {
    const catalogo = vigilarElCatalogo(page)
    await entrar(page)
    await page.goto('/admin/pruebas')
    await expect(page.getByRole('heading', { level: 1, name: 'Pruebas.' })).toBeVisible()
    await expect(menu(page).getByRole('link', { name: 'Pruebas', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('tab', { name: /Preguntas del Perfil Integral/ })).toHaveAttribute('aria-selected', 'true')
    if (quien === 'otra empresa') {
      // Sin nada escrito en sus vacantes: el estado vacío, y nada de RENASER (AC-04, AC-14)
      await expect(page.getByText('Ninguna vacante tiene preguntas propias todavía').first()).toBeVisible()
      await expect(page.getByRole('link', { name: 'Ir a Vacantes' })).toHaveAttribute('href', '/admin')
    }
    expect(catalogo, 'el panel no debe pedir el catálogo de preguntas').toEqual([])
  })

  test(`${quien}: /admin/pruebas/versiones/5, de la sección retirada, lleva a la lista de vacantes`, async ({ page }) => {
    const catalogo = vigilarElCatalogo(page)
    await entrar(page)
    await page.goto('/admin/pruebas/versiones/5')

    await expect(page).toHaveURL(/\/admin\/?$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()
    await expect(menu(page).getByRole('link', { name: 'Vacantes', exact: true })).toHaveAttribute('aria-current', 'page')

    // Recargar —la pestaña que quedó abierta con la pantalla vieja— da lo mismo.
    await page.reload()
    await expect(page).toHaveURL(/\/admin\/?$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()

    expect(catalogo, 'el panel no debe pedir el catálogo de preguntas').toEqual([])
  })
}
