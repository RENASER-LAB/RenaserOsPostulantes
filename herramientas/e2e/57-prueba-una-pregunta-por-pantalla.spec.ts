import { expect, type Locator, type Page } from '@playwright/test'
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
 *   +  Revisión humana del 09/10/2026: el archivo obligatorio va neutro al escribir y en ámbar
 *      desde que se pulsa «Entregar la prueba» con huecos, hasta que se sube; y el caso largo
 *      (prueba C), recortado en el lateral, se lee entero en su ventana de lectura —que Escape
 *      cierra devolviendo el foco—.
 *   +  Revisión humana del 10/10/2026, la pantalla previa: una ficha corta sin el caso, los
 *      materiales ni las preguntas, que se abren al empezar —el caso se lee dentro del reloj—. Los
 *      datos en una fila (2×2 en el teléfono), la condición con «Empezar prueba» debajo, a la vista
 *      al abrir, y lo que entregarás al final; sin archivos, los datos y la acción. Lo que trae la
 *      API antes y después de empezar lo comprueba el QA-13 del 57-qa.
 *
 * El recorrido 7 (la plantilla, igual que hoy) lo cubren el 31 y el recorrido 7 del 48.
 *
 * La prueba A tiene caso, 8 preguntas de los cuatro tipos, una abierta con su archivo
 * obligatorio y un entregable general obligatorio. La B no tiene caso ni generales. La C
 * tiene un caso largo, de varios párrafos y una lista.
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

/** El caso largo de la prueba C: más de lo que cabe en las líneas del lateral. */
const CASO_C_INICIO =
  'La tienda de Miraflores cerró marzo con un descuadre de S/ 1 250 entre el libro mayor y el extracto ' +
  'del banco. El contador anterior dejó notas sueltas y dos conciliaciones a medias.'
const CASO_C_LISTA = 'Lo que tienes:\n- el mayor de marzo\n- el extracto del banco\n- las notas del contador'
const CASO_C_FINAL =
  'La gerencia necesita saber antes del viernes de dónde sale la diferencia y qué asientos hay que ' +
  'corregir. Explica cada ajuste como se lo dirías a alguien que no es contador.'
const CASO_C = [CASO_C_INICIO, CASO_C_LISTA, CASO_C_FINAL, CASO_C_INICIO, CASO_C_FINAL].join('\n\n')
const PREGUNTA_C = '¿Qué asiento corregirías primero?'

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
let vacanteC = 0
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

/**
 * ¿Van de arriba abajo, cada una entera bajo la anterior? Tras cambiar el tamaño de la ventana la
 * página se recoloca, así que se espera a que se asiente.
 */
const unaBajoOtra = async (...ls: Locator[]) => {
  const cajas = await Promise.all(ls.map((l) => l.boundingBox()))
  return cajas.every((c, i) => c !== null && (i === 0 || c.y >= cajas[i - 1]!.y + cajas[i - 1]!.height - 1))
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

/** El ámbar de lo que frena la entrega: `--duda-bruma` de fondo y `--duda` de borde. */
const AMBAR = { fondo: 'rgb(251, 242, 228)', borde: 'rgb(143, 90, 10)' }
const colorDe = (l: Locator) =>
  l.evaluate((el) => ({ fondo: getComputedStyle(el).backgroundColor, borde: getComputedStyle(el).borderTopColor }))
const FRASE_DEL_ARCHIVO = 'Sin este archivo no se puede entregar la prueba.'

/**
 * La letra de un párrafo y cuántos caracteres caben en una de sus líneas: su ancho entre lo que
 * mide de media una letra de su propio texto. No depende de dónde caiga el último renglón.
 */
const letraDe = (parrafo: Locator) =>
  parrafo.evaluate((p) => {
    const estilo = getComputedStyle(p)
    const lienzo = document.createElement('canvas').getContext('2d')!
    lienzo.font = `${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`
    const texto = p.textContent ?? ''
    return {
      tamano: estilo.fontSize,
      linea: estilo.lineHeight,
      ancho: p.getBoundingClientRect().width,
      porLinea: p.getBoundingClientRect().width / (lienzo.measureText(texto).width / texto.length),
    }
  })

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
    vacanteC = await vacanteConPrueba('Una por pantalla C', {
      criterios: [
        {
          nombre: 'Ajustes', puntosCalificados: 100, calificador: 'PERSONA',
          preguntas: [{ tipo: 'ABIERTA', enunciado: PREGUNTA_C, queDebeTener: 'El asiento y su motivo.' }],
        },
      ],
      datos: { enunciado: CASO_C, materiales: MATERIALES, modalidad: 'CRONOMETRADA', duracionMinutos: 30 },
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

    // AC-04: respondida sin su archivo obligatorio, a medias; el recuadro, neutro hasta que se
    // intenta entregar (el ámbar lo recorre su propio test)
    await main.getByRole('textbox', { name: ABIERTA1 }).fill('En la cuenta 1041 había un depósito duplicado.')
    await expect(tarjeta(page)).toContainText('Archivo de esta pregunta: Conciliación.xlsx · obligatorio')
    await expect(tarjeta(page)).not.toContainText('Sin este archivo no se puede entregar la prueba.')
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

  test('AC-04 (revisión): el archivo obligatorio va neutro al escribir y en ámbar tras pulsar «Entregar la prueba», hasta que se sube', async ({ page }) => {
    const fer = await candidataEnLaPrueba(equipo, vacanteA, 'Fer', correos)
    await empezarLaPrueba(page, fer)
    const main = page.locator('main')
    await casilla(page, 'Pregunta 3').click()
    await enLaBarra(page, 'Pregunta 3 de 8')
    const archivo = tarjeta(page).locator('[id^="entregable-"]')

    // Escribir la respuesta no lo pone en ámbar: neutro, con su «· obligatorio» y sin la frase
    await main.getByRole('textbox', { name: ABIERTA1 }).fill('El depósito duplicado de la cuenta 1041.')
    await expect(casilla(page, 'Pregunta 3')).toHaveAttribute('aria-label', 'Pregunta 3, a medias, falta su archivo (estás aquí)')
    await expect(archivo).toContainText('· obligatorio')
    await expect(archivo).not.toContainText(FRASE_DEL_ARCHIVO)
    expect((await colorDe(archivo)).fondo, 'neutro antes de intentar entregar').not.toBe(AMBAR.fondo)

    // «Entregar la prueba» con huecos: el aviso de lo que falta y, a la vez, el ámbar con su frase
    await main.getByRole('button', { name: 'Entregar la prueba' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Para entregar te falta' })).toContainText(
      `Te falta subir «${ARCHIVO}» (pregunta 3), «${GENERAL}».`,
    )
    await expect(archivo).toContainText(FRASE_DEL_ARCHIVO)
    await expect(archivo).toContainText('· obligatorio')
    await expect.poll(() => colorDe(archivo)).toEqual(AMBAR)

    // El general obligatorio del paso «Entregables», igual
    await casilla(page, 'Entregables').click()
    await expect(main.getByRole('heading', { level: 1, name: 'Entregables' })).toBeVisible()
    const general = tarjeta(page).locator('[id^="entregable-"]').filter({ hasText: GENERAL })
    await expect(general).toContainText(FRASE_DEL_ARCHIVO)
    await expect.poll(() => colorDe(general)).toEqual(AMBAR)

    // De vuelta en la 3 sigue en ámbar, hasta que se sube
    await casilla(page, 'Pregunta 3').click()
    await enLaBarra(page, 'Pregunta 3 de 8')
    await expect.poll(() => colorDe(archivo)).toEqual(AMBAR)
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'conciliacion.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 la conciliación'),
    })
    await expect(tarjeta(page)).toContainText('Recibimos conciliacion.pdf', { timeout: 20_000 })
    await expect(archivo).not.toContainText(FRASE_DEL_ARCHIVO)
    expect((await colorDe(archivo)).fondo, 'subido, ya no frena la entrega').not.toBe(AMBAR.fondo)
  })

  test('la pantalla previa: una ficha corta —los datos, la condición con «Empezar prueba» y lo que entregarás—, sin el caso ni las preguntas; en el teléfono, en 2×2 y una columna', async ({ page }) => {
    // Revisión humana del 10/10/2026: el caso se lee dentro del reloj. La pantalla previa deja de
    // enseñarlo —ni los materiales, ni una pregunta— y la columna fija se va: todo cabe en una ficha.
    const irene = await candidataEnLaPrueba(equipo, vacanteA, 'Irene', correos)
    await page.setViewportSize({ width: 1440, height: 900 })
    await entrarAlPortalCon(page, irene.token)
    await page.goto(`/procesos/${irene.uuid}/prueba`)
    const main = page.locator('main')
    const empezar = main.getByRole('button', { name: 'Empezar prueba' })
    await expect(empezar).toBeVisible({ timeout: 20_000 })

    // Lo que dice arriba: el contenido y las preguntas se abren al empezar y desde ahí corre el
    // tiempo; sin nombrar un caso o unos materiales que antes de empezar no se sabe si hay (QA del
    // ciclo 11). Que leer cuenta lo dice la condición, con las preguntas y los obligatorios que son.
    await expect(main).toContainText('El contenido y las preguntas se abren al empezar, y desde ahí corre el tiempo.')
    await expect(main.locator('b', { hasText: 'desde ahí corre el tiempo' })).toBeVisible()
    await expect(main).not.toContainText(/El caso|los materiales/)
    await expect(main).not.toContainText('Lee todo antes de empezar')
    // Nada de la prueba antes de empezar: ni el caso, ni los materiales, ni una pregunta
    for (const texto of [CASO, MATERIALES, OU1, ABIERTA1, ESCALA2]) await expect(main).not.toContainText(texto)
    await expect(main.getByRole('heading', { name: /El caso|Materiales/ })).toHaveCount(0)

    // Los datos: cuatro celdas en una fila, a la escala de un título y sin índigo
    const franja = main.locator('dl')
    const celdas = franja.locator('> div')
    await expect(celdas.locator('dt')).toHaveText(['Tiempo', 'Fecha límite', 'Preguntas', 'Archivos'])
    const valores = celdas.locator('dd:first-of-type')
    await expect(valores).toHaveText(['90 min', /^\S+ \d\d\/\d\d a las \d\d:\d\d$/, '8', '2'])
    await expect(celdas.nth(0)).toContainText('desde que pulses Empezar')
    await expect(celdas.nth(0)).toContainText('o hasta la fecha límite, si llega antes')
    await expect(celdas.nth(3)).toContainText('2 obligatorios')
    const letra = await valores.evaluateAll((vs) => vs.map((v) => ({ tamano: getComputedStyle(v).fontSize, peso: getComputedStyle(v).fontWeight, color: getComputedStyle(v).color })))
    for (const l of letra) expect(l).toEqual({ tamano: '20px', peso: '600', color: 'rgb(16, 24, 40)' })
    const enRejilla = async () => {
      const cajas = await celdas.evaluateAll((cs) => cs.map((c) => c.getBoundingClientRect()).map((r) => [Math.round(r.x), Math.round(r.y)]))
      return { columnas: new Set(cajas.map(([x]) => x)).size, filas: new Set(cajas.map(([, y]) => y)).size }
    }
    expect(await enRejilla(), 'en una fila').toEqual({ columnas: 4, filas: 1 })

    // Debajo, la condición y a su derecha «Empezar prueba», en la misma fila; debajo, lo que entregarás
    const condicion = main.getByText(/^Una vez empezada no se puede pausar, ni para leer\./)
    await expect(condicion).toHaveText(
      'Una vez empezada no se puede pausar, ni para leer. Para entregar hay que responder las 8 preguntas y subir los 2 archivos obligatorios; si el tiempo termina con algo pendiente, queda sin completar.',
    )
    const entregar = main.locator('section').filter({ has: page.getByRole('heading', { name: 'Lo que entregarás' }) })
    await expect(entregar.getByRole('listitem')).toHaveText([
      `${ARCHIVO}obligatorio · en la pregunta 3 · se entrega como archivo`,
      `${GENERAL}obligatorio · se entrega como archivo`,
    ])
    const caja = async (l: Locator) => (await l.boundingBox())!
    const [cFranja, cCondicion, cBoton, cEntregar, cFicha] = [
      await caja(franja), await caja(condicion), await caja(empezar), await caja(entregar), await caja(franja.locator('xpath=..')),
    ]
    expect(cCondicion.y, 'la condición, bajo los datos').toBeGreaterThanOrEqual(cFranja.y + cFranja.height)
    expect(cBoton.x, 'el botón, a la derecha de la condición').toBeGreaterThan(cCondicion.x + cCondicion.width)
    expect(Math.abs(cBoton.y + cBoton.height / 2 - (cCondicion.y + cCondicion.height / 2)), 'en la misma fila').toBeLessThan(24)
    expect(cEntregar.y, 'lo que entregarás, bajo el botón').toBeGreaterThanOrEqual(cBoton.y + cBoton.height)
    // Una sola superficie a lo ancho del carril: los datos la llenan de borde a borde
    expect(cFranja.x).toBeCloseTo(cFicha.x + 1, 0)
    expect(cFranja.width).toBeCloseTo(cFicha.width - 2, 0)
    expect(cEntregar.x + cEntregar.width, 'lo que entregarás, a lo ancho de la ficha').toBeCloseTo(cFicha.x + cFicha.width - 1, 0)
    // Al abrir, el botón a la vista sin desplazar; y nada pegado: el bloque va con la página
    expect(await page.evaluate(() => scrollY), 'la pantalla recién abierta, arriba del todo').toBe(0)
    expect(cBoton.y + cBoton.height, '«Empezar prueba» a la vista al abrir, sin desplazar').toBeLessThanOrEqual(900)
    expect(await empezar.evaluate((b) => getComputedStyle(b.parentElement!).position)).toBe('static')
    await expect(empezar).toHaveAttribute('data-rotulo', 'Empezar prueba')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    // En el teléfono: los datos en 2×2, y todo en una columna en su orden, el botón a todo el ancho
    await page.setViewportSize({ width: 360, height: 800 })
    expect(await enRejilla(), 'en 2×2').toEqual({ columnas: 2, filas: 2 })
    await expect.poll(() => unaBajoOtra(franja, condicion, empezar, entregar), { message: 'datos, condición, botón y lo que entregarás' }).toBe(true)
    const [enElTelefono, fichaEnElTelefono] = [await caja(empezar), await caja(franja.locator('xpath=..'))]
    expect(enElTelefono.width, '«Empezar prueba» a todo el ancho').toBeCloseTo(fichaEnElTelefono.width - 2 - 2 * 16, 0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(empezar).toBeInViewport()
    await empezar.click()
    const dialogo = page.getByRole('dialog', { name: '¿Empezar ahora?' })
    await expect(dialogo).toContainText(
      'Al confirmar se abren el contenido de la prueba y sus 8 preguntas, y empieza a correr el tiempo, también mientras lees.',
    )
    await expect(dialogo).toContainText('si falta responder alguna pregunta o subir un archivo obligatorio, queda sin completar')
    await expect(dialogo).not.toContainText(/el caso|los materiales/)

    // QA del ciclo 11: en el teléfono, con reloj, fecha y dos obligatorios, «Empezar prueba» se ve al
    // abrir, también en un Android pequeño y en un iPhone SE; la condición sigue encima, sin desplazar.
    for (const [width, height] of [[360, 740], [375, 667], [390, 844]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(`/procesos/${irene.uuid}/prueba`)
      await expect(empezar).toBeVisible({ timeout: 20_000 })
      expect(await page.evaluate(() => scrollY), `${width}×${height}: recién abierta, arriba del todo`).toBe(0)
      const boton = await caja(empezar)
      expect(boton.y + boton.height, `${width}×${height}: «Empezar prueba» a la vista al abrir`).toBeLessThanOrEqual(height)
      expect((await caja(condicion)).y + (await caja(condicion)).height, `${width}×${height}: la condición, encima del botón`).toBeLessThanOrEqual(boton.y)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: sin desplazar a lo ancho`).toBe(true)
    }
  })

  test('el caso largo: no está en la pantalla previa; recortado en el lateral, se lee en su ventana y Escape la cierra devolviendo el foco', async ({ page }) => {
    const gabi = await candidataEnLaPrueba(equipo, vacanteC, 'Gabi', correos)
    await entrarAlPortalCon(page, gabi.token)
    await page.goto(`/procesos/${gabi.uuid}/prueba`)
    const main = page.locator('main')
    await expect(main.getByRole('button', { name: 'Empezar prueba' })).toBeVisible({ timeout: 20_000 })

    // La pantalla previa ya no lo enseña (revisión humana del 10/10/2026): el caso se lee dentro del
    // reloj. Ni su comienzo, ni su lista, ni los materiales; y la página no crece con él.
    for (const texto of [CASO_C_INICIO, 'las notas del contador', MATERIALES, PREGUNTA_C]) {
      await expect(main).not.toContainText(texto)
    }
    await expect(main.getByRole('heading', { name: 'El caso' })).toHaveCount(0)
    expect((await main.locator('dl').locator('xpath=..').boundingBox())!.height, 'la ficha no crece con el caso').toBeLessThan(320)

    await main.getByRole('button', { name: 'Empezar prueba' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Sí, empezar' }).click()
    await expect(page.getByText('Tiempo restante')).toBeVisible({ timeout: 20_000 })

    // El lateral: el comienzo, recortado a siete líneas en la letra del cuerpo; los materiales, ahí
    const lateral = page.getByRole('complementary', { name: 'El caso' })
    await expect(lateral).toContainText(MATERIALES)
    const primero = lateral.locator('p').first()
    const recorte = await primero.evaluate((p) => ({ alto: p.parentElement!.clientHeight, todo: p.parentElement!.scrollHeight }))
    expect(recorte.todo, 'el lateral recorta el caso').toBeGreaterThan(recorte.alto)
    // Siete líneas de 24 px, más el aire entre párrafos si el recorte cruza alguno (8 px cada uno)
    expect(recorte.alto, 'siete líneas de 24 px').toBeGreaterThanOrEqual(7 * 24)
    expect(recorte.alto, 'siete líneas de 24 px').toBeLessThan(8 * 24)
    const enElLateral = await letraDe(primero)
    expect(enElLateral.tamano).toBe('16px')
    expect(enElLateral.linea).toBe('24px')

    // «Leer el caso completo» lo abre entero, a unos 70 caracteres por línea, sin los materiales
    const leer = lateral.getByRole('button', { name: 'Leer el caso completo' })
    await leer.click()
    const ventana = page.getByRole('dialog', { name: 'El caso' })
    await expect(ventana).toBeVisible()
    await expect(ventana).toContainText(CASO_C_FINAL)
    await expect(ventana.getByRole('listitem')).toHaveText(['el mayor de marzo', 'el extracto del banco', 'las notas del contador'])
    await expect(ventana).not.toContainText(MATERIALES)
    const enLaVentana = await letraDe(ventana.locator('p').first())
    expect(enLaVentana.tamano).toBe('16px')
    expect(enLaVentana.porLinea, 'unos 70 caracteres por línea').toBeGreaterThan(60)
    expect(enLaVentana.porLinea, 'unos 70 caracteres por línea').toBeLessThan(80)
    // El foco entra en la ventana; Escape la cierra y lo devuelve al botón
    await expect.poll(() => ventana.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(ventana).toHaveCount(0)
    await expect(leer).toBeFocused()

    // En el teléfono, desde la barra plegable: la ventana ocupa la pantalla y la ✕ la cierra
    await page.setViewportSize({ width: 375, height: 812 })
    await main.getByRole('button', { name: 'Ver el caso' }).click()
    const leerEnElTelefono = main.getByRole('button', { name: 'Leer el caso completo' })
    await leerEnElTelefono.click()
    await expect(ventana).toBeVisible()
    expect(await ventana.boundingBox()).toEqual({ x: 0, y: 0, width: 375, height: 812 })
    await ventana.getByRole('button', { name: 'Cerrar' }).click()
    await expect(ventana).toHaveCount(0)
    await expect(leerEnElTelefono).toBeFocused()
  })

  test('la pantalla previa sin caso: con un archivo, lo que entregarás bajo la acción; sin archivos, los datos y la acción, y nada debajo', async ({ page }) => {
    const ARQUEO = 'Arqueo de caja.xlsx'
    const vacante = await vacanteConPrueba('Una por pantalla QA-UPP-FB15, sin lectura', {
      criterios: [
        {
          nombre: 'Caja', puntosCalificados: 50, calificador: 'PERSONA',
          preguntas: [
            { tipo: 'OPCION_UNICA', enunciado: PREGUNTA_B, puntos: 50, opciones: [{ texto: '18 %', puntos: 50 }, { texto: '19 %', puntos: 0 }] },
            { tipo: 'ABIERTA', enunciado: ABIERTA_B, queDebeTener: 'El arqueo y el registro.' },
          ],
        },
      ],
      entregables: [{ nombre: ARQUEO, formato: 'ARCHIVO', obligatorio: true, todaLaPrueba: true }],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 30 },
    })
    const [rita, sara] = [
      await candidataEnLaPrueba(equipo, vacante, 'Rita', correos),
      await candidataEnLaPrueba(equipo, vacanteB, 'Sara', correos),
    ]
    const main = page.locator('main')
    const empezar = main.getByRole('button', { name: 'Empezar prueba' })
    const condicion = main.getByText(/^Una vez empezada no se puede pausar, ni para leer\./)
    const caja = async (l: Locator) => (await l.boundingBox())!
    const sinDesplazarALoAncho = async () =>
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    // Con un archivo: los datos, la acción en una fila y, debajo, lo que entregarás a lo ancho; la
    // ficha acaba con la lista, sin un tramo vacío debajo
    await entrarAlPortalCon(page, rita.token)
    for (const [width, height] of [[1440, 900], [1024, 768]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(`/procesos/${rita.uuid}/prueba`)
      await expect(empezar).toBeVisible({ timeout: 20_000 })
      const entregar = main.locator('section').filter({ has: page.getByRole('heading', { name: 'Lo que entregarás' }) })
      await expect(entregar.getByRole('listitem')).toHaveText([`${ARQUEO}obligatorio · se entrega como archivo`])
      const ficha = main.locator('dl').locator('xpath=..')
      const [cFicha, cFranja, cCondicion, cBoton, cEntregar] = [
        await caja(ficha), await caja(main.locator('dl')), await caja(condicion), await caja(empezar), await caja(entregar),
      ]
      expect(cBoton.x, `${width}: el botón, a la derecha de la condición`).toBeGreaterThan(cCondicion.x + cCondicion.width)
      expect(cCondicion.y, `${width}: la acción, bajo los datos`).toBeGreaterThanOrEqual(cFranja.y + cFranja.height)
      expect(cEntregar.y, `${width}: lo que entregarás, bajo la acción`).toBeGreaterThanOrEqual(cBoton.y + cBoton.height)
      expect(cEntregar.width, `${width}: lo que entregarás, a lo ancho`).toBeCloseTo(cFicha.width - 2, 0)
      expect(cFicha.y + cFicha.height, `${width}: la ficha acaba con la lista`).toBeCloseTo(cEntregar.y + cEntregar.height + 1, 0)
      expect(cBoton.y + cBoton.height, `${width}: «Empezar prueba» a la vista al abrir`).toBeLessThanOrEqual(height)
      await sinDesplazarALoAncho()
    }
    // En el teléfono, una columna en su orden: datos, condición, botón y lo que entregarás
    await page.setViewportSize({ width: 390, height: 844 })
    await expect
      .poll(() => unaBajoOtra(main.locator('dl'), condicion, empezar, main.getByRole('heading', { name: 'Lo que entregarás' })), {
        message: 'datos, condición, botón y lo que entregarás',
      })
      .toBe(true)
    await expect(empezar).toBeInViewport()
    await sinDesplazarALoAncho()

    // Sin caso ni archivos (la prueba B): los datos y la acción, y la ficha acaba ahí
    await page.setViewportSize({ width: 1440, height: 900 })
    await entrarAlPortalCon(page, sara.token)
    await page.goto(`/procesos/${sara.uuid}/prueba`)
    await expect(empezar).toBeVisible({ timeout: 20_000 })
    await expect(main.getByRole('heading', { name: 'Lo que entregarás' })).toHaveCount(0)
    const celda = (etiqueta: string) => main.locator('dl > div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${etiqueta}$`) }) })
    await expect(celda('Preguntas').locator('dd').first()).toHaveText('2')
    await expect(celda('Tiempo').locator('dd').first()).toHaveText('30 min')
    await expect(celda('Archivos')).toHaveCount(0)
    // Sin archivos, la condición no habla de archivos (QA del ciclo 11): exige lo que hay
    await expect(condicion).toHaveText(
      'Una vez empezada no se puede pausar, ni para leer. Para entregar hay que responder las 2 preguntas; si el tiempo termina con algo pendiente, queda sin completar.',
    )
    await expect(main).toContainText('El contenido y las preguntas se abren al empezar, y desde ahí corre el tiempo.')
    const ficha = main.locator('dl').locator('xpath=..')
    const [cFicha, cAccion, cBoton] = [await caja(ficha), await caja(empezar.locator('xpath=..')), await caja(empezar)]
    expect(cFicha.y + cFicha.height, 'la ficha acaba con la acción').toBeCloseTo(cAccion.y + cAccion.height + 1, 0)
    expect(cBoton.y + cBoton.height, '«Empezar prueba» a la vista al abrir').toBeLessThanOrEqual(900)
    await sinDesplazarALoAncho()
    // En el teléfono, la condición y debajo el botón
    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => unaBajoOtra(condicion, empezar), { message: 'la condición y debajo el botón' }).toBe(true)
    await sinDesplazarALoAncho()
    await expect(empezar).toBeInViewport()
    await empezar.click()
    const dialogo = page.getByRole('dialog', { name: '¿Empezar ahora?' })
    await expect(dialogo).toBeVisible()
    await expect(dialogo).toContainText('Al confirmar se abren el contenido de la prueba y sus 2 preguntas, y empieza a correr el tiempo')
    await expect(dialogo).toContainText('si falta responder alguna pregunta, queda sin completar y no se califica.')
    await expect(dialogo).not.toContainText(/archivo|entregable|el caso|los materiales/)
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

  /*
    QA-UPP-14 con el dedo de verdad: una pantalla táctil (`hasTouch`) y toques (`touchscreen.tap`), no
    clics de ratón. En el teléfono «Empezar prueba» queda en parte bajo el pie de «¿Empezar ahora?»:
    el segundo toque caía en «Sí, empezar» y arrancaba el reloj, o en «Aún no» y cerraba el diálogo.
  */
  test.describe('con el dedo, en el teléfono (QA-UPP-14)', () => {
    test.use({ hasTouch: true, isMobile: true })

    /** Una vacante con la prueba de una plantilla publicada, como en el recorrido 7 del 48. */
    async function vacanteDePlantilla(nombre: string): Promise<number> {
      const vacante = await crearVacante(equipo, nombre, await lugarDe(equipo))
      await exigir(`/panel/vacantes/${vacante}/aplicacion-evaluacion`, equipo, 'POST', { aplica: false })
      let version = 0
      for (const p of await exigir<{ id: number }[]>('/panel/plantillas-prueba', equipo)) {
        const versiones = await exigir<{ id: number; estado: string }[]>(`/panel/plantillas-prueba/${p.id}/versiones`, equipo)
        const publicada = versiones.find((v) => v.estado === 'PUBLICADA')
        if (publicada) {
          version = publicada.id
          break
        }
      }
      expect(version, 'hace falta una plantilla publicada, como en el recorrido 7 del 48').toBeGreaterThan(0)
      await exigir(`/panel/vacantes/${vacante}/plantilla-prueba`, equipo, 'POST', { versionPlantillaPruebaId: version })
      await exigir(`/panel/vacantes/${vacante}/publicacion`, equipo, 'POST')
      return vacante
    }

    type Caja = { x: number; y: number; width: number; height: number }

    /** Lo que dos cajas tienen en común, o nada. */
    const comun = (a: Caja, b: Caja): Caja | null => {
      const x = Math.max(a.x, b.x)
      const y = Math.max(a.y, b.y)
      const width = Math.min(a.x + a.width, b.x + b.width) - x
      const height = Math.min(a.y + a.height, b.y + b.height) - y
      return width > 1 && height > 1 ? { x, y, width, height } : null
    }

    test('dos toques seguidos en «Empezar prueba» no la empiezan, en la del editor y en la de plantilla; leído el aviso, un toque en «Sí, empezar» sí', async ({ page }) => {
      test.setTimeout(300_000)
      const plantilla = await vacanteDePlantilla('Una por pantalla QA-UPP-FB15, plantilla con el dedo')
      for (const [cual, vacante, nombre] of [
        ['la del editor', vacanteA, 'Zoe'],
        ['la de plantilla', plantilla, 'Wanda'],
      ] as const) {
        const c = await candidataEnLaPrueba(equipo, vacante, nombre, correos)
        await entrarAlPortalCon(page, c.token)
        let inicios = 0
        const contar = (r: { method: () => string; url: () => string }) => {
          if (r.method() === 'POST' && new URL(r.url()).pathname.endsWith(`/portal/prueba/${c.uuid}/inicio`)) inicios += 1
        }
        page.on('request', contar)
        const dialogo = page.getByRole('dialog', { name: '¿Empezar ahora?' })
        const empezar = page.locator('main').getByRole('button', { name: 'Empezar prueba' })
        // Cuántos segundos toques caen en un botón del diálogo: si ninguno, la prueba no mira nada
        let sobreUnBoton = 0

        for (const [width, height] of [[390, 844], [375, 812], [360, 740]] as const) {
          await page.setViewportSize({ width, height })
          await page.goto(`/procesos/${c.uuid}/prueba`)
          await expect(empezar).toBeVisible({ timeout: 20_000 })
          const boton = (await empezar.boundingBox())!

          // Dónde queda el pie sobre el botón: se abre una vez, se mide y se cierra con «Aún no», que
          // con el aviso ya leído responde a un toque normal (el diálogo no se queda sordo)
          await empezar.tap()
          await expect(dialogo).toBeVisible()
          await expect(dialogo.getByRole('button', { name: 'Aún no' }), 'el foco entra por la opción segura').toBeFocused()
          const encima: { donde: string; x: number; y: number }[] = []
          for (const nombreDelBoton of ['Sí, empezar', 'Aún no']) {
            const parte = comun(boton, (await dialogo.getByRole('button', { name: nombreDelBoton }).boundingBox())!)
            if (parte) encima.push({ donde: `sobre «${nombreDelBoton}»`, x: parte.x + parte.width / 2, y: parte.y + parte.height / 2 })
          }
          await dialogo.getByRole('button', { name: 'Aún no' }).tap()
          await expect(dialogo).toHaveCount(0)
          sobreUnBoton += encima.length

          // Donde el pie tapa el botón, ahí; y además, arriba a la derecha y a la izquierda, donde el
          // QA lo vio empezar y cerrarse
          const puntos = [
            ...encima,
            { donde: 'arriba a la derecha', x: boton.x + boton.width * 0.85, y: boton.y + boton.height * 0.25 },
            { donde: 'arriba a la izquierda', x: boton.x + boton.width * 0.15, y: boton.y + boton.height * 0.25 },
          ]
          for (const { donde: dondeCae, x, y } of puntos) {
            for (const pausa of [0, 150]) {
              await page.goto(`/procesos/${c.uuid}/prueba`)
              await expect(empezar).toBeVisible({ timeout: 20_000 })
              await page.touchscreen.tap(x, y)
              if (pausa) await page.waitForTimeout(pausa)
              await page.touchscreen.tap(x, y)
              await page.waitForTimeout(600)
              const donde = `${cual}, ${width}×${height}, dos toques ${pausa ? `a ${pausa} ms` : 'seguidos'} ${dondeCae}`
              expect(inicios, `${donde}: ningún POST de inicio`).toBe(0)
              await expect(dialogo, `${donde}: «¿Empezar ahora?» sigue abierto`).toBeVisible()
            }
          }
        }
        expect(sobreUnBoton, `${cual}: en alguno de los teléfonos el pie tapa «Empezar prueba»`).toBeGreaterThan(0)

        // Leído el aviso, un toque en «Sí, empezar» la empieza, una sola vez
        await page.goto(`/procesos/${c.uuid}/prueba`)
        await empezar.tap({ timeout: 20_000 })
        const inicio = page.waitForResponse(
          (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith(`/portal/prueba/${c.uuid}/inicio`),
        )
        await dialogo.getByRole('button', { name: 'Sí, empezar' }).tap()
        expect((await inicio).ok(), `${cual}: empezó`).toBe(true)
        await expect(page.getByText('Tiempo restante')).toBeVisible({ timeout: 20_000 })
        expect(inicios, `${cual}: un solo POST de inicio`).toBe(1)
        page.off('request', contar)
      }
    })
  })
})
