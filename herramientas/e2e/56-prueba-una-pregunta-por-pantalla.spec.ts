import { expect, type Page } from '@playwright/test'
import { test } from './ayuda-candidato'
import { limpiarSiempre, literal, sql } from './base-de-datos'
import {
  cuentaDeCandidato,
  entrarAlPortalCon,
  escribirBorrador,
  exigir,
  pedir,
  postular,
  publicarPreguntas,
  tokenDePanel,
  uno,
} from './ayuda-preguntas-propias'
import {
  candidataEnLaPrueba,
  crearVacante,
  escribirPrueba,
  iniciarLaPrueba,
  lugarDe,
  publicarPrueba,
  retirarLoSembrado,
  vencer,
  verLaPrueba,
  type Candidata,
} from './ayuda-prueba-propia'
import {
  MARCA as MARCA_ELIMINA,
  retirarLoSembrado as retirarLasVacantesSembradas,
  sembrarVacantePropia,
} from './ayuda-eliminar-vacante'

/**
 * La prueba técnica y la evaluación, una pregunta por pantalla con el mismo marco
 * (`specs/prueba-una-pregunta-por-pantalla.md`): los recorridos de su Verificación.
 *
 *   1. Prueba, navegación: empezar, responder la 1 y la 2, saltar con el mapa a la 6 y
 *      volver con «Volver a la N».
 *   2. Prueba, entrega: dejar huecos, «Entregar la prueba», seguir el botón del aviso hasta lo
 *      primero que falta, completarlo todo y entregar.
 *   3. Recarga: recargar en la 5, en la prueba y en la evaluación, y seguir en la 5.
 *   4. El caso: abrirlo y ocultarlo desde una pregunta; en la vacante sin caso, que no salga.
 *   5. Vencimiento de la prueba: vencer con un hueco, que queda «sin completar».
 *   6. Evaluación: responder con el marco nuevo, una de varias partes a medias (banco del
 *      modelo), «Siguiente sin responder», «Entregar» con huecos, seguir el aviso y entregar.
 *   +  El teléfono (AC-12): el mapa en una hoja desde abajo y el caso plegado, sin
 *      desplazamiento horizontal.
 *
 * El recorrido 7 (la plantilla, igual que hoy) lo cubren el 31 y el recorrido 7 del 48.
 *
 * La prueba A tiene caso, 8 preguntas de los cuatro tipos, una abierta con su archivo
 * obligatorio y un entregable general obligatorio. La B no tiene caso ni generales.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira (marcas QA-PE-0067 y, para la
 * evaluación del banco del modelo, QA-ELIMINA-830D).
 */

const CASO = 'La tienda cerró marzo con un descuadre de S/ 1 250 entre el mayor y el banco.'
const MATERIALES = 'El mayor de marzo y el extracto del banco, en la carpeta compartida.'
const OU1 = '¿Qué libro registra primero una venta al crédito?'
const MULTI1 = '¿Qué documentos sustentan una compra?'
const ABIERTA1 = '¿Cómo hallaste el descuadre de marzo?'
const ESCALA1 = '¿Cuánto dominas las tablas dinámicas?'
const OU2 = '¿Qué función busca un valor en una tabla?'
const ABIERTA2 = 'Explica el ajuste a la gerencia en tres líneas.'
const MULTI2 = '¿Qué cuentas se concilian a fin de mes?'
const ESCALA2 = '¿Cuánto dominas el cierre mensual?'
const ARCHIVO = 'Conciliación.xlsx'
const GENERAL = 'Informe final'

const PREGUNTA_B = '¿Cuál es la tasa general del IGV en el Perú?'
const ABIERTA_B = 'Explica cómo cuadras la caja al cerrar el día.'

const E_OU = '¿A quién reportas primero un descuadre?'
const E_MULTI = '¿Qué revisas antes de cerrar la caja?'
const E_ESCALA = '¿Cuánto dominas Excel?'
const E_ABIERTA = 'Cuéntanos un cierre difícil y cómo lo resolviste.'
const E_OU2 = '¿Qué haces si el banco cobra dos veces una comisión?'

const correos: string[] = []
let equipo = ''
let vacanteA = 0
let vacanteB = 0
let vacanteE = 0
let ana: Candidata

const escala = (puntos: number) => [{ texto: null, puntos: 0 }, { texto: null, puntos: puntos / 2 }, { texto: null, puntos }]

/** Una vacante con la prueba del editor publicada, sin evaluación del banco. */
async function vacanteConPrueba(nombre: string, prueba: Parameters<typeof escribirPrueba>[2]): Promise<number> {
  const id = await crearVacante(equipo, nombre, await lugarDe(equipo))
  await exigir(`/panel/vacantes/${id}/aplicacion-evaluacion`, equipo, 'POST', { aplica: false })
  await escribirPrueba(equipo, id, prueba)
  const r = await publicarPrueba(equipo, id)
  expect(r.estado, JSON.stringify(r.cuerpo)).toBe(200)
  await exigir(`/panel/vacantes/${id}/publicacion`, equipo, 'POST')
  return id
}

/** Cuántas preguntas tiene respondidas el servidor: las que no se ven también cuentan. */
async function respondidasEnElServidor(c: Candidata): Promise<number> {
  const preguntas = (await verLaPrueba(c)).cuerpo.preguntas as any[]
  return preguntas.filter(
    (p) => p.respuestaOpcionId != null || (p.respuestaMarcadas?.length ?? 0) > 0 || (p.respuestaTexto ?? '').trim() !== '',
  ).length
}

/** Entra al portal y empieza la prueba desde su pantalla previa. */
async function empezarLaPrueba(page: Page, c: Candidata) {
  await entrarAlPortalCon(page, c.token)
  await page.goto(`/procesos/${c.uuid}/prueba`)
  await page.getByRole('button', { name: 'Empezar prueba' }).click({ timeout: 20_000 })
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, empezar' }).click()
  await expect(page.getByText('Tiempo restante')).toBeVisible({ timeout: 20_000 })
}

const casilla = (page: Page, nombre: string) =>
  page.locator('main').getByRole('button', { name: new RegExp(`^${nombre},`) })
const enLaBarra = (page: Page, texto: string) => expect(page.locator('main').getByText(texto, { exact: true })).toBeVisible()
const tarjeta = (page: Page) => page.locator('main').getByRole('article')
const siguiente = (page: Page) => page.locator('main').getByRole('button', { name: 'Siguiente', exact: true }).click()

/**
 * Con la hoja abierta: dónde acaba la barra fija **entera** —con la fila que le añade «Ocultar el
 * mapa» en el teléfono— y dónde empiezan el velo y la hoja. La barra es la que contiene el
 * botón del mapa (barra › mandos › botón).
 */
async function hojaYBarra(page: Page, hoja: ReturnType<Page['getByRole']>) {
  const barra = await page
    .locator('main')
    .getByRole('button', { name: 'Ocultar el mapa' })
    .evaluate((el) => el.parentElement!.parentElement!.getBoundingClientRect().bottom)
  const velo = await hoja.evaluate((el) => el.parentElement!.getBoundingClientRect().top)
  const caja = await hoja.evaluate((el) => el.getBoundingClientRect().top)
  return { barra, velo, caja }
}

/**
 * La barra fija frente a la cabecera y al pie del sitio (QA-UPP-04): cuánto queda su borde de
 * arriba bajo la cabecera (negativo: la cabecera la tapa), el aire hasta lo que la sigue y lo que
 * la página sigue después del pie. La barra no se va con el final del marco gracias a un margen
 * negativo, y ese margen no puede cambiar el aire ni alargar la página.
 */
async function laBarraFija(page: Page) {
  return page
    .locator('main')
    .getByRole('button', { name: /^(Ocultar el mapa|Ver las \d+)$/ })
    .evaluate((boton) => {
      const barra = boton.parentElement!.parentElement!
      const caja = barra.getBoundingClientRect()
      const cabecera = document.querySelector('header')!.getBoundingClientRect()
      const pie = document.querySelector('main ~ footer')!.getBoundingClientRect()
      return {
        bajoLaCabecera: caja.top - cabecera.bottom,
        aire: barra.nextElementSibling!.getBoundingClientRect().top - caja.bottom,
        trasElPie: document.documentElement.scrollHeight - (pie.bottom + window.scrollY),
      }
    })
}

const arriba = (page: Page) => page.evaluate(() => window.scrollTo(0, 0))
const alFinal = (page: Page) => page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))

/** Con la página arriba, el aire entre la barra y la pregunta es el de siempre y la página acaba en el pie. */
async function laBarraNoCambiaLaPagina(page: Page, donde: string) {
  await arriba(page)
  const medidas = await laBarraFija(page)
  expect(medidas.aire, `${donde}: el aire entre la barra y la pregunta`).toBeCloseTo(24, 0)
  expect(medidas.trasElPie, `${donde}: la página acaba en el pie`).toBeLessThanOrEqual(1)
}

/** El intento ya cerrado en el servidor: lo entregó la candidata o el barrido de vencimientos. */
const cerrado = (postulacion: number): boolean =>
  Number(uno(`select (entregado_en is not null)::int as cerrado from intento_prueba where postulacion_id = ${postulacion}`).cerrado) === 1

test.describe('Una pregunta por pantalla, en la prueba y en la evaluación', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    equipo = await tokenDePanel()
    vacanteA = await vacanteConPrueba('Una por pantalla A', {
      criterios: [
        {
          nombre: 'Contabilidad', puntosCalificados: 30, calificador: 'PERSONA',
          preguntas: [
            { tipo: 'OPCION_UNICA', enunciado: OU1, puntos: 10, opciones: [{ texto: 'Libro diario', puntos: 10 }, { texto: 'Caja', puntos: 0 }] },
            { tipo: 'OPCION_MULTIPLE', enunciado: MULTI1, puntos: 10, opciones: [{ texto: 'Factura', puntos: 5 }, { texto: 'Guía de remisión', puntos: 5 }, { texto: 'Recibo de luz', puntos: 0 }] },
            { tipo: 'ABIERTA', enunciado: ABIERTA1, queDebeTener: 'La cuenta y el monto.' },
            { tipo: 'ESCALA', enunciado: ESCALA1, puntos: 10, opciones: escala(10) },
          ],
        },
        {
          nombre: 'Excel', puntosCalificados: 10, calificador: 'PERSONA',
          preguntas: [
            { tipo: 'OPCION_UNICA', enunciado: OU2, puntos: 10, opciones: [{ texto: 'BUSCARV', puntos: 10 }, { texto: 'SUMA', puntos: 0 }] },
            { tipo: 'ABIERTA', enunciado: ABIERTA2, queDebeTener: 'Claridad sin jerga.' },
            { tipo: 'OPCION_MULTIPLE', enunciado: MULTI2, puntos: 10, opciones: [{ texto: 'Bancos', puntos: 5 }, { texto: 'Proveedores', puntos: 5 }, { texto: 'Ninguna', puntos: 0 }] },
            { tipo: 'ESCALA', enunciado: ESCALA2, puntos: 10, opciones: escala(10) },
          ],
        },
      ],
      entregables: [
        { nombre: ARCHIVO, formato: 'ARCHIVO', obligatorio: true, de: ABIERTA1 },
        { nombre: GENERAL, formato: 'ARCHIVO', obligatorio: true, todaLaPrueba: true },
      ],
      datos: { enunciado: CASO, materiales: MATERIALES, modalidad: 'CRONOMETRADA', duracionMinutos: 90 },
    })
    vacanteB = await vacanteConPrueba('Una por pantalla B', {
      criterios: [
        {
          nombre: 'Caja', puntosCalificados: 50, calificador: 'PERSONA',
          preguntas: [
            { tipo: 'OPCION_UNICA', enunciado: PREGUNTA_B, puntos: 50, opciones: [{ texto: '18 %', puntos: 50 }, { texto: '19 %', puntos: 0 }] },
            { tipo: 'ABIERTA', enunciado: ABIERTA_B, queDebeTener: 'El arqueo y el registro.' },
          ],
        },
      ],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 30 },
    })

    // La vacante de la evaluación: cinco preguntas propias y su prueba, sin pase automático.
    vacanteE = await crearVacante(equipo, 'Una por pantalla, la evaluación', await lugarDe(equipo))
    await escribirBorrador(equipo, vacanteE, [
      {
        nombre: 'General',
        preguntas: [
          { tipo: 'OPCION_UNICA', enunciado: E_OU, puntos: 20, opciones: [{ texto: 'A la jefatura', puntos: 20 }, { texto: 'A nadie', puntos: 0 }] },
          { tipo: 'OPCION_MULTIPLE', enunciado: E_MULTI, puntos: 20, opciones: [{ texto: 'El arqueo', puntos: 10 }, { texto: 'Los vales', puntos: 10 }, { texto: 'Nada', puntos: 0 }] },
          { tipo: 'ESCALA', enunciado: E_ESCALA, puntos: 20, opciones: Array.from({ length: 5 }, (_, i) => ({ texto: i === 0 ? 'Nada' : i === 4 ? 'Mucho' : '', puntos: (i + 1) * 4 })) },
          { tipo: 'ABIERTA', enunciado: E_ABIERTA, puntos: 20, queDebeTener: 'El monto, la causa y el plazo.' },
          { tipo: 'OPCION_UNICA', enunciado: E_OU2, puntos: 20, opciones: [{ texto: 'Reclamo al banco', puntos: 20 }, { texto: 'Lo dejo así', puntos: 0 }] },
        ],
      },
    ])
    await publicarPreguntas(equipo, vacanteE)
    await escribirPrueba(equipo, vacanteE, {
      criterios: [
        {
          nombre: 'Caja', puntosCalificados: 100, calificador: 'PERSONA',
          preguntas: [{ tipo: 'ABIERTA', enunciado: '¿Cómo hallarías el descuadre de marzo?', queDebeTener: 'La cuenta y el monto.' }],
        },
      ],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 90 },
    })
    expect((await publicarPrueba(equipo, vacanteE)).estado).toBe(200)
    await exigir(`/panel/vacantes/${vacanteE}/publicacion`, equipo, 'POST')
    await exigir(`/panel/vacantes/${vacanteE}/calificacion-automatica`, equipo, 'POST', { activa: false })
  })

  test.afterAll(async () => {
    await limpiarSiempre([() => retirarLoSembrado(correos), () => retirarLasVacantesSembradas([])])
  })

  test('recorridos 1, 3 y 4: la prueba de una en una, el salto con su vuelta, el caso y la recarga en la 5', async ({ page }) => {
    ana = await candidataEnLaPrueba(equipo, vacanteA, 'Ana', correos)
    await empezarLaPrueba(page, ana)
    const main = page.locator('main')

    // AC-01: solo la pregunta 1, con la barra fija, el mapa, «Anterior» y «Siguiente»
    await enLaBarra(page, 'Pregunta 1 de 8')
    await expect(main.getByRole('article')).toHaveCount(1)
    await expect(main.getByRole('heading', { level: 1 })).toHaveText(OU1)
    await expect(tarjeta(page)).toContainText('Pregunta 1 · Opción única')
    await expect(main.getByRole('navigation', { name: 'Las 8 preguntas' })).toContainText('Sin responder')
    await expect(main.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    await expect(casilla(page, 'Entregables')).toBeVisible()
    await expect(main.getByText('Te faltan 9 por terminar')).toBeVisible()
    // QA-UPP-04: con la página al final la barra sigue entera bajo la cabecera, sin cambiar el
    // aire hasta la pregunta ni alargar la página
    await laBarraNoCambiaLaPagina(page, 'escritorio')
    await alFinal(page)
    expect((await laBarraFija(page)).bajoLaCabecera, 'escritorio, al final: la barra entera bajo la cabecera').toBeGreaterThanOrEqual(-0.5)
    await arriba(page)
    // El caso, a la derecha, con sus materiales y «Por entregar»
    const caso = page.getByRole('complementary', { name: 'El caso' })
    await expect(caso).toContainText(CASO)
    await expect(caso).toContainText(MATERIALES)
    await expect(caso).toContainText('obligatorio, pendiente')

    // Responde la 1 y la 2
    await page.getByText('a. Libro diario', { exact: true }).click()
    await siguiente(page)
    await enLaBarra(page, 'Pregunta 2 de 8')
    await page.getByText('Factura', { exact: true }).click()
    await expect.poll(() => respondidasEnElServidor(ana), { timeout: 15_000 }).toBe(2)
    await expect(casilla(page, 'Pregunta 1')).toHaveAttribute('aria-label', 'Pregunta 1, lista')

    // Salta con el mapa a la 6 y vuelve con «Volver a la 2»
    await casilla(page, 'Pregunta 6').click()
    await enLaBarra(page, 'Pregunta 6 de 8')
    await expect(main.getByRole('heading', { level: 1 })).toHaveText(ABIERTA2)
    await main.getByRole('button', { name: 'Volver a la 2' }).click()
    await enLaBarra(page, 'Pregunta 2 de 8')
    await expect(main.getByRole('button', { name: /^Volver a la/ })).toHaveCount(0)

    // Recorrido 4: el caso se oculta y vuelve con «Ver el caso» desde otra pregunta
    await caso.getByRole('button', { name: 'Ocultar el caso' }).click()
    await expect(page.getByRole('complementary')).toHaveCount(0)
    await siguiente(page)
    await enLaBarra(page, 'Pregunta 3 de 8')
    await main.getByRole('button', { name: 'Ver el caso' }).click()
    await expect(page.getByRole('complementary', { name: 'El caso' })).toBeVisible()

    // AC-04: respondida sin su archivo obligatorio, a medias y en ámbar
    await main.getByRole('textbox', { name: ABIERTA1 }).fill('En la cuenta 1041 había un depósito duplicado.')
    await expect(tarjeta(page)).toContainText('Archivo de esta pregunta: Conciliación.xlsx · obligatorio')
    await expect(tarjeta(page)).toContainText('Sin este archivo no se puede entregar la prueba.')
    await expect(casilla(page, 'Pregunta 3')).toHaveAttribute('aria-label', 'Pregunta 3, a medias, falta su archivo (estás aquí)')

    // Recorrido 3: en la 5 se recarga y se sigue en la 5, con lo respondido contado
    await casilla(page, 'Pregunta 5').click()
    await enLaBarra(page, 'Pregunta 5 de 8')
    await expect.poll(() => respondidasEnElServidor(ana), { timeout: 15_000 }).toBe(3)
    await page.reload()
    await enLaBarra(page, 'Pregunta 5 de 8')
    await expect(casilla(page, 'Pregunta 2')).toHaveAttribute('aria-label', 'Pregunta 2, lista')
    await expect(casilla(page, 'Pregunta 4')).toHaveAttribute('aria-label', 'Pregunta 4, sin responder')
  })

  test('recorrido 2: con huecos no entrega; el aviso lleva a lo que falta, se completa y se entrega (AC-10)', async ({ page }) => {
    await entrarAlPortalCon(page, ana.token)
    await page.goto(`/procesos/${ana.uuid}/prueba`)
    await expect(page.getByText('Tiempo restante')).toBeVisible({ timeout: 20_000 })
    const main = page.locator('main')
    // Sin nada apuntado en esta pestaña: la primera que no está lista, la 3 (le falta el archivo)
    await enLaBarra(page, 'Pregunta 3 de 8')
    await casilla(page, 'Pregunta 1').click()
    await enLaBarra(page, 'Pregunta 1 de 8')

    await main.getByRole('button', { name: 'Entregar la prueba' }).click()
    const falta = page.getByRole('alert').filter({ hasText: 'Para entregar te falta' })
    await expect(falta).toContainText('Para entregar te falta responder 5 preguntas (la 4, la 5, la 6, la 7 y la 8).')
    await expect(falta).toContainText(`Te falta subir «${ARCHIVO}» (pregunta 3), «${GENERAL}».`)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    // Lo primero que falta es el archivo de la 3: lleva a su pregunta, con el foco en él
    await falta.getByRole('button', { name: 'Ir a la pregunta 3' }).click()
    await enLaBarra(page, 'Pregunta 3 de 8')
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest('[id^="entregable-"]') !== null))
      .toBe(true)
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'conciliacion.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 la conciliación'),
    })
    await expect(tarjeta(page)).toContainText('Recibimos conciliacion.pdf', { timeout: 20_000 })

    // Las que faltan, de una en una con «Siguiente sin responder»
    await main.getByRole('button', { name: 'Siguiente sin responder' }).click()
    await enLaBarra(page, 'Pregunta 4 de 8')
    await main.getByRole('radiogroup', { name: 'Niveles, del menor al mayor' }).getByText('3', { exact: true }).click()
    await main.getByRole('button', { name: 'Siguiente sin responder' }).click()
    await enLaBarra(page, 'Pregunta 5 de 8')
    await page.getByText('a. BUSCARV', { exact: true }).click()
    await main.getByRole('button', { name: 'Siguiente sin responder' }).click()
    await enLaBarra(page, 'Pregunta 6 de 8')
    await main.getByRole('textbox', { name: ABIERTA2 }).fill('El banco cobró dos veces la comisión; ya se reclamó.')
    await main.getByRole('button', { name: 'Siguiente sin responder' }).click()
    await enLaBarra(page, 'Pregunta 7 de 8')
    await page.getByText('Bancos', { exact: true }).click()
    await main.getByRole('button', { name: 'Siguiente sin responder' }).click()
    await enLaBarra(page, 'Pregunta 8 de 8')
    await main.getByRole('radiogroup', { name: 'Niveles, del menor al mayor' }).getByText('2', { exact: true }).click()
    // La última pregunta lleva al paso de los entregables
    await main.getByRole('button', { name: 'Siguiente: entregables' }).click()
    await expect(main.getByRole('heading', { level: 1, name: 'Entregables' })).toBeVisible()
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'informe.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 el informe'),
    })
    await expect(tarjeta(page)).toContainText('Recibimos informe.pdf', { timeout: 20_000 })
    await expect.poll(() => respondidasEnElServidor(ana), { timeout: 15_000 }).toBe(8)
    await expect(main.getByText('Todo listo para entregar')).toBeVisible()

    // En el paso final, «Entregar la prueba» va relleno y una sola vez
    await expect(main.getByRole('button', { name: 'Entregar la prueba' })).toHaveCount(1)
    await tarjeta(page).getByRole('button', { name: 'Entregar la prueba' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Entregar', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/procesos/${ana.uuid}$`), { timeout: 20_000 })
  })

  test('recorridos 4 y 5: sin caso no hay lateral; vencer con un hueco la deja sin completar', async ({ page }) => {
    // El barrido de vencimientos pasa cada 60 s y se espera dos veces (el testigo y Beto): no
    // cabe en los 60 s por defecto.
    test.setTimeout(240_000)
    const beto = await candidataEnLaPrueba(equipo, vacanteB, 'Beto', correos)
    await empezarLaPrueba(page, beto)
    const main = page.locator('main')
    await enLaBarra(page, 'Pregunta 1 de 2')
    await expect(page.getByRole('complementary')).toHaveCount(0)
    await expect(main.getByRole('button', { name: /Ver el caso|Para esta prueba/ })).toHaveCount(0)
    await expect(casilla(page, 'Entregables')).toHaveCount(0)

    await page.getByText('a. 18 %', { exact: true }).click()
    await expect.poll(() => respondidasEnElServidor(beto), { timeout: 15_000 }).toBe(1)

    /*
      QA-UPP-05: «Se acabó el tiempo» es lo que la pantalla dice entre su consulta —cada 20 s— y
      el barrido del servidor que cierra el intento —60 s después de acabar el anterior—. Vencido
      en un momento cualquiera, el barrido podía llegar antes que la consulta y la pantalla pasaba
      directamente a cerrada. Por eso se vence justo después de un barrido, el que cierra a un
      testigo vencido antes: hasta el siguiente quedan 60 s, de sobra para la consulta.
    */
    const testigo = await candidataEnLaPrueba(equipo, vacanteB, 'Testigo', correos)
    expect((await iniciarLaPrueba(testigo)).estado).toBe(200)
    vencer(testigo.postulacion)
    await expect
      .poll(() => cerrado(testigo.postulacion), { timeout: 75_000, intervals: [500], message: 'el barrido cierra al testigo' })
      .toBe(true)
    vencer(beto.postulacion)
    // La pantalla se entera en su siguiente consulta y lo dice, con el intento aún abierto en el servidor
    await expect(main.getByText('Se acabó el tiempo')).toBeVisible({ timeout: 30_000 })
    expect(cerrado(beto.postulacion), 'el barrido todavía no ha cerrado el intento').toBe(false)
    // Después del barrido, cerrada y sin preguntas
    await expect(
      page.getByRole('heading', { name: 'Tu tiempo terminó y la prueba quedó sin completar.' }),
    ).toBeVisible({ timeout: 100_000 })
    await expect(main.getByRole('article')).toHaveCount(0)
    expect(uno(`select no_completada from intento_prueba where postulacion_id = ${beto.postulacion}`).no_completada).toBe(true)
  })

  test('recorridos 3 y 6: la evaluación con el mismo marco, la recarga en la 5 y la entrega con huecos', async ({ page }) => {
    const carla = await cuentaDeCandidato('Carla', correos)
    const uuid = await postular(carla.token, vacanteE)
    await entrarAlPortalCon(page, carla.token)
    await page.goto(`/procesos/${uuid}/evaluacion`)
    await page.getByRole('button', { name: 'Empezar evaluación' }).click({ timeout: 20_000 })
    const main = page.locator('main')

    // AC-02: el mismo marco: barra, mapa con su leyenda y tarjeta, sin caso ni entregables
    await enLaBarra(page, 'Pregunta 1 de 5')
    await expect(main.getByText('0 de 5 respondidas')).toBeVisible()
    const mapa = main.getByRole('navigation', { name: 'Las 5 preguntas' })
    for (const estado of ['Lista', 'A medias', 'Sin responder']) await expect(mapa).toContainText(estado)
    await expect(casilla(page, 'Entregables')).toHaveCount(0)
    await expect(page.getByRole('complementary')).toHaveCount(0)
    await expect(tarjeta(page)).toContainText('Pregunta 1 · Opción única')

    // Responde la 1, la 2 y la 4; deja la 3 y la 5
    await main.getByText('A. A la jefatura', { exact: true }).click()
    await expect(tarjeta(page).getByText('Guardado', { exact: true })).toBeVisible({ timeout: 15_000 })
    await siguiente(page)
    await page.getByText('El arqueo', { exact: true }).click()
    await expect(tarjeta(page).getByText('Guardado', { exact: true })).toBeVisible({ timeout: 15_000 })
    await siguiente(page)
    await siguiente(page)
    await enLaBarra(page, 'Pregunta 4 de 5')
    await main.getByLabel('Tu respuesta').fill('En marzo la caja no cuadraba por 1.200 soles; lo hallé revisando los vales.')
    await expect(tarjeta(page).getByText('Guardado', { exact: true })).toBeVisible({ timeout: 15_000 })
    await siguiente(page)
    await enLaBarra(page, 'Pregunta 5 de 5')

    // Recorrido 3: recarga en la 5 y sigue en la 5 (no en la 3, la primera sin responder)
    await page.reload()
    await enLaBarra(page, 'Pregunta 5 de 5')
    await expect(main.getByText('3 de 5 respondidas')).toBeVisible()

    // «Siguiente sin responder» da la vuelta a la 3, y aparece «Volver a la 5»
    await main.getByRole('button', { name: 'Siguiente sin responder' }).click()
    await enLaBarra(page, 'Pregunta 3 de 5')
    await expect(main.getByRole('button', { name: 'Volver a la 5' })).toBeVisible()
    await main.getByRole('button', { name: 'Volver a la 5' }).click()
    await enLaBarra(page, 'Pregunta 5 de 5')

    // «Entregar la evaluación» con huecos: el aviso, sin ventana de recuento, y su botón
    await main.getByRole('button', { name: 'Entregar la evaluación' }).click()
    const falta = page.getByRole('alert').filter({ hasText: 'Para entregar te falta' })
    await expect(falta).toContainText('Para entregar te falta responder 2 preguntas (la 3 y la 5).')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await falta.getByRole('button', { name: 'Ir a la pregunta 3' }).click()
    await enLaBarra(page, 'Pregunta 3 de 5')
    await tarjeta(page).getByText('4', { exact: true }).click()
    await expect(tarjeta(page).getByText('Guardado', { exact: true })).toBeVisible({ timeout: 15_000 })
    await casilla(page, 'Pregunta 5').click()
    await enLaBarra(page, 'Pregunta 5 de 5')
    await main.getByText('A. Reclamo al banco', { exact: true }).click()
    await expect(main.getByText('Todo listo para entregar')).toBeVisible({ timeout: 15_000 })
    await expect(main.getByText('5 de 5 respondidas')).toBeVisible({ timeout: 15_000 })

    await expect(main.getByRole('button', { name: 'Entregar la evaluación' })).toHaveCount(1)
    await tarjeta(page).getByRole('button', { name: 'Entregar la evaluación' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Entregar', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/procesos/${uuid}$`), { timeout: 20_000 })
  })

  test('recorrido 6: en el banco del modelo, un formato de varias partes a medias sale a medias en el mapa', async ({ page }) => {
    // La evaluación se siembra como la del 32: una postulación en su turno del Perfil Integral
    // con la plantilla de una evaluación del banco que ya exista en el clon.
    const modelo = JSON.parse(sql(`
      select coalesce(row_to_json(e)::text, 'null') from (
        select plantilla_evaluacion_id, version_banco_nivel_id from evaluacion
         where proposito = 'PERFIL_INTEGRAL' and plantilla_evaluacion_id is not null
         order by id limit 1) e;`)) as { plantilla_evaluacion_id: number; version_banco_nivel_id: number } | null
    expect(modelo, 'hace falta una evaluación del banco en el clon de la que copiar la plantilla').not.toBeNull()
    const dani = await cuentaDeCandidato('Dani', correos)
    const vacante = sembrarVacantePropia(`${MARCA_ELIMINA} Una por pantalla, el banco del modelo`)
    const postulacion = JSON.parse(sql(`
      with po as (
        insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo)
        select v.organizacion_id, ${dani.usuario}, v.id, 'PERFIL_TURNO_CANDIDATO'
          from vacante v where v.id = ${vacante}
        returning id, uuid)
      select row_to_json(po) from po;`)) as { id: number; uuid: string }
    sql(`
      with ev as (
        insert into evaluacion (organizacion_id, usuario_id, plantilla_evaluacion_id,
                                version_banco_nivel_id, estado, vence_en, proposito)
        select v.organizacion_id, ${dani.usuario}, ${modelo!.plantilla_evaluacion_id},
               ${modelo!.version_banco_nivel_id}, 'PENDIENTE', now() + interval '7 days',
               ${literal('PERFIL_INTEGRAL')}
          from vacante v where v.id = ${vacante}
        returning id)
      update postulacion set evaluacion_id = (select id from ev) where id = ${postulacion.id};`)

    await entrarAlPortalCon(page, dani.token)
    await page.goto(`/procesos/${postulacion.uuid}/evaluacion`)
    await page.getByRole('button', { name: 'Empezar evaluación' }).click({ timeout: 20_000 })
    const main = page.locator('main')
    await expect(main.getByText(/^Pregunta 1 de \d+$/)).toBeVisible({ timeout: 20_000 })

    // Una elección forzada (EF-4): se marca «la que más» y no «la que menos»
    const preguntas = (await pedir(`/portal/evaluacion/${postulacion.uuid}`, dani.token)).cuerpo.preguntas as any[]
    const i = preguntas.findIndex((p) => p.tipo === 'EF-4')
    expect(i, 'el banco del modelo trae elecciones forzadas').toBeGreaterThanOrEqual(0)
    await casilla(page, `Pregunta ${i + 1}`).click()
    await enLaBarra(page, `Pregunta ${i + 1} de ${preguntas.length}`)
    // Los formatos del banco del modelo llevan solo «Pregunta N», sin el nombre del tipo
    await expect(tarjeta(page).getByText(`Pregunta ${i + 1}`, { exact: true })).toBeVisible()
    await tarjeta(page).getByText('La que más', { exact: true }).first().click()
    await expect(tarjeta(page).getByText('Sin terminar', { exact: true })).toBeVisible()
    await siguiente(page)
    await expect(casilla(page, `Pregunta ${i + 1}`)).toHaveAttribute('aria-label', `Pregunta ${i + 1}, a medias`)
    // Y al volver, sigue como se dejó
    await main.getByRole('button', { name: 'Anterior' }).click()
    await expect(tarjeta(page).getByText('Sin terminar', { exact: true })).toBeVisible()
  })

  test('AC-12: en el teléfono el mapa es una hoja desde abajo y el caso una barra plegable, sin desplazamiento lateral', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const eva = await candidataEnLaPrueba(equipo, vacanteA, 'Eva', correos)
    await empezarLaPrueba(page, eva)
    const main = page.locator('main')
    await enLaBarra(page, 'Pregunta 1 de 8')
    await expect(main.getByRole('navigation')).toHaveCount(0)
    await expect(page.getByRole('complementary')).toHaveCount(0)
    await laBarraNoCambiaLaPagina(page, 'teléfono')

    const plegado = main.getByRole('button', { name: 'Ver el caso' })
    await expect(plegado).toHaveAttribute('aria-expanded', 'false')
    await plegado.click()
    await expect(plegado).toHaveAttribute('aria-expanded', 'true')
    await expect(main).toContainText(CASO)

    await main.getByRole('button', { name: 'Ver las 8' }).click()
    const hoja = page.getByRole('dialog', { name: 'Las 8 preguntas' })
    await expect(hoja).toBeVisible()
    await expect(hoja).toContainText('Te faltan 9 por terminar.')
    // La hoja no tapa la barra fija —entera, con sus dos filas—: ni ella ni su velo empiezan
    // por encima de su borde de abajo
    const medidas = await hojaYBarra(page, hoja)
    expect(medidas.velo, 'el velo empieza bajo la barra').toBeGreaterThanOrEqual(medidas.barra - 0.5)
    expect(medidas.caja, 'la hoja empieza bajo la barra').toBeGreaterThanOrEqual(medidas.barra - 0.5)
    // QA-UPP-04: con la página al final, la barra —con la fila de «Ocultar el mapa»— sigue entera
    // bajo la cabecera, y la hoja bajo la barra
    await alFinal(page)
    expect((await laBarraFija(page)).bajoLaCabecera, 'teléfono, al final: la barra entera bajo la cabecera').toBeGreaterThanOrEqual(-0.5)
    await expect
      .poll(async () => {
        const m = await hojaYBarra(page, hoja)
        return Math.min(m.velo, m.caja) - m.barra
      }, { message: 'teléfono, al final: la hoja empieza bajo la barra' })
      .toBeGreaterThanOrEqual(-0.5)
    // «Ocultar el mapa» la cierra, y «Ver las 8» la vuelve a abrir
    await main.getByRole('button', { name: 'Ocultar el mapa' }).click()
    await expect(hoja).toHaveCount(0)
    await main.getByRole('button', { name: 'Ver las 8' }).click()
    await expect(hoja).toBeVisible()
    await hoja.getByRole('button', { name: /^Pregunta 4,/ }).click()
    await expect(hoja).toHaveCount(0)
    await enLaBarra(page, 'Pregunta 4 de 8')

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    // «Entregar la prueba», debajo de la pregunta y una sola vez
    await expect(main.getByRole('button', { name: 'Entregar la prueba' })).toHaveCount(1)
  })
})
