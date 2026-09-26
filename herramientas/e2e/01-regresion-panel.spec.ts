import { expect, test } from '@playwright/test'
import { cabecera, corte, entrarAlPanel, filasDelRanking, irAVacante, pestana, VACANTES } from './ayuda'

/**
 * Lo que YA existía antes de la rama y no puede haberse roto.
 *
 * Lo que aquí había y ya miran otros archivos no se repite: el listado con las
 * tres sembradas y entrar a una lo hace `00-humo`; las cinco pestañas, los tres
 * cortes con sus cifras y lo que trae cada uno lo contrasta con la API
 * `18-ranking-contra-api`; y qué etapas exportan a Excel es una regla de
 * `ranking.ts` que se prueba sin navegador (`seExportaAExcel`).
 */
test.describe('Regresión · el panel del equipo', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  test('el detalle de un candidato se despliega y se pliega', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    // Camila ya pasó de la preselección: con «Pendiente» no está en la tabla.
    await corte(page, 'Toda la tanda').click()
    const fila = filasDelRanking(page).filter({ hasText: 'Camila Torres Rivas' })
    await fila.click()
    await expect(page.getByText('Camila Torres Rivas').first()).toBeVisible()
    // La fila de detalle es un <tr> extra sin casilla de avance.
    await expect(page.locator('table tbody tr')).toHaveCount(5)
    await fila.click()
    await expect(page.locator('table tbody tr')).toHaveCount(4)
  })

  test('Simulación, Configuración y el Banco de preguntas siguen abriendo', async ({ page }) => {
    await page.goto('/admin/simulacion')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.getByRole('alert').count()).toBe(0)

    await page.goto('/admin/configuracion')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/banco de preguntas/i).first()).toBeVisible()
  })

  /*
    Qué sobrevive al cambio de pestaña y qué no. `<Ranking key={etapa}>` se
    remonta con cada etapa, y solo muere lo que vive dentro: el orden. La
    búsqueda (`filtros.texto`) y el corte (`vista`) viven en el padre desde
    #55 justo para que no se pierdan al cambiar de etapa; que los demás filtros
    también se conservan lo prueba `33-filtros-y-seleccion-en-lote`.
  */
  test('cambiar de pestaña reinicia el orden, pero la búsqueda y el corte se conservan', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await corte(page, 'Toda la tanda').click()
    await page.getByRole('searchbox').fill('camila')
    await expect(filasDelRanking(page)).toHaveCount(1)
    await cabecera(page, 'Candidato').getByRole('button').click()
    await expect(cabecera(page, 'Candidato')).toHaveAttribute('aria-sort', 'ascending')

    await pestana(page, 'Prueba del puesto').click()
    // El orden vive dentro de `<Ranking>` y muere con el remontaje.
    await expect(cabecera(page, 'Candidato')).toHaveAttribute('aria-sort', 'none')
    // La búsqueda y el corte viven en el padre y siguen aplicados: una sola fila.
    await expect(page.getByRole('searchbox')).toHaveValue('camila')
    await expect(corte(page, 'Toda la tanda')).toHaveAttribute('aria-pressed', 'true')
    await expect(filasDelRanking(page)).toHaveCount(1)
    // Y al vaciar la búsqueda, el corte entero de esta etapa.
    await page.getByRole('searchbox').clear()
    await expect(filasDelRanking(page)).toHaveCount(4)
  })
})
