import { expect, test } from '@playwright/test'
import { entrarAlPanel, filasDelRanking, irAVacante, VACANTES } from './ayuda'

test.describe('Humo: el arnés llega a la pantalla', () => {
  test('el panel abre el listado de vacantes y entra a la 7', async ({ page }) => {
    await entrarAlPanel(page)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Desarrollador web', exact: true }).first()).toBeVisible()

    await irAVacante(page, VACANTES.LLENA)
    await expect(page.getByRole('heading', { level: 1, name: 'Desarrollador web' })).toBeVisible()
    await expect(filasDelRanking(page)).toHaveCount(4) // «Con nota del perfil»: las cuatro tienen nota
  })
})
