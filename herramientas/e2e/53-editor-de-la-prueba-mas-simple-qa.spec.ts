import { expect, type Locator, type Page } from '@playwright/test'
import { entrarAlPanel } from './ayuda'
import { test } from './ayuda-candidato'
import { limpiarSiempre } from './base-de-datos'
import {
  entrarAlPortalCon,
  escribirBorrador,
  exigir,
  irConLaPastilla,
  pedir,
  publicarPreguntas,
  RUTA as RUTA_DEL_BANCO,
  tokenDePanel,
  uno,
} from './ayuda-preguntas-propias'
import {
  candidataEnLaPrueba,
  crearVacante,
  editorDe,
  entregarLaPrueba,
  escribirPrueba,
  fijarFechaLimite,
  iniciarLaPrueba,
  lugarDe,
  MARCA as MARCA_QA,
  publicarPrueba,
  responderLaPrueba,
  retirarLoSembrado,
  RUTA,
  type Candidata,
  type PruebaNueva,
} from './ayuda-prueba-propia'

/**
 * QA independiente de «Un editor de la prueba técnica más simple» (V68): lo que la suite
 * del trabajo (52) no cubría y lo que salió al explorar con el navegador.
 *
 *   - AC-11/AC-12: el reloj al abrir (cronometrada con fecha cercana o lejana; sin cronómetro).
 *   - AC-10 y la decisión del 05/10: mover la fecha no alarga el reloj de quien ya abrió una
 *     cronometrada (vence en lo que llegue antes); a quien no empezó y a «Sin cronómetro», la nueva.
 *   - AC-20: «Entregar» sin el archivo de una pregunta lleva a esa pregunta; el servidor lo rechaza.
 *   - Riesgo: quitar la única pregunta que cubría un general lo deja sin cubrir y su falta lleva a él.
 *   - QA-01: en el teléfono, «Publicar» y «Configuración» no tapan el balance de la cabecera fija.
 *   - QA-02: si la fecha falla al pulsar «Listo», lo que sí se guardó (los minutos) se ve.
 *   - QA-03: la falta de un criterio deja su línea a la vista, no debajo de la cabecera fija.
 *   - QA-04: la versión publicada sin caso no titula «El caso» a los materiales.
 *   - QA-05: en el teléfono, la línea del criterio plegado se lee en orden (puntos, luego cuenta).
 *   - QA-06: los títulos de la versión publicada no dejan un hueco de 280 px debajo.
 *   - QA-07: la guía «!» abierta con el cursor no se come el clic en el campo que tapa.
 *   - QA-08: sin «Publicar» (la publicada), «Configuración» llega al borde derecho de la cabecera.
 *   - QA-09: la guía fijada fuera del panel no se queda a la vista cuando su etiqueta sale al bajarlo.
 *   - QA-10: si bajan las cerradas de un criterio que no tenía parte calificada (V69, el total se
 *     mantiene), la parte que aparece sin nadie que la califique no se atribuye a la IA.
 *   - QA-11: en «Cambiar los puntos», con un total mal escrito (150), lo que se dice al guardar no
 *     contradice la suma de lo escrito con una suma que deja fuera ese criterio.
 *   - QA-12: en «Cambiar los puntos», el total mal escrito que frena el guardado y recibe el foco
 *     queda a la vista, no debajo de la barra del panel ni de la cabecera fija.
 *   - QA-13: en «Cambiar los puntos» del banco publicado, los puntos de las preguntas salen a la
 *     vista al abrir; un 400 del servidor con los criterios plegados despliega el de la pregunta, lo
 *     dice bajo su campo y lleva a él bajo la cabecera fija; un 400 solo de la suma no despliega nada.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira (marca QA-PE-0067).
 */

const correos: string[] = []
let equipo = ''

const ABIERTA = 'Arma un flujo de caja mensual para una tienda pequeña.'
const CERRADA = '¿Qué fórmula busca un valor en una tabla?'
/** Una cerrada de opción única que da sus puntos enteros a la primera opción. */
const cerrada = (enunciado: string, puntos: number) => ({
  tipo: 'OPCION_UNICA' as const, enunciado, puntos,
  opciones: [{ texto: 'BUSCARV', puntos }, { texto: 'SUMA', puntos: 0 }],
})
const UNA_CERRADA = cerrada(CERRADA, 40)

/** Una prueba de 100 que se publica: abierta (IA) con su archivo, y una cerrada. */
const PRUEBA_DE_CIEN = (datos: PruebaNueva['datos'], fechaLimite: string): PruebaNueva => ({
  criterios: [
    { nombre: 'Excel', puntosCalificados: 60, calificador: 'IA', preguntas: [{ tipo: 'ABIERTA', enunciado: ABIERTA }, UNA_CERRADA] },
  ],
  entregables: [{ nombre: 'Flujo de caja.xlsx', formato: 'ARCHIVO', obligatorio: true, de: ABIERTA }],
  datos,
  fechaLimite,
})

const enMinutos = (m: number) => new Date(Date.now() + m * 60_000).toISOString()
const ms = (iso: string) => new Date(iso).getTime()

async function vacanteConPrueba(nombre: string, prueba: PruebaNueva, publicar = true): Promise<number> {
  const id = await crearVacante(equipo, nombre, await lugarDe(equipo))
  await exigir(`/panel/vacantes/${id}/aplicacion-evaluacion`, equipo, 'POST', { aplica: false })
  await escribirPrueba(equipo, id, prueba)
  if (publicar) {
    const r = await publicarPrueba(equipo, id)
    expect(r.estado, JSON.stringify(r.cuerpo)).toBe(200)
    await exigir(`/panel/vacantes/${id}/publicacion`, equipo, 'POST')
  }
  return id
}

/** Si lo que hay en el centro de `el` es el propio `el` (nada lo tapa). */
const seVe = (el: Locator) =>
  el.evaluate((n) => {
    const r = n.getBoundingClientRect()
    if (r.bottom <= 0 || r.top >= window.innerHeight) return false
    const c = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return c !== null && (c === n || n.contains(c))
  })

const cabecera = (page: Page) => page.getByRole('region', { name: 'Balance de la prueba' })

/**
 * La línea del criterio se lee en orden: «Excel · 100 pts (sistema 40 + IA 60) · 2 preguntas ·
 * 1 archivo». Los puntos van antes que la cuenta: en la misma fila, a su izquierda, o en una
 * fila de más arriba (QA-05).
 */
async function puntosAntesQueLaCuenta(criterio: Locator): Promise<boolean> {
  const linea = criterio.locator('header').first()
  const puntos = await linea.getByText(/^\d+ pts\b/).first().boundingBox()
  const cuenta = await linea.getByText(/^· \d+ preguntas?/).first().boundingBox()
  if (!puntos || !cuenta) throw new Error('La línea del criterio no tiene puntos o cuenta')
  return Math.abs(puntos.y - cuenta.y) < 6 ? puntos.x < cuenta.x : puntos.y < cuenta.y
}

test.describe('QA del editor de la prueba más simple', () => {
  test.beforeAll(async () => {
    equipo = await tokenDePanel()
  })

  test.afterAll(async () => {
    await limpiarSiempre([() => retirarLoSembrado(correos)])
  })

  test('AC-11/AC-12: cronometrada vence en la fecha si llega antes, a los minutos si no; sin cronómetro, en la fecha', async () => {
    // Cronometrada de 90 min con la fecha a 30 min: vence en la fecha.
    const cerca = enMinutos(30)
    const v1 = await vacanteConPrueba('Reloj fecha cercana', PRUEBA_DE_CIEN({ modalidad: 'CRONOMETRADA', duracionMinutos: 90 }, cerca))
    const a = await candidataEnLaPrueba(equipo, v1, 'Alba', correos)
    const ia = await iniciarLaPrueba(a)
    expect(ia.estado).toBe(200)
    expect(Math.abs(ms(ia.cuerpo.venceEn) - ms(cerca))).toBeLessThan(5_000)

    // Cronometrada de 90 min con la fecha a un día: vence a los 90 minutos.
    const v2 = await vacanteConPrueba('Reloj fecha lejana', PRUEBA_DE_CIEN({ modalidad: 'CRONOMETRADA', duracionMinutos: 90 }, enMinutos(24 * 60)))
    const b = await candidataEnLaPrueba(equipo, v2, 'Bea', correos)
    const antes = Date.now()
    const ib = await iniciarLaPrueba(b)
    expect(ib.estado).toBe(200)
    const porElReloj = ms(ib.cuerpo.venceEn) - antes
    expect(porElReloj).toBeGreaterThan(89 * 60_000)
    expect(porElReloj).toBeLessThan(91 * 60_000)

    // Sin cronómetro: vence en la fecha límite, y no se guardan días.
    const lejos = enMinutos(3 * 24 * 60)
    const v3 = await vacanteConPrueba('Reloj sin cronómetro', PRUEBA_DE_CIEN({ modalidad: 'PLAZO_ABIERTO' }, lejos))
    expect((await editorDe(equipo, v3)).publicada.prueba.plazoDias ?? null).toBeNull()
    const c = await candidataEnLaPrueba(equipo, v3, 'Cira', correos)
    const ic = await iniciarLaPrueba(c)
    expect(ic.estado).toBe(200)
    expect(Math.abs(ms(ic.cuerpo.venceEn) - ms(lejos))).toBeLessThan(5_000)
  })

  test('AC-10 con la decisión del 05/10: mover la fecha no alarga el reloj de quien ya abrió una cronometrada; a quien no empezó y a «Sin cronómetro» les pone la nueva', async ({ page }) => {
    const v = await vacanteConPrueba('Mover la fecha con gente dentro', PRUEBA_DE_CIEN({ modalidad: 'CRONOMETRADA', duracionMinutos: 90 }, enMinutos(24 * 60)))
    const dentro = await candidataEnLaPrueba(equipo, v, 'Eva', correos)
    expect((await iniciarLaPrueba(dentro)).estado).toBe(200)
    const fuera = await candidataEnLaPrueba(equipo, v, 'Fia', correos)
    const venceEn = (c: Candidata) =>
      Number(uno(`select extract(epoch from vence_en) * 1000 as ms from intento_prueba where postulacion_id = ${c.postulacion}`).ms)
    const aSusMinutos = (c: Candidata) =>
      uno(`select vence_en = iniciado_en + interval '90 minutes' as ok from intento_prueba where postulacion_id = ${c.postulacion}`).ok
    expect(aSusMinutos(dentro)).toBe(true)

    // Desde la configuración, con motivo: la fecha pasa a dentro de tres días (hora de Lima).
    const enTresDias = Date.now() + 3 * 24 * 3_600_000
    const campo = new Date(enTresDias - 5 * 3_600_000).toISOString().slice(0, 16)
    await entrarAlPanel(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/admin/vacantes/${v}/prueba`)
    await cabecera(page).getByRole('button', { name: 'Configuración', exact: true }).click()
    const configuracion = page.getByRole('dialog', { name: 'Configuración de la prueba' })
    await configuracion.getByLabel('Fecha límite para dar la prueba').fill(campo)
    await configuracion.getByRole('textbox', { name: /Motivo del cambio/ }).fill(`${MARCA_QA}: se amplía la convocatoria.`)
    await configuracion.getByRole('button', { name: 'Listo' }).click()
    await expect(configuracion).toHaveCount(0, { timeout: 20_000 })
    const nueva = Date.parse(`${campo}:00-05:00`)

    // Quien ya la abrió sigue venciendo a sus 90 minutos; quien no empezó, en la nueva fecha.
    expect(aSusMinutos(dentro)).toBe(true)
    expect(venceEn(fuera)).toBe(nueva)

    // Adelantarla por debajo de su reloj sí la corta.
    const pronto = new Date(Math.ceil((Date.now() + 20 * 60_000) / 1000) * 1000).toISOString()
    expect((await fijarFechaLimite(equipo, v, pronto, `${MARCA_QA}: se adelanta.`)).estado).toBe(200)
    expect(venceEn(dentro)).toBe(Date.parse(pronto))
    expect(venceEn(fuera)).toBe(Date.parse(pronto))

    // «Sin cronómetro», ya empezada: pasa a la nueva fecha.
    const v2 = await vacanteConPrueba('Mover la fecha sin cronómetro', PRUEBA_DE_CIEN({ modalidad: 'PLAZO_ABIERTO' }, enMinutos(24 * 60)))
    const libre = await candidataEnLaPrueba(equipo, v2, 'Gia', correos)
    expect((await iniciarLaPrueba(libre)).estado).toBe(200)
    const masTarde = new Date(Math.ceil((Date.now() + 5 * 24 * 3_600_000) / 1000) * 1000).toISOString()
    expect((await fijarFechaLimite(equipo, v2, masTarde, `${MARCA_QA}: se amplía.`)).estado).toBe(200)
    expect(venceEn(libre)).toBe(Date.parse(masTarde))
  })

  test('AC-20: «Entregar» sin el archivo de una pregunta lo dice y lleva a esa pregunta; el servidor también lo rechaza', async ({ page }) => {
    const v = await vacanteConPrueba('Archivo de la pregunta', PRUEBA_DE_CIEN({ modalidad: 'CRONOMETRADA', duracionMinutos: 90 }, enMinutos(24 * 60)))
    const dana = await candidataEnLaPrueba(equipo, v, 'Dana', correos)
    const p = (await iniciarLaPrueba(dana)).cuerpo
    const abierta = (p.preguntas as any[]).find((x) => x.enunciado === ABIERTA)
    const cerrada = (p.preguntas as any[]).find((x) => x.enunciado === CERRADA)
    expect((await responderLaPrueba(dana, abierta.id, { texto: 'Ingresos, egresos y saldo por mes.' })).estado).toBe(200)
    expect((await responderLaPrueba(dana, cerrada.id, { opcionId: cerrada.opciones[0].id })).estado).toBe(200)
    const archivo = (p.entregables as any[]).find((e) => e.nombre === 'Flujo de caja.xlsx')
    expect(archivo.preguntaId).toBe(abierta.id)

    await entrarAlPortalCon(page, dana.token)
    await page.goto(`/procesos/${dana.uuid}/prueba`)
    await expect(page.getByText('Tiempo restante')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Entregar prueba' }).click()
    const falta = page.getByRole('alert').filter({ hasText: 'Te falta subir' })
    await expect(falta).toContainText(`«Flujo de caja.xlsx» (pregunta ${abierta.posicion ?? 1})`)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await falta.getByRole('button', { name: /^Ir a la pregunta/ }).click()
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest('[id^="entregable-"]')?.id ?? null))
      .toBe(`entregable-${archivo.id}`)
    expect((await entregarLaPrueba(dana)).estado).toBe(400)
  })

  test('quitar la única pregunta que cubría un general: el archivo de la pregunta se va, el general queda sin cubrir y su falta lleva a él', async ({ page }) => {
    const A1 = 'Analiza el estado de resultados de marzo.'
    const A2 = 'Explica el flujo a la gerencia en tres líneas.'
    const v = await vacanteConPrueba('Quitar la pregunta', {
      criterios: [
        { nombre: 'Análisis', puntosCalificados: 30, calificador: 'IA', preguntas: [{ tipo: 'ABIERTA', enunciado: A1 }, cerrada(CERRADA, 20)] },
        { nombre: 'Comunicación', puntosCalificados: 50, calificador: 'PERSONA', preguntas: [{ tipo: 'ABIERTA', enunciado: A2 }] },
      ],
      entregables: [
        { nombre: 'Análisis.xlsx', formato: 'ARCHIVO', obligatorio: true, de: A1 },
        { nombre: 'Informe final', formato: 'ARCHIVO', obligatorio: true, cubre: [A1] },
      ],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 60 },
      fechaLimite: null,
    }, false)

    await entrarAlPanel(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/admin/vacantes/${v}/prueba`)
    await expect(cabecera(page)).toContainText('100 de 100 pts', { timeout: 20_000 })
    const analisis = page.getByRole('region', { name: 'Criterio Análisis' })
    await analisis.getByRole('button', { name: 'Análisis', exact: true }).click()
    await page.getByRole('article', { name: `Pregunta: ${A1}` }).getByRole('button', { name: 'Quitar la pregunta' }).click()
    const generales = page.getByRole('region', { name: /Entregables generales/ })
    await expect(generales).toContainText('Cubre: ninguna pregunta', { timeout: 20_000 })
    const restantes = ((await editorDe(equipo, v)).borrador.prueba.entregables as any[]).map((e) => e.nombre)
    expect(restantes).toEqual(['Informe final'])

    const informe = ((await editorDe(equipo, v)).borrador.prueba.entregables as any[])[0].id
    // Su falta se escribe bajo él, y la pastilla lleva hasta él.
    const elInforme = page.locator(`#entregable-${informe}`)
    await expect(elInforme.getByRole('list', { name: 'Lo que le falta al entregable' })).toContainText(
      '«Informe final» no cubre ninguna pregunta',
    )
    await irConLaPastilla(page, elInforme)
  })

  test('QA-03: con varias faltas, la de un criterio deja su línea a la vista y no debajo de la cabecera fija', async ({ page }) => {
    // Cuatro faltas: los puntos (88), dos criterios de IA que no miran nada y la fecha.
    const v = await vacanteConPrueba('Faltas que llevan', {
      criterios: [
        { nombre: 'Tributación', puntosCalificados: 20, calificador: 'IA', preguntas: [cerrada(CERRADA, 20)] },
        { nombre: 'Control interno', puntosCalificados: 20, calificador: 'IA', preguntas: [cerrada('¿Quién aprueba un pago?', 20)] },
        // Más criterios debajo, para que la página dé para bajar hasta el de la falta.
        ...['Cierre', 'Costos', 'Planillas', 'Auditoría'].map((nombre) => ({
          nombre, puntosCalificados: 2, calificador: 'PERSONA' as const,
          preguntas: [
            { tipo: 'ABIERTA' as const, enunciado: `${nombre}: cuenta un caso difícil.` },
            { tipo: 'ABIERTA' as const, enunciado: `${nombre}: explica tu método.` },
          ],
        })),
      ],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 60 },
      fechaLimite: null,
    }, false)
    await entrarAlPanel(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/admin/vacantes/${v}/prueba`)
    await expect(cabecera(page).getByRole('button', { name: '4 por arreglar' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Plegar todo', exact: true }).click()

    await irConLaPastilla(page, page.getByRole('region', { name: 'Criterio Tributación' }))
    const plegador = page.getByRole('region', { name: 'Criterio Tributación' }).getByRole('button', { name: 'Tributación', exact: true })
    await expect(plegador).toHaveAttribute('aria-expanded', 'true')
    // Al terminar de bajar, el nombre del criterio no queda tapado por la cabecera.
    // El desplazamiento es suave: se espera a que termine antes de mirar.
    await expect
      .poll(async () => {
        const antes = await page.evaluate(() => window.scrollY)
        await page.waitForTimeout(250)
        return antes === (await page.evaluate(() => window.scrollY))
      })
      .toBe(true)
    expect(await seVe(plegador)).toBe(true)
  })

  test('QA-01: en el teléfono, la cabecera fija deja leer el balance junto a «Publicar» y «Configuración»', async ({ page }) => {
    const v = await vacanteConPrueba('Cabecera en el teléfono', PRUEBA_DE_CIEN({ modalidad: 'CRONOMETRADA', duracionMinutos: 90 }, enMinutos(24 * 60)), false)
    await entrarAlPanel(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/admin/vacantes/${v}/prueba`)
    const balance = cabecera(page).getByText('100 de 100 pts', { exact: true })
    await expect(balance).toBeVisible({ timeout: 20_000 })
    expect(await seVe(balance)).toBe(true)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect.poll(() => seVe(balance)).toBe(true)
    expect(await seVe(cabecera(page).getByRole('button', { name: 'Publicar la prueba' }))).toBe(true)
  })

  test('QA-02: si la fecha no se guarda al pulsar «Listo», el editor enseña lo que sí se guardó', async ({ page }) => {
    const v = await vacanteConPrueba('Configuración a medias', {
      ...PRUEBA_DE_CIEN({ modalidad: 'CRONOMETRADA', duracionMinutos: null }, ''),
      fechaLimite: null,
    }, false)
    await entrarAlPanel(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/admin/vacantes/${v}/prueba`)
    await expect(cabecera(page)).toContainText('Faltan los minutos', { timeout: 20_000 })
    await cabecera(page).getByRole('button', { name: 'Configuración', exact: true }).click()
    const configuracion = page.getByRole('dialog', { name: 'Configuración de la prueba' })
    await configuracion.getByRole('spinbutton', { name: 'Minutos' }).fill('45')
    // Una fecha pasada: el servidor la rechaza.
    await configuracion.getByLabel('Fecha límite para dar la prueba').fill('2026-01-05T10:00')
    await configuracion.getByRole('button', { name: 'Listo' }).click()
    await expect(configuracion.getByRole('alert')).toContainText('ya pasó', { timeout: 20_000 })
    await page.keyboard.press('Escape')
    await expect(configuracion).toHaveCount(0)

    // Lo que dice la pantalla es lo que guardó el servidor, sea lo que sea.
    const minutos = (await editorDe(equipo, v)).borrador.prueba.duracionMinutos ?? null
    const chip = cabecera(page).getByRole('button', { name: /^Tiempo:/ })
    if (minutos === null) {
      await expect(chip).toContainText('Faltan los minutos')
    } else {
      await expect(chip).toContainText(`${minutos} min`)
      await expect(cabecera(page)).not.toContainText('Faltan los minutos')
    }
  })

  test('QA-04: la prueba publicada sin caso no titula «El caso» a sus materiales', async ({ page }) => {
    const v = await vacanteConPrueba(
      'Publicada sin caso',
      PRUEBA_DE_CIEN({ modalidad: 'CRONOMETRADA', duracionMinutos: 90, materiales: 'Los estados de marzo.', herramientasPermitidas: 'Excel' }, enMinutos(24 * 60)),
    )
    const publicada = (await pedir(RUTA(v), equipo)).cuerpo.publicada
    expect(publicada.prueba.enunciado ?? null).toBeNull()
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${v}/prueba`)
    await expect(page.getByText('Materiales:')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('heading', { name: 'El caso' })).toHaveCount(0)
  })

  test('QA-05: en el teléfono, la línea del criterio plegado dice sus puntos y después sus preguntas y archivos', async ({ page }) => {
    const v = await vacanteConPrueba('Línea del criterio en el teléfono', PRUEBA_DE_CIEN({ modalidad: 'CRONOMETRADA', duracionMinutos: 90 }, enMinutos(24 * 60)), false)
    await entrarAlPanel(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/admin/vacantes/${v}/prueba`)
    const excel = page.getByRole('region', { name: 'Criterio Excel' })
    await expect(excel.getByRole('button', { name: 'Excel', exact: true })).toHaveAttribute('aria-expanded', 'false', { timeout: 20_000 })
    expect(await puntosAntesQueLaCuenta(excel)).toBe(true)
  })

  test('QA-06: en la prueba publicada, «El caso», «Materiales y herramientas» y «Entregables» no dejan un hueco bajo su título', async ({ page }) => {
    const v = await vacanteConPrueba(
      'Publicada con caso y materiales',
      PRUEBA_DE_CIEN({
        modalidad: 'CRONOMETRADA', duracionMinutos: 90, enunciado: 'La tienda cerró marzo con menos caja.',
        materiales: 'Los estados de marzo.', herramientasPermitidas: 'Excel',
      }, enMinutos(24 * 60)),
    )
    await entrarAlPanel(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/admin/vacantes/${v}/prueba`)
    for (const nombre of ['El caso', 'Materiales y herramientas', 'Entregables']) {
      const titulo = page.getByRole('heading', { name: nombre, exact: true })
      await expect(titulo).toBeVisible({ timeout: 20_000 })
      // Lo que sigue al título empieza justo debajo (una línea de título y 12 px de hueco), no
      // 280 px más abajo: el título no se estira hasta la base de su `flex: 1 1 280px`.
      const distancia = await titulo.evaluate((h) => h.nextElementSibling!.getBoundingClientRect().top - h.getBoundingClientRect().top)
      expect(distancia, nombre).toBeLessThan(60)
    }
  })

  test('QA-07: con la guía «!» abierta por el cursor, un clic en el campo que tapa llega al campo', async ({ page }) => {
    const v = await vacanteConPrueba('Guía sobre sus campos', PRUEBA_DE_CIEN({ modalidad: 'CRONOMETRADA', duracionMinutos: 90 }, enMinutos(24 * 60)), false)
    await entrarAlPanel(page)
    // Sus dos sitios: fuera del panel lateral (1440, hay sitio a su izquierda) y en el propio
    // panel, en su línea bajo la etiqueta (768, no lo hay).
    for (const [ancho, alLado] of [[1440, true], [768, false]] as const) {
      await page.setViewportSize({ width: ancho, height: 900 })
      await page.goto(`/admin/vacantes/${v}/prueba`)
      await cabecera(page).getByRole('button', { name: 'Configuración', exact: true }).click({ timeout: 20_000 })
      const configuracion = page.getByRole('dialog', { name: 'Configuración de la prueba' })
      // Quien lee la guía y baja a rellenar el campo: el cursor va del «!» al campo.
      const bajarDesdeLaGuia = async (guia: string, campo: Locator) => {
        await page.mouse.move(0, 0)
        await configuracion.getByRole('button', { name: `Guía: ${guia}` }).hover()
        const texto = configuracion.getByRole('tooltip')
        await expect(texto).toBeVisible()
        const panel = (await configuracion.boundingBox())!
        const caja = (await texto.boundingBox())!
        expect(caja.x + caja.width <= panel.x, `${ancho}: la guía va ${alLado ? 'fuera del' : 'en el'} panel`).toBe(alLado)
        const destino = (await campo.boundingBox())!
        await page.mouse.move(destino.x + Math.min(destino.width / 2, 40), destino.y + destino.height / 2, { steps: 10 })
        await page.mouse.down()
        await page.mouse.up()
      }
      const sinCronometro = configuracion.getByRole('radio', { name: 'Sin cronómetro' })
      await bajarDesdeLaGuia('Tiempo', sinCronometro)
      await expect(sinCronometro, `${ancho}`).toBeChecked()
      const fecha = configuracion.getByLabel('Fecha límite para dar la prueba')
      await bajarDesdeLaGuia('Fecha límite', fecha)
      await expect(fecha, `${ancho}`).toBeFocused()
    }
  })

  test('QA-09: la guía «!» fijada fuera del panel no se queda a la vista cuando su etiqueta sale al bajar el panel', async ({ page }) => {
    const v = await vacanteConPrueba('Guía y el panel que baja', PRUEBA_DE_CIEN({ modalidad: 'CRONOMETRADA', duracionMinutos: 90 }, enMinutos(24 * 60)), false)
    await entrarAlPanel(page)
    // Una ventana baja: el cuerpo del panel lateral se desplaza; a su izquierda cabe la guía.
    await page.setViewportSize({ width: 1280, height: 480 })
    await page.goto(`/admin/vacantes/${v}/prueba`)
    await cabecera(page).getByRole('button', { name: 'Configuración', exact: true }).click({ timeout: 20_000 })
    const configuracion = page.getByRole('dialog', { name: 'Configuración de la prueba' })
    const signo = configuracion.getByRole('button', { name: 'Guía: Tiempo' })
    const guia = configuracion.getByRole('tooltip')
    // Pulsar el «!» la deja fija; el cursor se va al panel y baja con la rueda.
    await signo.click()
    const panel = (await configuracion.boundingBox())!
    await page.mouse.move(panel.x + panel.width / 2, panel.y + panel.height - 60)
    await expect(guia).toBeVisible()
    expect((await guia.boundingBox())!.x + (await guia.boundingBox())!.width).toBeLessThanOrEqual(panel.x)
    /** Dónde está el «!» respecto a la parte visible del cuerpo del panel. */
    const signoALaVista = () =>
      signo.evaluate((b) => {
        let cuerpo = b.parentElement
        while (cuerpo && !(getComputedStyle(cuerpo).overflowY === 'auto' && cuerpo.scrollHeight > cuerpo.clientHeight)) cuerpo = cuerpo.parentElement
        const s = b.getBoundingClientRect()
        const c = cuerpo!.getBoundingClientRect()
        return s.bottom > c.top && s.top < c.bottom
      })
    // Mientras la etiqueta se ve, la guía la sigue a su altura.
    await page.mouse.wheel(0, 20)
    await expect.poll(async () => {
      const s = (await signo.boundingBox())!
      const g = (await guia.boundingBox())!
      const centro = s.y + s.height / 2
      return g.y <= centro && centro <= g.y + g.height
    }).toBe(true)
    // Al bajar hasta que la etiqueta sale de la vista, la guía no se queda flotando sin ella.
    await page.mouse.wheel(0, 400)
    await expect.poll(signoALaVista).toBe(false)
    await expect(guia).toBeHidden()
  })

  test('QA-08: sin «Publicar», «Configuración» llega al borde derecho de la cabecera, como el resumen', async ({ page }) => {
    const v = await vacanteConPrueba('Cabecera de la publicada', PRUEBA_DE_CIEN({ modalidad: 'CRONOMETRADA', duracionMinutos: 90 }, enMinutos(24 * 60)))
    await entrarAlPanel(page)
    // 1280 px con el menú abierto: la cabecera va en una fila (desde 56rem).
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/admin/vacantes/${v}/prueba`)
    const configurar = cabecera(page).getByRole('button', { name: 'Configuración', exact: true })
    await expect(configurar).toBeVisible({ timeout: 20_000 })
    await expect(cabecera(page).getByRole('button', { name: /^Publicar/ })).toHaveCount(0)
    const resumen = cabecera(page).getByText('1 criterio · 2 preguntas · 1 entregable', { exact: true })
    const bordeDerecho = async (l: Locator) => {
      const b = (await l.boundingBox())!
      return b.x + b.width
    }
    // En la fila no queda una columna vacía de «Publicar» que la aparte del borde.
    expect(Math.abs((await bordeDerecho(configurar)) - (await bordeDerecho(resumen)))).toBeLessThanOrEqual(1)
  })

  test('V69: lo que vale un criterio se mantiene al cambiar sus cerradas; si lo pasan, la falta lleva a él y se arregla con sus puntos', async ({ page }) => {
    const ABIERTA_EXCEL = 'Explica cómo armaste el flujo.'
    const v = await vacanteConPrueba('Lo que vale un criterio', {
      criterios: [
        // Vale 40: una cerrada de 20 y 20 de la IA mirando su abierta.
        { nombre: 'Excel', puntos: 40, calificador: 'IA', preguntas: [{ tipo: 'ABIERTA', enunciado: ABIERTA_EXCEL }, cerrada(CERRADA, 20)] },
        { nombre: 'Comunicación', puntos: 60, calificador: 'PERSONA', preguntas: [{ tipo: 'ABIERTA', enunciado: ABIERTA }] },
      ],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 60 },
      fechaLimite: null,
    }, false)
    const excel = () => editorDe(equipo, v).then((e) => (e.borrador.criterios as any[]).find((c) => c.nombre === 'Excel'))
    expect(await excel()).toMatchObject({ puntos: 40, puntosSistema: 20, puntosCalificados: 20 })

    // Bajar los puntos de su cerrada no le baja lo que vale: crece lo que califica la IA.
    const laCerrada = ((await excel()).preguntas as any[]).find((p) => p.enunciado === CERRADA).id
    await exigir(`${RUTA(v)}/preguntas/${laCerrada}`, equipo, 'PUT', { ...cerrada(CERRADA, 10), criterioId: (await excel()).id })
    expect(await excel()).toMatchObject({ puntos: 40, puntosSistema: 10, puntosCalificados: 30 })
    expect((await editorDe(equipo, v)).borrador.total).toBe(100)

    // Otra cerrada de 40 tampoco: sus cerradas (50) pasan de lo que vale y es una falta, también al publicar.
    await exigir(`${RUTA(v)}/preguntas`, equipo, 'POST', { ...cerrada('¿Qué fórmula suma con condición?', 40), criterioId: (await excel()).id })
    expect(await excel()).toMatchObject({ puntos: 40, puntosSistema: 50, puntosCalificados: 0 })
    const falta = 'Las cerradas de «Excel» suman 50 y el criterio vale 40.'
    const alPublicar = await publicarPrueba(equipo, v)
    expect(alPublicar.estado).toBe(400)
    expect(alPublicar.cuerpo.faltas).toContain(falta)

    // En el panel: la falta lleva al criterio abierto, que dice lo que vale y lo que suman sus cerradas.
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${v}/prueba`)
    await page.getByRole('button', { name: 'Plegar todo', exact: true }).click()
    const bloque = page.getByRole('region', { name: 'Criterio Excel' })
    await expect(bloque.locator('header').first()).toContainText(falta)
    await irConLaPastilla(page, bloque)
    await expect(bloque.getByRole('button', { name: 'Excel', exact: true })).toHaveAttribute('aria-expanded', 'true')
    await expect(bloque).toContainText('40 pts (sistema 50)')

    // Se arregla con sus puntos: el formulario dice la falta en vivo y el reparto al subirlos.
    await bloque.getByRole('button', { name: 'Editar el criterio Excel' }).click()
    const form = page.getByRole('form', { name: 'Editar el criterio Excel' })
    await expect(form.getByRole('spinbutton', { name: 'Puntos del criterio' })).toHaveValue('40')
    await expect(form).toContainText(falta)
    await form.getByRole('spinbutton', { name: 'Puntos del criterio' }).fill('60')
    await expect(form).toContainText('Cerradas: 50 pts · Abiertas y archivos: 10 pts, los califica')
    await form.getByRole('combobox', { name: 'Quién califica los 10 puntos de abiertas y archivos' }).selectOption('PERSONA')
    await form.getByRole('button', { name: 'Guardar el criterio' }).click()
    await expect(bloque).toContainText('60 pts (sistema 50 + persona 10)', { timeout: 20_000 })
    await expect(bloque.getByRole('list', { name: 'Lo que le falta al criterio' })).toHaveCount(0)
    expect(await excel()).toMatchObject({ puntos: 60, puntosCalificados: 10, calificador: 'PERSONA' })
  })

  test('QA-10: si bajan las cerradas de un criterio que todo lo puntuaba el sistema, la parte que aparece no se atribuye a la IA', async ({ page }) => {
    const OTRA = '¿Qué cuenta registra la caja?'
    const v = await vacanteConPrueba('Parte sin quién la califique', {
      criterios: [{ nombre: 'Cálculo', puntos: 30, calificador: null, preguntas: [cerrada(CERRADA, 15), cerrada(OTRA, 15)] }],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 60 },
      fechaLimite: null,
    }, false)
    const calculo = () => editorDe(equipo, v).then((e) => (e.borrador.criterios as any[]).find((c) => c.nombre === 'Cálculo'))
    // Guardado con sus cerradas sumando su total: «Todo lo puntúa el sistema», sin quién califica.
    await exigir(`${RUTA(v)}/criterios/${(await calculo()).id}`, equipo, 'PUT', { nombre: 'Cálculo', queEvalua: null, puntos: 30, calificador: null })
    expect(await calculo()).toMatchObject({ puntos: 30, puntosSistema: 30, puntosCalificados: 0, calificador: null })

    // Una cerrada baja de 15 a 10: el criterio sigue valiendo 30 y le aparecen 5 sin nadie que los califique.
    const laOtra = ((await calculo()).preguntas as any[]).find((p) => p.enunciado === OTRA).id
    await exigir(`${RUTA(v)}/preguntas/${laOtra}`, equipo, 'PUT', { ...cerrada(OTRA, 10), criterioId: (await calculo()).id })
    expect(await calculo()).toMatchObject({ puntos: 30, puntosSistema: 25, puntosCalificados: 5, calificador: null })
    const falta = 'El criterio «Cálculo»: falta decir quién califica su parte calificada, la IA o una persona.'
    expect((await editorDe(equipo, v)).borrador.avisos).toContain(falta)

    // El panel dice la falta y no puede decir a la vez que esa parte la califica la IA.
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${v}/prueba`)
    const bloque = page.getByRole('region', { name: 'Criterio Cálculo' })
    await page.getByRole('button', { name: 'Desplegar todo', exact: true }).click({ timeout: 20_000 })
    await expect(bloque.getByRole('list', { name: 'Lo que le falta al criterio' })).toContainText(falta)
    await expect(bloque.locator('header').first()).toContainText('30 pts')
    await expect(bloque.locator('header').first()).not.toContainText('IA')
    await expect(bloque).not.toContainText('Abiertas y archivos')
    await expect(bloque).not.toContainText('los califica la IA')
  })

  test('QA-11: en «Cambiar los puntos», un total mal escrito no trae al guardar una suma que contradice la escrita', async ({ page }) => {
    // Excel vale 100: sus cerradas 40 y la IA 60. Nadie rindió: guardar no pide confirmar.
    const v = await vacanteConPrueba('Total mal escrito al cambiar los puntos', PRUEBA_DE_CIEN({ modalidad: 'CRONOMETRADA', duracionMinutos: 60 }, enMinutos(24 * 60)))
    const excel = async () => ((await pedir(RUTA(v), equipo)).cuerpo.publicada.criterios as any[]).find((c) => c.nombre === 'Excel')
    expect(await excel()).toMatchObject({ puntos: 100 })

    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${v}/prueba`)
    await page.getByRole('button', { name: 'Cambiar los puntos' }).click({ timeout: 20_000 })
    const form = page.getByRole('form', { name: 'Cambiar los puntos' })
    await form.getByRole('spinbutton', { name: 'Puntos del criterio «Excel»' }).fill('150')
    // En vivo: la suma de lo escrito y qué está mal en ese total.
    await expect(form).toContainText('Suma de lo escrito: 150 de 100')
    await expect(form).toContainText('Los puntos del criterio van de 0 a 100.')

    // Puede no enviarse (lo frena el formulario) o rechazarlo el servidor; en los dos casos,
    // ninguna «Los puntos suman N de 100» puede decir otra suma que la escrita.
    const envio = page
      .waitForResponse((r) => r.url().includes(`${RUTA(v)}/publicada/puntos`) && r.request().method() !== 'GET', { timeout: 5_000 })
      .catch(() => null)
    await form.getByRole('button', { name: 'Guardar los puntos' }).click()
    const respuesta = await envio
    if (respuesta) {
      expect(respuesta.status()).toBe(400)
      const faltas: string[] = (await respuesta.json()).faltas ?? []
      expect(faltas.join(' | ')).toContain('Los puntos del criterio van de 0 a 100.')
      for (const f of faltas) {
        const suma = /^Los puntos suman (\d+) de 100/.exec(f)
        if (suma) expect(Number(suma[1]), faltas.join(' | ')).toBe(150)
      }
      await expect(form.getByText(/^Falta(n \d+ cosas| una cosa):/)).toBeVisible()
    }
    const dicho = (await form.innerText()).replace(/\s+/g, ' ')
    for (const m of dicho.matchAll(/Los puntos suman (\d+) de 100/g)) expect(Number(m[1]), dicho).toBe(150)
    await expect(form).toContainText('Los puntos del criterio van de 0 a 100.')
    // Nada cambió.
    expect(await excel()).toMatchObject({ puntos: 100 })
  })

  test('QA-12: en «Cambiar los puntos», el total mal escrito que frena el guardado queda a la vista, no bajo la cabecera fija', async ({ page }) => {
    // Tres criterios con parte calificada: el formulario es más alto que la ventana y
    // «Guardar los puntos» queda lejos del primer total.
    const v = await vacanteConPrueba('Total mal escrito a la vista', {
      criterios: [
        { nombre: 'Cálculo', puntos: 30, calificador: 'IA', preguntas: [{ tipo: 'ABIERTA', enunciado: ABIERTA }, cerrada(CERRADA, 15)] },
        { nombre: 'Análisis', puntosCalificados: 40, calificador: 'IA', preguntas: [{ tipo: 'ABIERTA', enunciado: 'Analiza el descuadre del mes de marzo.' }] },
        { nombre: 'Excel', puntosCalificados: 30, calificador: 'PERSONA', preguntas: [{ tipo: 'ABIERTA', enunciado: 'Arma el flujo de caja en una hoja.' }] },
      ],
      datos: { enunciado: 'El cierre de marzo.', modalidad: 'CRONOMETRADA', duracionMinutos: 60 },
      fechaLimite: enMinutos(24 * 60),
    })
    await page.setViewportSize({ width: 1280, height: 800 })
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${v}/prueba`)
    await page.getByRole('button', { name: 'Cambiar los puntos' }).click({ timeout: 20_000 })
    const form = page.getByRole('form', { name: 'Cambiar los puntos' })
    const total = form.getByRole('spinbutton', { name: 'Puntos del criterio «Cálculo»' })
    let envios = 0
    page.on('request', (r) => {
      if (r.url().includes(`${RUTA(v)}/publicada/puntos`) && r.method() !== 'GET') envios++
    })

    for (const malo of ['150', '25.5', '']) {
      await total.fill(malo)
      // Se guarda desde abajo, como quien acaba de repasar todo el formulario.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await form.getByRole('button', { name: 'Guardar los puntos' }).click()
      await expect(total, `con «${malo}»`).toBeFocused()
      await page.waitForTimeout(400) // que el navegador termine de colocarlo
      const campo = (await total.boundingBox())!
      const fija = (await cabecera(page).boundingBox())!
      expect(campo.y, `con «${malo}», el campo empieza debajo de la cabecera fija`).toBeGreaterThanOrEqual(fija.y + fija.height)
      expect(campo.y + campo.height, `con «${malo}», el campo cabe en la ventana`).toBeLessThanOrEqual(800)
      expect(await seVe(total), `con «${malo}», nada tapa el campo`).toBe(true)
    }
    expect(envios).toBe(0)
  })

  test('QA-13: en «Cambiar los puntos» del banco, los puntos salen a la vista y un 400 con los criterios plegados lleva a la pregunta', async ({ page }) => {
    // Un banco publicado de 100 con tres criterios; solo cerradas, cada opción con su texto propio.
    const ARQUEO = '¿Qué haces si falta dinero en el arqueo?'
    const CIERRE = '¿Cuándo cuadras la caja?'
    const TURNOS = '¿Cómo repartes los turnos?'
    const CREDITO = '¿Dónde registras una venta al crédito?'
    const v = await crearVacante(equipo, 'Banco publicado: cambiar los puntos', await lugarDe(equipo))
    await exigir(`/panel/vacantes/${v}/origen-preguntas`, equipo, 'POST', { origen: 'VACANTE' })
    await escribirBorrador(equipo, v, [
      { nombre: 'Caja', preguntas: [
        { tipo: 'OPCION_UNICA', enunciado: ARQUEO, puntos: 30, opciones: [{ texto: 'Lo reporto', puntos: 30 }, { texto: 'Lo repongo', puntos: 0 }] },
        { tipo: 'OPCION_UNICA', enunciado: CIERRE, puntos: 10, opciones: [{ texto: 'Al cerrar', puntos: 10 }, { texto: 'Al día siguiente', puntos: 0 }] },
      ] },
      { nombre: 'Personal', preguntas: [
        { tipo: 'OPCION_UNICA', enunciado: TURNOS, puntos: 30, opciones: [{ texto: 'Por rotación', puntos: 30 }, { texto: 'Al azar', puntos: 0 }] },
      ] },
      { nombre: 'Sistema', preguntas: [
        { tipo: 'OPCION_UNICA', enunciado: CREDITO, puntos: 30, opciones: [{ texto: 'Libro diario', puntos: 30 }, { texto: 'Libro mayor', puntos: 0 }] },
      ] },
    ], 'Premia lo que se reporta a tiempo.')
    await publicarPreguntas(equipo, v)

    await page.setViewportSize({ width: 1280, height: 800 })
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${v}/preguntas`)
    await page.getByRole('button', { name: 'Cambiar los puntos' }).click({ timeout: 20_000 })
    const form = page.getByRole('form', { name: 'Cambiar los puntos' })
    const criterio = (nombre: string) => form.getByRole('region', { name: `Criterio ${nombre}` }).getByRole('button', { name: nombre, exact: true })
    const puntosDe = (enunciado: string) => form.getByRole('spinbutton', { name: `Puntos de «${enunciado.slice(0, 40)}»` })
    const opcion = (texto: string) => form.getByRole('spinbutton', { name: `Puntos de la opción «${texto}»` })
    const plegarTodo = () => form.getByRole('button', { name: 'Plegar todo', exact: true }).click()
    const guardarDesdeAbajo = async () => {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      const respuesta = page.waitForResponse((r) => r.url().includes(`${RUTA_DEL_BANCO(v)}/publicada/puntos`) && r.request().method() === 'PUT')
      await form.getByRole('button', { name: 'Guardar los puntos' }).click()
      return (await respuesta).status()
    }

    // Al abrir, sus únicos campos —los puntos de las preguntas— están a la vista: todo desplegado.
    for (const nombre of ['Caja', 'Personal', 'Sistema']) await expect(criterio(nombre)).toHaveAttribute('aria-expanded', 'true')
    await expect(puntosDe(ARQUEO)).toBeInViewport()

    // Un 400 que solo dice la suma no despliega nada: la suma ya está arriba.
    await puntosDe(CREDITO).fill('20')
    await opcion('Libro diario').fill('20')
    await plegarTodo()
    expect(await guardarDesdeAbajo()).toBe(400)
    await expect(form.getByRole('alert')).toContainText('Los puntos suman 90 de 100')
    for (const nombre of ['Caja', 'Personal', 'Sistema']) await expect(criterio(nombre)).toHaveAttribute('aria-expanded', 'false')
    await criterio('Sistema').click()
    await puntosDe(CREDITO).fill('30')
    await opcion('Libro diario').fill('30')

    // Suma 100, pero la opción de «Personal» no da lo que vale su pregunta: el servidor lo rechaza.
    await criterio('Caja').click()
    await puntosDe(ARQUEO).fill('20')
    await opcion('Lo reporto').fill('20')
    await criterio('Personal').click()
    await puntosDe(TURNOS).fill('40')
    await plegarTodo()
    expect(await guardarDesdeAbajo()).toBe(400)

    // Se despliega solo «Personal» y se lleva a su pregunta, bajo la cabecera fija y con su falta debajo.
    const turnos = puntosDe(TURNOS)
    await expect(turnos).toBeFocused()
    await expect(criterio('Personal')).toHaveAttribute('aria-expanded', 'true')
    await expect(criterio('Caja')).toHaveAttribute('aria-expanded', 'false')
    await expect(criterio('Sistema')).toHaveAttribute('aria-expanded', 'false')
    await page.waitForTimeout(400) // que el navegador termine de colocarlo
    const campo = (await turnos.boundingBox())!
    const fija = (await page.getByRole('region', { name: 'Balance de las preguntas' }).boundingBox())!
    expect(campo.y, 'el campo empieza debajo de la cabecera fija').toBeGreaterThanOrEqual(fija.y + fija.height)
    expect(campo.y + campo.height, 'el campo cabe en la ventana').toBeLessThanOrEqual(800)
    expect(await seVe(turnos), 'nada tapa el campo').toBe(true)
    await expect(turnos).toHaveAttribute('aria-invalid', 'true')
    const falta = page.locator(`[id="${await turnos.getAttribute('aria-describedby')}"]`)
    await expect(falta).toContainText('La pregunta 3')
    await expect(falta).toContainText('alguna opción tiene que dar los 40 puntos')
    await expect(falta).toBeInViewport()

    // Al tocar la pregunta su aviso se va; con la opción en 40 se guarda.
    await opcion('Por rotación').fill('40')
    await expect(turnos).not.toHaveAttribute('aria-invalid', 'true')
    expect(await guardarDesdeAbajo()).toBe(200)
    await expect(page.getByText('Puntos guardados.')).toBeVisible()
    const publicada = (await pedir(RUTA_DEL_BANCO(v), equipo)).cuerpo.publicada
    expect((publicada.criterios as any[]).map((c) => `${c.nombre} ${c.puntos}`)).toEqual(['Caja 30', 'Personal 40', 'Sistema 30'])
  })
})
