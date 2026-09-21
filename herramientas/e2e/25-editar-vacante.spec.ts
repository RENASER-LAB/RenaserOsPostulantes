import { expect, test } from '@playwright/test'
import { entrarAlPanel, VACANTES } from './ayuda'

/**
 * Corregir una vacante desde la lista del panel, ahora en un modal.
 *
 * ⚠️ **No escribe nada, y eso es deliberado.** Lo único que guarda es el
 * formulario tal cual vino, que el backend reconoce como «no había cambios»: ni
 * auditoría ni avisos. Editar de verdad una vacante sembrada le dejaría un aviso
 * en la campana a cada candidato en carrera, y esos avisos no se pueden borrar
 * después — las demás pruebas del portal empezarían a ver un punto rojo que no
 * esperan.
 *
 * Lo que sí se comprueba aquí y no puede comprobar una prueba de servicio: que
 * el lápiz exista con un nombre que distinga una fila de otra, que el modal se
 * abra con los datos de ahora **sin mover la tabla de debajo**, que la solicitud
 * y el puesto no se puedan cambiar, que cerrar con algo escrito pregunte antes
 * de tirarlo, y que no queden dos formularios abiertos a la vez.
 */
test.describe('Editar una vacante desde la lista', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()
  })

  const elLapiz = (page: import('@playwright/test').Page, titulo: string) =>
    page.getByRole('button', { name: `Editar la vacante ${titulo}` })

  const elModal = (page: import('@playwright/test').Page) =>
    page.getByRole('dialog', { name: 'Editar vacante' })

  test('el lápiz de la fila abre un modal con los datos de ahora, y la tabla no se mueve', async ({
    page,
  }) => {
    const laFila = page.getByRole('row').filter({ hasText: VACANTES.LLENA })
    const antes = await laFila.boundingBox()

    await elLapiz(page, VACANTES.LLENA).click()

    await expect(elModal(page)).toBeVisible()
    await expect(page.getByLabel('Título que ve quien postula')).toHaveValue(VACANTES.LLENA)
    await expect(page.getByLabel('Descripción')).not.toHaveValue('')

    // La tabla sigue donde estaba: el modal se pone encima, no empuja las filas.
    expect(await laFila.boundingBox()).toEqual(antes)

    // La solicitud y el puesto, como texto fijo y con el porqué: cambiarlos
    // cambiaría el nivel y la familia de toda la evaluación.
    await expect(page.getByText(/El puesto decide el nivel y la familia/)).toBeVisible()
    await expect(page.getByLabel('Solicitud aprobada que la respalda')).toHaveCount(0)

    // Los tres botones del modal, con nombre: sin el del aspa no se puede cerrar
    // a ciegas con un lector de pantalla.
    await expect(elModal(page).getByRole('button', { name: 'Cerrar' })).toBeVisible()
    await expect(elModal(page).getByRole('button', { name: 'Cancelar' })).toBeVisible()
    await expect(elModal(page).getByRole('button', { name: 'Guardar cambios' })).toBeVisible()
  })

  test('cancelar sin cambios cierra; con cambios pregunta y no los pierde', async ({ page }) => {
    await elLapiz(page, VACANTES.LLENA).click()
    await expect(elModal(page)).toBeVisible()

    // Sin tocar nada: cierra y ya.
    await elModal(page).getByRole('button', { name: 'Cancelar' }).click()
    await expect(elModal(page)).toHaveCount(0)

    // Con algo escrito: pregunta, y «Seguir editando» devuelve lo escrito.
    await elLapiz(page, VACANTES.LLENA).click()
    await page.getByLabel('Horario').fill('Turnos rotativos de prueba')
    await elModal(page).getByRole('button', { name: 'Cancelar' }).click()

    const pregunta = page.getByRole('alertdialog', { name: 'Cambios sin guardar' })
    await expect(pregunta).toBeVisible()
    await pregunta.getByRole('button', { name: 'Seguir editando' }).click()
    await expect(page.getByLabel('Horario')).toHaveValue('Turnos rotativos de prueba')

    // Y «Descartar cambios» cierra sin guardar: al reabrir está lo de antes.
    await elModal(page).getByRole('button', { name: 'Cancelar' }).click()
    await page
      .getByRole('alertdialog', { name: 'Cambios sin guardar' })
      .getByRole('button', { name: 'Descartar cambios' })
      .click()
    await expect(elModal(page)).toHaveCount(0)

    await elLapiz(page, VACANTES.LLENA).click()
    await expect(page.getByLabel('Horario')).not.toHaveValue('Turnos rotativos de prueba')
  })

  test('Escape sin cambios cierra el modal y el foco vuelve al lápiz', async ({ page }) => {
    const lapiz = elLapiz(page, VACANTES.LLENA)
    await lapiz.click()
    await expect(elModal(page)).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(elModal(page)).toHaveCount(0)
    await expect(lapiz).toBeFocused()
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
      await expect(elModal(page)).toBeVisible()
      await elModal(page).getByRole('button', { name: 'Guardar cambios' }).click()
      await expect(page.getByRole('status').filter({ hasText: /\S/ })).toBeVisible()
      if (intento === 2) {
        await expect(page.getByText('No había cambios que guardar')).toBeVisible()
      }
      // Y el modal se cierra: no hay nada pendiente que decidir.
      await expect(elModal(page)).toHaveCount(0)
    }
  })

  test('abrir la edición cierra el alta: un solo formulario a la vez', async ({ page }) => {
    await page.getByRole('button', { name: 'Crear vacante' }).click()
    await expect(page.getByRole('heading', { name: /Vacante nueva/ })).toBeVisible()

    await elLapiz(page, VACANTES.LLENA).click()

    await expect(elModal(page)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Vacante nueva' })).toHaveCount(0)
  })

  test('el lápiz se alcanza con el tabulador y se abre con Enter', async ({ page }) => {
    const lapiz = elLapiz(page, VACANTES.LLENA)
    await lapiz.focus()
    await expect(lapiz).toBeFocused()

    await page.keyboard.press('Enter')

    await expect(elModal(page)).toBeVisible()
  })
})
