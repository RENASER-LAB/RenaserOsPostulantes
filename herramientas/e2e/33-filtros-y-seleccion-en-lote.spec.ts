import { expect, test, type Page, type Route } from '@playwright/test'
import {
  API,
  abrirFiltros,
  botonFiltros,
  cerrarFiltros,
  corte,
  entrarAlPanel,
  filasDelRanking,
  idDeVacante,
  irAVacante,
  nombresVisibles,
  panelFiltros,
  pestana,
  tokenDelPanel,
  VACANTES,
} from './ayuda'

/**
 * El botón «Filtros», el filtro por fecha de postulación y la selección en lote
 * con la barra de acciones pegada abajo.
 *
 * ⚠️ **No escribe nada.** «Avanzar» se intercepta en la red y se contesta 204:
 * lo que se prueba es A QUIÉN manda el panel —solo a los que se ven—, no la
 * máquina de estados, que ya prueba `09-avance`. «Descartar…» se abre y se
 * cancela. Así este archivo se puede repetir contra el mismo clon sin moverle
 * la gente a los demás.
 *
 * ⚠️ **Ninguna cifra va escrita a mano.** Las fechas las pone el sembrador al
 * crear la base y cambian de una siembra a otra: lo que se espera se calcula de
 * la respuesta de la API, en la MISMA zona horaria que el navegador de la prueba.
 */

// El día calendario es el del navegador: se fija la zona para poder calcularlo
// también aquí sin depender del equipo que corra la prueba.
const ZONA = 'America/Lima'
test.use({ timezoneId: ZONA })

/** `AAAA-MM-DD` en la zona del navegador de la prueba. `en-CA` escribe así. */
const diaEnLaZona = (instante: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instante))

interface Fila {
  postulacionId: number
  candidato: string
  estadoCalificacion: string
  ciudadCodigo: string | null
  postuladoEn?: string | null
}

async function tandaPorApi(titulo: string, etapa = 'PERFIL_INTEGRAL'): Promise<Fila[]> {
  const id = await idDeVacante(titulo)
  const r = await fetch(`${API}/panel/vacantes/${id}/ranking?etapa=${etapa}`, {
    headers: { Authorization: `Bearer ${await tokenDelPanel()}` },
  })
  if (!r.ok) throw new Error(`el ranking de «${titulo}» contestó ${r.status}`)
  return (await r.json()).filas as Fila[]
}

const etiquetas = (page: Page) =>
  page.getByRole('list', { name: 'Filtros activos' }).getByRole('button')
const marcarTodo = (page: Page) =>
  page.getByRole('checkbox', { name: 'Marcar todas las que se ven' })
const barra = (page: Page) => page.getByRole('group', { name: 'Lo marcado' })
const ordenados = (nombres: string[]) => [...nombres].sort((a, b) => a.localeCompare(b, 'es'))

/**
 * Intercepta «Avanzar» y apunta a quién se mandó. Contesta 204, como el
 * backend cuando avanza: la base no se toca.
 */
async function interceptarAvance(page: Page): Promise<number[]> {
  const pedidos: number[] = []
  await page.route('**/postulaciones/*/confirmacion-avance', async (ruta: Route) => {
    const id = ruta.request().url().match(/postulaciones\/(\d+)\/confirmacion-avance/)?.[1]
    pedidos.push(Number(id))
    await ruta.fulfill({ status: 204, body: '' })
  })
  return pedidos
}

test.describe('Nuevo · «Filtros», fecha de postulación y selección en lote', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
    await irAVacante(page, VACANTES.LLENA)
    await corte(page, 'Toda la tanda').click()
  })

  // Recorrido 1 · AC-02, AC-03, AC-05, AC-06, AC-08, AC-09
  test('un día y un rango: conteos, etiquetas e insignia; quitar una y borrar todo', async ({ page }) => {
    const filas = await tandaPorApi(VACANTES.LLENA)
    const conFecha = filas.filter((f) => f.postuladoEn != null)
    expect(conFecha.length, 'el backend tiene que mandar postuladoEn en cada fila').toBeGreaterThan(0)
    const dias = [...new Set(conFecha.map((f) => diaEnLaZona(f.postuladoEn!)))].sort()
    const primerDia = dias[0]!
    const ultimoDia = dias[dias.length - 1]!
    const deEseDia = conFecha.filter((f) => diaEnLaZona(f.postuladoEn!) === primerDia)

    // Sin filtros: ni insignia, ni «Borrar filtros», ni etiquetas.
    await expect(botonFiltros(page)).toHaveText('Filtros')
    await expect(page.getByRole('button', { name: 'Borrar filtros' })).toHaveCount(0)
    await expect(page.getByRole('list', { name: 'Filtros activos' })).toHaveCount(0)

    await abrirFiltros(page)
    // En escritorio no es modal: sin fondo apagado, la tabla sigue detrás.
    await expect(panelFiltros(page)).toHaveAttribute('aria-modal', 'false')

    // Un día.
    await panelFiltros(page).getByLabel('Postulados el día').fill(primerDia)
    await expect(filasDelRanking(page)).toHaveCount(deEseDia.length)
    expect(ordenados(await nombresVisibles(page))).toEqual(ordenados(deEseDia.map((f) => f.candidato)))
    await expect(panelFiltros(page).getByText(`Se ven ${deEseDia.length} de ${filas.length}`)).toBeVisible()
    await expect(botonFiltros(page)).toContainText('1')
    await expect(etiquetas(page)).toHaveCount(1)
    await expect(etiquetas(page).first()).toContainText('Postulados el')

    // Un rango del primer al último día: todos los que tienen fecha, nadie sin ella.
    await panelFiltros(page).getByRole('radio', { name: 'Rango' }).check()
    await panelFiltros(page).getByLabel('Postulados desde').fill(primerDia)
    await panelFiltros(page).getByLabel('Postulados hasta').fill(ultimoDia)
    await expect(filasDelRanking(page)).toHaveCount(conFecha.length)
    await expect(etiquetas(page).first()).toContainText('Postulados')

    // Un segundo filtro, para quitar solo uno con su «×».
    await panelFiltros(page).getByRole('checkbox', { name: /^Calificada/ }).check()
    const calificadas = conFecha.filter((f) => f.estadoCalificacion === 'TERMINADA')
    await expect(filasDelRanking(page)).toHaveCount(calificadas.length)
    await expect(botonFiltros(page)).toContainText('2')
    await expect(etiquetas(page)).toHaveCount(2)

    await cerrarFiltros(page)
    await etiquetas(page).filter({ hasText: 'IA: calificada' }).click()
    await expect(etiquetas(page)).toHaveCount(1)
    await expect(filasDelRanking(page)).toHaveCount(conFecha.length)

    // «Borrar filtros» limpia todo, búsqueda incluida.
    await page.getByRole('searchbox').fill('a')
    await page.getByRole('button', { name: 'Borrar filtros' }).click()
    await expect(filasDelRanking(page)).toHaveCount(filas.length)
    await expect(page.getByRole('searchbox')).toHaveValue('')
    await expect(page.getByRole('list', { name: 'Filtros activos' })).toHaveCount(0)
    await expect(botonFiltros(page)).toHaveText('Filtros')
  })

  // AC-04b: abrir y cerrar el panel no mueve la tabla.
  test('el panel flota: abrirlo y cerrarlo no mueve ni una fila', async ({ page }) => {
    const cabecera = page.locator('table thead')
    const antes = await cabecera.boundingBox()
    await abrirFiltros(page)
    const abierto = await cabecera.boundingBox()
    await cerrarFiltros(page)
    const despues = await cabecera.boundingBox()
    expect(abierto!.y).toBe(antes!.y)
    expect(despues!.y).toBe(antes!.y)
    // El foco vuelve al botón (AC-04).
    await expect(botonFiltros(page)).toBeFocused()
  })

  // AC-11
  test('«Desde» después de «Hasta» no se aplica y se avisa junto a los campos', async ({ page }) => {
    const total = await filasDelRanking(page).count()
    await abrirFiltros(page)
    await panelFiltros(page).getByRole('radio', { name: 'Rango' }).check()
    await panelFiltros(page).getByLabel('Postulados desde').fill('2026-09-15')
    await panelFiltros(page).getByLabel('Postulados hasta').fill('2026-09-12')
    await expect(panelFiltros(page).getByRole('alert')).toContainText('«Desde» es posterior a «Hasta»')
    await expect(filasDelRanking(page)).toHaveCount(total)
    await expect(botonFiltros(page)).toHaveText('Filtros')
  })

  // AC-12
  test('«Últimos 7 días» rellena de hoy − 6 a hoy, editable', async ({ page }) => {
    await abrirFiltros(page)
    await panelFiltros(page).getByRole('button', { name: 'Últimos 7 días' }).click()
    const hoy = diaEnLaZona(new Date().toISOString())
    const haceSeis = diaEnLaZona(new Date(Date.now() - 6 * 86_400_000).toISOString())
    await expect(panelFiltros(page).getByLabel('Postulados hasta')).toHaveValue(hoy)
    await expect(panelFiltros(page).getByLabel('Postulados desde')).toHaveValue(haceSeis)
    await expect(panelFiltros(page).getByLabel('Postulados desde')).toBeEditable()
  })

  // Recorrido 2 · AC-13
  test('calificación con IA «Fallida»: solo las fallidas', async ({ page }) => {
    const filas = await tandaPorApi(VACANTES.LLENA)
    const fallidas = filas.filter((f) => f.estadoCalificacion === 'FALLIDA')
    await abrirFiltros(page)
    await panelFiltros(page).getByRole('checkbox', { name: /^Fallida/ }).check()
    await expect(filasDelRanking(page)).toHaveCount(fallidas.length)
    expect(ordenados(await nombresVisibles(page))).toEqual(ordenados(fallidas.map((f) => f.candidato)))
    await expect(etiquetas(page).first()).toContainText('IA: fallida')
    if (fallidas.length === 0) {
      await expect(page.locator('table tbody tr').last()).toContainText('Ningún resultado con estos filtros')
    }
  })

  // Recorrido 3 · AC-07
  test('los filtros se conservan al cambiar de etapa y volver', async ({ page }) => {
    const filas = await tandaPorApi(VACANTES.LLENA)
    const deLima = filas.filter((f) => f.ciudadCodigo === '1501')
    await abrirFiltros(page)
    await panelFiltros(page).getByRole('button', { name: /^Lima — Lima/ }).click()
    await cerrarFiltros(page)
    await expect(filasDelRanking(page)).toHaveCount(deLima.length)

    await pestana(page, 'Prueba del puesto').click()
    await expect(botonFiltros(page)).toContainText('1')
    await expect(etiquetas(page).first()).toContainText('Ciudad: Lima — Lima')
    await expect(filasDelRanking(page)).toHaveCount(deLima.length)

    await pestana(page, 'Perfil integral').click()
    await expect(botonFiltros(page)).toContainText('1')
    await expect(filasDelRanking(page)).toHaveCount(deLima.length)
  })

  // Recorrido 4 · AC-14, AC-18, AC-20
  test('marcar todo con un filtro puesto y avanzar: solo avanzan las que se ven', async ({ page }) => {
    const pedidos = await interceptarAvance(page)
    const filas = await tandaPorApi(VACANTES.LLENA)

    await abrirFiltros(page)
    await panelFiltros(page).getByRole('button', { name: /^Lima — Lima/ }).click()
    await cerrarFiltros(page)
    const visibles = await nombresVisibles(page)
    expect(visibles.length, 'el filtro tiene que dejar a alguien').toBeGreaterThan(0)
    expect(visibles.length, 'y esconder a alguien').toBeLessThan(filas.length)

    await marcarTodo(page).check()
    await expect(barra(page)).toContainText(
      `${visibles.length} ${visibles.length === 1 ? 'persona marcada' : 'personas marcadas'}`,
    )

    // Quitando el filtro, las ocultas siguen sin marcar: marcar todo no las tocó.
    await page.getByRole('button', { name: 'Borrar filtros' }).click()
    await expect(filasDelRanking(page)).toHaveCount(filas.length)
    expect(await marcarTodo(page).evaluate((c) => (c as HTMLInputElement).checked)).toBe(false)
    const marcadas = await filasDelRanking(page)
      .locator('input[aria-label^="Avanza "]:checked')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!.replace(/^Avanza /, '')))
    expect(ordenados(marcadas)).toEqual(ordenados(visibles))

    await barra(page).getByLabel('Motivo (obligatorio)').fill('E2E: solo las que se ven')
    await barra(page).getByRole('button', { name: /^Avanzar a/ }).click()
    await expect(
      page.locator('[role="status"]').filter({ hasText: /Avanzaron/ }),
    ).toBeVisible({ timeout: 20_000 })

    const esperados = filas.filter((f) => visibles.includes(f.candidato)).map((f) => f.postulacionId)
    expect([...pedidos].sort()).toEqual([...esperados].sort())
    // Y la barra se va con las marcas: solo queda el resultado.
    await expect(barra(page)).toHaveCount(0)
  })

  // Recorrido 5 · AC-16, AC-19
  test('con la tabla más alta que la ventana, «Descartar…» se alcanza sin bajar y enseña los nombres', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 560 })
    const nombres = await nombresVisibles(page)
    const dos = nombres.slice(0, 2)
    for (const nombre of dos) {
      await page.getByRole('checkbox', { name: `Avanza ${nombre}` }).check()
    }
    // La ficha de la primera fila, abierta, hace la tabla más alta que la ventana.
    await filasDelRanking(page).first().getByRole('button', { name: dos[0]! }).click()
    await filasDelRanking(page).first().scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, 120))

    const descartar = barra(page).getByRole('button', { name: 'Descartar…' })
    await expect(descartar).toBeInViewport()
    await expect(barra(page).getByRole('button', { name: /^Avanzar a 2 personas/ })).toBeInViewport()

    await barra(page).getByLabel('Motivo (obligatorio)').fill('E2E: solo mirar la ventana')
    await descartar.click()
    const ventana = page.getByRole('dialog', { name: 'Descartar a 2 personas' })
    await expect(ventana).toBeVisible()
    for (const nombre of dos) await expect(ventana.getByText(nombre, { exact: true })).toBeVisible()
    // No se confirma: no sale ni un correo.
    await ventana.getByRole('button', { name: 'Cancelar' }).click()
    await expect(ventana).toHaveCount(0)
  })

  // Recorrido 6 · AC-15
  test('marcar todo funciona igual en dos etapas distintas', async ({ page }) => {
    for (const etapa of ['Perfil integral', 'Prueba del puesto']) {
      await pestana(page, etapa).click()
      await corte(page, 'Toda la tanda').click()
      const cuantas = await filasDelRanking(page).count()
      if (cuantas === 0) continue
      await marcarTodo(page).check()
      await expect(
        filasDelRanking(page).locator('input[aria-label^="Avanza "]:checked'),
      ).toHaveCount(cuantas)
      await expect(barra(page)).toContainText(
        `${cuantas} ${cuantas === 1 ? 'persona marcada' : 'personas marcadas'}`,
      )
      // Con una suelta, la cabecera queda en intermedio.
      if (cuantas > 1) {
        await filasDelRanking(page).first().locator('input[aria-label^="Avanza "]').uncheck()
        expect(await marcarTodo(page).evaluate((c) => (c as HTMLInputElement).indeterminate)).toBe(true)
      }
      await barra(page).getByRole('button', { name: 'Soltar selección' }).click()
      await expect(barra(page)).toHaveCount(0)
    }
  })
})
