/**
 * «Qué buscar en el CV» (V80, specs/que-buscar-en-el-cv): los puntos del ranking, el orden
 * «Por lo buscado», la ficha de una persona buscada y la de un CV sin texto, el Excel con ese
 * orden y la casilla privada al editar, con la confirmación de volver a buscar.
 *
 * Lo que la IA habría encontrado se siembra con SQL (ver `ayuda-que-buscar.ts`): en el preview
 * la IA está apagada.
 */

import { expect, test } from '@playwright/test'
import { corte, entrarAlPanel, idDeVacante, irAVacante, nombresVisibles, VACANTES } from './ayuda'
import { LINEAS, lineasVivas, quitarLoBuscado, sembrarLoBuscado, type Sembrado } from './ayuda-que-buscar'

test.describe.configure({ mode: 'serial' })

test.describe('Qué buscar en el CV (V80)', () => {
  let vacante: number
  let sembrado: Sembrado

  test.beforeAll(async () => {
    vacante = await idDeVacante(VACANTES.LLENA)
    sembrado = sembrarLoBuscado(vacante)
  })

  test.afterAll(() => {
    if (vacante) quitarLoBuscado(vacante)
  })

  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  const orden = (page: import('@playwright/test').Page) => page.getByRole('group', { name: 'Orden' })

  test('AC-16/17: los puntos, la línea de estado y «Por lo buscado»', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await corte(page, 'Toda la tanda').click()

    await expect(page.getByText(/^2 de \d+ listos/)).toBeVisible()
    await expect(page.getByText('4 de 4 requisitos')).toBeAttached()
    await expect(page.getByRole('table').getByText('CV sin texto')).toBeVisible()

    await orden(page).getByRole('button', { name: 'Por lo buscado' }).click()
    const porLoBuscado = await nombresVisibles(page)
    expect(porLoBuscado.slice(0, 2)).toEqual([sembrado.todo, sembrado.uno])

    // Una cabecera manda: el control vuelve a «De siempre».
    await page.getByRole('table').getByRole('button', { name: /^Candidato/ }).click()
    await expect(orden(page).getByRole('button', { name: 'De siempre' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('AC-18: la ficha de una persona buscada y la de un CV sin texto', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await corte(page, 'Toda la tanda').click()

    await page.getByRole('table').getByRole('button', { name: sembrado.uno, exact: true }).click()
    const bloque = page.getByRole('region', { name: 'Qué buscar en el CV' })
    await expect(bloque.getByText('1 de 4').first()).toBeVisible()
    await expect(bloque.getByText('«Frase del CV 1»')).toBeVisible()
    await expect(bloque.getByText('Lo menciona, sin detalle')).toBeVisible()
    await expect(bloque.getByText('Para la entrevista:').first()).toBeVisible()
    await page.getByRole('table').getByRole('button', { name: sembrado.uno, exact: true }).click()

    await page.getByRole('table').getByRole('button', { name: sembrado.sinTexto, exact: true }).click()
    await expect(
      page.getByRole('region', { name: 'Qué buscar en el CV' }).getByText('CV sin texto: no se pudo buscar.'),
    ).toBeVisible()
  })

  test('AC-20: el Excel sale en el orden de la pantalla y dice «Orden: por lo buscado»', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await corte(page, 'Toda la tanda').click()
    await orden(page).getByRole('button', { name: 'Por lo buscado' }).click()
    const enPantalla = await nombresVisibles(page)

    const pedido = page.waitForRequest((r) => r.url().endsWith('/ranking/excel') && r.method() === 'POST')
    await page.route('**/ranking/excel', (ruta) =>
      ruta.fulfill({ status: 200, contentType: 'application/octet-stream', body: 'x' }),
    )
    await page.getByRole('button', { name: /^Descargar Excel/ }).click()
    const cuerpo = (await pedido).postDataJSON() as { postulacionIds: number[]; filtroDescrito: string }
    expect(cuerpo.filtroDescrito).toContain('Orden: por lo buscado')
    expect(cuerpo.postulacionIds).toHaveLength(enPantalla.length)
  })

  test('AC-02/15: la casilla al editar: lo prohibido apaga el guardado y cancelar no cambia nada', async ({ page }) => {
    // La lista del panel vive en /admin: /admin/vacantes no es una ruta y cae en el portal.
    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 1, name: 'Vacantes.' })).toBeVisible()
    await page.getByRole('button', { name: `Editar la vacante ${VACANTES.LLENA}`, exact: true }).click()
    const casilla = page.getByLabel(/Qué buscar en el CV, uno por línea/)
    await expect(casilla).toHaveValue(LINEAS.join('\n'))
    await expect(page.getByText('Solo lo ve tu equipo')).toBeVisible()

    await casilla.fill('Experiencia en cocina saludable\nMenor de 35 años')
    await expect(page.getByText(/no sirven para elegir a nadie/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()

    await casilla.fill('Experiencia en cocina saludable\nDirige equipos')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    const pregunta = page.getByRole('alertdialog', { name: /^¿Volver a buscar en \d+ CV\?$/ })
    await expect(pregunta).toBeVisible()
    await expect(pregunta.getByText('No cambia nadie de etapa.', { exact: false })).toBeVisible()
    await pregunta.getByRole('button', { name: 'Cancelar' }).click()

    await expect(pregunta).toBeHidden()
    expect(lineasVivas(vacante)).toEqual([...LINEAS])
  })
})
