import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  cabecera,
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
 * El selector «Columnas» del ranking: la casilla del ponderado se lee en una
 * palabra y la tabla sigue cuadrada al ocultar Veredicto (spec
 * `selector-de-columnas-del-ranking`, AC-01 a AC-11).
 *
 * El número 41 ya lo tenía `41-logotipo`: este es el 42.
 *
 * ⚠️ **Desde la spec `veredicto-solo-en-el-perfil-integral` el Veredicto solo
 * existe en «Perfil integral».** Los recorridos que lo ocultan (AC-04/05, AC-06
 * y AC-08/09) se hacen allí; los de la prueba (AC-07/10 y AC-11) apagan el
 * Ponderado, que es su columna de resumen. La casilla «Ponderado» (AC-01..03 y
 * la de AC-11) se sigue comprobando en la prueba.
 *
 * ⚠️ **Lo que se comprueba es la tabla que se VE, fila a fila.** El fallo se
 * escapó porque las pruebas contaban cabeceras: al ocultar Veredicto se iba su
 * `<th>` y su `<td>` seguía en cada fila, así que «No priorizado» caía bajo
 * ESTADO, el estado bajo CIUDAD y la ciudad en una columna sin cabecera. Aquí
 * se cuentan las celdas de cada fila, se lee lo que hay bajo «Estado» y
 * «Ciudad», y se mide que la cabecera y cada fila acaben en el mismo borde.
 *
 * **Datos.** La vacante LLENA —«Desarrollador web»— con el escenario de
 * siempre encima (grupos, ciudades y pretensiones) y, además, un ponderado y dos
 * criterios de la rúbrica de la prueba por persona. Ni el ponderado ni esos
 * criterios los siembra nadie: sin ellos la columna Ponderado sale en guiones y
 * el interruptor de los criterios no aparece. Por eso esta intercepción es
 * propia y corre también con `E2E_ESCENARIO=base`: la base no puede dárselos.
 *
 * **Reseñas.** Con las reseñas de empresas la tabla tiene una columna más que
 * arranca apagada: los contadores y «Ver todas» cuentan con ella (ver `RESENAS`).
 */

/** Una fila del ranking tal como la deja el escenario: lo justo y el resto tal cual. */
type FilaServida = Parameters<typeof conElEscenario>[0][number]

/** Dos criterios de la rúbrica de la prueba del puesto; el segundo, sin nota. */
const CRITERIOS = [
  { criterio: 'Manejo y control de caja', codigo: 'CAJA', maximo: 20 },
  { criterio: 'Conocimiento del negocio de divisas', codigo: 'DIVISAS', maximo: 15 },
] as const

/** El ponderado y los criterios encima de cada fila. Uno de cada tres, sin ponderado. */
function conPonderadoYCriterios(filas: FilaServida[]): FilaServida[] {
  return filas.map((fila, i) => ({
    ...fila,
    ponderado:
      i % 3 === 2
        ? { sobre100: null, cv: 70, perfil: null, prueba: 64 }
        : { sobre100: 78 - i, cv: 76.5, perfil: 82, prueba: 73 - i },
    notasCriterio: CRITERIOS.map((c, j) => ({
      criterio: c.criterio,
      codigo: c.codigo,
      puntaje: j === 0 ? Math.max(0, c.maximo - 2 - i) : null,
      maximo: c.maximo,
      peso: c.maximo,
      explicacion: null,
      origen: j === 0 ? 'AGENTE' : null,
      confianza: null,
      motivoAjuste: null,
    })),
  }))
}

/**
 * Intercepta el ranking de la vacante LLENA y devuelve lo que se sirvió, por
 * nombre: de ahí sale lo que tiene que leerse bajo «Estado» y «Ciudad».
 *
 * Solo la ruta del ranking, por su camino exacto, como `interceptarEscenario`.
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
      cuerpo.filas = conPonderadoYCriterios(conElEscenario(cuerpo.filas ?? [], etapa))
      for (const fila of cuerpo.filas) servidas.set(fila.candidato, fila)
      await ruta.fulfill({ response: respuesta, json: cuerpo })
    },
  )
  return servidas
}

/**
 * La tabla del ranking: la que lleva la cabecera «Candidato».
 *
 * Por su cabecera y no por sus filas, para seguir encontrándola cuando un
 * filtro la deja vacía. La ficha abierta puede traer otra tabla dentro, y esa
 * no tiene esta cabecera.
 */
const laTabla = (page: Page): Locator =>
  page.locator('table', { has: page.getByRole('button', { name: 'Candidato', exact: true }) })

/** El `summary` del menú «Columnas», que al ocultar algo dice además «1 oculta» o «N ocultas». */
const resumenColumnas = (page: Page): Locator =>
  page.locator('summary').filter({ hasText: /^Columnas/ })

/**
 * La casilla de «Reseñas de empresas» (spec `resenas-de-empresas-a-contratados`,
 * V63). Para quien puede verlas —`dev-equipo` puede— la columna existe y
 * **arranca apagada**: el menú ya dice «1 oculta» antes de tocar nada, ocultar
 * otra columna lo deja en «2 ocultas», y «Ver todas» la enciende también, al final.
 */
const RESENAS = 'Reseñas de empresas'

const casilla = (page: Page, nombre: string): Locator =>
  page.getByRole('checkbox', { name: nombre, exact: true })

/** Lo que dice cada casilla del menú, con el interruptor de los criterios incluido. */
const rotulosDelMenu = async (page: Page): Promise<string[]> =>
  (
    await page.locator('details', { has: resumenColumnas(page) }).locator('label').allTextContents()
  ).map((r) => r.trim())

/**
 * La leyenda de los veredictos, bajo la tabla: su rótulo corto va en negrita. La
 * píldora de cada fila lleva el mismo `title` pero no la negrita.
 */
const leyendaDeVeredictos = (page: Page): Locator =>
  page.locator('p > span[title="Prioridad alta"]', { has: page.locator('b') })

interface Medida {
  cabeceras: string[]
  filas: { nombre: string; celdas: string[]; bordeDerecho: number }[]
  bordeDeLaCabecera: number
  bordeDeLaTabla: number
}

/** La tabla tal como está pintada: sus rótulos, las celdas de cada persona y dónde acaba cada cosa. */
async function medir(page: Page): Promise<Medida> {
  return laTabla(page).evaluate((tabla) => {
    const cabeceras = Array.from(
      tabla.querySelectorAll<HTMLTableCellElement>(':scope > thead > tr > th'),
    )
    const filas = Array.from(
      tabla.querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr'),
    ).filter((tr) => tr.cells[0]?.querySelector('input[aria-label^="Avanza "]'))
    const ultima = cabeceras[cabeceras.length - 1]
    return {
      cabeceras: cabeceras.map((th) => th.textContent?.trim() ?? ''),
      filas: filas.map((tr) => ({
        nombre: (tr.cells[0]!.querySelector('input')!.getAttribute('aria-label') ?? '').replace(
          /^Avanza /,
          '',
        ),
        celdas: Array.from(tr.cells).map((td) => td.textContent?.trim() ?? ''),
        bordeDerecho: tr.cells[tr.cells.length - 1]!.getBoundingClientRect().right,
      })),
      bordeDeLaCabecera: ultima ? ultima.getBoundingClientRect().right : 0,
      bordeDeLaTabla: tabla.getBoundingClientRect().right,
    }
  })
}

/**
 * La tabla cuadra: cada fila tiene tantas celdas como cabeceras, bajo «Estado»
 * está el estado de esa persona y bajo «Ciudad» su ciudad, y la cabecera y cada
 * fila acaban donde acaba la tabla —sin columna sin rótulo a la derecha—.
 */
async function laTablaCuadra(
  page: Page,
  servidas: Map<string, FilaServida>,
  situacion: string,
): Promise<Medida> {
  const medida = await medir(page)
  const { cabeceras, filas } = medida
  const bajo = (rotulo: string) => cabeceras.indexOf(rotulo)
  expect(filas.length, `${situacion}: la tabla no tiene filas`).toBeGreaterThan(0)
  for (const fila of filas) {
    expect(
      fila.celdas,
      `${situacion}: «${fila.nombre}» tiene ${fila.celdas.length} celdas bajo ${cabeceras.length} cabeceras (${cabeceras.join(' | ')})`,
    ).toHaveLength(cabeceras.length)
    const servida = servidas.get(fila.nombre)
    expect(servida, `${situacion}: «${fila.nombre}» no vino en el ranking`).toBeDefined()
    if (bajo('Estado') >= 0) {
      // Las dos líneas del estado van en dos bloques: `textContent` las pega sin el « · ».
      expect(fila.celdas[bajo('Estado')], `${situacion}: bajo «Estado», «${fila.nombre}»`).toBe(
        String(servida!.estadoNombre ?? '').replace(' · ', ''),
      )
    }
    if (bajo('Ciudad') >= 0) {
      expect(fila.celdas[bajo('Ciudad')], `${situacion}: bajo «Ciudad», «${fila.nombre}»`).toBe(
        servida!.ciudad ?? '—',
      )
    }
    expect(
      Math.abs(fila.bordeDerecho - medida.bordeDeLaCabecera),
      `${situacion}: la fila de «${fila.nombre}» acaba donde acaba la cabecera`,
    ).toBeLessThanOrEqual(2)
  }
  expect(
    Math.abs(medida.bordeDeLaTabla - medida.bordeDeLaCabecera),
    `${situacion}: la fila de cabeceras llega al borde derecho de la tabla`,
  ).toBeLessThanOrEqual(2)
  return medida
}

/** Espera a que la cabecera tenga estos rótulos: el cambio de una casilla repinta la tabla. */
const esperarCabeceras = async (page: Page, cuantas: number) =>
  expect.poll(async () => (await medir(page)).cabeceras.length).toBe(cuantas)

/** La vacante LLENA, en la pestaña de la prueba y con la tanda entera a la vista. */
async function abrirLaPrueba(page: Page): Promise<Map<string, FilaServida>> {
  await entrarAlPanel(page)
  const servidas = await interceptarRanking(page)
  await irAVacante(page, VACANTES.LLENA)
  await pestana(page, 'Prueba del puesto').click()
  await corte(page, 'Toda la tanda').click()
  await expect(cabecera(page, 'Ponderado')).toBeVisible()
  // Al menos dos personas: con una sola, una celda corrida no tendría con quién discrepar.
  await expect(filasDelRanking(page).nth(1)).toBeVisible()
  return servidas
}

/**
 * La vacante LLENA en «Perfil integral» —la pestaña por defecto, y la única con
 * Veredicto—, con la tanda entera a la vista.
 */
async function abrirElPerfil(page: Page): Promise<Map<string, FilaServida>> {
  await entrarAlPanel(page)
  const servidas = await interceptarRanking(page)
  await irAVacante(page, VACANTES.LLENA)
  await corte(page, 'Toda la tanda').click()
  await expect(page.getByRole('columnheader', { name: 'Veredicto', exact: true })).toBeVisible()
  await expect(filasDelRanking(page).nth(1)).toBeVisible()
  return servidas
}

test.describe('El selector de columnas del ranking, en la prueba del puesto', () => {
  let servidas: Map<string, FilaServida>
  test.beforeEach(async ({ page }) => {
    servidas = await abrirLaPrueba(page)
  })

  test('AC-01..03 · la casilla dice «Ponderado» y la explicación sigue en la cabecera', async ({
    page,
  }) => {
    await resumenColumnas(page).click()
    await expect(casilla(page, 'Ponderado')).toBeVisible()
    const rotulos = await rotulosDelMenu(page)
    expect(rotulos).toContain('Ponderado')
    for (const rotulo of rotulos) expect(rotulo).not.toContain('No es la nota final')
    // En una línea: mide lo mismo que la casilla de «#».
    const alto = async (nombre: string) =>
      (await page.locator('label', { has: casilla(page, nombre) }).boundingBox())!.height
    expect(Math.abs((await alto('Ponderado')) - (await alto('#')))).toBeLessThanOrEqual(1)
    // El menú flota sobre la tabla: se cierra para llegar a la cabecera.
    await resumenColumnas(page).click()

    const boton = cabecera(page, 'Ponderado').getByRole('button', { name: 'Ponderado', exact: true })
    await expect(boton).toHaveAttribute('title', 'Ordenar por Ponderado')
    await expect(cabecera(page, 'Ponderado')).toHaveAttribute('title', /No es la nota final/)
    /*
      Lo que enseña el navegador al pasar el cursor por la palabra es el `title`
      más cercano bajo el puntero. El botón llena la celda: si la explicación
      viviera solo en el `<th>`, aquí saldría «Ordenar por Ponderado».
    */
    const palabra = boton.locator('span[title]')
    await palabra.hover()
    const caja = (await palabra.boundingBox())!
    const titulo = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest('[title]')?.getAttribute('title') ?? null,
      [caja.x + caja.width / 2, caja.y + caja.height / 2] as const,
    )
    expect(titulo).toContain('No es la nota final')
  })

  test('AC-07/10 · con los criterios encendidos, el menú los nombra enteros y la tabla cuadra', async ({
    page,
  }) => {
    await resumenColumnas(page).click()
    await page.getByRole('checkbox', { name: /Ver los criterios/ }).check()
    for (const { criterio } of CRITERIOS) await expect(casilla(page, criterio)).toBeVisible()
    const conCriterios = await laTablaCuadra(page, servidas, 'con los criterios')
    // En la prueba no hay Veredicto que apagar: se apaga su columna de resumen.
    expect(conCriterios.cabeceras).not.toContain('Veredicto')
    await expect(casilla(page, 'Veredicto')).toHaveCount(0)

    await casilla(page, 'Ponderado').uncheck()
    await casilla(page, 'Estado').uncheck()
    await casilla(page, 'Ciudad').uncheck()
    await esperarCabeceras(page, conCriterios.cabeceras.length - 3)
    await laTablaCuadra(page, servidas, 'con los criterios y sin Ponderado, Estado ni Ciudad')
  })
})

/*
  Los recorridos que ocultan Veredicto, en la única pestaña donde existe (spec
  `veredicto-solo-en-el-perfil-integral`).
*/
test.describe('El selector de columnas del ranking, en el perfil integral', () => {
  let servidas: Map<string, FilaServida>
  test.beforeEach(async ({ page }) => {
    servidas = await abrirElPerfil(page)
  })

  test('AC-04/05 · ocultar Veredicto se lleva cabecera y celdas, y la leyenda', async ({ page }) => {
    const antes = await laTablaCuadra(page, servidas, 'con todas')
    expect(antes.cabeceras).toContain('Veredicto')
    // «Reseñas» arranca apagada: ya hay una oculta, y se dice en singular.
    expect(antes.cabeceras).not.toContain('Reseñas')
    await expect(resumenColumnas(page)).toHaveText(/^Columnas\s*1 oculta$/)
    await expect(leyendaDeVeredictos(page)).toBeVisible()

    await resumenColumnas(page).click()
    await expect(casilla(page, RESENAS)).not.toBeChecked()
    await casilla(page, 'Veredicto').uncheck()
    await esperarCabeceras(page, antes.cabeceras.length - 1)

    const despues = await laTablaCuadra(page, servidas, 'sin Veredicto')
    expect(despues.cabeceras).not.toContain('Veredicto')
    for (const fila of despues.filas) {
      for (const pildora of ['Alta', 'Con riesgo', 'No priorizado', 'Incompatible']) {
        expect(fila.celdas, `«${fila.nombre}» sigue con su veredicto`).not.toContain(pildora)
      }
    }
    await expect(leyendaDeVeredictos(page)).toHaveCount(0)
    // Veredicto y la «Reseñas» que arrancó apagada.
    await expect(resumenColumnas(page)).toHaveText(/^Columnas\s*2 ocultas$/)
  })

  test('AC-06 · Veredicto vuelve a su sitio al marcarlo y con «Ver todas»', async ({ page }) => {
    const deSiempre = (await medir(page)).cabeceras
    // En el perfil integral va justo detrás de «Nota»: allí no hay Ponderado.
    expect(deSiempre.indexOf('Veredicto')).toBe(deSiempre.indexOf('Nota') + 1)
    expect(deSiempre.indexOf('Estado')).toBe(deSiempre.indexOf('Veredicto') + 1)

    await resumenColumnas(page).click()
    await casilla(page, 'Veredicto').uncheck()
    await esperarCabeceras(page, deSiempre.length - 1)
    await casilla(page, 'Veredicto').check()
    await esperarCabeceras(page, deSiempre.length)
    expect((await laTablaCuadra(page, servidas, 'Veredicto marcado otra vez')).cabeceras).toEqual(
      deSiempre,
    )

    await casilla(page, 'Veredicto').uncheck()
    await esperarCabeceras(page, deSiempre.length - 1)
    await page.getByRole('button', { name: 'Ver todas', exact: true }).click()
    // «Ver todas» es todas: también «Reseñas», que arrancaba apagada y sale al final.
    await esperarCabeceras(page, deSiempre.length + 1)
    const conTodas = await laTablaCuadra(page, servidas, 'tras «Ver todas»')
    expect(conTodas.cabeceras).toEqual([...deSiempre, 'Reseñas'])
    for (const fila of conTodas.filas) {
      expect(fila.celdas[fila.celdas.length - 1], `bajo «Reseñas», «${fila.nombre}»`).toMatch(
        /^(—|\d,\d \(\d+\))$/,
      )
    }
    await expect(casilla(page, RESENAS)).toBeChecked()
    await expect(resumenColumnas(page)).not.toContainText('oculta')
    await expect(page.getByRole('button', { name: 'Ver todas', exact: true })).toHaveCount(0)
    await expect(leyendaDeVeredictos(page)).toBeVisible()

    // Apagar «Reseñas» devuelve la tabla de siempre, con su «1 oculta».
    await casilla(page, RESENAS).uncheck()
    await esperarCabeceras(page, deSiempre.length)
    expect((await laTablaCuadra(page, servidas, 'Reseñas apagada otra vez')).cabeceras).toEqual(
      deSiempre,
    )
    await expect(resumenColumnas(page)).toHaveText(/^Columnas\s*1 oculta$/)
  })

  test('AC-08/09 · sin Veredicto, la ficha y el «no hay» de un filtro ocupan el ancho entero', async ({
    page,
  }) => {
    await resumenColumnas(page).click()
    await casilla(page, 'Veredicto').uncheck()
    await resumenColumnas(page).click()
    const { cabeceras } = await medir(page)
    expect(cabeceras).not.toContain('Veredicto')

    const anchoEntero = async (celda: Locator, que: string) => {
      expect(await celda.evaluate((td) => (td as HTMLTableCellElement).colSpan), que).toBe(
        cabeceras.length,
      )
      const suCaja = (await celda.boundingBox())!
      const laCaja = (await laTabla(page).boundingBox())!
      expect(Math.abs(suCaja.width - laCaja.width), que).toBeLessThanOrEqual(2)
    }

    await filasDelRanking(page).first().locator('button[aria-expanded]').click()
    const ficha = laTabla(page).locator('td[id^="ficha-"]')
    await expect(ficha).toBeVisible()
    await anchoEntero(ficha, 'la ficha abierta')
    await filasDelRanking(page).first().locator('button[aria-expanded]').click()
    await expect(ficha).toHaveCount(0)

    await page.getByRole('searchbox').fill('nadie se llama así')
    const vacia = laTabla(page).locator('td', { hasText: 'Ningún resultado con estos filtros' })
    await expect(vacia).toBeVisible()
    await anchoEntero(vacia, 'el «no hay» del filtro')
  })
})

/*
  AC-11. En el teléfono «Columnas» vive dentro de «Más» y es el mismo menú. El
  proyecto `movil` mide 375 px: este bloque fija los 360 que pide la spec.
*/
test.describe('El selector de columnas en un teléfono de 360 px', () => {
  test.use({ viewport: { width: 360, height: 780 } })

  test('AC-11 · «Más» → «Columnas» dice «Ponderado», no ofrece Veredicto y la tabla no se descuadra', async ({
    page,
  }) => {
    const servidas = await abrirLaPrueba(page)
    await expect(resumenColumnas(page)).toBeHidden()
    await page.getByRole('button', { name: 'Más', exact: true }).click()
    await resumenColumnas(page).click()
    await expect(casilla(page, 'Ponderado')).toBeVisible()
    for (const rotulo of await rotulosDelMenu(page)) {
      expect(rotulo).not.toContain('No es la nota final')
    }
    /*
      ⚠️ **El menú tiene que caber en la pantalla.** `toBeVisible` no mira el
      viewport: con el panel anclado al borde derecho de «Columnas» —que en el
      teléfono queda a la izquierda— la lista salía por el borde izquierdo
      (x ≈ −200) y ninguna casilla se podía tocar, aunque el test la diera por
      visible. Se mide la lista entera, no una casilla suelta.
    */
    const ancho = page.viewportSize()!.width
    const lista = page.locator('details', { has: resumenColumnas(page) }).locator('summary + div')
    const cajaDeLaLista = (await lista.boundingBox())!
    expect(cajaDeLaLista.x, 'la lista de «Columnas» empieza dentro de la pantalla').toBeGreaterThanOrEqual(0)
    expect(
      cajaDeLaLista.x + cajaDeLaLista.width,
      'la lista de «Columnas» acaba dentro de la pantalla',
    ).toBeLessThanOrEqual(ancho)

    // En la prueba no hay Veredicto (spec `veredicto-solo-en-el-perfil-integral`).
    await expect(casilla(page, 'Veredicto')).toHaveCount(0)
    const antes = await medir(page)
    expect(antes.cabeceras).not.toContain('Veredicto')
    await casilla(page, 'Ponderado').uncheck()
    await esperarCabeceras(page, antes.cabeceras.length - 1)
    // El Ponderado y la «Reseñas» que arranca apagada.
    await expect(resumenColumnas(page)).toHaveText(/^Columnas\s*2 ocultas$/)
    await laTablaCuadra(page, servidas, '360 px sin Ponderado')

    // La página no rueda en horizontal: la tabla lo hace dentro de su envoltura.
    await resumenColumnas(page).click()
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(desborda, 'la página entera no debe poder desplazarse en horizontal').toBe(false)
  })
})
