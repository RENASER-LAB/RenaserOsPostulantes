import { expect, test, type Download, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  abrirMasFiltros,
  cabecera,
  corte,
  entrarAlPanel,
  filasDelRanking,
  irAVacante,
  nombresVisibles,
  pestana, VACANTES, idDeVacante } from './ayuda'

const CARPETA = mkdtempSync(join(tmpdir(), 'qa-excel-'))

/** La posición de una columna de la hoja por su título, o revienta diciendo cuáles hay. */
function cabeceras_o(cabeceras: string[], titulo: string): number {
  const i = cabeceras.findIndex((c) => c.startsWith(titulo))
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
 * La hoja «Resumen», leída de verdad con openpyxl.
 *
 * ⚠️ **No vale `max_row`.** Debajo de las filas hay una línea «Filtro
 * aplicado: … · Generado el …»; contar hasta el final daría siempre de más.
 * Se busca la cabecera y se cuenta lo que hay debajo hasta el primer hueco.
 */
function leerResumen(ruta: string): { cabeceras: string[]; filas: string[][] } {
  const salida = execFileSync('python3', [
    '-c',
    `
import json, sys
import openpyxl
libro = openpyxl.load_workbook(sys.argv[1], data_only=True)
hoja = libro['Resumen']
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
cabeceras = [c.strip() for c in tabla[i] if c.strip() != '']
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
import sys, openpyxl
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

test.describe('Nuevo · la descarga del Excel', () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPanel(page)
  })

  /*
    La hoja sale del panel y se reenvía por correo, donde ya no hay pantalla al
    lado que la explique. Así que lo que dice tiene que ser LO MISMO que decía la
    pantalla de la que salió, celda por celda y no solo fila por fila.

    Estas dos comprobaciones existen porque las dos fallaban: la columna «#»
    decía el puesto del ranking en la mesa y la posición de la hoja en el
    archivo —«#2 Camila» en pantalla, «#1 Camila» en el fichero, de la MISMA
    descarga—, y la pretensión se escribía «S/ 4,000 – 5,200» en la mesa y
    «PEN 4000 – 5200» en la hoja. Ninguna de las dos rompía nada; las dos hacían
    que dos personas mirando el mismo dato leyeran cosas distintas.
  */
  /*
    Se corre en LAS DOS etapas que exportan y no solo en una: el «#» estaba mal
    en los dos sitios, y arreglar el Resumen del perfil dejó el de la prueba
    intacto justo porque nada lo miraba.
  */
  for (const etapa of ['Perfil integral', 'Prueba del puesto'] as const) {
  test(`la hoja de «${etapa}» dice lo MISMO que la pantalla: el «#» y la pretensión, celda a celda`, async ({
    page,
  }) => {
    await irAVacante(page, VACANTES.LLENA)
    if (etapa !== 'Perfil integral') {
      await pestana(page, etapa).click()
      await corte(page, 'Toda la tanda').click()
    }
    // Se ordena por nombre a propósito: con el orden del ranking, la posición de
    // la hoja y el puesto coinciden por casualidad y la prueba no probaría nada.
    await cabecera(page, 'Candidato').getByRole('button').click()

    /*
      Las columnas se localizan por su TÍTULO, en los dos lados. Con índices fijos
      la prueba pasaría por casualidad el día que alguien meta una columna en
      medio, que es exactamente el cambio que este archivo existe para vigilar.
    */
    const titulos = await page
      .locator('table thead th')
      .evaluateAll((ths) => ths.map((th) => th.textContent!.trim()))
    const iNumeroEnPantalla = titulos.findIndex((c) => c === '#')
    const iPretensionEnPantalla = titulos.findIndex((c) => c.startsWith('Pretensión'))
    expect(iNumeroEnPantalla, 'la mesa tiene columna «#»').toBeGreaterThanOrEqual(0)
    expect(iPretensionEnPantalla, 'la mesa tiene columna «Pretensión»').toBeGreaterThanOrEqual(0)

    const enPantalla = await filasDelRanking(page).evaluateAll(
      (filas, [iN, iP]) =>
        filas.map((f) => {
          const celdas = [...f.querySelectorAll('td')].map((c) => c.textContent!.trim())
          return { numero: celdas[iN as number], pretension: celdas[iP as number] }
        }),
      [iNumeroEnPantalla, iPretensionEnPantalla],
    )

    const { ruta } = await bajar(page)
    const { filas, cabeceras } = leerResumen(ruta)
    const iNumero = cabeceras_o(cabeceras, '#')
    const iPretension = cabeceras_o(cabeceras, 'Pretensión')

    expect(filas).toHaveLength(enPantalla.length)
    expect(filas.map((f) => f[iNumero])).toEqual(enPantalla.map((f) => f.numero))
    expect(filas.map((f) => f[iPretension])).toEqual(
      // La celda sin pretensión pinta un guion en la mesa y va vacía en la hoja:
      // ahí sí difieren, y está bien —una celda vacía es lo que Excel entiende—.
      enPantalla.map((f) => (f.pretension === '—' ? '' : f.pretension)),
    )
  })
  }

  test('Perfil integral: el archivo llega, pesa y lleva la fecha en el nombre', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
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

    const { cabeceras, filas, hojas } = leerResumen(ruta) as never as {
      cabeceras: string[]
      filas: string[][]
      hojas: string[]
    }
    expect(hojas).toEqual(['Resumen', 'Detalle'])
    expect(cabeceras).toContain('Candidato')
    expect(filas).toHaveLength(4)
  })

  test('Prueba del puesto también exporta (hay que abrir «Toda la tanda» antes)', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await pestana(page, 'Prueba del puesto').click()
    // Con el corte por defecto no hay nadie con nota: el botón está apagado.
    await expect(page.getByRole('button', { name: 'Nada que descargar' })).toBeDisabled()

    await corte(page, 'Toda la tanda').click()
    await expect(botonExcel(page)).toHaveText('Descargar Excel (4)')
    const { nombre, ruta, bytes } = await bajar(page)
    const id = await idDeVacante(VACANTES.LLENA)
    expect(nombre).toMatch(
      new RegExp(`^ranking-prueba-puesto-vacante-${id}-\\d{4}-\\d{2}-\\d{2}\\.xlsx$`),
    )
    expect(bytes).toBeGreaterThan(2000)
    expect(leerResumen(ruta).filas).toHaveLength(4)
  })

  test('EL EXCEL RESPETA EL FILTRO: una ciudad en pantalla, esa ciudad en la hoja', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await abrirMasFiltros(page)
    await page.getByRole('button', { name: /^Lima — Lima/ }).click()

    const enPantalla = await nombresVisibles(page)
    expect(enPantalla).toEqual(['Camila Torres Rivas'])
    await expect(botonExcel(page)).toHaveText(`Descargar Excel (${enPantalla.length})`)

    const { ruta } = await bajar(page)
    const { filas } = leerResumen(ruta)
    expect(filas).toHaveLength(enPantalla.length)
    expect(filas.some((f) => f.join(' ').includes('Camila Torres Rivas'))).toBe(true)
    expect(filas.some((f) => f.join(' ').includes('Joaquín Vargas Ureta'))).toBe(false)

    // Y la hoja dice de qué recorte salió.
    const texto = textoDelLibro(ruta)
    expect(texto).toContain('Filtro aplicado:')
    expect(texto).toContain('Ciudad: Lima — Lima')
    expect(texto).toContain('Perfil integral')
    expect(texto).toContain('Con nota del perfil')
  })

  test('EL EXCEL RESPETA EL ORDEN de la pantalla', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await cabecera(page, 'Candidato').getByRole('button').click()
    const enPantalla = await nombresVisibles(page)

    const { ruta } = await bajar(page)
    const { filas } = leerResumen(ruta)
    const enLaHoja = filas.map((f) => f.find((c) => enPantalla.includes(c)) ?? f.join(' '))
    expect(enLaHoja).toEqual(enPantalla)

    // Y el orden viaja escrito dentro de la hoja.
    expect(textoDelLibro(ruta)).toContain('Orden: Candidato, de menor a mayor')
  })

  test('un filtro que deja tres filas baja exactamente tres', async ({ page }) => {
    await irAVacante(page, VACANTES.LLENA)
    await abrirMasFiltros(page)
    await page.getByLabel('Nota del perfil, desde').fill('56')

    const enPantalla = await nombresVisibles(page)
    expect(enPantalla).toHaveLength(3)
    const { ruta } = await bajar(page)
    expect(leerResumen(ruta).filas).toHaveLength(3)
    expect(textoDelLibro(ruta)).toContain('Nota ≥ 56')
  })

  test('vacante 8: la hoja avisa de que la pretensión salió vacía y por qué', async ({ page }) => {
    await irAVacante(page, VACANTES.SIN_PRETENSION)
    await corte(page, 'Toda la tanda').click()
    await expect(botonExcel(page)).toHaveText('Descargar Excel (3)')
    const { ruta } = await bajar(page)
    const texto = textoDelLibro(ruta)
    expect(texto).toContain('Ninguno de estos candidatos declaró pretensión salarial')
    expect(leerResumen(ruta).filas).toHaveLength(3)
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
