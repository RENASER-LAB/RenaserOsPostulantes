import { expect, type Locator, type Page } from '@playwright/test'
import { API, entrarAlPanel } from './ayuda'
import { test } from './ayuda-candidato'
import { limpiarSiempre, sql } from './base-de-datos'
import {
  auditoriasDe,
  crearVacante,
  cuentaDeCandidato,
  editorDe,
  elegirLaPruebaDelPuesto,
  empezarEvaluacion,
  entrarAlPanelCon,
  entrarAlPortalCon,
  entregar,
  escribirBorrador,
  estadoDeLaPostulacion,
  exigir,
  lugarDeLaPlataforma,
  pedir,
  postulacionPorUuid,
  postular,
  publicarPreguntas,
  quitarTrabajo,
  respuestaA,
  responder,
  retirarLoSembrado,
  RUTA,
  sembrarEquipoSin,
  sembrarNotaDeLaIa,
  sembrarRecalificacionEnCurso,
  sembrarRecalificacionFallida,
  titulo,
  tokenDePanel,
  trabajosDeIaDe,
  type Cuenta,
} from './ayuda-preguntas-propias'

/**
 * QA de las preguntas propias (V66, fase 1): el candidato responde los cuatro
 * tipos, el sistema puntúa lo cerrado, una persona ajusta o completa lo abierto
 * y los cambios con candidatos dentro recalculan a todos.
 *
 * Criterios: AC-06, AC-07, AC-08, AC-09, AC-16, AC-19, AC-22, AC-25, AC-26,
 * AC-27, AC-29 (IA apagada), AC-30, AC-32 y AC-33. En el preview la IA está
 * apagada (sin broker): la nota que habría puesto a una abierta se siembra como
 * la guarda `guardarNotasAbiertas`, y la recalificación en curso como la deja
 * la cola. Lo que la IA hace de verdad lo prueba `FlujoPreguntasPropiasIT`.
 *
 * La vacante, con 100 puntos y una clave AL REVÉS a propósito (AC-32):
 *   Conocimiento contable · 24 = opción única 4 (A «Libro mayor» 4, B «Libro diario» 0)
 *                               + múltiple 10 (+6, +6, −4) + escala 10 (niveles 1…10)
 *   Casos · 20                  = abierta 20 + abierta de 0 puntos
 *   Tributación · 56            = opción única 56 (A «18 %» 56, B «19 %» 0)
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira.
 */

const OU = '¿Qué libro registra primero una venta al crédito?'
const MULTI = '¿Qué documentos sustentan una compra al crédito?'
const ESCALA = '¿Cuánto dominas las conciliaciones bancarias?'
const ABIERTA = 'Cuéntanos un cierre con un descuadre. ¿Cómo lo hallaste?'
const CERO = '¿Qué te gustaría aprender en este puesto?'
const IGV = '¿Cuál es la tasa general del IGV en el Perú?'
const MOTIVO = 'Sí dio el dato; la IA no leyó el anexo.'

const correos: string[] = []
const NOMBRE = 'Calificación por puntos'
let equipo = ''
let vacante = 0
let publicada: any = null
const c: Record<'uno' | 'dos' | 'tres', Cuenta & { uuid: string; postulacion: number }> = {} as never

const pregunta = (enunciado: string) =>
  [...publicada.criterios.flatMap((k: any) => k.preguntas)].find((p: any) => p.enunciado === enunciado)
const opcion = (enunciado: string, texto: string): number =>
  pregunta(enunciado).opciones.find((o: any) => o.texto === texto).id

const desglose = async (postulacion: number) =>
  (await exigir(`/panel/postulaciones/${postulacion}/evaluacion`, equipo)).porPuntos
const deLaPregunta = (d: any, enunciado: string) =>
  [...d.criterios.flatMap((k: any) => k.preguntas), ...d.sinCriterio].find((p: any) => p.enunciado === enunciado)
const delCriterio = (d: any, nombre: string) => d.criterios.find((k: any) => k.nombre === nombre)
const filaDelRanking = async (postulacion: number) =>
  (await exigir(`/panel/vacantes/${vacante}/ranking`, equipo)).filas.find((f: any) => f.postulacionId === postulacion)

async function responderPorApi(quien: Cuenta & { uuid: string }, eleccion: {
  ou: string
  marcadas: string[]
  nivel: string
  abierta: string
  cero: string
  igv: string
}) {
  const evaluacion = await empezarEvaluacion(quien.token, quien.uuid)
  const del = (enunciado: string) => evaluacion.preguntas.find((p: any) => p.enunciado === enunciado)
  const op = (enunciado: string, texto: string) => del(enunciado).opciones.find((o: any) => o.texto === texto).id
  await responder(quien.token, quien.uuid, del(OU).id, { opcionId: op(OU, eleccion.ou) })
  await responder(quien.token, quien.uuid, del(MULTI).id, {
    detalle: { marcadas: eleccion.marcadas.map((t) => op(MULTI, t)) },
  })
  await responder(quien.token, quien.uuid, del(ESCALA).id, { opcionId: op(ESCALA, eleccion.nivel) })
  await responder(quien.token, quien.uuid, del(ABIERTA).id, { texto: eleccion.abierta })
  await responder(quien.token, quien.uuid, del(CERO).id, { texto: eleccion.cero })
  await responder(quien.token, quien.uuid, del(IGV).id, { opcionId: op(IGV, eleccion.igv) })
  await entregar(quien.token, quien.uuid)
}

/** El desglose de la evaluación de un candidato, abierto en su fila del ranking. */
async function abrirDesglose(page: Page, nombre: string): Promise<Locator> {
  await page.goto(`/admin/vacantes/${vacante}`)
  await expect(page.getByRole('heading', { level: 1, name: titulo(NOMBRE) })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: /Toda la tanda/ }).click()
  await page.getByRole('row').filter({ hasText: nombre }).getByRole('button', { name: nombre }).click()
  const seccion = page.getByRole('heading', { name: 'La evaluación del banco' }).locator('xpath=..')
  await expect(seccion).toBeVisible({ timeout: 20_000 })
  // Los tres criterios ya pintados antes de abrirlos: un <details> cerrado esconde sus botones.
  await expect(seccion.locator('details')).toHaveCount(3, { timeout: 20_000 })
  for (const d of await seccion.locator('details').all()) await d.evaluate((e) => ((e as HTMLDetailsElement).open = true))
  return seccion
}

test.describe('Las preguntas propias, respondidas y calificadas', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    equipo = await tokenDePanel()
    vacante = await crearVacante(equipo, NOMBRE, await lugarDeLaPlataforma(equipo, 'EJECUCION'))
    await exigir(`/panel/vacantes/${vacante}/origen-preguntas`, equipo, 'POST', { origen: 'VACANTE' })
    await escribirBorrador(
      equipo,
      vacante,
      [
        {
          nombre: 'Conocimiento contable',
          queEvalua: 'Domina el registro y el cierre mensual.',
          preguntas: [
            { tipo: 'OPCION_UNICA', enunciado: OU, puntos: 4, opciones: [{ texto: 'Libro mayor', puntos: 4 }, { texto: 'Libro diario', puntos: 0 }] },
            {
              tipo: 'OPCION_MULTIPLE',
              enunciado: MULTI,
              puntos: 10,
              opciones: [{ texto: 'Factura', puntos: 6 }, { texto: 'Guía de remisión', puntos: 6 }, { texto: 'Boleta personal', puntos: -4 }],
            },
            {
              tipo: 'ESCALA',
              enunciado: ESCALA,
              puntos: 10,
              opciones: Array.from({ length: 10 }, (_, i) => ({ texto: i === 0 ? 'Nada' : i === 9 ? 'Mucho' : '', puntos: i + 1 })),
            },
          ],
        },
        {
          nombre: 'Casos',
          preguntas: [
            { tipo: 'ABIERTA', enunciado: ABIERTA, puntos: 20, queDebeTener: 'El monto, la cuenta y en cuántos días lo cerró.' },
            { tipo: 'ABIERTA', enunciado: CERO, puntos: 0 },
          ],
        },
        {
          nombre: 'Tributación',
          preguntas: [{ tipo: 'OPCION_UNICA', enunciado: IGV, puntos: 56, opciones: [{ texto: '18 %', puntos: 56 }, { texto: '19 %', puntos: 0 }] }],
        },
      ],
      'Guía inicial de la vacante',
    )
    publicada = (await publicarPreguntas(equipo, vacante)).publicada
    await elegirLaPruebaDelPuesto(equipo, vacante)
    await exigir(`/panel/vacantes/${vacante}/publicacion`, equipo, 'POST', {})
    for (const [clave, nombre] of [['uno', 'Uno'], ['dos', 'Dos'], ['tres', 'Tres']] as const) {
      const cuenta = await cuentaDeCandidato(nombre, correos)
      const uuid = await postular(cuenta.token, vacante)
      c[clave] = { ...cuenta, uuid, postulacion: postulacionPorUuid(uuid) }
    }
  })

  test.afterAll(async () => {
    await limpiarSiempre([() => retirarLoSembrado(correos)])
  })

  test('AC-08/AC-22 · el portal no enseña puntos, clave ni criterios, y la escala va del 1 al 10 en el teléfono', async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 375, height: 812 })
    await entrarAlPortalCon(page, c.uno.token)
    await page.goto(`/procesos/${c.uno.uuid}/evaluacion`)
    await page.getByRole('button', { name: 'Empezar evaluación' }).click()
    const main = page.locator('main')
    await expect(main.getByText('Pregunta 1 de 6')).toBeVisible({ timeout: 20_000 })

    // Lo que devuelve la API al candidato: ni puntos, ni clave, ni criterios (RF-53).
    const r = await fetch(`${API}/portal/evaluacion/${c.uno.uuid}`, {
      headers: { Authorization: `Bearer ${c.uno.token}` },
    })
    const cuerpo = await r.text()
    expect(r.status).toBe(200)
    for (const prohibida of ['"puntos"', '"puntaje"', '"criterio', '"queDebeTener"', '"queEvalua"', 'Conocimiento contable', 'Tributación']) {
      expect.soft(cuerpo, prohibida).not.toContain(prohibida)
    }

    const guardada = () => expect(main.getByText(/Respuesta guardada/)).toBeVisible({ timeout: 15_000 })
    for (let i = 0; i < 6; i++) {
      const enunciado = (await main.getByRole('heading', { level: 1 }).innerText()).trim()
      if (enunciado === OU) await main.getByText('A. Libro mayor').click()
      else if (enunciado === MULTI) {
        for (const t of ['Factura', 'Guía de remisión', 'Boleta personal']) await main.getByText(t, { exact: true }).click()
      } else if (enunciado === ESCALA) {
        await expect(main.getByRole('radio')).toHaveCount(10)
        // Los niveles, en el orden en que se leen: del 1 al 10, no 1, 10, 2…
        const niveles = (await main.getByRole('article').innerText())
          .split('\n').map((l) => l.trim()).filter((l) => /^\d+$/.test(l)).map(Number)
        expect(niveles).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        // En el teléfono van en una columna: cada nivel, debajo del anterior.
        const alturas: number[] = []
        for (let n = 1; n <= 10; n++) alturas.push((await main.getByText(String(n), { exact: true }).boundingBox())!.y)
        expect(alturas.every((y, j) => j === 0 || y > alturas[j - 1]!)).toBe(true)
        await main.getByText('7', { exact: true }).click()
      } else if (enunciado === ABIERTA) {
        await main.getByRole('textbox').fill('En marzo el mayor no cuadraba por 1.200 soles; revisé la cuenta 12 y lo cerré en dos días.')
      } else if (enunciado === CERO) {
        await main.getByRole('textbox').fill('Quiero aprender a cerrar el mes en SAP.')
      } else if (enunciado === IGV) {
        await main.getByText('A. 18 %').click()
      } else throw new Error(`Pregunta inesperada: ${enunciado}`)
      await guardada()
      if (i < 5) await main.getByRole('button', { name: 'Siguiente', exact: true }).click()
    }
    await expect(main.getByText('6 de 6 respondidas')).toBeVisible()
    await main.getByRole('button', { name: 'Entregar evaluación' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Entregar', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/procesos/${c.uno.uuid}$`), { timeout: 20_000 })
  })

  test('AC-06/AC-07/AC-09 · lo cerrado lo puntúa el sistema y, sin la abierta, no hay nota del Perfil Integral', async ({ page }) => {
    await responderPorApi(c.dos, {
      ou: 'Libro diario', marcadas: ['Factura', 'Guía de remisión'], nivel: 'Mucho',
      abierta: 'Cuadré la caja de tres sedes cada día.', cero: 'Excel avanzado.', igv: '18 %',
    })
    await responderPorApi(c.tres, {
      ou: 'Libro mayor', marcadas: ['Boleta personal'], nivel: 'Nada',
      abierta: 'No recuerdo un caso concreto.', cero: 'Nada en particular.', igv: '19 %',
    })

    const [d1, d2, d3] = [await desglose(c.uno.postulacion), await desglose(c.dos.postulacion), await desglose(c.tres.postulacion)]
    // AC-06: +6 +6 −4 da 8; +6 +6 topa en 10; solo −4 no baja de 0.
    expect(deLaPregunta(d1, MULTI).obtenido).toBe(8)
    expect(deLaPregunta(d2, MULTI).obtenido).toBe(10)
    expect(deLaPregunta(d3, MULTI).obtenido).toBe(0)
    expect([deLaPregunta(d1, OU).obtenido, deLaPregunta(d2, OU).obtenido, deLaPregunta(d3, OU).obtenido]).toEqual([4, 0, 4])
    expect([deLaPregunta(d1, ESCALA).obtenido, deLaPregunta(d2, ESCALA).obtenido, deLaPregunta(d3, ESCALA).obtenido]).toEqual([7, 10, 1])
    expect(delCriterio(d1, 'Conocimiento contable').sistema).toBe(19)
    expect(delCriterio(d1, 'Tributación').nota).toBe(56)

    // AC-07: la de 0 puntos se guarda y se ve, sin nota, y no deja nada pendiente.
    const cero = deLaPregunta(d1, CERO)
    expect(cero.sinPuntos).toBe(true)
    expect(cero.pendiente).toBe(false)
    expect(cero.respuesta).toBe('Quiero aprender a cerrar el mes en SAP.')

    // AC-09: la abierta de 20 sigue pendiente, y sin ella no hay nota ni del banco ni del Perfil Integral.
    for (const [d, quien] of [[d1, c.uno], [d2, c.dos], [d3, c.tres]] as const) {
      expect(d.completo).toBe(false)
      expect(deLaPregunta(d, ABIERTA).pendiente).toBe(true)
      expect(delCriterio(d, 'Casos').pendiente).toBe(true)
      expect((await filaDelRanking(quien.postulacion)).notaEtapa).toBeNull()
    }

    await entrarAlPanel(page)
    const seccion = await abrirDesglose(page, 'Uno Preguntas QA')
    await expect(seccion).toContainText('Pendiente: falta la nota de 1 abierta')
    await expect(seccion).toContainText('Conocimiento contable')
    await expect(seccion).toContainText('19/24 · Sistema 19/24')
    await expect(seccion).toContainText('pendiente/20')
    await expect(seccion).toContainText('«Quiero aprender a cerrar el mes en SAP.»')
    await expect(seccion).toContainText('Opción múltiple · 8/10')
  })

  test('AC-30 · cambiar la guía queda registrado con quién, cuándo y el texto anterior', async () => {
    const r = await exigir(`${RUTA(vacante)}/publicada/instrucciones`, equipo, 'PUT', { guiaCalificacion: 'Guía corregida' })
    expect(r.personas).toBe(0) // nadie tiene todavía nota de la IA
    const ahora = (await editorDe(equipo, vacante)).publicada
    expect(ahora.guiaCalificacion).toBe('Guía corregida')
    expect(ahora.versionGuia).toBe(2)
    const registros = auditoriasDe('corregir_instrucciones_ia', ahora.id)
    expect(registros).toHaveLength(1)
    expect(String(registros[0]!.antes)).toContain('Guía inicial de la vacante')
    expect(registros[0]!.usuario_id).not.toBeNull()
    expect(registros[0]!.ocurrida_en).not.toBeNull()
  })

  test('AC-16 · con postulantes la vara no se mueve: ni otra versión, ni textos, ni el origen', async () => {
    const intentos = [
      await pedir(`${RUTA(vacante)}/borrador`, equipo, 'POST'),
      await pedir(`${RUTA(vacante)}/publicacion`, equipo, 'POST'),
      await pedir(`${RUTA(vacante)}/criterios`, equipo, 'POST', { nombre: 'Otro criterio' }),
      await pedir(`${RUTA(vacante)}/preguntas/${pregunta(ABIERTA).id}`, equipo, 'PUT', {
        tipo: 'ABIERTA', enunciado: 'Enunciado reescrito', puntos: 20, criterioId: pregunta(ABIERTA).criterioId,
      }),
      await pedir(`/panel/vacantes/${vacante}/origen-preguntas`, equipo, 'POST', { origen: 'SIN_EVALUACION' }),
    ]
    for (const [i, r] of intentos.entries()) {
      expect.soft(r.estado, `intento ${i}`).toBe(409)
      // Publicar sin borrador no llega a mirar la vara: el borrador ya no se puede abrir.
      if (i !== 1) expect.soft(JSON.stringify(r.cuerpo), `intento ${i}`).toMatch(/postulantes|misma vara/)
    }
    const editor = await editorDe(equipo, vacante)
    expect(editor.borrador).toBeNull()
    expect(pregunta(ABIERTA).enunciado).toBe(ABIERTA)
    expect(editor.publicada.id).toBe(publicada.id)
  })

  test('AC-25/AC-26/AC-19 · ajustar una abierta con motivo deja las dos notas a la vista y recalcula sin mover', async ({ page }) => {
    const version = (await editorDe(equipo, vacante)).publicada.versionGuia as number
    sembrarNotaDeLaIa(respuestaA(c.uno.postulacion, ABIERTA), 12, version)
    sembrarNotaDeLaIa(respuestaA(c.dos.postulacion, ABIERTA), 10, version)
    const antes = await desglose(c.uno.postulacion)
    expect(antes.completo).toBe(true)
    expect(delCriterio(antes, 'Casos').nota).toBe(12)
    expect(antes.total).toBe(87)
    // AC-19: la suma de los criterios cuadra con la nota.
    expect(antes.criterios.reduce((s: number, k: any) => s + Number(k.nota), 0)).toBe(Number(antes.total))
    const estadoAntes = estadoDeLaPostulacion(c.uno.postulacion)

    await entrarAlPanel(page)
    const seccion = await abrirDesglose(page, 'Uno Preguntas QA')
    const abierta = seccion.getByRole('article').filter({ hasText: ABIERTA })
    await abierta.getByRole('button', { name: 'Ajustar nota' }).click()
    const form = abierta.getByRole('form', { name: 'Ajustar la nota' })
    await form.getByLabel(/Nota nueva/).fill('16')
    await form.getByLabel(/Motivo/).fill(MOTIVO)
    await form.getByRole('button', { name: 'Guardar la nota' }).click()
    await expect(abierta).toContainText('Abierta · 16/20', { timeout: 20_000 })
    await expect(abierta).toContainText(`«${MOTIVO}»`)
    await expect(abierta).toContainText(/Ajustada por .+ el \d\d\/\d\d/)
    await expect(abierta).toContainText('IA 12/20 ·')
    await expect(seccion).toContainText('Nota de las preguntas: 91 de 100')

    const despues = await desglose(c.uno.postulacion)
    expect(delCriterio(despues, 'Casos').nota).toBe(16)
    expect(despues.total).toBe(91)
    const nota = deLaPregunta(despues, ABIERTA)
    expect(nota).toMatchObject({ obtenido: 16, puntajeIa: 12, ajustada: true, motivoAjuste: MOTIVO })
    expect((await filaDelRanking(c.uno.postulacion)).notaEtapa).not.toBeNull()
    expect(estadoDeLaPostulacion(c.uno.postulacion)).toBe(estadoAntes)

    // Dos ajustes seguidos: queda el último.
    const ruta = (resp: number) => `/panel/postulaciones/${c.uno.postulacion}/evaluacion/respuestas/${resp}/nota`
    const suya = respuestaA(c.uno.postulacion, ABIERTA)
    await exigir(ruta(suya), equipo, 'PUT', { puntaje: 17, motivo: 'Primero 17' })
    await exigir(ruta(suya), equipo, 'PUT', { puntaje: 16, motivo: MOTIVO })
    expect(deLaPregunta(await desglose(c.uno.postulacion), ABIERTA)).toMatchObject({ obtenido: 16, puntajeIa: 12 })

    // AC-26: fuera de rango, sin motivo o una cerrada, 400.
    expect((await pedir(ruta(suya), equipo, 'PUT', { puntaje: 21, motivo: 'x' })).estado).toBe(400)
    expect((await pedir(ruta(suya), equipo, 'PUT', { puntaje: -1, motivo: 'x' })).estado).toBe(400)
    expect((await pedir(ruta(suya), equipo, 'PUT', { puntaje: 10, motivo: '' })).estado).toBe(400)
    expect((await pedir(ruta(respuestaA(c.uno.postulacion, OU)), equipo, 'PUT', { puntaje: 1, motivo: 'x' })).estado).toBe(400)
    expect(deLaPregunta(await desglose(c.uno.postulacion), ABIERTA).obtenido).toBe(16)

    // AC-26: el candidato no ve ni la nota ni el ajuste.
    for (const ruta of [`/portal/postulaciones/${c.uno.uuid}`, `/portal/evaluacion/${c.uno.uuid}`, '/portal/postulaciones']) {
      const r = await fetch(`${API}${ruta}`, { headers: { Authorization: `Bearer ${c.uno.token}` } })
      const texto = await r.text()
      expect.soft(texto, ruta).not.toContain(MOTIVO)
      expect.soft(texto, ruta).not.toContain('"puntaje"')
      expect.soft(texto, ruta).not.toContain('notaEtapa')
    }
  })

  test('AC-26 · sin ajustar_nota el servidor contesta 403 y el botón no aparece', async ({ page }) => {
    const sinAjuste = await tokenDePanel(sembrarEquipoSin('sin-ajuste', ['ajustar_nota']))
    const r = await pedir(
      `/panel/postulaciones/${c.dos.postulacion}/evaluacion/respuestas/${respuestaA(c.dos.postulacion, ABIERTA)}/nota`,
      sinAjuste, 'PUT', { puntaje: 5, motivo: 'No debería' },
    )
    expect(r.estado).toBe(403)
    expect((await exigir(`/panel/postulaciones/${c.dos.postulacion}/evaluacion`, sinAjuste)).porPuntos.puedeAjustar).toBe(false)

    await entrarAlPanelCon(page, sinAjuste)
    const seccion = await abrirDesglose(page, 'Dos Preguntas QA')
    await expect(seccion).toContainText('Nota de las preguntas')
    await expect(seccion.getByRole('button', { name: /Ajustar nota|Calificar a mano/ })).toHaveCount(0)
  })

  test('AC-27 · calificar a mano la abierta que la IA no pudo escribe la nota y el grupo sin mover de etapa', async ({ page }) => {
    const estadoAntes = estadoDeLaPostulacion(c.tres.postulacion)
    expect((await filaDelRanking(c.tres.postulacion)).notaEtapa).toBeNull()

    await entrarAlPanel(page)
    const seccion = await abrirDesglose(page, 'Tres Preguntas QA')
    const abierta = seccion.getByRole('article').filter({ hasText: ABIERTA })
    await expect(abierta).toContainText('Pendiente de la IA.')
    await abierta.getByRole('button', { name: 'Calificar a mano' }).click()
    const form = abierta.getByRole('form', { name: 'Calificar a mano' })
    await form.getByLabel(/Nota nueva/).fill('5')
    await form.getByLabel(/Motivo/).fill('La IA no pudo calificarla; lo hago yo.')
    await form.getByRole('button', { name: 'Guardar la nota' }).click()
    await expect(seccion).toContainText('Nota de las preguntas: 10 de 100', { timeout: 20_000 })

    const d = await desglose(c.tres.postulacion)
    expect(d.completo).toBe(true)
    expect(deLaPregunta(d, ABIERTA)).toMatchObject({ obtenido: 5, puntajeIa: null, ajustada: true })
    const fila = await filaDelRanking(c.tres.postulacion)
    expect(fila.notaEtapa).not.toBeNull()
    expect(fila.grupoPrioridad).not.toBeNull()
    expect(estadoDeLaPostulacion(c.tres.postulacion)).toBe(estadoAntes)
  })

  test('AC-29 · con la IA apagada la guía no cambia y se dice en una ventana', async ({ page }) => {
    // Quien tiene nota de la IA sin ajustar (Dos) obliga a recalificar: sin IA, no se guarda nada.
    const antes = (await editorDe(equipo, vacante)).publicada
    const directo = await pedir(`${RUTA(vacante)}/publicada/instrucciones`, equipo, 'PUT', { guiaCalificacion: 'Guía que no entra' })
    expect(directo.estado).toBe(409)
    expect(JSON.stringify(directo.cuerpo)).toMatch(/IA está apagada|saldo|tope/)

    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${vacante}/preguntas`)
    await page.getByRole('button', { name: 'Corregir las instrucciones de la IA' }).click()
    const form = page.getByRole('form', { name: 'Corregir las instrucciones de la IA' })
    await form.getByLabel(/Guía de calificación para la IA/).fill('Guía que tampoco entra por la pantalla')
    await form.getByRole('button', { name: 'Guardar las instrucciones' }).click()
    await expect(page.getByRole('alertdialog', { name: 'Volver a calificar' })).toContainText('Las notas ajustadas a mano no cambian')
    await form.getByRole('button', { name: 'Sí, volver a calificar' }).click()
    const ventana = page.getByRole('dialog', { name: 'La IA no tiene saldo' })
    await expect(ventana).toBeVisible({ timeout: 20_000 })
    // Dice que no se guardó: con el mensaje del servidor («No se guardó el cambio…») o, si
    // el servidor no lo explica, con la frase propia de la ventana (QA-PP-09).
    await expect(ventana).toContainText(/no se guardó/i)

    const despues = (await editorDe(equipo, vacante)).publicada
    expect(despues.guiaCalificacion).toBe(antes.guiaCalificacion)
    expect(despues.versionGuia).toBe(antes.versionGuia)
  })

  test('AC-33/AC-28 · con una recalificación en curso los puntos y la guía no cambian, y se ve «Recalificando»', async ({ page }) => {
    const trabajo = sembrarRecalificacionEnCurso(c.dos.postulacion)
    const nota = respuestaA(c.dos.postulacion, ABIERTA)
    // Su nota es de la guía anterior: conserva la vieja hasta que llegue la nueva.
    sql(`update nota_respuesta set version_guia = version_guia - 1 where respuesta_id = ${nota};`)
    try {
      const puntos = await pedir(`${RUTA(vacante)}/publicada/puntos`, equipo, 'PUT', { preguntas: [] })
      expect(puntos.estado).toBe(409)
      const guia = await pedir(`${RUTA(vacante)}/publicada/instrucciones`, equipo, 'PUT', { guiaCalificacion: 'Otra guía' })
      expect(guia.estado).toBe(409)
      expect((await editorDe(equipo, vacante)).recalificacion.recalificando).toBe(1)

      await entrarAlPanel(page)
      await page.goto(`/admin/vacantes/${vacante}/preguntas`)
      await expect(page.getByRole('status').filter({ hasText: 'Recalificando con la guía nueva' })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('button', { name: 'Cambiar los puntos' })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Corregir las instrucciones de la IA' })).toBeDisabled()
      const seccion = await abrirDesglose(page, 'Dos Preguntas QA')
      await expect(seccion).toContainText('Recalificando con la guía nueva')
      await expect(seccion).toContainText('IA 10/20')
    } finally {
      sql(`update nota_respuesta set version_guia = version_guia + 1 where respuesta_id = ${nota};`)
      quitarTrabajo(trabajo)
    }
  })

  test('AC-32/AC-33 · arreglar la clave al revés recalcula a todos al instante, sin IA ni mover de etapa', async () => {
    const postulaciones = [c.uno.postulacion, c.dos.postulacion, c.tres.postulacion]
    const trabajosAntes = trabajosDeIaDe(postulaciones)
    const estadosAntes = postulaciones.map(estadoDeLaPostulacion)
    const cambio = (igv: number) => ({
      preguntas: [
        { id: pregunta(OU).id, puntos: 4, opciones: [{ id: opcion(OU, 'Libro mayor'), puntos: 0 }, { id: opcion(OU, 'Libro diario'), puntos: 4 }] },
        { id: pregunta(ABIERTA).id, puntos: 15 },
        { id: pregunta(IGV).id, puntos: igv, opciones: [{ id: opcion(IGV, '18 %'), puntos: igv }] },
      ],
    })

    // Si el total no queda en 100: 400 con la lista y no cambia nada.
    const mal = await pedir(`${RUTA(vacante)}/publicada/puntos`, equipo, 'PUT', cambio(56))
    expect(mal.estado).toBe(400)
    expect(JSON.stringify(mal.cuerpo.faltas)).toContain('faltan 5')
    expect((await desglose(c.uno.postulacion)).total).toBe(91)

    const bien = await exigir(`${RUTA(vacante)}/publicada/puntos`, equipo, 'PUT', cambio(61))
    expect(bien.personas).toBe(3)

    const [d1, d2, d3] = [await desglose(c.uno.postulacion), await desglose(c.dos.postulacion), await desglose(c.tres.postulacion)]
    // Quien marcó A pierde 4 y quien marcó B gana 4.
    expect(deLaPregunta(d1, OU).obtenido).toBe(0)
    expect(deLaPregunta(d2, OU).obtenido).toBe(4)
    // Las abiertas se escalan en proporción: la ajustada y la de la IA (12/20 → 9/15).
    expect(deLaPregunta(d1, ABIERTA)).toMatchObject({ obtenido: 12, puntajeIa: 9, maximo: 15, motivoAjuste: MOTIVO })
    expect(deLaPregunta(d2, ABIERTA)).toMatchObject({ obtenido: 7.5, maximo: 15 })
    expect(deLaPregunta(d3, ABIERTA)).toMatchObject({ obtenido: 3.75, maximo: 15 })
    expect([d1.total, d2.total, d3.total]).toEqual([88, 92.5, 4.75])
    for (const [d, p] of [[d1, c.uno], [d2, c.dos], [d3, c.tres]] as const) {
      expect(Number((await filaDelRanking(p.postulacion)).notaEtapa)).toBe(Number(d.total))
    }
    expect(postulaciones.map(estadoDeLaPostulacion)).toEqual(estadosAntes)
    expect(trabajosDeIaDe(postulaciones)).toBe(trabajosAntes)

    // AC-33: queda registrado con quién, cuándo y los puntos anteriores.
    const registros = auditoriasDe('cambiar_puntos_preguntas_propias', publicada.id)
    expect(registros).toHaveLength(1)
    const antes = JSON.parse(String(registros[0]!.antes))
    expect(antes[`pregunta ${pregunta(ABIERTA).id}`]).toBe(20)
    expect(antes[`pregunta ${pregunta(IGV).id}`]).toBe(56)
    expect(Number(antes[`opción ${opcion(OU, 'Libro mayor')}`])).toBe(4)
    expect(registros[0]!.usuario_id).not.toBeNull()
  })

  test('AC-29 · quien se quedó sin recalificar conserva su nota marcada, con el motivo, y «Reintentar» dice qué pasó', async ({ page }) => {
    const trabajo = sembrarRecalificacionFallida(c.dos.postulacion)
    const nota = respuestaA(c.dos.postulacion, ABIERTA)
    sql(`update nota_respuesta set version_guia = version_guia - 1 where respuesta_id = ${nota};`)
    try {
      const editor = await editorDe(equipo, vacante)
      expect(editor.recalificacion).toMatchObject({ pendientes: 1, recalificando: 0 })
      expect(editor.recalificacion.motivos.length).toBeGreaterThan(0)

      await entrarAlPanel(page)
      await page.goto(`/admin/vacantes/${vacante}/preguntas`)
      const aviso = page.getByRole('status').filter({ hasText: 'Pendiente de recalificar' })
      await expect(aviso).toContainText('1 persona conserva la nota de la guía anterior', { timeout: 20_000 })
      await expect(aviso).toContainText(editor.recalificacion.motivos[0])
      const seccion = await abrirDesglose(page, 'Dos Preguntas QA')
      await expect(seccion).toContainText('Pendiente de recalificar: conserva la nota de la guía anterior.')
      await expect(seccion).toContainText(/IA 7[,.]5\/15/)

      // «Reintentar» con la IA apagada: no se encola, y la pantalla no puede decir que no
      // quedaba nadie cuando la persona sigue pendiente (punto 18: se dice qué pasó).
      await page.goto(`/admin/vacantes/${vacante}/preguntas`)
      await page.getByRole('button', { name: 'Reintentar' }).click()
      const dicho = page.getByRole('status').filter({ hasText: /encolar|recalificaci|IA/ }).last()
      await expect(dicho).toBeVisible({ timeout: 20_000 })
      expect((await editorDe(equipo, vacante)).recalificacion.pendientes).toBe(1)
      await expect(page.getByText('No quedó nadie por volver a encolar.')).toHaveCount(0)
      await expect(page.getByText(/IA está apagada|saldo|tope/).first()).toBeVisible()
    } finally {
      sql(`update nota_respuesta set version_guia = version_guia + 1 where respuesta_id = ${nota};`)
      quitarTrabajo(trabajo)
    }
  })

  // Va la última del bloque serial: si falla, no deja sin correr a las demás.
  test('QA-PP-09 · la ventana «La IA no tiene saldo» dice una sola vez por qué no se guardó', async ({ page }) => {
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${vacante}/preguntas`)
    await page.getByRole('button', { name: 'Corregir las instrucciones de la IA' }).click()
    const form = page.getByRole('form', { name: 'Corregir las instrucciones de la IA' })
    await form.getByLabel(/Guía de calificación para la IA/).fill('Guía que no entra, para leer la ventana')
    await form.getByRole('button', { name: 'Guardar las instrucciones' }).click()
    await form.getByRole('button', { name: 'Sí, volver a calificar' }).click()
    const ventana = page.getByRole('dialog', { name: 'La IA no tiene saldo' })
    await expect(ventana).toBeVisible({ timeout: 20_000 })
    const texto = await ventana.innerText()
    // El motivo del servidor (IA apagada o tope) sí va; la explicación de por qué no se
    // guarda, una vez: hoy la pinta la ventana y la repite el mensaje del servidor.
    expect(texto).toMatch(/IA está apagada|tope|saldo/)
    expect(texto.match(/guardarlo sin recalificar/g) ?? [], texto).toHaveLength(1)
  })
})
