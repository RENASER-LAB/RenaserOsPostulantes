import { expect, test } from '@playwright/test'
import { entrarAlPanel, VACANTES } from './ayuda'

/**
 * Corregir una vacante desde la lista del panel.
 *
 * ⚠️ **No escribe nada, y eso es deliberado.** Lo único que guarda es el
 * formulario tal cual vino, que el backend reconoce como «no había cambios»: ni
 * auditoría ni avisos. Editar de verdad una vacante sembrada le dejaría un aviso
 * en la campana a cada candidato en carrera, y esos avisos no se pueden borrar
 * después — las demás pruebas del portal empezarían a ver un punto rojo que no
 * esperan.
 *
 * Lo que sí se comprueba aquí y no puede comprobar una prueba de servicio: que
 * el lápiz exista con un nombre que distinga una fila de otra, que el formulario
 * se abra con los datos de ahora, que la solicitud y el puesto no se puedan
 * cambiar, y que no queden dos formularios abiertos a la vez.
 */
test.describe('Editar una vacante desde la lista', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()
  })

  const elLapiz = (page: import('@playwright/test').Page, titulo: string) =>
    page.getByRole('button', { name: `Editar la vacante ${titulo}` })

  test('el lápiz de la fila abre el formulario con los datos de ahora', async ({ page }) => {
    await elLapiz(page, VACANTES.LLENA).click()

    await expect(page.getByRole('heading', { name: 'Editar vacante' })).toBeVisible()
    await expect(page.getByLabel('Título que ve quien postula')).toHaveValue(VACANTES.LLENA)
    await expect(page.getByLabel('Descripción')).not.toHaveValue('')

    // La solicitud y el puesto, como texto fijo y con el porqué: cambiarlos
    // cambiaría el nivel y la familia de toda la evaluación.
    await expect(page.getByText(/El puesto decide el nivel y la familia/)).toBeVisible()
    await expect(page.getByLabel('Solicitud aprobada que la respalda')).toHaveCount(0)
  })

  test('guardar dos veces lo mismo: la segunda dice que no había nada que guardar', async ({ page }) => {
    /*
      Se guarda DOS veces y solo se exige la segunda, a propósito. La vacante
      sembrada puede traer algún campo interno que el formulario normaliza al
      abrirlo —plazas escritas en una vacante permanente, por ejemplo—, así que el
      primer guardado puede tener algo que escribir. Lo que esta prueba protege es
      lo que de verdad importa: que reenviar la MISMA edición no vuelva a guardar
      ni a avisar. Es el doble clic y el reintento de una red lenta.
    */
    for (const intento of [1, 2]) {
      await elLapiz(page, VACANTES.LLENA).click()
      await expect(page.getByRole('heading', { name: 'Editar vacante' })).toBeVisible()
      await page.getByRole('button', { name: 'Guardar cambios' }).click()
      await expect(page.getByRole('status')).toBeVisible()
      if (intento === 2) {
        await expect(page.getByText('No había cambios que guardar')).toBeVisible()
      }
      // Y el formulario se cierra: no hay nada pendiente que decidir.
      await expect(page.getByRole('heading', { name: 'Editar vacante' })).toHaveCount(0)
    }
  })

  test('abrir la edición cierra el alta: un solo formulario a la vez', async ({ page }) => {
    await page.getByRole('button', { name: 'Crear vacante' }).click()
    await expect(page.getByRole('heading', { name: /Vacante nueva/ })).toBeVisible()

    await elLapiz(page, VACANTES.LLENA).click()

    await expect(page.getByRole('heading', { name: 'Editar vacante' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Vacante nueva' })).toHaveCount(0)
  })

  test('el lápiz se alcanza con el tabulador y se abre con Enter', async ({ page }) => {
    const lapiz = elLapiz(page, VACANTES.LLENA)
    await lapiz.focus()
    await expect(lapiz).toBeFocused()

    await page.keyboard.press('Enter')

    await expect(page.getByRole('heading', { name: 'Editar vacante' })).toBeVisible()
  })
})
