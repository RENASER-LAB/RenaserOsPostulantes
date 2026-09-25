import { expect, test, type Download, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  abrirFiltros,
  cabecera,
  corte,
  entrarAlPanel,
  filasDelRanking,
  irAVacante,
  nombresVisibles,
  pestana, VACANTES, idDeVacante } from './ayuda'
import { interceptarEscenario } from './escenario-desarrollador-web'

/**
 * La descarga del Excel, contra el backend de verdad: el archivo lo arma el
 * servidor con las filas que el navegador le manda, en el orden en que se las
 * manda, y lo que dice tiene que ser LO MISMO que decía la pantalla.
 *
 * ⚠️ **Desde el 16/09/2026 el libro es UNA hoja, «Datos»**, con el formato
 * resumido del cliente: «#», «Candidato», «Correo», «CV», «Teléfono», las notas
 * y los criterios. Ya no hay «Resumen» ni «Detalle», y **no lleva columna de
 * Pretensión ni de Ciudad**: lo que se compara con la pantalla es el «#» y el
 * nombre, celda a celda, y el pie que dice de qué recorte salió.
 *
 * Solo lee: ninguna prueba escribe en la base.
 */

const CARPETA = mkdtempSync(join(tmpdir(), 'qa-excel-'))

/** La posición de una columna de la hoja por su título, o revienta diciendo cuáles hay. */
function columna(cabeceras: string[], titulo: string): number {
  const i = cabeceras.findIndex((c) => c === titulo)
  if (i < 0) throw new Error(`La hoja no tiene columna «${titulo}». Tiene: ${cabeceras.join(', ')}`)
  return i
}

/** El botón que baja la hoja, tal como se llama cuando hay algo que bajar. */
const botonExcel = (page: Page) => page.getByRole('button', { name: /^Descargar Excel \(\d+\)$/ })

async function bajar(page: Page): Promise<{ nombre: string; ruta: string; bytes: number }> {
  const espera = page.waitForEvent('download', { timeout: 30_000 })
  await botonExcel(page).click()
  const descarga: Download = await espera
  const nombre = descarga.suggestedFilename()
  const ruta = join(CARPETA, `${Date.now()}-${nombre}`)
  await descarga.saveAs(ruta)
  return { nombre, ruta, bytes: statSync(ruta).size }
}

/**
 * La hoja «Datos», leída de verdad con openpyxl.
 *
 * ⚠️ **No vale `max_row`.** Debajo de las filas hay un pie —«Filtro aplicado: … ·
 * Generado el …» y la explicación de la nota—; contar hasta el final daría
 * siempre de más. Se busca la cabecera y se cuenta lo que hay debajo hasta el
 * primer hueco.
 */
function leerLaHoja(ruta: string): { hojas: string[]; cabeceras: string[]; filas: string[][] } {
  const salida = execFileSync('python3', [
    '-c',
    `
import json, sys, warnings
import openpyxl
warnings.simplefilter('ignore')
libro = openpyxl.load_workbook(sys.argv[1], data_only=True)
hoja = libro.worksheets[0]
# Como lo VE quien abre el archivo, no como lo guarda el formato: POI escribe los
# enteros como double y openpyxl los devuelve 2.0, pero en Excel se lee «2». Sin
# esto, comparar la hoja con la pantalla marcaría una diferencia que no existe.
def visible(c):
    if c is None:
        return ''
    if isinstance(c, float) and c.is_integer():
        return str(int(c))
    return str(c)

tabla = [[visible(c) for c in fila] for fila in hoja.iter_rows(values_only=True)]
# La cabecera es la primera fila con «Candidato» en alguna celda.
i = next(n for n, f in enumerate(tabla) if any(c.strip() == 'Candidato' for c in f))
cabeceras = [c.strip() for c in tabla[i]]
filas = []
for f in tabla[i + 1:]:
    if all(c.strip() == '' for c in f):
        break
    if f and f[0].startswith('Filtro aplicado'):
        break
    filas.append([c.strip() for c in f])
print(json.dumps({'cabeceras': cabeceras, 'filas': filas, 'hojas': libro.sheetnames}))
`,
    ruta,
  ])
  return JSON.parse(salida.toString())
}

const textoDelLibro = (ruta: string): string =>
  execFileSync('python3', [
    '-c',
    `
import sys, warnings, openpyxl
warnings.simplefilter('ignore')
libro = openpyxl.load_workbook(sys.argv[1], data_only=True)
partes = []
for h in libro.worksheets:
    for fila in h.iter_rows(values_only=True):
        for c in fila:
            if c is not None:
                partes.append(str(c))
print('\\n'.join(partes))
`,
    ruta,
  ]).toString()

test.describe('La descarga del Excel', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  /*
    La hoja sale del panel y se reenvía por correo, donde ya no hay pantalla al
    lado que la explique. Así que lo que dice tiene que ser LO MISMO que decía la
    pantalla de la que salió, celda por celda y no solo fila por fila.

    Esta comprobación existe porque fallaba: la columna «#» decía el puesto del
    ranking en la mesa y la posición de la hoja en el archivo —«#2 Camila» en
    pantalla, «#1 Camila» en el fichero, de la MISMA descarga—. No rompía nada;
    hacía que dos personas mirando el mismo dato leyeran cosas distintas.

    Se corre en LAS DOS etapas que exportan y no solo en una: el «#» estaba mal
    en los dos sitios, y arreglar el del perfil dejó el de la prueba intacto
    justo porque nada lo miraba.
  */
  for (const etapa of ['Perfil integral', 'Prueba del puesto'] as const) {
    test(`la hoja de «${etapa}» dice lo MISMO que la pantalla: el «#» y el nombre, celda a celda`, async ({
      page,
    }) => {
      await irAVacante(page, VACANTES.LLENA)
      if (etapa !== 'Perfil integral') {
        await pestana(page, etapa).click()
      }
      await corte(page, 'Toda la tanda').click()
      // Se ordena por nombre a propósito: con el orden del ranking, la posición de
      // la hoja y el puesto coinciden por casualidad y la prueba no probaría nada.
      await cabecera(page, 'Candidato').getByRole('button').click()
      await expect(cabecera(page, 'Candidato')).toHaveAttribute('aria-sort', 'ascending')

      /*
        Las columnas se localizan por su TÍTULO, en los dos lados. Con índices fijos
        la prueba pasaría por casualidad el día que alguien meta una columna en
        medio, que es exactamente el cambio que este archivo existe para vigilar.
      */
      const titulos = await page
        .locator('table thead th')
        .evaluateAll((ths) => ths.map((th) => th.textContent!.trim()))
      const iNumeroEnPantalla = titulos.findIndex((c) => c === '#')
      expect(iNumeroEnPantalla, 'la mesa tiene columna «#»').toBeGreaterThanOrEqual(0)

      const enPantalla = await filasDelRanking(page).evaluateAll(
        (filas, iN) =>
          filas.map((f) => {
            const celdas = [...f.querySelectorAll('td')].map((c) => c.textContent!.trim())
            return {
              numero: celdas[iN as number],
              nombre: f.querySelector('input[aria-label^="Avanza "]')!.getAttribute('aria-label')!.replace(/^Avanza /, ''),
            }
          }),
        iNumeroEnPantalla,
      )

      const { ruta } = await bajar(page)
      const { filas, cabeceras } = leerLaHoja(ruta)
      const iNumero = columna(cabeceras, '#')
      const iNombre = columna(cabeceras, 'Candidato')

      expect(filas).toHaveLength(enPantalla.length)
      expect(filas.map((f) => f[iNombre])).toEqual(enPantalla.map((f) => f.nombre))
      expect(filas.map((f) => f[iNumero])).toEqual(enPantalla.map((f) => f.numero))
    })
  }

  test('Perfil integral: el archivo llega, pesa, es una sola hoja «Datos» y lleva la fecha en el nombre', async ({
    page,
  }) => {
    await irAVacante(page, VACANTES.LLENA)
    // El botón cuenta las filas del corte, y se abre por «Pendiente».
    await corte(page, 'Toda la tanda').click()
    await expect(botonExcel(page)).toHaveText('Descargar Excel (4)')

    const { nombre, ruta, bytes } = await bajar(page)
    // Cerca de medianoche el reloj del servidor puede ir un día por detrás.
    const hoy = new Date()
    const ayer = new Date(hoy.getTime() - 86_400_000)
    const fechas = [hoy, ayer].map((d) => d.toISOString().slice(0, 10))
    const id = await idDeVacante(VACANTES.LLENA)
    expect(fechas).toContain(nombre.replace(/^.*-vacante-\d+-/, '').replace(/\.xlsx$/, ''))
    expect(nombre).toMatch(
      new RegExp(`^ranking-perfil-integral-vacante-${id}-\\d{4}-\\d{2}-\\d{2}\\.xlsx$`),
    )
    expect(bytes).toBeGreaterThan(2000)

    const { cabeceras, filas, hojas } = leerLaHoja(ruta)
    // El formato resumido del cliente: una hoja, y ni rastro de «Resumen» ni «Detalle».
    expect(hojas).toEqual(['Datos'])
    expect(cabeceras.slice(0, 5)).toEqual(['#', 'Candidato', 'Correo', 'CV', 'Teléfono'])
    expect(cabeceras).toContain('Nota Perfil Integral /100')
    expect(filas).toHaveLength(4)
  })

  test('Prueba del puesto también exporta (hay que abrir «Toda la tanda» antes)', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await pestana(page, 'Prueba del puesto').click()
    // Con «Pendiente» solo sale quien espera decisión en esta etapa: una
    // persona, así que el botón exporta esa. La tanda entera trae las cuatro.
    await expect(botonExcel(page)).toHaveText('Descargar Excel (1)')

    await corte(page, 'Toda la tanda').click()
    await expect(botonExcel(page)).toHaveText('Descargar Excel (4)')
    const { nombre, ruta, bytes } = await bajar(page)
    const id = await idDeVacante(VACANTES.LLENA)
    expect(nombre).toMatch(
      new RegExp(`^ranking-prueba-puesto-vacante-${id}-\\d{4}-\\d{2}-\\d{2}\\.xlsx$`),
    )
    expect(bytes).toBeGreaterThan(2000)
    const { cabeceras, filas } = leerLaHoja(ruta)
    expect(filas).toHaveLength(4)
    // Las dos notas y la combinada, que solo existen en esta etapa.
    expect(cabeceras).toContain('Nota Examen Técnico /100')
    expect(cabeceras).toContain('Nota Combinada /100')
  })

  test('EL EXCEL RESPETA EL FILTRO: una ciudad en pantalla, esa ciudad en la hoja', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await abrirFiltros(page)
    await page.getByRole('button', { name: /^Lima — Lima/ }).click()

    const enPantalla = await nombresVisibles(page)
    expect(enPantalla).toEqual(['Camila Torres Rivas'])
    await expect(botonExcel(page)).toHaveText(`Descargar Excel (${enPantalla.length})`)

    const { ruta } = await bajar(page)
    const { filas } = leerLaHoja(ruta)
    expect(filas).toHaveLength(enPantalla.length)
    expect(filas.some((f) => f.join(' ').includes('Camila Torres Rivas'))).toBe(true)
    expect(filas.some((f) => f.join(' ').includes('Joaquín Vargas Ureta'))).toBe(false)

    // Y la hoja dice de qué recorte salió: la etapa, el corte y el filtro.
    const texto = textoDelLibro(ruta)
    expect(texto).toContain('Filtro aplicado:')
    expect(texto).toContain('Ciudad: Lima — Lima')
    expect(texto).toContain('Perfil integral')
    expect(texto).toContain('Pendiente')
    expect(texto).toContain(`${enPantalla.length} candidatos`)
  })

  test('EL EXCEL RESPETA EL ORDEN de la pantalla', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await cabecera(page, 'Candidato').getByRole('button').click()
    const enPantalla = await nombresVisibles(page)

    const { ruta } = await bajar(page)
    const { filas } = leerLaHoja(ruta)
    const enLaHoja = filas.map((f) => f.find((c) => enPantalla.includes(c)) ?? f.join(' '))
    expect(enLaHoja).toEqual(enPantalla)

    // Y el orden viaja escrito dentro de la hoja.
    expect(textoDelLibro(ruta)).toContain('Orden: Candidato, de menor a mayor')
  })

  /*
    El único caso de este archivo que necesita notas en la tabla, y la siembra
    de siempre no trae ninguna. Se interceptan (ver `escenario-desarrollador-web`):
    el navegador filtra con ellas y manda al backend los tres ids que quedan,
    que es exactamente lo que el backend escribe.
  */
  test('un filtro que deja tres filas baja exactamente tres, y la hoja dice el rango', async ({ page }) => {
    await interceptarEscenario(page)
    await irAVacante(page, VACANTES.LLENA)
    await corte(page, 'Toda la tanda').click()
    await abrirFiltros(page)
    // Nota ≥ 56: 61, 74 y 95. El 55 de Camila queda fuera.
    await page.getByLabel('Nota del perfil, desde').fill('56')

    const enPantalla = await nombresVisibles(page)
    expect(enPantalla).toHaveLength(3)
    expect(enPantalla).not.toContain('Camila Torres Rivas')
    const { ruta } = await bajar(page)
    expect(leerLaHoja(ruta).filas).toHaveLength(3)
    expect(textoDelLibro(ruta)).toContain('Nota ≥ 56')
  })

  test('si el servidor rechaza la descarga, se enseña SU mensaje y el botón revive', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await page.route('**/ranking/excel', (ruta) =>
      ruta.fulfill({
        status: 400,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          title: 'Bad Request',
          status: 400,
          detail: 'Esa etapa no tiene columnas que volcar.',
        }),
      }),
    )
    await botonExcel(page).click()
    // El texto del servidor tal cual, no un «no se pudo descargar» genérico.
    await expect(page.getByRole('alert')).toContainText('Esa etapa no tiene columnas que volcar.')
    // Y no se queda colgado en «Preparando el Excel…».
    await expect(botonExcel(page)).toBeEnabled()
  })

  test('sin filas visibles el botón está apagado y no baja nada', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await page.getByRole('searchbox').fill('zzzzz')
    await expect(filasDelRanking(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Nada que descargar' })).toBeDisabled()
  })
})
