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
 * QA de `specs/prueba-una-pregunta-por-pantalla.md`: lo que el 56 no recorre y lo que la
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

/** Una evaluación del banco del modelo de DIRECCIÓN (60 o más preguntas), sembrada como en el 56. */
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
})
