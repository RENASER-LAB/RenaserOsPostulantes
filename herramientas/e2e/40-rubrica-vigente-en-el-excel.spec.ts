import { expect, test, type Page } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { entrarAlPanel, filasDelRanking, pestana, corte } from './ayuda'
import {
  ADMINISTRADOR,
  CAJERO,
  DEMO,
  DESMESURADO,
  MARCA,
  NOTAS_DE_ANA,
  NOTAS_DE_BRUNO,
  excelPorLaApi,
  fotoDeLaBase,
  leerElLibro,
  rankingPorLaApi,
  retirarLoSembrado,
  rotulo,
  sembrarTerreno,
  type Libro,
  type Terreno,
} from './ayuda-rubrica-vigente'

/**
 * «El Excel de la prueba del puesto usa la prueba vigente» (specs/rubrica-vigente-en-el-ranking.md).
 *
 * El terreno es la vacante 13 en pequeño, sembrada por SQL en el clon porque la
 * mezcla ya no se fabrica por la API: la vacante tuvo la demo (B), Bruno y Carla
 * la abrieron —Bruno con sus cuatro notas, una de ellas un 0—, y pasó a la de
 * Administrador (A), que Ana rindió entera —también con un 0—. Diego no abrió nada.
 *
 * Los casos que pasan por la pantalla bajan el archivo con el botón del panel; los
 * de control lo piden a la API, que es lo mismo que hace el botón.
 *
 * Solo lee: la siembra y su retirada son lo único que escribe, y van con marca propia.
 */

const CARPETA = mkdtempSync(join(tmpdir(), 'qa-rubrica-vigente-'))

const FIJAS_ANTES = ['#', 'Candidato', 'Correo', 'CV', 'Teléfono', 'Nota Examen Técnico /100', 'Nota Perfil Integral /100']
const FIJAS_DESPUES = ['Nota Combinada /100', 'Justificación resumida', 'Justificación detallada']
const DE_A = ADMINISTRADOR.map(rotulo)
const DE_B = DEMO.map(rotulo)
/** Una línea de Calibri 11, lo que mide cada línea de la cabecera. */
const LINEA = 15
const iJustificacion = FIJAS_ANTES.length + DE_A.length + 2

let terreno: Terreno

test.beforeAll(() => {
  terreno = sembrarTerreno(MARCA)
})

test.afterAll(() => {
  retirarLoSembrado(MARCA, terreno?.correos ?? [])
})

async function abrirLaPrueba(page: Page, vacante: number) {
  await entrarAlPanel(page)
  await page.goto(`/admin/vacantes/${vacante}`)
  await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()
  await pestana(page, 'Prueba del puesto').click()
  await corte(page, 'Toda la tanda').click()
}

async function bajarDelPanel(page: Page, filas: number): Promise<Libro> {
  const boton = page.getByRole('button', { name: `Descargar Excel (${filas})` })
  await expect(boton).toBeEnabled()
  const espera = page.waitForEvent('download', { timeout: 30_000 })
  await boton.click()
  const descarga = await espera
  const ruta = join(CARPETA, `${Date.now()}-${descarga.suggestedFilename()}`)
  await descarga.saveAs(ruta)
  return leerElLibro(ruta)
}

function libroDeLaApi(contenido: Buffer): Libro {
  const ruta = join(CARPETA, `${Date.now()}-api.xlsx`)
  writeFileSync(ruta, contenido)
  return leerElLibro(ruta)
}

const fila = (libro: Libro, nombre: string): string[] => {
  const suya = libro.filas.find((f) => f[1] === nombre)
  if (!suya) throw new Error(`La hoja no trae a ${nombre}: ${libro.filas.map((f) => f[1]).join(', ')}`)
  return suya
}

const criteriosDe = (f: string[]) => f.slice(FIJAS_ANTES.length, FIJAS_ANTES.length + DE_A.length)

test('AC-01 · AC-03 · AC-10 · AC-13 · desde el panel, la vacante mezclada baja solo las 7 columnas de la vigente y lo de la demo va a la justificación', async ({ page }) => {
  await abrirLaPrueba(page, terreno.mezclada)
  await expect(filasDelRanking(page)).toHaveCount(4)
  const libro = await bajarDelPanel(page, 4)

  expect(libro.hojas).toEqual(['Datos'])
  expect(libro.cabeceras).toEqual([...FIJAS_ANTES, ...DE_A, ...FIJAS_DESPUES])
  for (const deLaDemo of DE_B) expect(libro.cabeceras).not.toContain(deLaDemo)

  // Ana rindió la vigente: sus siete notas bajo su criterio, y su 0 es una nota, no un hueco.
  expect(criteriosDe(fila(libro, terreno.ana.nombre))).toEqual([...NOTAS_DE_ANA])
  // Bruno rindió la demo: celdas en blanco y sus cuatro notas, el 0 incluido, en la justificación.
  const bruno = fila(libro, terreno.bruno.nombre)
  expect(criteriosDe(bruno)).toEqual(Array(DE_A.length).fill(''))
  for (const [codigo, puntaje, explicacion] of NOTAS_DE_BRUNO) {
    const [, nombre, puntos] = DEMO.find(([c]) => c === codigo)!
    expect(bruno[iJustificacion]).toContain(`${nombre} (${puntaje}/${puntos}): ${explicacion}`)
  }
  // Carla abrió la demo sin nota y Diego no abrió nada: sus filas salen, con los huecos.
  for (const quien of [terreno.carla, terreno.diego]) {
    expect(criteriosDe(fila(libro, quien.nombre))).toEqual(Array(DE_A.length).fill(''))
  }

  // AC-10 · la altura va ESCRITA en la fila 1 y alcanza para las ~5 líneas del rótulo más largo.
  expect(libro.alturaEscrita).toBe(true)
  expect(libro.alturaCabecera).toBeGreaterThanOrEqual(5 * LINEA)
  expect(libro.alturaCabecera).toBeLessThanOrEqual(8 * LINEA)
  // AC-13 · la cabecera sigue fija y los anchos son los de siempre.
  expect(libro.congelada).toBe('A2')
  expect(libro.anchos).toEqual([5, 34, 32, 30, 18, 15, 16, ...Array(DE_A.length).fill(14), 17, 48, 90])
})

test('AC-02 · con la búsqueda dejando solo a quien rindió la demo, las 7 columnas de la vigente siguen, en blanco', async ({ page }) => {
  await abrirLaPrueba(page, terreno.mezclada)
  await page.getByRole('searchbox', { name: 'Buscar por nombre' }).fill('Díaz Rúbrica')
  await expect(filasDelRanking(page)).toHaveCount(1)
  const libro = await bajarDelPanel(page, 1)

  expect(libro.cabeceras).toEqual([...FIJAS_ANTES, ...DE_A, ...FIJAS_DESPUES])
  expect(libro.filas).toHaveLength(1)
  expect(criteriosDe(libro.filas[0]!)).toEqual(Array(DE_A.length).fill(''))
  expect(libro.filas[0]![iJustificacion]).toContain('Claridad (0/20): Se pierde en el detalle')
  expect(libro.pie.join(' ')).toContain('Díaz Rúbrica')
})

test('AC-09 · el panel sigue igual: el JSON no trae campos nuevos y la tabla sigue juntando las dos rúbricas', async ({ page }) => {
  const { campos, filas } = await rankingPorLaApi(terreno.mezclada, 'PRUEBA_PUESTO')
  expect(campos.sort()).toEqual(['calificados', 'conPasadaFina', 'enCurso', 'fallidos', 'filas', 'nivelPuesto',
    'puedeMoverPostulacion', 'puedeVerPretension', 'puesto', 'total', 'vacante', 'vacanteId',
    'vacanteMuestraSueldo'].sort())
  const nombresDe = (id: number) => filas.find((f) => f.postulacionId === id)!.notasCriterio.map((n) => n.criterio)
  expect(nombresDe(terreno.bruno.postulacionId)).toEqual(DEMO.map(([, n]) => n))
  expect(nombresDe(terreno.ana.postulacionId)).toEqual(ADMINISTRADOR.map(([, n]) => n))

  await abrirLaPrueba(page, terreno.mezclada)
  const antes = await page.locator('table thead th').count()
  await page.getByText('Columnas', { exact: true }).click()
  // Fuera de alcance a propósito: la tabla junta las de las filas, 7 de A y 4 de B.
  await expect(page.getByText(`${DE_A.length + DE_B.length} columnas más, una por criterio`)).toBeVisible()
  await page.getByRole('checkbox', { name: 'Ver los criterios en la tabla' }).check()
  await expect(page.locator('table thead th')).toHaveCount(antes + DE_A.length + DE_B.length)
})

test('AC-04 · AC-08 · con una sola versión y en el perfil integral, columnas y celdas son las de juntar las filas, como antes', async () => {
  // AC-04: la regla de antes —juntar los criterios de las filas en el orden en que aparecen—
  // y la de ahora —la rúbrica vigente— tienen que dar el mismo archivo.
  const { filas } = await rankingPorLaApi(terreno.unaVersion, 'PRUEBA_PUESTO')
  const orden = [terreno.fede.postulacionId, terreno.eva.postulacionId]
  const libro = libroDeLaApi(await excelPorLaApi(terreno.unaVersion, 'PRUEBA_PUESTO', orden))
  const deLasFilas = [...new Set(filas.flatMap((f) => f.notasCriterio.map((n) => `${n.criterio} (pts /${n.maximo})`)))]
  expect(deLasFilas).toEqual(CAJERO.map(rotulo))
  expect(libro.cabeceras).toEqual([...FIJAS_ANTES, ...deLasFilas, ...FIJAS_DESPUES])
  expect(libro.filas.map((f) => f[1])).toEqual([terreno.fede.nombre, terreno.eva.nombre])
  for (const f of libro.filas) {
    const suya = filas.find((x) => x.postulacionId === (f[1] === terreno.eva.nombre ? terreno.eva : terreno.fede).postulacionId)!
    expect(f.slice(FIJAS_ANTES.length, FIJAS_ANTES.length + 2))
      .toEqual(suya.notasCriterio.map((n) => (n.puntaje == null ? '' : String(Number(n.puntaje)))))
  }
  expect(libro.pie.some((t) => t.startsWith('Filtro aplicado: Todos') && t.endsWith('· 2 candidatos'))).toBe(true)
  expect(libro.anchos).toEqual([5, 34, 32, 30, 18, 15, 16, 14, 14, 17, 48, 90])
  expect(libro.alturaEscrita).toBe(true)
  expect(libro.congelada).toBe('A2')

  // AC-08 · AC-11: el perfil integral sigue sacando los criterios globales del currículum de las filas.
  const perfil = await rankingPorLaApi(terreno.mezclada, 'PERFIL_INTEGRAL')
  const delCurriculum = [...new Set(perfil.filas.flatMap((f) => f.notasCriterio.map((n) =>
    n.maximo == null ? n.criterio : `${n.criterio} (pts /${n.maximo})`)))]
  expect(delCurriculum.length).toBeGreaterThan(0)
  const libroPerfil = libroDeLaApi(await excelPorLaApi(terreno.mezclada, 'PERFIL_INTEGRAL',
    [terreno.ana.postulacionId, terreno.bruno.postulacionId]))
  expect(libroPerfil.cabeceras).toEqual(['#', 'Candidato', 'Correo', 'CV', 'Teléfono', 'Nota Perfil Integral /100',
    ...delCurriculum, 'Justificación resumida', 'Justificación detallada'])
  expect(libroPerfil.anchos).toEqual([5, 34, 32, 30, 18, 15, ...Array(delCurriculum.length).fill(14), 48, 90])
  expect(libroPerfil.alturaEscrita).toBe(true)
  expect(libroPerfil.alturaCabecera).toBeGreaterThanOrEqual(2 * LINEA)
  expect(libroPerfil.congelada).toBe('A2')
})

test('AC-05 · AC-06 · con la vigente y nadie en la etapa salen sus columnas vacías; con el cuestionario técnico, ninguna', async () => {
  const nueva = libroDeLaApi(await excelPorLaApi(terreno.recienAbierta, 'PRUEBA_PUESTO', [terreno.iris.postulacionId]))
  expect(nueva.cabeceras).toEqual([...FIJAS_ANTES, ...DE_A, ...FIJAS_DESPUES])
  expect(criteriosDe(nueva.filas[0]!)).toEqual(Array(DE_A.length).fill(''))

  const cuestionario = libroDeLaApi(await excelPorLaApi(terreno.cuestionario, 'PRUEBA_PUESTO', [terreno.gina.postulacionId]))
  expect(cuestionario.cabeceras).toEqual([...FIJAS_ANTES, ...FIJAS_DESPUES])
  expect(cuestionario.alturaEscrita).toBe(true)
})

test('AC-12 · un rótulo de más de 8 líneas deja la cabecera en 8, entero en la celda, y los homónimos se desambiguan como hoy', async () => {
  const libro = libroDeLaApi(await excelPorLaApi(terreno.desmesurada, 'PRUEBA_PUESTO', [terreno.hugo.postulacionId]))
  expect(libro.alturaEscrita).toBe(true)
  expect(libro.alturaCabecera).toBe(8 * LINEA)
  expect(libro.cabeceras.slice(FIJAS_ANTES.length, FIJAS_ANTES.length + 3)).toEqual([
    `${DESMESURADO} (pts /60)`, 'Claridad [CLARIDAD_A] (pts /20)', 'Claridad [CLARIDAD_B] (pts /20)'])
  expect(libro.filas[0]!.slice(FIJAS_ANTES.length, FIJAS_ANTES.length + 3)).toEqual(['40', '15', '0'])
  expect(libro.congelada).toBe('A2')
})

test('descargar los dos Excel, por el panel y por la API, no escribe nada en la base', async ({ page }) => {
  const vacantes = [terreno.mezclada, terreno.unaVersion, terreno.cuestionario, terreno.desmesurada]
  const antes = fotoDeLaBase(vacantes)

  await abrirLaPrueba(page, terreno.mezclada)
  await bajarDelPanel(page, 4)
  const todos = [terreno.ana, terreno.bruno, terreno.carla, terreno.diego].map((p) => p.postulacionId)
  await excelPorLaApi(terreno.mezclada, 'PRUEBA_PUESTO', todos)
  await excelPorLaApi(terreno.mezclada, 'PERFIL_INTEGRAL', todos)
  await excelPorLaApi(terreno.cuestionario, 'PRUEBA_PUESTO', [terreno.gina.postulacionId])

  expect(fotoDeLaBase(vacantes)).toBe(antes)
})
