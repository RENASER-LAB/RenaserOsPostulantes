import { expect, test } from '@playwright/test'
import { cabecera, corte, entrarAlPanel, irAVacante, nombresVisibles, VACANTES } from './ayuda'
import { interceptarEscenario, ORDEN_DEL_BACKEND } from './escenario-desarrollador-web'

/**
 * Ordenar desde la cabecera: lo que SOLO se ve en el navegador.
 *
 * El orden en sí —por nombre, ciudad, nota y pretensión; los vacíos al final
 * suba o baje; la nota cruzando grupos; una columna entera vacía que no
 * descoloca nada— es lógica de `ranking.ts` y se prueba sin navegador en
 * `ranking.test.ts` y en `ranking.escenario-e2e.test.ts`, con este mismo
 * escenario. Aquí queda lo que ninguna prueba unitaria puede ver: que el clic y
 * el teclado sobre el `<th>` recorran los tres estados con su `aria-sort`, que
 * una sola columna lleve el orden, que el foco no se pierda al reordenar y que
 * el veredicto siga pintado en la fila.
 *
 * ⚠️ **El escenario viene interceptado** (`escenario-desarrollador-web.ts`): el
 * ranking se pide al backend de verdad y a las cuatro filas se les ponen encima
 * las notas, los grupos, las ciudades y las pretensiones que estas pruebas dan
 * por sabidas. Con `E2E_ESCENARIO=base` se fía de la base en vez de interceptar.
 *
 *   Lucía     (ALTA,           74, Arequipa — Camaná,      3100–3600)
 *   Camila    (ALTA,           55, Lima — Lima,            2500–3000)
 *   Sebastián (NO_PRIORIZADO,  61, Junín — Huancayo,       sin pretensión)
 *   Joaquín   (INCOMPATIBLE,   95, La Libertad — Trujillo, 4000–5200)
 */
test.describe('Ordenar desde la cabecera', () => {
  /*
    La pantalla abre por «Pendiente», que solo trae a quien espera una
    decisión. Lo que se mide aquí es el orden, así que se abre la tanda entera
    para tener las cuatro filas con las que trabajar.
  */
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
    await interceptarEscenario(page)
    await irAVacante(page, VACANTES.LLENA)
    await corte(page, 'Toda la tanda').click()
  })

  test('el clic recorre los tres estados con aria-sort coherente, una sola columna a la vez, y el veredicto sigue en la fila', async ({
    page,
  }) => {
    const candidato = cabecera(page, 'Candidato')
    await expect(candidato).toHaveAttribute('aria-sort', 'none')
    expect(await nombresVisibles(page)).toEqual(ORDEN_DEL_BACKEND)

    await candidato.getByRole('button').click()
    await expect(candidato).toHaveAttribute('aria-sort', 'ascending')
    expect(await nombresVisibles(page)).toEqual([
      'Camila Torres Rivas',
      'Joaquín Vargas Ureta',
      'Lucía Chávez Paredes',
      'Sebastián Cárdenas Rojo',
    ])

    await candidato.getByRole('button').click()
    await expect(candidato).toHaveAttribute('aria-sort', 'descending')
    expect(await nombresVisibles(page)).toEqual([
      'Sebastián Cárdenas Rojo',
      'Lucía Chávez Paredes',
      'Joaquín Vargas Ureta',
      'Camila Torres Rivas',
    ])

    // Tercer clic: vuelve al orden del backend.
    await candidato.getByRole('button').click()
    await expect(candidato).toHaveAttribute('aria-sort', 'none')
    expect(await nombresVisibles(page)).toEqual(ORDEN_DEL_BACKEND)

    // Solo una columna a la vez: la nota abre por la MAYOR y apaga a las demás.
    const nota = cabecera(page, 'Nota')
    await nota.getByRole('button').click()
    await expect(nota).toHaveAttribute('aria-sort', 'descending')
    for (const otra of ['Candidato', 'Ciudad', 'Pretensión']) {
      await expect(cabecera(page, otra)).toHaveAttribute('aria-sort', 'none')
    }
    // Manda la nota, cruzando grupos: el 95 sube aunque su grupo sea el último.
    expect(await nombresVisibles(page)).toEqual([
      'Joaquín Vargas Ureta',
      'Lucía Chávez Paredes',
      'Sebastián Cárdenas Rojo',
      'Camila Torres Rivas',
    ])

    // El grupo sigue pintándose aunque ya no mueva a nadie: quien mira tiene que
    // ver que ese 95 arrastra algo antes de descolgar el teléfono. Acotado a la
    // TABLA: los mismos rótulos salen también en la leyenda que explica los grupos.
    const tabla = page.getByRole('table')
    await expect(tabla.getByTitle('Prioridad alta').first()).toBeVisible()
    await expect(tabla.getByTitle('Incompatible')).toBeVisible()
    await expect(tabla.getByTitle('No priorizado')).toBeVisible()
  })

  test('las cabeceras se pulsan con Enter y con Espacio, y el foco no se pierde al reordenar', async ({
    page,
  }) => {
    const pretension = cabecera(page, 'Pretensión')
    const boton = pretension.getByRole('button')
    await boton.focus()
    await expect(boton).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(pretension).toHaveAttribute('aria-sort', 'ascending')
    // Los vacíos al final, suba o baje el orden: Sebastián no declaró pretensión.
    expect((await nombresVisibles(page)).at(-1)).toBe('Sebastián Cárdenas Rojo')

    await page.keyboard.press('Space')
    await expect(pretension).toHaveAttribute('aria-sort', 'descending')
    expect((await nombresVisibles(page)).at(-1)).toBe('Sebastián Cárdenas Rojo')
    // El foco no se perdió al reordenar: quien va con teclado sigue en su sitio.
    await expect(boton).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(pretension).toHaveAttribute('aria-sort', 'none')
    expect(await nombresVisibles(page)).toEqual(ORDEN_DEL_BACKEND)
  })
})
