import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  corte,
  entrarAlPanel,
  filasDelRanking,
  idDeVacante,
  irAVacante,
  pestana,
  VACANTES,
} from './ayuda'
import { conElEscenario } from './escenario-desarrollador-web'

/**
 * El Veredicto, solo en la pestaña «Perfil integral» (spec
 * `veredicto-solo-en-el-perfil-integral`, AC-01 a AC-06 y AC-11).
 *
 * Los números 41, 42 y 43 ya estaban ocupados: este es el 44.
 *
 * ⚠️ **El Veredicto es el grupo de prioridad, y el backend lo calcula una sola
 * vez, con la nota del PERFIL.** En las otras cuatro pestañas contradecía la
 * nota de al lado —un 95 en la prueba junto a «No priorizado»—, así que allí ya
 * no hay cabecera, ni celda, ni leyenda, ni casilla en «Columnas». En la prueba
 * la columna de resumen es el Ponderado, justo después de «Nota».
 *
 * **Datos.** La vacante LLENA —«Desarrollador web»— con el escenario de siempre
 * encima (grupos, ciudades y pretensiones) y, solo en la pestaña de la prueba,
 * una nota y un ponderado por persona: nadie los siembra, y sin nota en la
 * prueba no hay «95 junto a No priorizado» que comprobar. Por eso la
 * intercepción es propia y corre también con `E2E_ESCENARIO=base`.
 */

/** Una fila del ranking tal como la deja el escenario: lo justo y el resto tal cual. */
type FilaServida = Parameters<typeof conElEscenario>[0][number]

/** Quien es «No priorizado» en el perfil y saca un 95 en la prueba (AC-06). */
const NO_PRIORIZADO_CON_95 = 'Sebastián Cárdenas Rojo'

/** La nota de la prueba de cada quien. El escenario deja la prueba sin notas. */
const NOTA_EN_LA_PRUEBA: Record<string, number> = {
  [NO_PRIORIZADO_CON_95]: 95,
  'Lucía Chávez Paredes': 68,
  'Camila Torres Rivas': 81,
}

/** Los cuatro rótulos cortos del catálogo de grupos: solo pueden salir en el perfil. */
const ROTULOS_DE_GRUPO = ['Alta', 'Con riesgo', 'No priorizado', 'Incompatible']

/** El escenario y, en la prueba, su nota y su ponderado. */
function conLaPrueba(filas: FilaServida[], etapa: string | null): FilaServida[] {
  const conEscenario = conElEscenario(filas, etapa)
  if (etapa !== 'PRUEBA_PUESTO') return conEscenario
  return conEscenario.map((fila) => {
    const nota = NOTA_EN_LA_PRUEBA[fila.candidato] ?? null
    return {
      ...fila,
      notaEtapa: nota,
      ponderado:
        nota === null
          ? { sobre100: null, cv: 70, perfil: 61, prueba: null }
          : { sobre100: Math.round((nota + 61) / 2), cv: 70, perfil: 61, prueba: nota },
    }
  })
}

/**
 * Intercepta el ranking de la vacante LLENA por su camino exacto —el Excel
 * cuelga de `…/ranking/excel` y ese llega al backend tal cual— y devuelve lo
 * que se sirvió en la última petición, por nombre.
 */
async function interceptarRanking(page: Page): Promise<Map<string, FilaServida>> {
  const servidas = new Map<string, FilaServida>()
  const vacanteId = await idDeVacante(VACANTES.LLENA)
  const camino = `/panel/vacantes/${vacanteId}/ranking`
  await page.route(
    (url) => url.pathname.endsWith(camino),
    async (ruta) => {
      const respuesta = await ruta.fetch()
      if (!respuesta.ok()) {
        await ruta.fulfill({ response: respuesta })
        return
      }
      const cuerpo = (await respuesta.json()) as { filas?: FilaServida[] }
      const etapa = new URL(ruta.request().url()).searchParams.get('etapa')
      cuerpo.filas = conLaPrueba(cuerpo.filas ?? [], etapa)
      servidas.clear()
      for (const fila of cuerpo.filas) servidas.set(fila.candidato, fila)
      await ruta.fulfill({ response: respuesta, json: cuerpo })
    },
  )
  return servidas
}

/**
 * La tabla del ranking: la que lleva la cabecera «Candidato». Por su cabecera y
 * no por sus filas: la ficha abierta puede traer otra tabla dentro.
 */
const laTabla = (page: Page): Locator =>
  page.locator('table', { has: page.getByRole('button', { name: 'Candidato', exact: true }) })

/** El `summary` del menú «Columnas». */
const resumenColumnas = (page: Page): Locator =>
  page.locator('summary').filter({ hasText: /^Columnas/ })

const casilla = (page: Page, nombre: string): Locator =>
  page.getByRole('checkbox', { name: nombre, exact: true })

/** Las casillas del menú «Columnas», por lo que dicen. */
const rotulosDelMenu = async (page: Page): Promise<string[]> =>
  (
    await page.locator('details', { has: resumenColumnas(page) }).locator('label').allTextContents()
  ).map((r) => r.trim())

/**
 * La leyenda de los veredictos, bajo la tabla: su rótulo corto va en negrita. La
 * píldora de cada fila lleva el mismo `title` pero no la negrita.
 */
const leyendaDeVeredictos = (page: Page): Locator =>
  page.locator('p > span[title="Prioridad alta"], p > span[title="No priorizado"]', {
    has: page.locator('b'),
  })

interface Medida {
  cabeceras: string[]
  filas: { nombre: string; celdas: string[]; titulos: string[] }[]
}

/** Lo que la tabla pinta: sus rótulos y, por persona, el texto y el título de cada celda. */
async function medir(page: Page): Promise<Medida> {
  return laTabla(page).evaluate((tabla) => {
    const cabeceras = Array.from(
      tabla.querySelectorAll<HTMLTableCellElement>(':scope > thead > tr > th'),
    )
    const filas = Array.from(
      tabla.querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr'),
    ).filter((tr) => tr.cells[0]?.querySelector('input[aria-label^="Avanza "]'))
    return {
      cabeceras: cabeceras.map((th) => th.textContent?.trim() ?? ''),
      filas: filas.map((tr) => ({
        nombre: (tr.cells[0]!.querySelector('input')!.getAttribute('aria-label') ?? '').replace(
          /^Avanza /,
          '',
        ),
        celdas: Array.from(tr.cells).map((td) => td.textContent?.trim() ?? ''),
        titulos: Array.from(tr.querySelectorAll('[title]')).map(
          (el) => el.getAttribute('title') ?? '',
        ),
      })),
    }
  })
}

/**
 * La tabla cuadra —cada fila tiene tantas celdas como cabeceras, y bajo
 * «Estado» y «Ciudad» está lo de esa persona— y ninguna celda dice un grupo.
 */
async function cuadraYSinVeredicto(
  page: Page,
  servidas: Map<string, FilaServida>,
  situacion: string,
): Promise<Medida> {
  const medida = await medir(page)
  const { cabeceras, filas } = medida
  expect(cabeceras, `${situacion}: cabecera «Veredicto»`).not.toContain('Veredicto')
  expect(filas.length, `${situacion}: la tabla no tiene filas`).toBeGreaterThan(1)
  const bajo = (rotulo: string) => cabeceras.indexOf(rotulo)
  for (const fila of filas) {
    expect(
      fila.celdas,
      `${situacion}: «${fila.nombre}» tiene ${fila.celdas.length} celdas bajo ${cabeceras.length} cabeceras (${cabeceras.join(' | ')})`,
    ).toHaveLength(cabeceras.length)
    for (const rotulo of ROTULOS_DE_GRUPO) {
      expect(fila.celdas, `${situacion}: «${fila.nombre}» enseña «${rotulo}»`).not.toContain(rotulo)
    }
    expect(fila.titulos, `${situacion}: «${fila.nombre}» lleva su grupo en un título`).not.toContain(
      'Prioridad alta',
    )
    const servida = servidas.get(fila.nombre)
    expect(servida, `${situacion}: «${fila.nombre}» no vino en el ranking`).toBeDefined()
    if (bajo('Estado') >= 0) {
      expect(fila.celdas[bajo('Estado')], `${situacion}: bajo «Estado», «${fila.nombre}»`).toBe(
        String(servida!.estadoNombre ?? '').replace(' · ', ''),
      )
    }
    if (bajo('Ciudad') >= 0) {
      expect(fila.celdas[bajo('Ciudad')], `${situacion}: bajo «Ciudad», «${fila.nombre}»`).toBe(
        servida!.ciudad ?? '—',
      )
    }
  }
  return medida
}

/** Abre la vacante LLENA, con la tanda entera a la vista, en la pestaña pedida. */
async function abrirEn(page: Page, nombre: string): Promise<Map<string, FilaServida>> {
  await entrarAlPanel(page)
  const servidas = await interceptarRanking(page)
  await irAVacante(page, VACANTES.LLENA)
  if (nombre !== 'Perfil integral') await pestana(page, nombre).click()
  await expect(pestana(page, nombre)).toHaveAttribute('aria-selected', 'true')
  await corte(page, 'Toda la tanda').click()
  // Al menos dos personas: con una sola, una celda corrida no tendría con quién discrepar.
  await expect(filasDelRanking(page).nth(1)).toBeVisible()
  return servidas
}

/** Lo que dice la celda de «Nota» de una persona, por su nombre. */
async function notaDe(page: Page, nombre: string): Promise<string> {
  const { cabeceras, filas } = await medir(page)
  const fila = filas.find((f) => f.nombre === nombre)
  expect(fila, `«${nombre}» no está en la tabla`).toBeDefined()
  return fila!.celdas[cabeceras.indexOf('Nota')] ?? ''
}

test.describe('El Veredicto, solo en «Perfil integral»', () => {
  test('1 · AC-01 · en «Perfil integral» siguen la cabecera, las píldoras, la leyenda y la casilla', async ({
    page,
  }) => {
    await abrirEn(page, 'Perfil integral')
    const cabeceraVeredicto = page.getByRole('columnheader', { name: 'Veredicto', exact: true })
    await expect(cabeceraVeredicto).toBeVisible()
    const { cabeceras, filas } = await medir(page)
    expect(cabeceras.indexOf('Veredicto')).toBe(cabeceras.indexOf('Nota') + 1)
    const bajoVeredicto = filas.map((f) => f.celdas[cabeceras.indexOf('Veredicto')])
    expect(bajoVeredicto).toContain('Alta')
    expect(bajoVeredicto).toContain('No priorizado')
    // La píldora con el rótulo corto y el nombre entero en el título emergente.
    await expect(
      laTabla(page).locator('td span[title="Prioridad alta"]').first(),
    ).toHaveText('Alta')
    await expect(leyendaDeVeredictos(page).first()).toBeVisible()

    await resumenColumnas(page).click()
    await expect(casilla(page, 'Veredicto')).toBeVisible()
  })

  test('2 · AC-02 a AC-04 y AC-06 · «Prueba del puesto» sin Veredicto, con Ponderado tras Nota', async ({
    page,
  }) => {
    const servidas = await abrirEn(page, 'Prueba del puesto')
    await expect(page.getByRole('columnheader', { name: 'Ponderado' })).toBeVisible()
    const { cabeceras } = await cuadraYSinVeredicto(page, servidas, 'Prueba del puesto')
    expect(cabeceras.indexOf('Ponderado')).toBe(cabeceras.indexOf('Nota') + 1)
    await expect(page.getByRole('columnheader', { name: 'Veredicto', exact: true })).toHaveCount(0)
    // AC-04: sin leyenda de veredictos, aunque las filas traigan su grupo.
    await expect(leyendaDeVeredictos(page)).toHaveCount(0)
    await expect(page.getByText('Prioridad alta', { exact: true })).toHaveCount(0)

    // AC-06: el 95 se lee solo, sin «No priorizado» al lado.
    expect(await notaDe(page, NO_PRIORIZADO_CON_95)).toMatch(/^95/)

    // AC-03: el menú ofrece Ponderado y no Veredicto.
    await resumenColumnas(page).click()
    await expect(casilla(page, 'Ponderado')).toBeVisible()
    await expect(casilla(page, 'Veredicto')).toHaveCount(0)
    expect(await rotulosDelMenu(page)).not.toContain('Veredicto')
    await resumenColumnas(page).click()

    // AC-06: de vuelta en el perfil, en «Toda la tanda», su grupo sigue ahí.
    await pestana(page, 'Perfil integral').click()
    await expect(page.getByRole('columnheader', { name: 'Veredicto', exact: true })).toBeVisible()
    await corte(page, 'Toda la tanda').click()
    await expect
      .poll(async () => {
        const { cabeceras: enPerfil, filas } = await medir(page)
        const suya = filas.find((f) => f.nombre === NO_PRIORIZADO_CON_95)
        return suya?.celdas[enPerfil.indexOf('Veredicto')]
      })
      .toBe('No priorizado')
  })

  for (const nombre of ['Validación', 'Decisión']) {
    test(`3 · AC-05 · «${nombre}» sin Veredicto, sin leyenda y sin casilla`, async ({ page }) => {
      const servidas = await abrirEn(page, nombre)
      const { cabeceras } = await cuadraYSinVeredicto(page, servidas, nombre)
      // El Ponderado solo estuvo en la prueba: aquí tampoco.
      expect(cabeceras).not.toContain('Ponderado')
      await expect(page.getByRole('columnheader', { name: 'Veredicto', exact: true })).toHaveCount(0)
      await expect(leyendaDeVeredictos(page)).toHaveCount(0)

      await resumenColumnas(page).click()
      await expect(casilla(page, 'Estado')).toBeVisible()
      await expect(casilla(page, 'Veredicto')).toHaveCount(0)
      expect(await rotulosDelMenu(page)).not.toContain('Veredicto')
    })
  }
})

/*
  AC-11. En el teléfono «Columnas» vive dentro de «Más» y es el mismo menú. El
  proyecto `movil` mide 375 px y solo corre los `*movil.spec.ts`: este bloque
  fija los 360 que pide la spec dentro del proyecto de escritorio.
*/
test.describe('El Veredicto en un teléfono de 360 px', () => {
  test.use({ viewport: { width: 360, height: 780 } })

  test('4 · AC-11 · «Más» → «Columnas» en la prueba no ofrece Veredicto y la tabla cuadra', async ({
    page,
  }) => {
    const servidas = await abrirEn(page, 'Prueba del puesto')
    const { cabeceras } = await cuadraYSinVeredicto(page, servidas, '360 px, prueba del puesto')
    expect(cabeceras.indexOf('Ponderado')).toBe(cabeceras.indexOf('Nota') + 1)
    await expect(leyendaDeVeredictos(page)).toHaveCount(0)

    await expect(resumenColumnas(page)).toBeHidden()
    await page.getByRole('button', { name: 'Más', exact: true }).click()
    await resumenColumnas(page).click()
    await expect(casilla(page, 'Ponderado')).toBeVisible()
    await expect(casilla(page, 'Veredicto')).toHaveCount(0)
    expect(await rotulosDelMenu(page)).not.toContain('Veredicto')
    await resumenColumnas(page).click()

    // La página no rueda en horizontal: la tabla lo hace dentro de su envoltura.
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(desborda, 'la página entera no debe poder desplazarse en horizontal').toBe(false)
  })
})
