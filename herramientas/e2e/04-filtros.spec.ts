import { expect, test, type Page } from '@playwright/test'
import {
  abrirFiltros,
  botonFiltros,
  cabecera,
  corte,
  entrarAlPanel,
  filasDelRanking,
  irAVacante,
  nombresVisibles,
  pestana,
  VACANTES,
} from './ayuda'
import { interceptarEscenario } from './escenario-desarrollador-web'

/**
 * Los filtros del ranking: lo que SOLO se ve en el navegador.
 *
 * Qué filas deja cada filtro —el buscador con y sin tildes, varias ciudades a la
 * vez, los rangos de nota y de pretensión, un rango al revés, cómo se combinan
 * entre sí y con el corte, que el filtro sobreviva a ordenar— es lógica de
 * `ranking.ts` y se prueba sin navegador en `ranking.test.ts` y en
 * `ranking.escenario-e2e.test.ts`, con este mismo escenario. El resto de la
 * pantalla —etiquetas, insignia, «Borrar filtros», la tabla vacía, los chips de
 * ciudad, el foco— lo cubren `07-movil`, `08-teclado-y-consola`,
 * `33-filtros-y-seleccion-en-lote` y `34-filtros-y-seleccion-qa`.
 *
 * Aquí quedan dos cosas: que los campos de rango del panel estén cableados a la
 * tabla, y que recargar la página lo pierda todo, que solo se ve recargando.
 *
 * ⚠️ **El escenario viene interceptado** (`escenario-desarrollador-web.ts`): las
 * notas y pretensiones que se filtran son las de ahí, puestas encima del
 * ranking real. Con `E2E_ESCENARIO=base` se fía de la base.
 */

const notaDesde = (page: Page) => page.getByLabel('Nota del perfil, desde')
const notaHasta = (page: Page) => page.getByLabel('Nota del perfil, hasta')
const pretDesde = (page: Page) => page.getByLabel('Pretensión, desde')
const pretHasta = (page: Page) => page.getByLabel('Pretensión, hasta')

test.describe('Los filtros del ranking', () => {
  /*
    La pantalla abre por «Pendiente», que solo trae a quien espera una
    decisión. Lo que se mide aquí son los filtros, así que se abre la tanda
    entera para tener las cuatro filas con las que trabajar.
  */
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
    await interceptarEscenario(page)
    await irAVacante(page, VACANTES.LLENA)
    await corte(page, 'Toda la tanda').click()
  })

  test('los rangos de nota y de pretensión del panel recortan la tabla, y quien no declaró queda fuera', async ({
    page,
  }) => {
    await abrirFiltros(page)
    await expect(page.getByText('Quien no tiene nota queda fuera.')).toBeVisible()

    // Nota 60–80: Lucía (74) y Sebastián (61). Camila (55) y Joaquín (95) quedan fuera.
    await notaDesde(page).fill('60')
    await notaHasta(page).fill('80')
    await expect(filasDelRanking(page)).toHaveCount(2)
    expect((await nombresVisibles(page)).sort()).toEqual(['Lucía Chávez Paredes', 'Sebastián Cárdenas Rojo'])

    // Solo un extremo también filtra: ≥ 60 son 61, 74 y 95.
    await notaHasta(page).fill('')
    await expect(filasDelRanking(page)).toHaveCount(3)
    await notaDesde(page).fill('')
    await expect(filasDelRanking(page)).toHaveCount(4)

    // La pretensión se cruza por solape, no por contención; sin declarar queda fuera.
    await expect(
      page.getByText('Sale quien pida algo dentro de esa banda. Quien no la declaró queda fuera.'),
    ).toBeVisible()
    await pretDesde(page).fill('2000')
    await pretHasta(page).fill('3000')
    // Camila pide 2500–3000: solapa. Lucía empieza en 3100: no. Sebastián no declaró.
    await expect(filasDelRanking(page)).toHaveCount(1)
    expect(await nombresVisibles(page)).toEqual(['Camila Torres Rivas'])
    await pretHasta(page).fill('3200')
    await expect(filasDelRanking(page)).toHaveCount(2)

    // La insignia del botón cuenta los filtros del panel: uno, el de pretensión.
    await expect(botonFiltros(page)).toContainText('1')
  })

  test('recargar la página pierde filtros, orden, etapa y corte (todo vive en memoria)', async ({
    page,
  }) => {
    await pestana(page, 'Prueba del puesto').click()
    await corte(page, 'Toda la tanda').click()
    await page.getByRole('searchbox').fill('lucia')
    await cabecera(page, 'Candidato').getByRole('button').click()

    await page.reload()
    await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()
    await expect(pestana(page, 'Perfil integral')).toHaveAttribute('aria-selected', 'true')
    await expect(corte(page, 'Pendiente')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('searchbox')).toHaveValue('')
    await expect(cabecera(page, 'Candidato')).toHaveAttribute('aria-sort', 'none')
  })
})
