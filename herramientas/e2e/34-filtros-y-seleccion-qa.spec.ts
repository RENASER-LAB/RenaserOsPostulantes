import { expect, test, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  abrirFiltros,
  botonFiltros,
  cerrarFiltros,
  corte,
  entrarAlPanel,
  filasDelRanking,
  irAVacante,
  nombresVisibles,
  panelFiltros,
  pestana,
  VACANTES,
} from './ayuda'
import {
  PANEL_SIN_MOVER,
  TITULO_OTRA,
  TITULO_TANDA,
  ZONA,
  estadoDeLaPostulacion,
  retirarLoSembrado,
  sembrarTerreno,
  sumarDias,
  tokenDePanelDe,
  transicionesDe,
  type Sembrada,
  type Terreno,
} from './ayuda-filtros-y-seleccion'

/**
 * QA de «Filtros», fecha de postulación y selección en lote, sobre un terreno
 * PROPIO: 32 postulaciones en 9 días de Lima, con la IA en sus cuatro estados
 * (ver `ayuda-filtros-y-seleccion.ts`). La siembra de siempre trae cuatro
 * postulaciones del mismo día y ninguna calificación con IA, y con eso ni el
 * filtro de fecha ni el de la IA se pueden probar de verdad.
 *
 * ⚠️ **Lo esperado se calcula del terreno sembrado, no de la pantalla.** Si la
 * pantalla filtra mal, compararla consigo misma no lo vería.
 *
 * ⚠️ **Escribe en la base solo en dos pruebas, y sobre lo suyo:** el avance real
 * (AC-18) y el intento sin permiso (AC-23). Lo demás no confirma nada —el
 * descarte se abre y se cancela—. Todo se retira al terminar.
 */

test.use({ timezoneId: ZONA })

let terreno: Terreno
test.beforeAll(() => {
  terreno = sembrarTerreno()
})
test.afterAll(() => {
  retirarLoSembrado(terreno?.correos ?? [])
})

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** «13 sep», con el año solo si no es el de hoy: como lo escribe la etiqueta. */
const diaDicho = (dia: string): string => {
  const [a, m, d] = dia.split('-').map(Number)
  const anioHoy = Number(terreno.hoy.slice(0, 4))
  return `${d} ${MESES[m! - 1]}${a === anioHoy ? '' : ` ${a}`}`
}

const etiquetas = (page: Page) => page.getByRole('list', { name: 'Filtros activos' }).getByRole('button')
const marcarTodo = (page: Page) => page.getByRole('checkbox', { name: 'Marcar todas las que se ven' })
const barra = (page: Page) => page.getByRole('group', { name: 'Lo marcado' })
const casilla = (page: Page, nombre: string) =>
  page.getByRole('checkbox', { name: `Avanza ${nombre}`, exact: true })
const ordenados = (nombres: string[]) => [...nombres].sort((a, b) => a.localeCompare(b, 'es'))
const nombresDe = (filas: Sembrada[]) => ordenados(filas.map((f) => f.nombre))
const la = (n: number) => terreno.filas[n - 1]!

async function abrirVacante(page: Page, id: number = terreno.tanda) {
  await page.goto(`/admin/vacantes/${id}`)
  await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()
}

async function entrarComo(page: Page, renaserOsId: string) {
  const token = await tokenDePanelDe(renaserOsId)
  await page.addInitScript(
    ([clave, valor]) => window.localStorage.setItem(clave as string, valor as string),
    ['renaser_panel_token', token],
  )
}

test.describe('QA · filtros y selección en lote, con la tanda de 32', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  // AC-02, AC-03, AC-05, AC-08, AC-09, AC-10
  test('fecha: un día, rango inclusivo, solo «Desde» y solo «Hasta»; tres filtros son tres etiquetas y la «×» quita solo el suyo', async ({ page }) => {
    await abrirVacante(page)
    await corte(page, 'Toda la tanda').click()
    const todas = terreno.filas
    await expect(filasDelRanking(page)).toHaveCount(todas.length)

    // AC-02: sin filtros no hay insignia, ni «Borrar filtros», ni fila de etiquetas.
    await expect(botonFiltros(page)).toHaveText('Filtros')
    await expect(page.getByRole('button', { name: 'Borrar filtros' })).toHaveCount(0)
    await expect(page.getByRole('list', { name: 'Filtros activos' })).toHaveCount(0)

    await abrirFiltros(page)
    const panel = panelFiltros(page)

    // AC-08: un día calendario.
    const d9 = sumarDias(terreno.hoy, -9)
    const deD9 = todas.filter((f) => f.dia === d9)
    expect(deD9.length).toBeGreaterThan(1)
    await panel.getByLabel('Postulados el día').fill(d9)
    await expect(filasDelRanking(page)).toHaveCount(deD9.length)
    expect(ordenados(await nombresVisibles(page))).toEqual(nombresDe(deD9))
    await expect(panel.getByText(`Se ven ${deD9.length} de ${todas.length}`)).toBeVisible()
    await expect(etiquetas(page)).toHaveCount(1)
    await expect(etiquetas(page).first()).toContainText(`Postulados el ${diaDicho(d9)}`)
    await expect(botonFiltros(page)).toContainText('1 activo')

    // AC-09: rango con los dos extremos dentro.
    const desde = sumarDias(terreno.hoy, -5)
    const hasta = sumarDias(terreno.hoy, -1)
    await panel.getByRole('radio', { name: 'Rango' }).check()
    await panel.getByLabel('Postulados desde').fill(desde)
    await panel.getByLabel('Postulados hasta').fill(hasta)
    const enRango = todas.filter((f) => f.dia >= desde && f.dia <= hasta)
    expect(enRango.some((f) => f.dia === desde) && enRango.some((f) => f.dia === hasta)).toBe(true)
    await expect(filasDelRanking(page)).toHaveCount(enRango.length)
    expect(ordenados(await nombresVisibles(page))).toEqual(nombresDe(enRango))
    await expect(etiquetas(page).first()).toContainText('Postulados del')

    // AC-10: solo «Desde»…
    await panel.getByLabel('Postulados hasta').fill('')
    const enAdelante = todas.filter((f) => f.dia >= desde)
    await expect(filasDelRanking(page)).toHaveCount(enAdelante.length)
    await expect(etiquetas(page).first()).toContainText(`Postulados desde el ${diaDicho(desde)}`)
    // …y solo «Hasta».
    const tope = sumarDias(terreno.hoy, -15)
    await panel.getByLabel('Postulados desde').fill('')
    await panel.getByLabel('Postulados hasta').fill(tope)
    const hastaTope = todas.filter((f) => f.dia <= tope)
    await expect(filasDelRanking(page)).toHaveCount(hastaTope.length)
    expect(ordenados(await nombresVisibles(page))).toEqual(nombresDe(hastaTope))
    await expect(etiquetas(page).first()).toContainText(`Postulados hasta el ${diaDicho(tope)}`)

    // AC-03: tres filtros —fecha, IA y ciudad—, tres etiquetas y la insignia en 3.
    await panel.getByLabel('Postulados desde').fill(tope)
    await panel.getByLabel('Postulados hasta').fill(terreno.hoy)
    await panel.getByRole('checkbox', { name: /^Calificada/ }).check()
    await panel.getByRole('button', { name: /^Lima — Lima/ }).click()
    const tres = todas.filter((f) => f.dia >= tope && f.ia === 'TERMINADA' && f.ciudad === '1501')
    await expect(filasDelRanking(page)).toHaveCount(tres.length)
    await expect(botonFiltros(page)).toContainText('3 activos')
    await expect(etiquetas(page)).toHaveCount(3)
    await expect(etiquetas(page).nth(1)).toContainText('IA: calificada')
    await expect(etiquetas(page).nth(2)).toContainText('Ciudad: Lima — Lima')
    await cerrarFiltros(page)

    // AC-05: la «×» de la ciudad quita solo la ciudad.
    await etiquetas(page).filter({ hasText: 'Ciudad:' }).click()
    const sinCiudad = todas.filter((f) => f.dia >= tope && f.ia === 'TERMINADA')
    await expect(filasDelRanking(page)).toHaveCount(sinCiudad.length)
    await expect(etiquetas(page)).toHaveCount(2)
    await expect(botonFiltros(page)).toContainText('2 activos')
    await expect(botonFiltros(page)).toBeFocused()
  })

  // AC-13 y el aviso de la sección fuera del perfil (comportamiento 11).
  test('IA: «Fallida» deja solo las fallidas, dos casillas son la unión y cada casilla cuenta la tanda', async ({ page }) => {
    await abrirVacante(page)
    await corte(page, 'Toda la tanda').click()
    const todas = terreno.filas
    const cuenta = (ia: string) => todas.filter((f) => f.ia === ia).length

    await abrirFiltros(page)
    const panel = panelFiltros(page)
    await expect(panel.locator('label', { hasText: 'Calificada' })).toContainText(String(cuenta('TERMINADA')))
    await expect(panel.locator('label', { hasText: 'En curso' })).toContainText(String(cuenta('EN_CURSO')))
    await expect(panel.locator('label', { hasText: 'Fallida' })).toContainText(String(cuenta('FALLIDA')))
    await expect(panel.getByText('Es la calificación del currículum.')).toHaveCount(0)

    await panel.getByRole('checkbox', { name: /^Fallida/ }).check()
    const fallidas = todas.filter((f) => f.ia === 'FALLIDA')
    await expect(filasDelRanking(page)).toHaveCount(fallidas.length)
    expect(ordenados(await nombresVisibles(page))).toEqual(nombresDe(fallidas))
    await expect(etiquetas(page).first()).toContainText('IA: fallida')

    await panel.getByRole('checkbox', { name: /^En curso/ }).check()
    const union = todas.filter((f) => f.ia === 'FALLIDA' || f.ia === 'EN_CURSO')
    await expect(filasDelRanking(page)).toHaveCount(union.length)
    expect(ordenados(await nombresVisibles(page))).toEqual(nombresDe(union))
    await expect(etiquetas(page).first()).toContainText('IA: en curso o fallida')
    await cerrarFiltros(page)

    // Fuera del perfil: el mismo filtro, las mismas filas, y la sección lo aclara.
    await pestana(page, 'Prueba del puesto').click()
    await expect(filasDelRanking(page)).toHaveCount(union.length)
    await abrirFiltros(page)
    await expect(panelFiltros(page).getByText('Es la calificación del currículum.')).toBeVisible()
  })

  // Riesgo «zona horaria en el borde de medianoche» y AC-12 con «Hoy» y «Últimos 30 días».
  test('medianoche de Lima: 23:30 y 00:30 caen en su día calendario; «Hoy» y «Últimos 30 días» rellenan un rango editable', async ({ page }) => {
    await abrirVacante(page)
    await corte(page, 'Toda la tanda').click()
    await abrirFiltros(page)
    const panel = panelFiltros(page)
    const { antes, despues } = terreno.medianoche

    await panel.getByLabel('Postulados el día').fill(antes.dia)
    await expect(filasDelRanking(page)).toHaveCount(1)
    expect(await nombresVisibles(page)).toEqual([antes.nombre])
    await panel.getByLabel('Postulados el día').fill(despues.dia)
    await expect(filasDelRanking(page).filter({ hasText: despues.nombre })).toHaveCount(1)
    expect(await nombresVisibles(page)).toEqual([despues.nombre])

    await panel.getByRole('button', { name: 'Hoy' }).click()
    await expect(panel.getByRole('radio', { name: 'Rango' })).toBeChecked()
    await expect(panel.getByLabel('Postulados desde')).toHaveValue(terreno.hoy)
    await expect(panel.getByLabel('Postulados hasta')).toHaveValue(terreno.hoy)
    const deHoy = terreno.filas.filter((f) => f.desfase === 0)
    await expect(filasDelRanking(page)).toHaveCount(deHoy.length)
    expect(ordenados(await nombresVisibles(page))).toEqual(nombresDe(deHoy))

    await panel.getByRole('button', { name: 'Últimos 30 días' }).click()
    const desde = sumarDias(terreno.hoy, -29)
    await expect(panel.getByLabel('Postulados desde')).toHaveValue(desde)
    await expect(filasDelRanking(page)).toHaveCount(terreno.filas.filter((f) => f.dia >= desde).length)
    await expect(panel.getByLabel('Postulados desde')).toBeEditable()
  })

  // Comportamiento 10 —quien no tiene fecha, nula o ausente, queda fuera de un
  // filtro de fecha— es una regla de `filtrarFino` y se fija sin navegador en
  // `ranking.test.ts` («quien no tiene fecha queda fuera en cuanto hay filtro de fecha»).

  // AC-20, AC-06, AC-19 y AC-15 (intermedio).
  test('seis marcadas y un filtro que esconde dos: la barra dice 4 · 2 fuera de vista, «Descartar…» nombra solo a las 4 y «Borrar filtros» no toca las marcas', async ({ page }) => {
    await abrirVacante(page)
    await corte(page, 'Toda la tanda').click()
    const deLima = [la(1), la(4), la(7), la(10)]
    const deCusco = [la(2), la(5)]
    expect(deLima.every((f) => f.ciudad === '1501') && deCusco.every((f) => f.ciudad === '0801')).toBe(true)
    for (const f of [...deLima, ...deCusco]) await casilla(page, f.nombre).check()
    await expect(barra(page)).toContainText('6 personas marcadas')
    expect(await marcarTodo(page).evaluate((c) => (c as HTMLInputElement).indeterminate)).toBe(true)

    await abrirFiltros(page)
    await panelFiltros(page).getByRole('button', { name: /^Lima — Lima/ }).click()
    await cerrarFiltros(page)
    await expect(barra(page)).toContainText('4 personas marcadas · 2 fuera de vista')
    await expect(barra(page).getByRole('button', { name: 'Avanzar a 4 personas' })).toBeVisible()

    // AC-19: la ventana nombra a las cuatro que se ven y a nadie más; cancelar no descarta.
    await barra(page).getByLabel('Motivo (obligatorio)').fill('E2E QA 43ca: solo mirar la ventana')
    await barra(page).getByRole('button', { name: 'Descartar…' }).click()
    const ventana = page.getByRole('dialog', { name: 'Descartar a 4 personas' })
    await expect(ventana).toBeVisible()
    expect(ordenados(await ventana.locator('ul li').allTextContents())).toEqual(nombresDe(deLima))
    await ventana.getByRole('button', { name: 'Cancelar' }).click()
    await expect(ventana).toHaveCount(0)
    for (const f of [...deLima, ...deCusco]) {
      expect(estadoDeLaPostulacion(f.postulacionId)).toBe(f.estado)
      expect(transicionesDe(f.postulacionId)).toBe(0)
    }

    // AC-06: «Borrar filtros» vuelve a enseñar toda la tanda y deja las seis marcas.
    await page.getByRole('button', { name: 'Borrar filtros' }).first().click()
    await expect(filasDelRanking(page)).toHaveCount(terreno.filas.length)
    await expect(barra(page)).toContainText('6 personas marcadas')
    await expect(page.locator('input[aria-label^="Avanza "]:checked')).toHaveCount(6)

    // «Soltar las ocultas» suelta solo las dos de Cusco.
    await abrirFiltros(page)
    await panelFiltros(page).getByRole('button', { name: /^Lima — Lima/ }).click()
    await cerrarFiltros(page)
    await barra(page).getByRole('button', { name: 'Soltar las ocultas' }).click()
    await expect(barra(page).locator('p').first()).toHaveText('4 personas marcadas')
    await page.getByRole('button', { name: 'Borrar filtros' }).first().click()
    const marcadas = await page
      .locator('input[aria-label^="Avanza "]:checked')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!.replace(/^Avanza /, '')))
    expect(ordenados(marcadas)).toEqual(nombresDe(deLima))
  })

  // AC-22 y el riesgo «conservar filtros entre etapas con resultado vacío».
  test('un filtro conservado deja vacía otra etapa: se explica cuántas hay sin filtrar, la cabecera se apaga y «Borrar filtros» las devuelve', async ({ page }) => {
    await abrirVacante(page)
    const fallidasPendientes = terreno.filas.filter((f) => f.ia === 'FALLIDA' && f.estado === 'PERFIL_POR_CONFIRMAR')
    await abrirFiltros(page)
    await panelFiltros(page).getByRole('checkbox', { name: /^Fallida/ }).check()
    await cerrarFiltros(page)
    await expect(filasDelRanking(page)).toHaveCount(fallidasPendientes.length)

    await pestana(page, 'Prueba del puesto').click()
    const pendientesDeLaPrueba = terreno.filas.filter((f) => f.estado === 'PRUEBA_POR_CONFIRMAR')
    expect(pendientesDeLaPrueba.some((f) => f.ia === 'FALLIDA')).toBe(false)
    await expect(filasDelRanking(page)).toHaveCount(0)
    await expect(page.locator('table tbody')).toContainText(
      `Ningún resultado con estos filtros. Hay ${pendientesDeLaPrueba.length} sin filtrar`,
    )
    await expect(marcarTodo(page)).toBeDisabled()
    await expect(botonFiltros(page)).toContainText('1 activo')
    await expect(etiquetas(page).first()).toContainText('IA: fallida')

    await page.locator('table tbody').getByRole('button', { name: 'Borrar filtros' }).click()
    await expect(filasDelRanking(page)).toHaveCount(pendientesDeLaPrueba.length)
    await expect(marcarTodo(page)).toBeEnabled()
    await expect(botonFiltros(page)).toHaveText('Filtros')
  })

  // AC-07, segunda mitad: al cambiar de vacante por la propia aplicación, se reinician.
  test('los filtros se reinician al pasar a otra vacante y al volver', async ({ page }) => {
    await abrirVacante(page)
    await abrirFiltros(page)
    await panelFiltros(page).getByRole('checkbox', { name: /^Calificada/ }).check()
    await cerrarFiltros(page)
    await expect(botonFiltros(page)).toContainText('1 activo')

    const irA = async (titulo: string) => {
      await page.getByRole('link', { name: /Volver a las vacantes/ }).click()
      await page
        .getByRole('row', { name: new RegExp(titulo) })
        .getByRole('link', { name: 'Ver postulantes y gestionar' })
        .click()
      await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()
    }
    await irA(TITULO_OTRA)
    await expect(page).toHaveURL(new RegExp(`/admin/vacantes/${terreno.otra}$`))
    await expect(botonFiltros(page)).toHaveText('Filtros')
    await expect(page.getByRole('list', { name: 'Filtros activos' })).toHaveCount(0)

    await irA(TITULO_TANDA)
    await expect(page).toHaveURL(new RegExp(`/admin/vacantes/${terreno.tanda}$`))
    await expect(botonFiltros(page)).toHaveText('Filtros')
  })

  // AC-21 con los filtros nuevos.
  test('el Excel lleva exactamente las filas visibles con fecha e IA puestas, en el mismo orden, y dice el recorte', async ({ page }) => {
    await abrirVacante(page)
    await corte(page, 'Toda la tanda').click()
    await abrirFiltros(page)
    const panel = panelFiltros(page)
    await panel.getByRole('radio', { name: 'Rango' }).check()
    const desde = sumarDias(terreno.hoy, -15)
    const hasta = sumarDias(terreno.hoy, -1)
    await panel.getByLabel('Postulados desde').fill(desde)
    await panel.getByLabel('Postulados hasta').fill(hasta)
    await panel.getByRole('checkbox', { name: /^Calificada/ }).check()
    await cerrarFiltros(page)
    const esperadas = terreno.filas.filter((f) => f.dia >= desde && f.dia <= hasta && f.ia === 'TERMINADA')
    await expect(filasDelRanking(page)).toHaveCount(esperadas.length)
    const enPantalla = await nombresVisibles(page)
    expect(ordenados(enPantalla)).toEqual(nombresDe(esperadas))

    const boton = page.getByRole('button', { name: `Descargar Excel (${enPantalla.length})` })
    const espera = page.waitForEvent('download', { timeout: 30_000 })
    await boton.click()
    const descarga = await espera
    const ruta = join(mkdtempSync(join(tmpdir(), 'qa-43ca-excel-')), descarga.suggestedFilename())
    await descarga.saveAs(ruta)
    const { filas, texto } = JSON.parse(
      execFileSync('python3', [
        '-c',
        `
import json, sys, warnings, openpyxl
warnings.simplefilter('ignore')
libro = openpyxl.load_workbook(sys.argv[1], data_only=True)
# La hoja única del formato del cliente («Datos»): la cabecera es la fila con «Candidato».
hoja = libro.worksheets[0]
tabla = [['' if c is None else str(c).strip() for c in f] for f in hoja.iter_rows(values_only=True)]
i = next(n for n, f in enumerate(tabla) if any(c == 'Candidato' for c in f))
filas = []
for f in tabla[i + 1:]:
    if all(c == '' for c in f) or (f and f[0].startswith('Filtro aplicado')):
        break
    filas.append(f)
texto = '\\n'.join(str(c) for h in libro.worksheets for f in h.iter_rows(values_only=True) for c in f if c is not None)
print(json.dumps({'filas': filas, 'texto': texto}))
`,
        ruta,
      ]).toString(),
    ) as { filas: string[][]; texto: string }
    const enLaHoja = filas.map((f) => f.find((c) => enPantalla.includes(c)) ?? f.join(' '))
    expect(enLaHoja).toEqual(enPantalla)
    // El pie de la hoja dice el recorte con las mismas palabras que las etiquetas.
    expect(texto).toContain('Filtro aplicado:')
    expect(texto).toContain(`Postulados del`)
    expect(texto).toContain('IA: calificada')
  })

  // AC-16: la tabla más alta que la ventana y la barra a la vista a media tabla.
  test('a media tabla, «Avanzar» y «Descartar…» están a la vista y la barra va pegada al borde inferior', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 })
    await abrirVacante(page)
    await corte(page, 'Toda la tanda').click()
    await casilla(page, la(1).nombre).check()
    await casilla(page, la(2).nombre).check()
    await casilla(page, la(16).nombre).scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, 200))
    const caja = page.locator('[role="group"][aria-label="Lo marcado"]').locator('xpath=..')
    const b = (await caja.boundingBox())!
    expect(Math.round(b.y + b.height)).toBeGreaterThanOrEqual(595)
    expect(Math.round(b.y + b.height)).toBeLessThanOrEqual(600)
    await expect(barra(page).getByRole('button', { name: 'Avanzar a 2 personas' })).toBeInViewport()
    await expect(barra(page).getByRole('button', { name: 'Descartar…' })).toBeInViewport()
    // Y al final de la página la barra no tapa la última fila.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const ultima = (await filasDelRanking(page).last().boundingBox())!
    const alFinal = (await caja.boundingBox())!
    expect(ultima.y + ultima.height).toBeLessThanOrEqual(alFinal.y + 1)
  })
})

test.describe('QA · el día calendario es el del navegador', () => {
  // Tokio va 14 horas por delante de Lima: las dos del borde de medianoche caen el mismo día.
  test.use({ timezoneId: 'Asia/Tokyo' })

  test('en Tokio, el 23:30 y el 00:30 de Lima son del mismo día calendario', async ({ page }) => {
    await entrarAlPanel(page)
    await abrirVacante(page)
    await corte(page, 'Toda la tanda').click()
    await abrirFiltros(page)
    const { antes, despues } = terreno.medianoche
    await panelFiltros(page).getByLabel('Postulados el día').fill(despues.dia)
    await expect(filasDelRanking(page)).toHaveCount(2)
    expect(ordenados(await nombresVisibles(page))).toEqual(ordenados([antes.nombre, despues.nombre]))
  })
})

test.describe('QA · regresiones de lo encontrado explorando', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  test('F-01 · en escritorio no se pinta «Más»: lo que recoge ya está a la vista', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await abrirVacante(page)
    await expect(page.getByText('Columnas', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Más', exact: true })).toBeHidden()
  })

  test('F-02 · clic fuera, sobre algo que no es un control: el panel se cierra y el foco vuelve a «Filtros»', async ({ page }) => {
    await abrirVacante(page)
    await abrirFiltros(page)
    await page.getByRole('heading', { level: 1 }).click()
    await expect(panelFiltros(page)).toHaveCount(0)
    await expect(botonFiltros(page)).toBeFocused()
  })

  // El panel flota ENCIMA de la tabla: el clic fuera más probable cae en el
  // ranking, que es un `tabpanel` con tabindex 0. Un texto suyo no es un control
  // que alguien pulsó, y el foco tiene que volver a «Filtros» como con el título.
  test('F-02 · clic fuera sobre un texto del ranking (no un control): el panel se cierra y el foco vuelve a «Filtros»', async ({ page }) => {
    await abrirVacante(page)
    await abrirFiltros(page)
    await page.getByRole('tabpanel').getByText(/ya calificados/).first().click()
    await expect(panelFiltros(page)).toHaveCount(0)
    await expect(botonFiltros(page)).toBeFocused()
  })

  // F-06 · «Borrar filtros» de la barra: a dónde va el foco lo fija con exactitud
  // `08-teclado-y-consola` («la barra lo manda a «Filtros» y el pie lo conserva»);
  // Enter sobre un botón dispara el mismo clic.

  test('F-06 · «Borrar filtros» de la tabla vacía, con teclado: devuelve las filas y el foco no cae al vacío', async ({ page }) => {
    await abrirVacante(page)
    await corte(page, 'Toda la tanda').click()
    await page.getByRole('searchbox', { name: /buscar por nombre/i }).fill('zzz-nadie-se-llama-asi')
    const frase = page.getByText(/Ningún resultado con estos filtros/)
    await expect(frase).toBeVisible()
    const borrar = frase.locator('xpath=..').getByRole('button', { name: 'Borrar filtros' })
    await borrar.focus()
    await page.keyboard.press('Enter')
    await expect(filasDelRanking(page)).toHaveCount(terreno.filas.length)
    const perdido = await page.evaluate(() => !document.activeElement || document.activeElement === document.body)
    expect(perdido, 'el foco quedó en <body>: quien va con teclado pierde su sitio').toBe(false)
  })

  test('F-06 · «Borrar filtros» del pie del panel, con teclado: el foco sigue dentro del panel', async ({ page }) => {
    await abrirVacante(page)
    await corte(page, 'Toda la tanda').click()
    await abrirFiltros(page)
    const panel = panelFiltros(page)
    await panel.getByRole('checkbox', { name: /^Fallida/ }).check()
    await panel.getByRole('button', { name: 'Borrar filtros' }).focus()
    await page.keyboard.press('Enter')
    await expect(panel.getByRole('checkbox', { name: /^Fallida/ })).not.toBeChecked()
    const dentro = await page.evaluate(
      () => !!document.activeElement?.closest('[role="dialog"][aria-label="Filtros"]'),
    )
    expect(dentro, 'el foco salió del panel abierto (quedó en <body>)').toBe(true)
  })

  test('F-03 · con el panel abierto y la tabla recorrida, pulsar una casilla la marca y la página no salta', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await abrirVacante(page)
    await corte(page, 'Toda la tanda').click()
    await abrirFiltros(page)
    await page.evaluate(() => window.scrollTo(0, 2000))
    // Una casilla que se ve en la ventana, por debajo de la cabecera del panel.
    const casillas = page.locator('input[aria-label^="Avanza "]')
    let elegida: string | null = null
    let centro = { x: 0, y: 0 }
    for (let i = 0; i < (await casillas.count()); i++) {
      const b = await casillas.nth(i).boundingBox()
      if (b && b.y > 150 && b.y < 500) {
        elegida = await casillas.nth(i).getAttribute('aria-label')
        centro = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
        break
      }
    }
    expect(elegida, 'tiene que haber una casilla a la vista').not.toBeNull()
    const antes = await page.evaluate(() => window.scrollY)
    await page.mouse.click(centro.x, centro.y)
    await expect(page.getByRole('checkbox', { name: elegida!, exact: true })).toBeChecked()
    const despues = await page.evaluate(() => window.scrollY)
    expect(Math.abs(despues - antes)).toBeLessThan(50)
  })

  test('F-03 · con el panel abierto y la página bajada hasta sus chips, «Descargar Excel» baja el archivo al primer clic', async ({ page }) => {
    // Es el recorrido de 05-excel «EL EXCEL RESPETA EL FILTRO», que con este panel se
    // quedó esperando la descarga: el clic se pierde porque la página salta al cerrar.
    // Sobre la vacante sembrada de siempre y sin escribir nada: con cuatro filas, el
    // panel abierto es lo que alarga la página, y al cerrarse la página se recoge.
    await page.setViewportSize({ width: 1280, height: 720 })
    await irAVacante(page, VACANTES.LLENA)
    await abrirFiltros(page)
    await panelFiltros(page).getByRole('button', { name: /^Lima — Lima/ }).click()
    const boton = page.getByRole('button', { name: /^Descargar Excel \(\d+\)$/ })
    const espera = page.waitForEvent('download', { timeout: 10_000 })
    await boton.click()
    const descarga = await espera
    expect(descarga.suggestedFilename()).toMatch(/\.xlsx$/)
  })

  test('F-04 · salir del panel con Tab no deja el foco escondido debajo del panel', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await abrirVacante(page)
    await corte(page, 'Toda la tanda').click()
    await abrirFiltros(page)
    await panelFiltros(page).getByRole('button', { name: 'Listo' }).focus()
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      const tapado = await page.evaluate(() => {
        const foco = document.activeElement as HTMLElement | null
        const panel = document.querySelector('[role="dialog"][aria-label="Filtros"]')
        if (!foco || !panel || panel.contains(foco)) return null
        const r = foco.getBoundingClientRect()
        const encima = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
        return encima && panel.contains(encima) ? (foco.getAttribute('aria-label') ?? foco.textContent ?? '').trim() : null
      })
      expect(tapado, `el foco está en «${tapado}», tapado por el panel`).toBeNull()
    }
  })

  test('F-05 · en una ventana de 768 px (tableta en vertical) el panel cabe sin crear scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await abrirVacante(page)
    await abrirFiltros(page)
    const caja = (await panelFiltros(page).boundingBox())!
    expect(caja.x + caja.width).toBeLessThanOrEqual(768)
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(desborda).toBe(0)
  })
})

test.describe('QA · sin permiso de mover postulaciones', () => {
  // AC-23
  test('la barra no ofrece «Descartar…» y «Avanzar» falla por fila con el mensaje del backend, sin mover a nadie', async ({ page }) => {
    await entrarComo(page, PANEL_SIN_MOVER)
    await abrirVacante(page)
    const dos = [la(1), la(4)]
    for (const f of dos) await casilla(page, f.nombre).check()
    await expect(barra(page).getByRole('button', { name: 'Avanzar a 2 personas' })).toBeVisible()
    await expect(barra(page).getByRole('button', { name: /^Descartar/ })).toHaveCount(0)

    await barra(page).getByLabel('Motivo (obligatorio)').fill('E2E QA 43ca: sin permiso')
    await barra(page).getByRole('button', { name: 'Avanzar a 2 personas' }).click()
    const resultado = page.locator('[role="status"]').filter({ hasText: /No avanzaron:/ })
    await expect(resultado).toBeVisible({ timeout: 20_000 })
    for (const f of dos) {
      await expect(resultado).toContainText(f.nombre)
      expect(estadoDeLaPostulacion(f.postulacionId)).toBe(f.estado)
      expect(transicionesDe(f.postulacionId)).toBe(0)
    }
    await expect(resultado).toContainText('No tienes permiso')
  })
})

test.describe('QA · avance real desde la barra', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  // AC-14, AC-18 y AC-20 contra el backend de verdad. Va al final: mueve a cinco.
  test('marcar todo con un filtro, soltar una y avanzar: solo cambian de estado las cinco visibles marcadas', async ({ page }) => {
    const pedidos: number[] = []
    page.on('request', (r) => {
      const id = r.url().match(/postulaciones\/(\d+)\/confirmacion-avance/)?.[1]
      if (id && r.method() === 'POST') pedidos.push(Number(id))
    })
    await abrirVacante(page)
    const oculta = la(1)
    await casilla(page, oculta.nombre).check()
    await abrirFiltros(page)
    await panelFiltros(page).getByRole('button', { name: /^Cusco — Cusco/ }).click()
    await cerrarFiltros(page)
    const cusco = terreno.filas.filter((f) => f.ciudad === '0801' && f.estado === 'PERFIL_POR_CONFIRMAR')
    await expect(filasDelRanking(page)).toHaveCount(cusco.length)
    const visibles = await nombresVisibles(page)

    await marcarTodo(page).check()
    await expect(page.locator('input[aria-label^="Avanza "]:checked')).toHaveCount(visibles.length)
    const sexta = terreno.filas.find((f) => f.nombre === visibles[visibles.length - 1])!
    await casilla(page, sexta.nombre).uncheck()
    const cinco = terreno.filas.filter((f) => visibles.slice(0, -1).includes(f.nombre))
    expect(cinco).toHaveLength(5)
    await expect(barra(page)).toContainText('5 personas marcadas · 1 fuera de vista')

    await barra(page).getByLabel('Motivo (obligatorio)').fill('E2E QA 43ca: avanzan solo las cinco que se ven')
    // Doble clic: el segundo no puede mandar a nadie dos veces.
    await barra(page).getByRole('button', { name: 'Avanzar a 5 personas' }).dblclick()
    const resultado = page.locator('[role="status"]').filter({ hasText: /^Avanzaron:/ })
    await expect(resultado).toBeVisible({ timeout: 20_000 })
    for (const f of cinco) await expect(resultado).toContainText(f.nombre)
    await expect(barra(page)).toHaveCount(0)

    expect([...pedidos].sort((a, b) => a - b)).toEqual(cinco.map((f) => f.postulacionId).sort((a, b) => a - b))
    for (const f of cinco) expect(estadoDeLaPostulacion(f.postulacionId)).not.toBe('PERFIL_POR_CONFIRMAR')
    for (const f of [oculta, sexta]) {
      expect(estadoDeLaPostulacion(f.postulacionId)).toBe('PERFIL_POR_CONFIRMAR')
      expect(transicionesDe(f.postulacionId)).toBe(0)
    }

    // La tanda se refrescó: en «Pendiente» con Cusco solo queda la sexta; y el motivo está limpio.
    await expect(filasDelRanking(page)).toHaveCount(1)
    await casilla(page, sexta.nombre).check()
    await expect(barra(page).getByLabel('Motivo (obligatorio)')).toHaveValue('')
  })
})
