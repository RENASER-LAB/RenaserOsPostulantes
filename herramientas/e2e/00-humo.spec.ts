import { expect, test } from '@playwright/test'
import { corte, entrarAlPanel, filasDelRanking, irAVacante, VACANTES } from './ayuda'

test.describe('Humo: el arnés llega a la pantalla', () => {
  test('el panel abre el listado de vacantes y entra a la 7', async ({ page }) => {
    await entrarAlPanel(page)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Desarrollador web', exact: true }).first()).toBeVisible()

    await irAVacante(page, VACANTES.LLENA)
    await expect(page.getByRole('heading', { level: 1, name: 'Desarrollador web' })).toBeVisible()
    // La pantalla abre por «Por revisar», que es la bandeja de trabajo y suele
    // traer una o ninguna: el humo mira la tanda entera, que son cuatro.
    await corte(page, 'Toda la tanda').click()
    await expect(filasDelRanking(page)).toHaveCount(4)
  })
})
