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

  test('cambiar de pestaña limpia la búsqueda y el orden, pero el corte se conserva', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await corte(page, 'Toda la tanda').click()
    await page.getByRole('searchbox').fill('camila')
    await expect(filasDelRanking(page)).toHaveCount(1)
    await cabecera(page, 'Candidato').getByRole('button').click()
    await expect(cabecera(page, 'Candidato')).toHaveAttribute('aria-sort', 'ascending')

    await pestana(page, 'Prueba del puesto').click()
    // `<Ranking key={etapa}>` remonta: la búsqueda y el orden mueren con él.
    await expect(page.getByRole('searchbox')).toHaveValue('')
    await expect(cabecera(page, 'Candidato')).toHaveAttribute('aria-sort', 'none')
    // `vista` vive en el padre y NO se reinicia.
    await expect(corte(page, 'Toda la tanda')).toHaveAttribute('aria-pressed', 'true')
    await expect(filasDelRanking(page)).toHaveCount(4)
  })
})
