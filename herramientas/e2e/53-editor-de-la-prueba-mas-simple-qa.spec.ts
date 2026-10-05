import { expect, type Locator, type Page } from '@playwright/test'
import { entrarAlPanel } from './ayuda'
import { test } from './ayuda-candidato'
import { limpiarSiempre } from './base-de-datos'
import { entrarAlPortalCon, exigir, pedir, tokenDePanel } from './ayuda-preguntas-propias'
import {
  candidataEnLaPrueba,
  crearVacante,
  editorDe,
  entregarLaPrueba,
  escribirPrueba,
  iniciarLaPrueba,
  lugarDe,
  publicarPrueba,
  responderLaPrueba,
  retirarLoSembrado,
  RUTA,
  type PruebaNueva,
} from './ayuda-prueba-propia'

/**
 * QA independiente de «Un editor de la prueba técnica más simple» (V68): lo que la suite
 * del trabajo (52) no cubría y lo que salió al explorar con el navegador.
 *
 *   - AC-11/AC-12: el reloj al abrir (cronometrada con fecha cercana o lejana; sin cronómetro).
 *   - AC-20: «Entregar» sin el archivo de una pregunta lleva a esa pregunta; el servidor lo rechaza.
 *   - Riesgo: quitar la única pregunta que cubría un general lo deja sin cubrir y su falta lleva a él.
 *   - QA-01: en el teléfono, «Publicar» y «Configuración» no tapan el balance de la cabecera fija.
 *   - QA-02: si la fecha falla al pulsar «Listo», lo que sí se guardó (los minutos) se ve.
 *   - QA-03: la falta de un criterio deja su línea a la vista, no debajo de la cabecera fija.
 *   - QA-04: la versión publicada sin caso no titula «El caso» a los materiales.
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
    await cabecera(page).getByRole('button', { name: /^«Informe final» no cubre ninguna pregunta/ }).click()
    await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? null)).toBe(`entregable-${informe}`)
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
    const faltas = cabecera(page).getByRole('list', { name: 'Lo que frena la publicación' }).getByRole('button')
    await expect(faltas).toHaveCount(4, { timeout: 20_000 })
    await page.getByRole('button', { name: 'Plegar todo', exact: true }).click()

    await cabecera(page).getByRole('button', { name: /^El criterio «Tributación»/ }).click()
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
      await expect(cabecera(page).getByRole('button', { name: /^Faltan los minutos/ })).toHaveCount(0)
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
})
