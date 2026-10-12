import { expect, type Page } from '@playwright/test'
import { test } from './ayuda-candidato'
import { limpiarSiempre, literal, sql } from './base-de-datos'
import {
  cuentaDeCandidato,
  empezarEvaluacion,
  entrarAlPortalCon,
  escribirBorrador,
  exigir,
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
  verLaPrueba,
  type Candidata,
} from './ayuda-prueba-propia'
import {
  MARCA as MARCA_ELIMINA,
  retirarLoSembrado as retirarLasVacantesSembradas,
  sembrarVacantePropia,
} from './ayuda-eliminar-vacante'

/**
 * QA de `specs/prueba-una-pregunta-por-pantalla.md`: lo que el 57 no recorre y lo que la
 * exploración con navegador encontró.
 *
 *   - AC-06 y AC-15: sin caso pero con materiales y entregables generales, el lateral se titula
 *     «Para esta prueba»; se oculta y vuelve desde la barra; «Por entregar» solo consulta y su
 *     «Ir →» lleva al paso «Entregables».
 *   - AC-08, en las dos pantallas: un guardado que falla deja la pregunta a medias con «No se
 *     pudo guardar; se reintenta» aunque ya no esté en pantalla, y se recupera sola.
 *   - AC-11: el reloj de la prueba en rojo por debajo de 10 minutos; el plazo de la evaluación
 *     en rojo por debajo de una hora con el aviso que ya no promete entregar lo respondido.
 *   - AC-12 con el banco del modelo (60 o más preguntas) en el teléfono: la hoja del mapa se
 *     desplaza por dentro y elegir la última lleva a ella.
 *   - QA-01 (caso límite «doble pulsación en Siguiente»): el segundo clic no puede responder
 *     la pregunta que aparece debajo del puntero, en la prueba ni en la evaluación.
 *   - QA-02 (caso límite «60 preguntas en móvil»): la hoja no tapa la barra y «Ocultar el
 *     mapa» la cierra.
 *   - QA-04 (la misma barra, con la página al final en el teléfono): la cabecera del sitio no
 *     tapa la primera fila de la barra —el reloj o el plazo, «Pregunta N de M», lo que falta—,
 *     ni con la hoja cerrada ni al abrirla.
 *   - QA-05 (lo que no debe romper el arreglo de QA-01, que vigila todos los clics de la página):
 *     el doble clic dentro del texto selecciona la palabra, «Seleccionar archivo» abre un solo
 *     selector, «Subir» de SEC mueve el paso una sola vez y fuera de la prueba no se vigila nada.
 *   - QA-08 (la pantalla previa, revisiones del 09/10/2026 y del 10/10/2026): en escritorio,
 *     «Empezar prueba» se ve al abrir la pantalla, sin desplazar, aunque haya cuatro archivos, desde
 *     520 px de alto.
 *   - QA-09 (la misma, en la ventana de un portátil de 1366×768 o 1280×720 con las barras del
 *     navegador, y en el teléfono): el botón también se ve al abrir.
 *   - QA-10 (la lista de lo que entregarás): con ocho archivos no se desplaza por dentro ni queda
 *     bajo nada pegado, y al bajar la página se llega a ver entero el último. Antes la tapaba el
 *     bloque fijo del botón (ciclos 7 y 8); con la ficha corta no hay nada pegado.
 *   - QA-11 (el caso largo): antes cuidaba que el botón siguiera a la vista mientras se leía el
 *     final del caso en la pantalla previa. Desde el 10/10/2026 el caso no está ahí —se lee dentro
 *     del reloj—: se comprueba que no aparezca, que la ficha no crezca y que el botón se vea al abrir.
 *   - QA-13 (revisión humana del 10/10/2026): lo que trae la API, interceptado en el navegador.
 *     Antes de empezar, ni las preguntas —sí cuántas son—, ni el caso, ni los materiales, ni la
 *     consigna, ni el detalle de los archivos; en la respuesta de empezar y después, todo.
 *   - QA-14 (la misma revisión, en la prueba de plantilla, que se pinta por otro camino): antes de
 *     empezar, ni el encargo, ni los materiales, ni las preguntas, ni el detalle de los archivos; al
 *     empezar, todo, y la pantalla en curso lo enseña.
 *   - QA-15 (QA-UPP-13, ciclo 11): un doble clic en «Empezar prueba» deja abierto «¿Empezar ahora?».
 *     Hoy el segundo clic cae en el fondo del diálogo, porque el botón queda fuera de su panel, y lo
 *     cierra: quien hace doble clic no ve nada.
 *   - QA-16 (QA-UPP-14, ciclo 12): en el teléfono, con la ficha compacta, «Empezar prueba» queda en
 *     parte bajo el pie del diálogo; el segundo toque de un doble toque cae en «Aún no» (lo cierra) o
 *     en «Sí, empezar» (arranca el reloj sin leer el aviso). Ningún doble toque debe empezarla.
 *   - QA-12 (AC-06 con el teclado, humo del ciclo 9 tras reiniciar el clon): al ocultar el caso
 *     el foco pasa a «Ver el caso» y al volver a verlo entra en el lateral; hoy cae al cuerpo de
 *     la página y el siguiente Tab vuelve al logo de la cabecera.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira con las marcas de sus helpers
 * (QA-PE-0067 y QA-ELIMINA-830D) y los correos creados aquí.
 */

const OU1 = '¿Qué libro registra primero una venta al crédito?'
const MULTI1 = '¿Qué documentos sustentan una compra?'
const ABIERTA1 = '¿Cómo hallaste el descuadre de marzo?'
const ESCALA1 = '¿Cuánto dominas las tablas dinámicas?'
const OU2 = '¿Qué función busca un valor en una tabla?'
const ABIERTA2 = 'Explica el ajuste a la gerencia en tres líneas.'
const MULTI2 = '¿Qué cuentas se concilian a fin de mes?'
const ESCALA2 = '¿Cuánto dominas el cierre mensual?'
const MATERIALES = 'La plantilla de arqueo, en la carpeta compartida.'
const ANEXO = 'Anexo del arqueo'

const E_OU = '¿A quién reportas primero un descuadre?'
const E_MULTI = '¿Qué revisas antes de cerrar la caja?'

const AVISO_DE_PLAZO = 'Cuando se acabe, la evaluación se cierra sin entregarse. Entrégala antes.'

const correos: string[] = []
let equipo = ''
let vacanteA = 0
let vacanteC = 0
let vacanteE = 0
let modelo: { plantilla: number; version: number } | null = null

const escala = (puntos: number) => [{ texto: null, puntos: 0 }, { texto: null, puntos: puntos / 2 }, { texto: null, puntos }]

async function vacanteConPrueba(nombre: string, prueba: Parameters<typeof escribirPrueba>[2]): Promise<number> {
  const id = await crearVacante(equipo, nombre, await lugarDe(equipo))
  await exigir(`/panel/vacantes/${id}/aplicacion-evaluacion`, equipo, 'POST', { aplica: false })
  await escribirPrueba(equipo, id, prueba)
  const r = await publicarPrueba(equipo, id)
  expect(r.estado, JSON.stringify(r.cuerpo)).toBe(200)
  await exigir(`/panel/vacantes/${id}/publicacion`, equipo, 'POST')
  return id
}

/** Pantalla previa con caso corto, cronometrada, y la lista de lo que habrá que entregar (QA-08 a QA-10). */
const ABIERTA_ARQUEO = 'Explica el arqueo de caja.'
const CUATRO_ARCHIVOS = [
  { nombre: 'Conciliación de febrero.xlsx', formato: 'ARCHIVO', obligatorio: true, de: ABIERTA_ARQUEO, detalle: 'Con las partidas en tránsito separadas de los errores de registro.' },
  { nombre: 'Conciliación de marzo.xlsx', formato: 'ARCHIVO', obligatorio: true, todaLaPrueba: true },
  { nombre: 'Informe para la gerencia', formato: 'CUALQUIERA', obligatorio: true, todaLaPrueba: true, detalle: 'Una página como máximo, en palabras sencillas.' },
  { nombre: 'Notas de trabajo', formato: 'ENLACE', obligatorio: false, todaLaPrueba: true },
]
const OCHO_ARCHIVOS = Array.from({ length: 8 }, (_, i) => ({
  nombre: `Entregable ${i + 1} del almacén.xlsx`,
  formato: i % 3 === 2 ? 'ENLACE' : 'ARCHIVO',
  obligatorio: i < 4,
  ...(i === 0 ? { de: ABIERTA_ARQUEO } : { todaLaPrueba: true }),
  detalle: `Detalle del entregable ${i + 1}: lo que debe traer, en una o dos líneas para que la lista crezca.`,
}))

function vacanteConArchivos(nombre: string, entregables: object[]): Promise<number> {
  return vacanteConPrueba(nombre, {
    criterios: [
      {
        nombre: 'Caja', puntosCalificados: 50, calificador: 'PERSONA',
        preguntas: [
          { tipo: 'OPCION_UNICA', enunciado: '¿Cuál es la tasa general del IGV?', puntos: 50, opciones: [{ texto: '18 %', puntos: 50 }, { texto: '19 %', puntos: 0 }] },
          { tipo: 'ABIERTA', enunciado: ABIERTA_ARQUEO, queDebeTener: 'El arqueo.' },
        ],
      },
    ],
    entregables,
    datos: {
      enunciado: 'La tienda cerró marzo con un descuadre de S/ 1 250 entre el libro mayor y el extracto del banco.',
      modalidad: 'CRONOMETRADA',
      duracionMinutos: 90,
    },
  } as Parameters<typeof escribirPrueba>[2])
}

async function respondidasEnElServidor(c: Candidata): Promise<number> {
  const preguntas = (await verLaPrueba(c)).cuerpo.preguntas as any[]
  return preguntas.filter(
    (p) => p.respuestaOpcionId != null || (p.respuestaMarcadas?.length ?? 0) > 0 || (p.respuestaTexto ?? '').trim() !== '',
  ).length
}

async function empezarLaPrueba(page: Page, c: Candidata) {
  await entrarAlPortalCon(page, c.token)
  await page.goto(`/procesos/${c.uuid}/prueba`)
  await page.getByRole('button', { name: 'Empezar prueba' }).click({ timeout: 20_000 })
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, empezar' }).click()
  await expect(page.getByText('Tiempo restante')).toBeVisible({ timeout: 20_000 })
}

/** Una evaluación del Perfil Integral con preguntas propias, empezada por la API. */
async function evaluacionEmpezada(nombre: string): Promise<{ token: string; uuid: string }> {
  const c = await cuentaDeCandidato(nombre, correos)
  const uuid = await postular(c.token, vacanteE)
  await empezarEvaluacion(c.token, uuid)
  return { token: c.token, uuid }
}

/** Respuestas guardadas de una evaluación, contadas en la base del clon. */
const respuestasDeLaEvaluacion = (uuid: string): number =>
  Number(uno(`select count(*) as n from respuesta r join postulacion p on p.evaluacion_id = r.evaluacion_id
               where p.uuid = ${literal(uuid)}`).n)

/** Una evaluación del banco del modelo de DIRECCIÓN (60 o más preguntas), sembrada como en el 57. */
async function evaluacionDelModelo(nombre: string): Promise<{ token: string; uuid: string }> {
  expect(modelo, 'hace falta una plantilla y un banco publicados de DIRECCIÓN en el clon').not.toBeNull()
  const c = await cuentaDeCandidato(nombre, correos)
  const vacante = sembrarVacantePropia(`${MARCA_ELIMINA} Una por pantalla QA, el banco de Dirección ${nombre}`)
  const postulacion = JSON.parse(sql(`
    with po as (
      insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo)
      select v.organizacion_id, ${c.usuario}, v.id, 'PERFIL_TURNO_CANDIDATO' from vacante v where v.id = ${vacante}
      returning id, uuid)
    select row_to_json(po) from po;`)) as { id: number; uuid: string }
  sql(`
    with ev as (
      insert into evaluacion (organizacion_id, usuario_id, plantilla_evaluacion_id, version_banco_nivel_id,
                              estado, vence_en, proposito)
      select v.organizacion_id, ${c.usuario}, ${modelo!.plantilla}, ${modelo!.version}, 'PENDIENTE',
             now() + interval '7 days', ${literal('PERFIL_INTEGRAL')}
        from vacante v where v.id = ${vacante}
      returning id)
    update postulacion set evaluacion_id = (select id from ev) where id = ${postulacion.id};`)
  await empezarEvaluacion(c.token, postulacion.uuid)
  return { token: c.token, uuid: postulacion.uuid }
}

/** El color que resuelve un token del mundo visual, para comparar con el de un elemento. */
const colorDelToken = (page: Page, token: string) =>
  page.evaluate((t) => {
    const prueba = document.createElement('span')
    prueba.style.color = `var(${t})`
    document.body.appendChild(prueba)
    const color = getComputedStyle(prueba).color
    prueba.remove()
    return color
  }, token)

const casilla = (page: Page, nombre: string) =>
  page.locator('main').getByRole('button', { name: new RegExp(`^${nombre},`) })
const enLaBarra = (page: Page, texto: string) => expect(page.locator('main').getByText(texto, { exact: true })).toBeVisible()
const tarjeta = (page: Page) => page.locator('main').getByRole('article')

test.describe('QA · una pregunta por pantalla', () => {
  // Sin `serial`: cada prueba siembra lo suyo y un fallo no deja sin correr a las demás.
  test.describe.configure({ mode: 'default' })

  test.beforeAll(async () => {
    equipo = await tokenDePanel()
    vacanteA = await vacanteConPrueba('Una por pantalla QA, A', {
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
        { nombre: 'Conciliación.xlsx', formato: 'ARCHIVO', obligatorio: true, de: ABIERTA1 },
        { nombre: 'Informe final', formato: 'ARCHIVO', obligatorio: true, todaLaPrueba: true },
      ],
      datos: { enunciado: 'La tienda cerró marzo con un descuadre.', modalidad: 'CRONOMETRADA', duracionMinutos: 90 },
    })
    // Sin caso, pero con materiales y un entregable general: «Para esta prueba».
    vacanteC = await vacanteConPrueba('Una por pantalla QA, C', {
      criterios: [
        {
          nombre: 'Caja', puntosCalificados: 50, calificador: 'PERSONA',
          preguntas: [
            { tipo: 'OPCION_UNICA', enunciado: '¿Cuál es la tasa general del IGV?', puntos: 50, opciones: [{ texto: '18 %', puntos: 50 }, { texto: '19 %', puntos: 0 }] },
            { tipo: 'ABIERTA', enunciado: 'Explica el arqueo de caja.', queDebeTener: 'El arqueo.' },
          ],
        },
      ],
      entregables: [{ nombre: ANEXO, formato: 'ARCHIVO', obligatorio: true, todaLaPrueba: true }],
      datos: { materiales: MATERIALES, modalidad: 'CRONOMETRADA', duracionMinutos: 30 },
    })

    vacanteE = await crearVacante(equipo, 'Una por pantalla QA, la evaluación', await lugarDe(equipo))
    await escribirBorrador(equipo, vacanteE, [
      {
        nombre: 'General',
        preguntas: [
          { tipo: 'OPCION_UNICA', enunciado: E_OU, puntos: 25, opciones: [{ texto: 'A la jefatura', puntos: 25 }, { texto: 'A nadie', puntos: 0 }] },
          { tipo: 'OPCION_MULTIPLE', enunciado: E_MULTI, puntos: 25, opciones: [{ texto: 'El arqueo', puntos: 15 }, { texto: 'Los vales', puntos: 10 }, { texto: 'Nada', puntos: 0 }] },
          { tipo: 'ABIERTA', enunciado: 'Cuéntanos un cierre difícil y cómo lo resolviste.', puntos: 25, queDebeTener: 'El monto y la causa.' },
          { tipo: 'OPCION_UNICA', enunciado: '¿Qué haces si el banco cobra dos veces?', puntos: 25, opciones: [{ texto: 'Reclamo al banco', puntos: 25 }, { texto: 'Lo dejo así', puntos: 0 }] },
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

    modelo = JSON.parse(sql(`
      select coalesce(row_to_json(m)::text, 'null') from (
        select (select id from plantilla_evaluacion where nivel_puesto_codigo = 'DIRECCION' and estado = 'PUBLICADA'
                 order by id limit 1) as plantilla,
               (select id from version_banco where tipo_banco = 'NIVEL' and nivel_puesto_codigo = 'DIRECCION' and estado = 'PUBLICADA'
                 order by id desc limit 1) as version) m;`))
    if (modelo && (modelo.plantilla == null || modelo.version == null)) modelo = null
  })

  test.afterAll(async () => {
    await limpiarSiempre([() => retirarLoSembrado(correos), () => retirarLasVacantesSembradas([])])
  })

  test('AC-06/AC-15 · sin caso con materiales y un general: «Para esta prueba», que vuelve desde la barra, y «Ir →» lleva a los entregables', async ({ page }) => {
    const cata = await candidataEnLaPrueba(equipo, vacanteC, 'Cata', correos)
    await empezarLaPrueba(page, cata)
    const main = page.locator('main')
    const lateral = page.getByRole('complementary', { name: 'Para esta prueba' })
    await expect(lateral).toContainText(MATERIALES)
    await expect(lateral).toContainText(ANEXO)
    await expect(lateral).toContainText('obligatorio, pendiente')
    await expect(page.getByRole('complementary', { name: 'El caso' })).toHaveCount(0)
    // Desde el lateral no se sube nada
    await expect(lateral.locator('input')).toHaveCount(0)

    await lateral.getByRole('button', { name: 'Ocultar «Para esta prueba»' }).click()
    await expect(page.getByRole('complementary')).toHaveCount(0)
    await main.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await enLaBarra(page, 'Pregunta 2 de 2')
    await main.getByRole('button', { name: 'Para esta prueba' }).click()
    await expect(lateral).toBeVisible()

    await lateral.getByRole('button', { name: `Ir a subir «${ANEXO}»` }).click()
    await expect(main.getByRole('heading', { level: 1, name: 'Entregables' })).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest('[id^="entregable-"]') !== null))
      .toBe(true)
    await tarjeta(page).locator('input[type="file"]').first().setInputFiles({
      name: 'anexo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 el anexo'),
    })
    await expect(tarjeta(page)).toContainText('Recibimos anexo.pdf', { timeout: 20_000 })
    await expect(lateral).toContainText('subido')
    await expect(casilla(page, 'Entregables')).toHaveAttribute('aria-label', /^Entregables, listos/)
  })

  test('AC-08 · prueba: un guardado que falla deja la pregunta a medias aunque ya no esté en pantalla, y se recupera sola', async ({ page }) => {
    const ivan = await candidataEnLaPrueba(equipo, vacanteA, 'Iván', correos)
    await empezarLaPrueba(page, ivan)
    const main = page.locator('main')
    await casilla(page, 'Pregunta 6').click()
    await enLaBarra(page, 'Pregunta 6 de 8')

    await page.route('**/api/v1/portal/prueba/*/respuestas/**', (ruta) => ruta.abort('failed'))
    await main.getByRole('textbox', { name: ABIERTA2 }).fill('El banco cobró dos veces la comisión; se reclamó.')
    await casilla(page, 'Pregunta 8').click()
    await enLaBarra(page, 'Pregunta 8 de 8')
    await expect(casilla(page, 'Pregunta 6')).toHaveAttribute(
      'aria-label', 'Pregunta 6, a medias, no se pudo guardar; se reintenta', { timeout: 15_000 },
    )
    expect(await respondidasEnElServidor(ivan)).toBe(0)

    // Sin volver a la 6: la cola la reintenta sola y el mapa la da por lista al confirmarse
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await expect(casilla(page, 'Pregunta 6')).toHaveAttribute('aria-label', 'Pregunta 6, lista', { timeout: 45_000 })
    expect(await respondidasEnElServidor(ivan)).toBe(1)
    await enLaBarra(page, 'Pregunta 8 de 8')
  })

  test('AC-08 · evaluación: el guardado que falla sale a medias con «No se pudo guardar; se reintenta» y no se pierde', async ({ page }) => {
    const juana = await evaluacionEmpezada('Juana')
    await entrarAlPortalCon(page, juana.token)
    await page.goto(`/procesos/${juana.uuid}/evaluacion`)
    const main = page.locator('main')
    await enLaBarra(page, 'Pregunta 1 de 4')

    await page.route('**/api/v1/portal/evaluacion/**', (ruta) =>
      ruta.request().method() === 'GET' ? ruta.continue() : ruta.abort('failed'),
    )
    await main.getByText('A. A la jefatura', { exact: true }).click()
    await main.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await enLaBarra(page, 'Pregunta 2 de 4')
    await expect(casilla(page, 'Pregunta 1')).toHaveAttribute(
      'aria-label', 'Pregunta 1, a medias, no se pudo guardar; se reintenta', { timeout: 15_000 },
    )
    await expect(main.getByText('0 de 4 respondidas')).toBeVisible()
    await main.getByRole('button', { name: 'Anterior' }).click()
    await expect(tarjeta(page).getByText('No se pudo guardar; se reintenta', { exact: true })).toBeVisible()
    await expect(page.getByRole('radio', { name: /A la jefatura/ })).toBeChecked()

    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await expect(casilla(page, 'Pregunta 1')).toHaveAttribute('aria-label', 'Pregunta 1, lista (estás aquí)', { timeout: 45_000 })
    await expect(main.getByText('1 de 4 respondidas')).toBeVisible()
    expect(respuestasDeLaEvaluacion(juana.uuid)).toBe(1)
  })

  test('AC-11 · la prueba con 9 minutos pone el reloj en rojo; la evaluación con menos de una hora, su plazo en rojo y el aviso nuevo', async ({ page }) => {
    const karla = await candidataEnLaPrueba(equipo, vacanteA, 'Karla', correos)
    expect((await iniciarLaPrueba(karla)).estado).toBe(200)
    sql(`update intento_prueba set vence_en = now() + interval '9 minutes' where postulacion_id = ${karla.postulacion};`)
    await entrarAlPortalCon(page, karla.token)
    await page.goto(`/procesos/${karla.uuid}/prueba`)
    await expect(page.getByText('Tiempo restante')).toBeVisible({ timeout: 20_000 })
    const rojo = await colorDelToken(page, '--mal')
    const reloj = page.locator('main').getByText(/^00:0\d:\d\d$/)
    await expect(reloj).toBeVisible()
    await expect(reloj).toHaveCSS('color', rojo)

    const luis = await evaluacionEmpezada('Luis')
    sql(`update evaluacion set vence_en = now() + interval '50 minutes'
          where id = (select evaluacion_id from postulacion where uuid = ${literal(luis.uuid)});`)
    await entrarAlPortalCon(page, luis.token)
    await page.goto(`/procesos/${luis.uuid}/evaluacion`)
    const main = page.locator('main')
    await enLaBarra(page, 'Pregunta 1 de 4')
    const plazo = main.getByText(/^Quedan \d\d:\d\d:\d\d$/)
    await expect(plazo).toBeVisible()
    await expect(plazo).toHaveCSS('color', rojo)
    await expect(main).toContainText(AVISO_DE_PLAZO)
    await expect(main).not.toContainText('se entregará lo que tengas respondido')
  })

  test('AC-12 · el banco del modelo de Dirección en el teléfono: la hoja del mapa se desplaza por dentro y elegir la última lleva a ella', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const mara = await evaluacionDelModelo('Mara')
    await entrarAlPortalCon(page, mara.token)
    await page.goto(`/procesos/${mara.uuid}/evaluacion`)
    const main = page.locator('main')
    const donde = main.getByText(/^Pregunta 1 de \d+$/)
    await expect(donde).toBeVisible({ timeout: 20_000 })
    const total = Number((await donde.textContent())!.match(/de (\d+)$/)![1])
    expect(total).toBeGreaterThanOrEqual(60)

    await main.getByRole('button', { name: `Ver las ${total}` }).click()
    const hoja = page.getByRole('dialog', { name: `Las ${total} preguntas` })
    await expect(hoja).toBeVisible()
    // La hoja y su velo empiezan bajo la barra fija entera (barra › mandos › «Ocultar el mapa»),
    // no bajo su primera fila
    const barra = await main
      .getByRole('button', { name: 'Ocultar el mapa' })
      .evaluate((el) => el.parentElement!.parentElement!.getBoundingClientRect().bottom)
    const velo = await hoja.evaluate((el) => el.parentElement!.getBoundingClientRect().top)
    expect(velo, 'la hoja empieza bajo la barra entera').toBeGreaterThanOrEqual(barra - 1)
    const medidas = await hoja.evaluate((el) => ({ alto: el.scrollHeight, visible: el.clientHeight }))
    expect(medidas.alto).toBeGreaterThan(medidas.visible)
    const ultima = hoja.getByRole('button', { name: new RegExp(`^Pregunta ${total},`) })
    await ultima.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await ultima.click()
    await expect(hoja).toHaveCount(0)
    await enLaBarra(page, `Pregunta ${total} de ${total}`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('QA-01 · doble clic en «Siguiente» avanza una sola pregunta y no responde la que aparece debajo, en la prueba y en la evaluación', async ({ page }) => {
    const nora = await candidataEnLaPrueba(equipo, vacanteA, 'Nora', correos)
    await empezarLaPrueba(page, nora)
    const main = page.locator('main')
    await page.getByText('a. Libro diario', { exact: true }).click()
    await expect.poll(() => respondidasEnElServidor(nora), { timeout: 15_000 }).toBe(1)
    await main.getByRole('button', { name: 'Siguiente', exact: true }).dblclick()
    await enLaBarra(page, 'Pregunta 2 de 8')
    await page.waitForTimeout(1_500)
    await expect.soft(casilla(page, 'Pregunta 2')).toHaveAttribute('aria-label', 'Pregunta 2, sin responder (estás aquí)')
    expect.soft(await respondidasEnElServidor(nora), 'respuestas de la prueba en el servidor').toBe(1)

    const olga = await evaluacionEmpezada('Olga')
    await entrarAlPortalCon(page, olga.token)
    await page.goto(`/procesos/${olga.uuid}/evaluacion`)
    await enLaBarra(page, 'Pregunta 1 de 4')
    await main.getByText('A. A la jefatura', { exact: true }).click()
    await expect(tarjeta(page).getByText('Guardado', { exact: true })).toBeVisible({ timeout: 15_000 })
    await main.getByRole('button', { name: 'Siguiente', exact: true }).dblclick()
    await enLaBarra(page, 'Pregunta 2 de 4')
    await page.waitForTimeout(1_500)
    await expect.soft(casilla(page, 'Pregunta 2')).toHaveAttribute('aria-label', 'Pregunta 2, sin responder (estás aquí)')
    expect.soft(respuestasDeLaEvaluacion(olga.uuid), 'respuestas de la evaluación en el servidor').toBe(1)
  })

  test('QA-02 · en el teléfono la hoja del mapa no tapa la barra y «Ocultar el mapa» la cierra, en la prueba y en la evaluación', async ({ page }) => {
    // 360 px: el ancho de muchos Android; ahí «Ocultar el mapa» ya no cabe en la fila de «Ver las N».
    await page.setViewportSize({ width: 360, height: 800 })
    const barraYHoja = async (nombreHoja: string) => {
      const hoja = page.getByRole('dialog', { name: nombreHoja })
      await expect(hoja).toBeVisible()
      const velo = await hoja.evaluate((el) => el.parentElement!.getBoundingClientRect().top)
      const barra = await page
        .locator('main')
        .getByRole('button', { name: 'Ocultar el mapa' })
        .evaluate((el) => el.parentElement!.parentElement!.getBoundingClientRect().bottom)
      return { velo, barra }
    }

    const pia = await candidataEnLaPrueba(equipo, vacanteA, 'Pía', correos)
    await empezarLaPrueba(page, pia)
    const main = page.locator('main')
    await main.getByRole('button', { name: 'Ver las 8' }).click()
    const enLaPrueba = await barraYHoja('Las 8 preguntas')
    // Ni la hoja ni su velo empiezan por encima del borde inferior de la barra fija
    expect.soft(enLaPrueba.velo, 'el velo de la hoja empieza bajo la barra (prueba)').toBeGreaterThanOrEqual(enLaPrueba.barra - 1)
    await main.getByRole('button', { name: 'Ocultar el mapa' }).click()
    await expect.soft(page.getByRole('dialog', { name: 'Las 8 preguntas' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    const mara = await evaluacionDelModelo('Rosa')
    await entrarAlPortalCon(page, mara.token)
    await page.goto(`/procesos/${mara.uuid}/evaluacion`)
    const donde = main.getByText(/^Pregunta 1 de \d+$/)
    await expect(donde).toBeVisible({ timeout: 20_000 })
    const total = Number((await donde.textContent())!.match(/de (\d+)$/)![1])
    await main.getByRole('button', { name: `Ver las ${total}` }).click()
    const enLaEvaluacion = await barraYHoja(`Las ${total} preguntas`)
    expect.soft(enLaEvaluacion.velo, 'la hoja empieza bajo la barra (evaluación)').toBeGreaterThanOrEqual(enLaEvaluacion.barra - 1)
    await main.getByRole('button', { name: 'Ocultar el mapa' }).click()
    await expect.soft(page.getByRole('dialog', { name: `Las ${total} preguntas` })).toHaveCount(0)
  })

  test('QA-04 · en el teléfono, con la página al final, la cabecera no tapa la primera fila de la barra, con la hoja cerrada ni abierta', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    const main = page.locator('main')
    /**
     * Lo que la cabecera del sitio (u otra cosa) tapa de la primera fila de la barra fija: el
     * reloj o el plazo, «Pregunta N de M» y lo que falta. Se mira el centro de cada dato.
     */
    const tapado = () =>
      page.evaluate(() => {
        const mapa = [...document.querySelectorAll('main button')].find((b) =>
          /^(Ocultar el mapa|Ver las \d+)$/.test((b.textContent ?? '').trim()),
        )
        const datos = mapa?.parentElement?.parentElement?.firstElementChild
        if (!datos) return ['sin barra']
        return [...datos.children]
          .filter((dato) => {
            const r = dato.getBoundingClientRect()
            const encima = document.elementFromPoint(r.left + Math.min(12, r.width / 2), r.top + r.height / 2)
            return !encima || !(dato === encima || dato.contains(encima))
          })
          .map((dato) => (dato.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30))
      })
    const alFinal = () => page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))

    const quena = await candidataEnLaPrueba(equipo, vacanteA, 'Quena', correos)
    await empezarLaPrueba(page, quena)
    await alFinal()
    expect.soft(await tapado(), 'prueba al final, con la hoja cerrada').toEqual([])
    await main.getByRole('button', { name: 'Ver las 8' }).click()
    await expect(page.getByRole('dialog', { name: 'Las 8 preguntas' })).toBeVisible()
    expect.soft(await tapado(), 'prueba al final, con la hoja abierta').toEqual([])
    await page.keyboard.press('Escape')

    const sara = await evaluacionDelModelo('Sara')
    await entrarAlPortalCon(page, sara.token)
    await page.goto(`/procesos/${sara.uuid}/evaluacion`)
    const donde = main.getByText(/^Pregunta 1 de \d+$/)
    await expect(donde).toBeVisible({ timeout: 20_000 })
    const total = Number((await donde.textContent())!.match(/de (\d+)$/)![1])
    await alFinal()
    expect.soft(await tapado(), 'evaluación al final, con la hoja cerrada').toEqual([])
    await main.getByRole('button', { name: `Ver las ${total}` }).click()
    await expect(page.getByRole('dialog', { name: `Las ${total} preguntas` })).toBeVisible()
    expect.soft(await tapado(), 'evaluación al final, con la hoja abierta').toEqual([])
  })

  test('QA-05 · el doble clic que cae donde empezó sigue funcionando (texto, archivo, SEC) y fuera de la prueba no se vigila nada', async ({ page }) => {
    const main = page.locator('main')
    const art = main.locator('article')
    /**
     * Una serie de dos pulsaciones que empieza en el enunciado y acaba en otro sitio: dentro de la
     * prueba la segunda se descarta (QA-01); fuera, tiene que llegar.
     */
    const segundaLlega = () =>
      page.evaluate(() => {
        const primera = document.querySelector('main h1, main h2') ?? document.body
        const segunda = document.querySelector('main p') ?? document.querySelector('footer')!
        let llegadas = 0
        const oir = () => { llegadas++ }
        segunda.addEventListener('click', oir)
        primera.dispatchEvent(new MouseEvent('mousedown', { detail: 1, bubbles: true }))
        primera.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true }))
        segunda.dispatchEvent(new MouseEvent('mousedown', { detail: 2, bubbles: true }))
        segunda.dispatchEvent(new MouseEvent('click', { detail: 2, bubbles: true }))
        segunda.removeEventListener('click', oir)
        return llegadas === 1
      })

    const tere = await candidataEnLaPrueba(equipo, vacanteA, 'Tere', correos)
    await empezarLaPrueba(page, tere)
    expect(await segundaLlega(), 'dentro de la prueba la segunda pulsación en otro sitio se descarta').toBe(false)

    // Doble clic dentro del texto: selecciona la palabra
    await casilla(page, 'Pregunta 3').click()
    await enLaBarra(page, 'Pregunta 3 de 8')
    const texto = art.locator('textarea')
    await texto.fill('Conciliación bancaria')
    const caja = (await texto.boundingBox())!
    await page.mouse.dblclick(caja.x + 30, caja.y + 18)
    expect(await texto.evaluate((el: HTMLTextAreaElement) => el.value.slice(el.selectionStart, el.selectionEnd))).toBe('Conciliación')

    // Doble clic en «Seleccionar archivo»: un solo selector
    let selectores = 0
    page.on('filechooser', () => { selectores++ })
    await art.getByRole('button', { name: 'Seleccionar archivo' }).dblclick()
    await expect.poll(() => selectores).toBe(1)
    await page.waitForTimeout(500)
    expect(selectores, 'el doble clic abre el selector una sola vez').toBe(1)

    // Fuera de la prueba ya no se vigila nada
    await page.getByRole('link', { name: /Volver a mi proceso/ }).click()
    await expect(page).toHaveURL(new RegExp(`/procesos/${tere.uuid}$`))
    // La ruta nueva puede tardar en montarse: hasta entonces la prueba sigue en pantalla
    await expect(main.getByText(/^Pregunta \d+ de \d+$/)).toHaveCount(0)
    await expect.poll(segundaLlega, { message: 'fuera de la prueba la segunda pulsación llega' }).toBe(true)

    // SEC del banco de Dirección: doble clic en «Subir» mueve el paso una sola vez
    const ursula = await evaluacionDelModelo('Úrsula')
    await entrarAlPortalCon(page, ursula.token)
    await page.goto(`/procesos/${ursula.uuid}/evaluacion`)
    await expect(main.getByText(/^Pregunta 1 de \d+$/)).toBeVisible({ timeout: 20_000 })
    // En el banco de Dirección la 4 es la de ordenar los pasos (SEC)
    await casilla(page, 'Pregunta 4').click()
    await expect(main.getByText(/^Pregunta 4 de \d+$/)).toBeVisible()
    const pasos = art.locator('ol li')
    await expect(pasos.first().getByRole('button', { name: /^Subir/ })).toBeAttached()
    const orden =() => pasos.evaluateAll((lis) => lis.map((li) => li.querySelector('button')!.getAttribute('aria-label')!.replace(/^Subir: /, '')))
    const antes = await orden()
    expect(antes.length).toBeGreaterThanOrEqual(3)
    await pasos.nth(2).getByRole('button', { name: /^Subir/ }).dblclick()
    await expect.poll(orden).toEqual([antes[0], antes[2], antes[1], ...antes.slice(3)])
    await page.waitForTimeout(500)
    expect(await orden(), 'el segundo clic no deshace el movimiento').toEqual([antes[0], antes[2], antes[1], ...antes.slice(3)])
  })

  test('QA-07 · con el teclado, el caso recortado del lateral no se desplaza a un enlace que queda oculto bajo el recorte', async ({ page }) => {
    // Un caso largo de varios párrafos con un enlace en el último, muy por debajo de las siete
    // líneas que enseña el lateral (revisión humana del 09/10/2026: «Leer el caso completo»).
    const parrafo =
      'La tienda de Miraflores cerró marzo con un descuadre de S/ 1 250 entre el libro mayor y el extracto ' +
      'del banco. El contador anterior dejó notas sueltas y dos conciliaciones a medias.'
    const caso = [parrafo, parrafo, parrafo, 'El plan contable, por si lo necesitas: https://www.example.com/plan-contable.pdf'].join('\n\n')
    const vacante = await vacanteConPrueba('Una por pantalla QA, caso con enlace', {
      criterios: [
        {
          nombre: 'Caja', puntosCalificados: 50, calificador: 'PERSONA',
          preguntas: [
            { tipo: 'OPCION_UNICA', enunciado: '¿Cuál es la tasa general del IGV?', puntos: 50, opciones: [{ texto: '18 %', puntos: 50 }, { texto: '19 %', puntos: 0 }] },
            { tipo: 'ABIERTA', enunciado: 'Explica el arqueo de caja.', queDebeTener: 'El arqueo.' },
          ],
        },
      ],
      datos: { enunciado: caso, modalidad: 'CRONOMETRADA', duracionMinutos: 30 },
    })
    const vale = await candidataEnLaPrueba(equipo, vacante, 'Vale', correos)
    await empezarLaPrueba(page, vale)

    const lateral = page.getByRole('complementary', { name: 'El caso' })
    const recorte = lateral.locator('[class*="casoRecortado"]')
    await expect(recorte).toBeVisible()
    await expect(lateral.getByRole('button', { name: 'Leer el caso completo' })).toBeVisible()
    /** Dónde queda el recorte y, si el foco está dentro, dónde queda el elemento enfocado. */
    const estado = () =>
      recorte.evaluate((r) => {
        const caja = r.getBoundingClientRect()
        const foco = document.activeElement as HTMLElement | null
        const dentro = !!foco && r.contains(foco)
        const f = dentro ? foco!.getBoundingClientRect() : null
        return {
          desplazado: r.scrollTop,
          foco: foco?.textContent?.trim().slice(0, 40) ?? '',
          fueraDeLaVista: f ? f.top < caja.top - 1 || f.bottom > caja.bottom + 1 : false,
        }
      })

    // Del «Ocultar» del lateral, con Tab, hasta «Leer el caso completo»
    await lateral.getByRole('button', { name: 'Ocultar' }).focus()
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab')
      const e = await estado()
      expect(e.desplazado, `el lateral sigue enseñando el comienzo del caso (foco en «${e.foco}»)`).toBe(0)
      expect(e.fueraDeLaVista, `el foco no cae en algo que el recorte oculta («${e.foco}»)`).toBe(false)
      if (e.foco === 'Leer el caso completo') break
    }
    await expect(lateral.getByRole('button', { name: 'Leer el caso completo' })).toBeFocused()
    expect((await estado()).desplazado, 'al salir del texto, el recorte vuelve a estar arriba').toBe(0)
  })

  test('QA-08 · la pantalla previa en escritorio: «Empezar prueba» se ve al abrirla, sin desplazar, aunque haya cuatro archivos que entregar, desde 520 px de alto', async ({ page }) => {
    // Nació con la ficha de columna fija (revisión del 09/10/2026), y la regla sigue con la ficha
    // corta del 10/10/2026: el botón se ve al abrir la pantalla desde 520 px de alto, con los
    // archivos que tenga. Ahora lo garantiza el orden —va justo después de los datos—, sin nada pegado.
    const vacante = await vacanteConArchivos('Una por pantalla QA, cuatro archivos', CUATRO_ARCHIVOS)
    const lola = await candidataEnLaPrueba(equipo, vacante, 'Lola', correos)
    await entrarAlPortalCon(page, lola.token)

    for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768], [1280, 520], [1024, 520]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(`/procesos/${lola.uuid}/prueba`)
      const empezar = page.locator('main').getByRole('button', { name: 'Empezar prueba' })
      await expect(empezar).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('heading', { name: 'Lo que entregarás' })).toBeAttached()
      expect(await page.evaluate(() => scrollY), 'la pantalla recién abierta, arriba del todo').toBe(0)
      const boton = (await empezar.boundingBox())!
      expect(boton.y, `${width}×${height}: el botón, bajo la cabecera`).toBeGreaterThanOrEqual(84)
      expect(boton.y + boton.height, `${width}×${height}: «Empezar prueba» a la vista al abrir, sin desplazar`).toBeLessThanOrEqual(height)
    }
  })

  test('QA-09 · en un portátil de 1366×768 o 1280×720 con las barras del navegador, y en el teléfono, «Empezar prueba» también se ve al abrir la pantalla previa', async ({ page }) => {
    // La misma regla que QA-08, con la ventana que deja Chrome en esas pantallas: unos 633 px de
    // alto en 1366×768 y unos 600 en 1280×720. Y en el teléfono, donde cabe.
    const vacante = await vacanteConArchivos('Una por pantalla QA, portátil', CUATRO_ARCHIVOS)
    const lia = await candidataEnLaPrueba(equipo, vacante, 'Lía', correos)
    await entrarAlPortalCon(page, lia.token)

    for (const [width, height] of [[1366, 633], [1280, 600], [390, 844], [412, 915]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(`/procesos/${lia.uuid}/prueba`)
      const empezar = page.locator('main').getByRole('button', { name: 'Empezar prueba' })
      await expect(empezar).toBeAttached({ timeout: 20_000 })
      await expect(page.getByRole('heading', { name: 'Lo que entregarás' })).toBeAttached()
      expect(await page.evaluate(() => scrollY), 'la pantalla recién abierta, arriba del todo').toBe(0)
      const boton = (await empezar.boundingBox())!
      expect(boton.y, `${width}×${height}: el botón, bajo la cabecera`).toBeGreaterThanOrEqual(84)
      expect(boton.y + boton.height, `${width}×${height}: «Empezar prueba» a la vista al abrir, sin desplazar`).toBeLessThanOrEqual(height)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: sin desplazar a lo ancho`).toBe(true)
    }
  })

  test('QA-10 · con ocho archivos, lo que entregarás no se desplaza por dentro ni queda bajo nada: al bajar la página se ven todos', async ({ page }) => {
    // Antes (ciclos 7 y 8) la lista iba en la columna fija y la tapaba el bloque del botón; la
    // rueda sobre ella no llegaba al último archivo. Con la ficha corta (10/10/2026) no hay nada
    // pegado: la lista va en el flujo de la página, en columnas si hay ancho, y la rueda mueve la
    // página. Lo que se comprueba es lo mismo: el último archivo se llega a ver entero, sin nada encima.
    const ocho = await vacanteConArchivos('Una por pantalla QA, ocho archivos', OCHO_ARCHIVOS)
    const nadia = await candidataEnLaPrueba(equipo, ocho, 'Nadia', correos)
    await entrarAlPortalCon(page, nadia.token)
    for (const [width, height] of [[1440, 900], [1024, 768], [1280, 600], [390, 844]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(`/procesos/${nadia.uuid}/prueba`)
      const main = page.locator('main')
      await expect(main.getByRole('button', { name: 'Empezar prueba' })).toBeVisible({ timeout: 20_000 })
      const lista = main.locator('section').filter({ has: page.getByRole('heading', { name: 'Lo que entregarás' }) }).getByRole('list')
      await expect(lista.getByRole('listitem')).toHaveCount(8)
      expect(await lista.evaluate((l) => l.scrollHeight <= l.clientHeight + 1), `${width}: la lista no se desplaza por dentro`).toBe(true)
      const caja = (await lista.boundingBox())!
      await page.mouse.move(caja.x + caja.width / 2, Math.min(caja.y + 20, height - 10))
      const ultimo = lista.getByRole('listitem').last()
      const seVe = () =>
        ultimo.evaluate((li) => {
          const r = li.getBoundingClientRect()
          const encima = document.elementFromPoint(r.left + 8, r.top + r.height / 2)
          return r.top >= 84 - 1 && r.bottom <= innerHeight + 1 && !!encima && li.contains(encima)
        })
      for (let i = 0; i < 30 && !(await seVe()); i++) {
        await page.mouse.wheel(0, 200)
        await page.waitForTimeout(100)
      }
      expect(await seVe(), `${width}×${height}: «Entregable 8 del almacén.xlsx» se llega a ver entero, sin nada encima`).toBe(true)
    }
  })

  test('QA-11 · con un caso largo, materiales y herramientas, la pantalla previa no enseña el caso ni los materiales: la ficha no crece y «Empezar prueba» se ve al abrirla en un portátil', async ({ page }) => {
    // QA-11 cuidaba que el botón siguiera a la vista mientras se leía el final de un caso largo en
    // la pantalla previa. Desde el 10/10/2026 el caso no está ahí: se lee dentro del reloj. Lo
    // equivalente es que no aparezca —ni sus párrafos ni los materiales— y que, sin él, la ficha
    // quede corta y el botón se vea al abrir en esas ventanas. Las herramientas sí se dicen.
    const PARRAFO = (n: number) =>
      `Párrafo ${n} del caso: la tienda cerró marzo con un descuadre entre el libro mayor y el extracto del banco, ` +
      'y la gerencia quiere saber de dónde sale antes de presentar los estados financieros al directorio la semana próxima.'
    const HERRAMIENTAS = 'Excel o Google Sheets, y una calculadora. No se permite consultar a otras personas.'
    const vacante = await vacanteConPrueba('Una por pantalla QA, caso largo en el portátil', {
      criterios: [
        {
          nombre: 'Caja', puntosCalificados: 50, calificador: 'PERSONA',
          preguntas: [
            { tipo: 'OPCION_UNICA', enunciado: '¿Cuál es la tasa general del IGV?', puntos: 50, opciones: [{ texto: '18 %', puntos: 50 }, { texto: '19 %', puntos: 0 }] },
            { tipo: 'ABIERTA', enunciado: ABIERTA_ARQUEO, queDebeTener: 'El arqueo.' },
          ],
        },
      ],
      entregables: CUATRO_ARCHIVOS,
      datos: {
        enunciado: Array.from({ length: 9 }, (_, i) => PARRAFO(i + 1)).join('\n\n'),
        materiales: MATERIALES,
        herramientasPermitidas: HERRAMIENTAS,
        modalidad: 'CRONOMETRADA',
        duracionMinutos: 90,
      },
    } as Parameters<typeof escribirPrueba>[2])
    const olga = await candidataEnLaPrueba(equipo, vacante, 'Olga', correos)
    await entrarAlPortalCon(page, olga.token)

    for (const [width, height] of [[1366, 633], [1280, 600]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(`/procesos/${olga.uuid}/prueba`)
      const main = page.locator('main')
      const empezar = main.getByRole('button', { name: 'Empezar prueba' })
      await expect(empezar).toBeVisible({ timeout: 20_000 })
      await expect(main.getByRole('heading', { name: 'Herramientas permitidas' })).toBeAttached()
      await expect(main).toContainText(HERRAMIENTAS)
      for (const texto of [PARRAFO(1), PARRAFO(9), MATERIALES, ABIERTA_ARQUEO]) await expect(main).not.toContainText(texto)
      await expect(main.getByRole('heading', { name: /El caso|Materiales/ })).toHaveCount(0)
      const ficha = (await main.locator('dl').locator('xpath=..').boundingBox())!
      expect(ficha.height, `${width}×${height}: la ficha no crece con el caso`).toBeLessThan(520)
      const boton = (await empezar.boundingBox())!
      expect(boton.y + boton.height, `${width}×${height}: «Empezar prueba» a la vista al abrir`).toBeLessThanOrEqual(height)
      expect(await empezar.evaluate((b) => getComputedStyle(b.parentElement!).position), 'nada pegado').toBe('static')
    }
  })

  test('QA-12 · con el teclado, ocultar el caso deja el foco en «Ver el caso» y volver a verlo lo lleva al lateral, sin caer al principio de la página', async ({ page }) => {
    const olga = await candidataEnLaPrueba(equipo, vacanteA, 'Olga', correos)
    await empezarLaPrueba(page, olga)
    const main = page.locator('main')
    const lateral = page.getByRole('complementary', { name: 'El caso' })
    await expect(lateral).toBeVisible()
    const enfocado = () =>
      page.evaluate(() => {
        const a = document.activeElement
        if (!a || a === document.body) return 'el cuerpo de la página'
        return a.getAttribute('aria-label') || a.textContent?.trim() || a.tagName
      })

    // Ocultar con el teclado: el botón desaparece y el foco no puede quedarse en el cuerpo.
    await lateral.getByRole('button', { name: 'Ocultar el caso' }).focus()
    await page.keyboard.press('Enter')
    await expect(lateral).toHaveCount(0)
    const verElCaso = main.getByRole('button', { name: 'Ver el caso' })
    await expect(verElCaso).toBeVisible()
    await expect.poll(enfocado, { message: 'tras «Ocultar el caso», el foco' }).toBe('Ver el caso')

    // Volver a verlo con el teclado: el foco entra en el lateral que acaba de aparecer.
    await page.keyboard.press('Enter')
    await expect(lateral).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest('aside, [role="complementary"]')), {
        message: `tras «Ver el caso», el foco está dentro del lateral «El caso»`,
      })
      .toBe(true)

    // Y el siguiente Tab no salta a la cabecera del sitio.
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('header'))).toBe(false)
  })

  test('QA-13 · lo que trae la API: antes de empezar, ni las preguntas, ni el caso, ni los materiales, ni el detalle de los archivos; al empezar, todo', async ({ page }) => {
    // Revisión humana del 10/10/2026: el caso se lee dentro del reloj. Antes de pulsar «Empezar» la
    // pantalla no lo pintaba, pero viajaba en la respuesta: se podía leer y trabajar sin reloj.
    const CASO_QA13 = 'QA-UPP-FB15: la sede de Surco cerró abril con S/ 3 480 de diferencia entre la caja y el banco.'
    const HERRAMIENTAS = 'Excel o Google Sheets, y una calculadora.'
    const IGV = '¿Cuál es la tasa general del IGV?'
    const vacante = await vacanteConPrueba('Una por pantalla QA-UPP-FB15, lo que viaja', {
      criterios: [
        {
          nombre: 'Caja', puntosCalificados: 50, calificador: 'PERSONA',
          preguntas: [
            { tipo: 'OPCION_UNICA', enunciado: IGV, puntos: 50, opciones: [{ texto: '18 %', puntos: 50 }, { texto: '19 %', puntos: 0 }] },
            { tipo: 'ABIERTA', enunciado: ABIERTA_ARQUEO, queDebeTener: 'El arqueo.' },
          ],
        },
      ],
      entregables: CUATRO_ARCHIVOS,
      datos: { enunciado: CASO_QA13, materiales: MATERIALES, herramientasPermitidas: HERRAMIENTAS, modalidad: 'CRONOMETRADA', duracionMinutos: 90 },
    } as Parameters<typeof escribirPrueba>[2])
    const hana = await candidataEnLaPrueba(equipo, vacante, 'Hana', correos)
    await entrarAlPortalCon(page, hana.token)
    const ruta = `/portal/prueba/${hana.uuid}`
    const porNombre = (es: any[]) => [...es].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)))
    const detalles = CUATRO_ARCHIVOS.flatMap((a) => (a.detalle ? [a.detalle] : []))

    // La pantalla previa: se intercepta lo que contesta el servidor al abrirla
    const lectura = page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname.endsWith(ruta))
    await page.goto(`/procesos/${hana.uuid}/prueba`)
    const antes = await (await lectura).json()
    expect(antes.estadoIntento).toBe('PENDIENTE')
    expect(antes.preguntas, 'ninguna pregunta antes de empezar').toEqual([])
    expect(antes.totalPreguntas, 'pero sí cuántas son').toBe(2)
    expect(antes.enunciado, 'ni el caso').toBeNull()
    expect(antes.materiales, 'ni los materiales').toBeNull()
    expect(antes.consigna ?? null, 'ni la consigna').toBeNull()
    expect(antes.herramientasPermitidas, 'las herramientas, sí').toBe(HERRAMIENTAS)
    expect(antes.duracionMinutos).toBe(90)
    expect(porNombre(antes.entregables).map((e: any) => [e.nombre, e.esObligatorio, e.formato, e.detalle])).toEqual(
      porNombre(CUATRO_ARCHIVOS).map((a) => [a.nombre, a.obligatorio, a.formato, null]),
    )
    // El archivo de una pregunta dice cuál es por su número, sin la pregunta
    const conPregunta = (antes.entregables as any[]).find((e) => e.nombre === CUATRO_ARCHIVOS[0]!.nombre)
    expect(conPregunta.posicionDeLaPregunta).toBe(2)
    const crudo = JSON.stringify(antes)
    for (const visto of [CASO_QA13, MATERIALES, IGV, ABIERTA_ARQUEO, '18 %', ...detalles]) {
      expect(crudo, `«${visto}» no viaja antes de empezar`).not.toContain(visto)
    }
    // Y la pantalla tampoco lo enseña
    const main = page.locator('main')
    await expect(main.getByRole('button', { name: 'Empezar prueba' })).toBeVisible({ timeout: 20_000 })
    for (const visto of [CASO_QA13, MATERIALES, IGV, ...detalles]) await expect(main).not.toContainText(visto)
    await expect(main.getByText(/· en la pregunta 2 ·/)).toBeVisible()

    // Al empezar: la respuesta de empezar lo trae todo, sin puntos ni criterios (RF-53)
    const inicio = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith(`${ruta}/inicio`))
    await main.getByRole('button', { name: 'Empezar prueba' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Sí, empezar' }).click()
    const despues = await (await inicio).json()
    expect(despues.estadoIntento).toBe('EN_CURSO')
    expect(despues.enunciado).toBe(CASO_QA13)
    expect(despues.materiales).toBe(MATERIALES)
    expect((despues.preguntas as any[]).map((p) => p.enunciado)).toEqual([IGV, ABIERTA_ARQUEO])
    expect(porNombre(despues.entregables).map((e: any) => e.detalle)).toEqual(porNombre(CUATRO_ARCHIVOS).map((a) => a.detalle ?? null))
    expect(JSON.stringify(despues)).not.toMatch(/puntos|puntaje|criterio|calificador|queDebeTener/i)
    // La pantalla, con el caso en su lateral y la pregunta 1
    await expect(page.getByText('Tiempo restante')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('complementary', { name: 'El caso' })).toContainText('la sede de Surco cerró abril')
    await expect(tarjeta(page)).toContainText(IGV)
    // Y las lecturas que siguen, ya empezada, también lo traen
    const deNuevo = (await verLaPrueba(hana)).cuerpo
    expect(deNuevo.enunciado).toBe(CASO_QA13)
    expect(deNuevo.preguntas).toHaveLength(2)
  })

  test('QA-14 · la prueba de plantilla, igual que la del editor: antes de empezar la API no trae el encargo, los materiales, las preguntas ni el detalle de los archivos; al empezar, todo', async ({ page }) => {
    // Revisión humana del 10/10/2026: «ni en la prueba del editor ni en la de plantilla». QA-13 lo
    // cubre en la del editor; esta es la de plantilla, que pinta su respuesta por otro camino
    // (`ServicioPruebaImpl.pintar`) y no tenía más prueba que las unitarias con dobles.
    const vacante = await crearVacante(equipo, 'Una por pantalla QA-UPP-FB15, plantilla', await lugarDe(equipo))
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

    // Lo que tiene la plantilla, leído de la base: es lo que no debe viajar antes de empezar
    const deLaVersion = uno(`select enunciado, materiales, herramientas_permitidas as herramientas
                               from version_plantilla_prueba where id = ${version}`)
    const preguntas: string[] = JSON.parse(sql(`
      select coalesce(json_agg(pp.enunciado order by pv.orden), '[]')::text
        from pregunta_version_plantilla pv join pregunta_prueba pp on pp.id = pv.pregunta_prueba_id
       where pv.version_plantilla_prueba_id = ${version};`))
    const archivos: { nombre: string; detalle: string | null; formato: string; obligatorio: boolean }[] = JSON.parse(sql(`
      select coalesce(json_agg(json_build_object('nombre', nombre, 'detalle', nullif(btrim(coalesce(detalle, '')), ''),
                                                 'formato', formato, 'obligatorio', es_obligatorio) order by orden), '[]')::text
        from entregable_requerido where version_plantilla_prueba_id = ${version};`))
    expect(String(deLaVersion.enunciado ?? '').trim(), 'la plantilla tiene encargo').not.toBe('')
    expect(preguntas.length, 'y preguntas').toBeGreaterThan(0)
    const encargo = String(deLaVersion.enunciado).trim()
    const materiales = String(deLaVersion.materiales ?? '').trim()
    const detalles = archivos.flatMap((a) => (a.detalle ? [a.detalle] : []))
    const porNombre = (es: any[]) => [...es].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)))

    const ivana = await candidataEnLaPrueba(equipo, vacante, 'Ivana', correos)
    await entrarAlPortalCon(page, ivana.token)
    const ruta = `/portal/prueba/${ivana.uuid}`
    const lectura = page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname.endsWith(ruta))
    await page.goto(`/procesos/${ivana.uuid}/prueba`)
    const antes = await (await lectura).json()
    expect(antes.estadoIntento).toBe('PENDIENTE')
    expect(antes.delEditor ?? false, 'es la de plantilla').toBe(false)
    expect(antes.preguntas, 'ninguna pregunta antes de empezar').toEqual([])
    expect(antes.totalPreguntas, 'pero sí cuántas son').toBe(preguntas.length)
    expect(antes.enunciado, 'ni el encargo').toBeNull()
    expect(antes.materiales, 'ni los materiales').toBeNull()
    expect(antes.consigna ?? null, 'ni la consigna').toBeNull()
    expect(antes.cambioTexto ?? null, 'ni el cambio inesperado').toBeNull()
    expect(antes.herramientasPermitidas ?? null, 'las herramientas, sí').toBe(deLaVersion.herramientas ?? null)
    expect(porNombre(antes.entregables).map((e: any) => [e.nombre, e.esObligatorio, e.formato, e.detalle])).toEqual(
      porNombre(archivos).map((a) => [a.nombre, a.obligatorio, a.formato, null]),
    )
    const crudo = JSON.stringify(antes)
    for (const visto of [encargo, ...(materiales ? [materiales] : []), ...preguntas, ...detalles]) {
      expect(crudo, `«${visto.slice(0, 60)}» no viaja antes de empezar`).not.toContain(visto)
    }
    // La pantalla previa, la misma ficha corta, tampoco lo enseña
    const main = page.locator('main')
    const empezar = main.getByRole('button', { name: 'Empezar prueba' })
    await expect(empezar).toBeVisible({ timeout: 20_000 })
    await expect(main).toContainText('Si el tiempo termina, se entrega lo que hayas guardado.')
    for (const visto of [encargo.slice(0, 60), ...(materiales ? [materiales] : []), ...preguntas, ...detalles]) {
      await expect(main).not.toContainText(visto)
    }

    // Al empezar: la respuesta de empezar lo trae todo
    const inicio = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith(`${ruta}/inicio`))
    await empezar.click()
    await page.getByRole('dialog').getByRole('button', { name: 'Sí, empezar' }).click()
    const despues = await (await inicio).json()
    expect(despues.estadoIntento).toBe('EN_CURSO')
    expect(String(despues.enunciado).trim()).toBe(encargo)
    if (materiales) expect(String(despues.materiales).trim()).toBe(materiales)
    expect((despues.preguntas as any[]).map((p) => p.enunciado)).toEqual(preguntas)
    expect(despues.totalPreguntas).toBe(preguntas.length)
    expect(porNombre(despues.entregables).map((e: any) => e.detalle ?? null)).toEqual(porNombre(archivos).map((a) => a.detalle))
    // La pantalla en curso, con el encargo
    await expect(page.getByText('Tiempo restante')).toBeVisible({ timeout: 20_000 })
    await expect(main).toContainText(encargo.slice(0, 60))
    await expect(main).toContainText(preguntas[0]!)
    // Y la lectura siguiente, ya empezada, también lo trae
    const deNuevo = (await verLaPrueba(ivana)).cuerpo
    expect(String(deNuevo.enunciado).trim()).toBe(encargo)
    expect(deNuevo.preguntas).toHaveLength(preguntas.length)
  })

  test('QA-15 · un doble clic en «Empezar prueba» deja abierto «¿Empezar ahora?», sin empezarla, en escritorio y en el teléfono', async ({ page }) => {
    // QA-UPP-13 (ciclo 11): con la ficha corta el botón queda fuera del panel del diálogo, sobre su
    // fondo. El primer clic abre «¿Empezar ahora?» y el segundo cae en el fondo y lo cierra: quien hace
    // doble clic ve un parpadeo y nada más. En el ciclo 10 el botón caía bajo el panel y el diálogo
    // seguía abierto. Se prueba el doble clic y dos clics a 150 ms, el ritmo de una persona.
    const jade = await candidataEnLaPrueba(equipo, vacanteC, 'Jade', correos)
    await entrarAlPortalCon(page, jade.token)
    for (const [width, height] of [[1440, 900], [1280, 600], [1024, 768], [390, 844]] as const) {
      await page.setViewportSize({ width, height })
      for (const como of ['doble clic', 'dos clics a 150 ms'] as const) {
        await page.goto(`/procesos/${jade.uuid}/prueba`)
        const empezar = page.locator('main').getByRole('button', { name: 'Empezar prueba' })
        await expect(empezar).toBeVisible({ timeout: 20_000 })
        const caja = (await empezar.boundingBox())!
        const [x, y] = [caja.x + caja.width / 2, caja.y + caja.height / 2]
        if (como === 'doble clic') {
          await page.mouse.dblclick(x, y)
        } else {
          await page.mouse.click(x, y)
          await page.waitForTimeout(150)
          await page.mouse.click(x, y)
        }
        await page.waitForTimeout(400)
        await expect(page.getByRole('dialog', { name: '¿Empezar ahora?' }), `${width}×${height}, ${como}: «¿Empezar ahora?» sigue abierto`).toBeVisible()
      }
    }
    // Y nada de eso la empezó: abrir el diálogo no arranca el reloj
    expect((await verLaPrueba(jade)).cuerpo.estadoIntento).toBe('PENDIENTE')
  })

  test('QA-16 · en el teléfono, un doble toque en cualquier parte de «Empezar prueba» no la empieza: «¿Empezar ahora?» queda abierto y no sale ningún POST de inicio', async ({ page }) => {
    // QA-UPP-14 (ciclo 12): con la ficha compacta del teléfono, «Empezar prueba» queda en parte bajo el
    // pie de «¿Empezar ahora?». El segundo toque de un doble toque ya no cae en el fondo —ese lo cubre
    // `aPruebaDeDobleClic`— sino en «Aún no», que cierra el diálogo, o en «Sí, empezar», que arranca el
    // reloj sin que se haya leído nada. Se tocan tres puntos del botón (derecha, centro e izquierda),
    // en su parte alta y en la baja, en teléfonos de 375 a 414 px de ancho.
    const kora = await candidataEnLaPrueba(equipo, vacanteA, 'Kora', correos)
    await entrarAlPortalCon(page, kora.token)
    let inicios = 0
    page.on('request', (r) => {
      if (r.method() === 'POST' && new URL(r.url()).pathname.endsWith(`/portal/prueba/${kora.uuid}/inicio`)) inicios += 1
    })
    for (const [width, height] of [[375, 812], [390, 844], [393, 852], [414, 896]] as const) {
      await page.setViewportSize({ width, height })
      for (const [fx, fy] of [[0.85, 0.25], [0.5, 0.25], [0.15, 0.25], [0.85, 0.75], [0.5, 0.75], [0.15, 0.75]] as const) {
        await page.goto(`/procesos/${kora.uuid}/prueba`)
        const empezar = page.locator('main').getByRole('button', { name: 'Empezar prueba' })
        await expect(empezar).toBeVisible({ timeout: 20_000 })
        const caja = (await empezar.boundingBox())!
        await page.mouse.dblclick(caja.x + caja.width * fx, caja.y + caja.height * fy)
        await page.waitForTimeout(600)
        const donde = `${width}×${height}, doble toque en (${fx}, ${fy}) del botón`
        expect(inicios, `${donde}: ningún POST de inicio`).toBe(0)
        await expect(page.getByRole('dialog', { name: '¿Empezar ahora?' }), `${donde}: «¿Empezar ahora?» sigue abierto`).toBeVisible()
      }
    }
    expect((await verLaPrueba(kora)).cuerpo.estadoIntento, 'la prueba sigue sin empezar').toBe('PENDIENTE')
  })
})
