import { expect, test, type Locator } from '@playwright/test'
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
 * y el puesto no se puedan cambiar, que Escape devuelva el foco al lápiz, y que
 * reenviar lo mismo diga que no había nada que guardar.
 *
 * Cancelar con y sin cambios, «Seguir editando» y «Descartar cambios», y que
 * abrir la edición cierre el alta son comportamientos del componente y se
 * fijan sin navegador en `EditarVacante.test.tsx`.
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

  /**
   * Dónde está en la PÁGINA, no en la ventana.
   *
   * ⚠️ `boundingBox()` mide contra la ventana. Cada corrida entera deja en la lista
   * vacantes que no se pueden borrar (las de `14`, `16`, `17`, `29`–`35`), y el
   * panel las pone arriba: con doce filas «Desarrollador web» queda bajo el pliegue
   * de los 720 px, el clic en el lápiz desplaza la página para alcanzarlo y la
   * segunda medida sale 300 px más arriba sin que la tabla se haya movido. Sumando
   * el desplazamiento, lo que se compara es la posición en el documento: solo
   * cambia si algo empuja las filas, que es lo que la prueba vigila.
   */
  const posicionEnLaPagina = (fila: Locator) =>
    fila.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x + window.scrollX, y: r.y + window.scrollY, ancho: r.width, alto: r.height }
    })

  test('el lápiz de la fila abre un modal con los datos de ahora, y la tabla no se mueve', async ({
    page,
  }) => {
    const laFila = page.getByRole('row').filter({ hasText: VACANTES.LLENA })
    // A la vista antes de medir: así el clic tampoco tiene que desplazar nada.
    await laFila.scrollIntoViewIfNeeded()
    const antes = await posicionEnLaPagina(laFila)

    await elLapiz(page, VACANTES.LLENA).click()

    await expect(elModal(page)).toBeVisible()
    await expect(page.getByLabel('Título que ve quien postula')).toHaveValue(VACANTES.LLENA)
    await expect(page.getByLabel('Descripción')).not.toHaveValue('')

    // La tabla sigue donde estaba: el modal se pone encima, no empuja las filas.
    expect(await posicionEnLaPagina(laFila)).toEqual(antes)

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
})
