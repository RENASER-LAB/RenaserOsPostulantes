import { writeFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import { entrarAlPanel } from './ayuda'
import { test } from './ayuda-candidato'
import { limpiarSiempre } from './base-de-datos'
import { entrarAlPanelCon, entrarAlPortalCon, exigir, pedir, tokenDePanel, uno } from './ayuda-preguntas-propias'
import {
  cambiarCriterio,
  candidataEnLaPrueba,
  crearVacante,
  criterioDe,
  editorDe,
  empresaB,
  entregableDe,
  enVeinteDias,
  fijarFechaLimite,
  entregarLaPrueba,
  escribirPrueba,
  estadoDe,
  iniciarLaPrueba,
  intentoDe,
  lugarDe,
  notaDeLaEtapa,
  publicarPrueba,
  quitarTrabajo,
  responderLaPrueba,
  retirarLoSembrado,
  RUTA,
  sembrarEquipoSin,
  sembrarNotaDeLaIa,
  sembrarRecalificacionEnCurso,
  subirArchivo,
  titulo,
  trabajosDeIaDe,
  vencer,
  verLaPrueba,
  type Candidata,
} from './ayuda-prueba-propia'
import { excelPorLaApi, leerElLibro } from './ayuda-rubrica-vigente'

/**
 * QA de la prueba del puesto escrita en el editor (V67, fase 2): los siete
 * recorridos de la spec `prueba-del-puesto-con-el-editor`, con la IA simulada.
 *
 * En el preview la IA está apagada (sin broker): la nota que el agente habría
 * puesto a la parte calificada de un criterio se siembra como la guarda la red
 * de seguridad, y la recalificación en curso como la deja la cola. El reloj se
 * adelanta en la base; el barrido de 60 s del backend cierra el intento solo.
 *
 * La prueba de la vacante A (100 puntos):
 *   Conocimiento contable · 30 = opción única 4 + múltiple 6 + parte calificada 20 (IA; mira Tablero.xlsx, el archivo de su abierta)
 *   Manejo de Excel       · 20 = escala 10 + opción única 10
 *   Comunicación          · 50 = parte calificada 50 (persona; mira Video de 2 min, general de toda la prueba)
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira (marca QA-PE-0067).
 */

const OU = '¿Qué libro registra primero una venta al crédito?'
const MULTI = '¿Qué documentos sustentan una compra?'
const ABIERTA = '¿Cómo hallaste el descuadre?'
const ESCALA = '¿Cuánto dominas las tablas dinámicas?'
const OU2 = '¿Qué función busca un valor en una tabla?'
const ENUNCIADO = 'La empresa cerró marzo con un descuadre de S/ 1 250 entre el mayor y el banco. Encuentra la cuenta.'
const MOTIVO = 'El video explica el asiento con claridad, aunque se extiende.'

const correos: string[] = []
const trabajos: number[] = []
let equipo = ''
let vacanteA = 0
let vacanteB = 0
let vacanteC = 0
const quien: Record<'ana' | 'beto' | 'carla' | 'dani', Candidata> = {} as never

const NOMBRE_A = 'Asistente contable A'
const NOMBRE_B = 'Asistente contable B'
const NOMBRE_C = 'Plantilla de siempre'

const publicadaDe = async (vacante: number) => (await editorDe(equipo, vacante)).publicada
const pruebaDe = (postulacion: number) => exigir<any>(`/panel/postulaciones/${postulacion}/prueba-propia`, equipo)
const filaDe = async (vacante: number, postulacion: number) =>
  (await exigir<any>(`/panel/vacantes/${vacante}/ranking?etapa=PRUEBA_PUESTO`, equipo)).filas.find(
    (f: any) => f.postulacionId === postulacion,
  )

/** Espera al barrido de vencimientos (cada 60 s en el backend). */
async function esperarAlBarrido(postulaciones: number[]) {
  await expect
    .poll(
      () =>
        Number(
          uno(`select count(*) as n from intento_prueba
                where postulacion_id in (${postulaciones.join(',')}) and entregado_en is not null`).n,
        ),
      { timeout: 100_000, intervals: [2_000] },
    )
    .toBe(postulaciones.length)
}

/** Responder por la API, todo o una parte. */
async function responderPorApi(c: Candidata, que: { ou?: string; multi?: string[]; abierta?: string; nivel?: number; ou2?: string }) {
  const p = (await iniciarLaPrueba(c)).cuerpo
  const q = (t: string) => p.preguntas.find((x: any) => x.enunciado === t)
  const op = (t: string, o: string) => q(t).opciones.find((x: any) => x.texto === o).id
  if (que.ou) expect((await responderLaPrueba(c, q(OU).id, { opcionId: op(OU, que.ou) })).estado).toBe(200)
  if (que.multi) {
    expect((await responderLaPrueba(c, q(MULTI).id, { marcadas: que.multi.map((m) => op(MULTI, m)) })).estado).toBe(200)
  }
  if (que.abierta) expect((await responderLaPrueba(c, q(ABIERTA).id, { texto: que.abierta })).estado).toBe(200)
  if (que.nivel !== undefined) {
    expect((await responderLaPrueba(c, q(ESCALA).id, { opcionId: q(ESCALA).opciones[que.nivel].id })).estado).toBe(200)
  }
  if (que.ou2) expect((await responderLaPrueba(c, q(OU2).id, { opcionId: op(OU2, que.ou2) })).estado).toBe(200)
  return p
}

test.describe('La prueba del puesto escrita en el editor', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    equipo = await tokenDePanel()
    const lugar = await lugarDe(equipo)
    vacanteA = await crearVacante(equipo, NOMBRE_A, lugar)
    vacanteB = await crearVacante(equipo, NOMBRE_B, lugar)
    // La evaluación del banco apagada: quien postula va directo a la bandeja y su única
    // evaluación es la prueba.
    for (const v of [vacanteA, vacanteB]) {
      await exigir(`/panel/vacantes/${v}/aplicacion-evaluacion`, equipo, 'POST', { aplica: false })
    }
  })

  test.afterAll(async () => {
    await limpiarSiempre([
      () => trabajos.forEach(quitarTrabajo),
      () => retirarLoSembrado(correos),
    ])
  })

  test('recorrido 1: la vacante nueva arma su prueba en el editor y sin ella no se publica (AC-01..AC-05)', async ({ page }) => {
    // AC-01/AC-02: nace con la prueba del editor, también en RENASER
    expect((await exigir<any>(`/panel/vacantes/${vacanteA}`, equipo)).instrumentoEtapaTecnica).toBe('PRUEBA_PROPIA')
    // AC-03: el servidor no publica la vacante sin prueba publicada
    const sinPrueba = await pedir(`/panel/vacantes/${vacanteA}/publicacion`, equipo, 'POST')
    expect(sinPrueba.estado).toBe(409)
    expect(JSON.stringify(sinPrueba.cuerpo)).toContain('prueba técnica')

    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${vacanteA}`)
    const bloque = page.getByRole('group', { name: 'Prueba técnica' })
    await expect(bloque).toContainText('Sin prueba', { timeout: 20_000 })
    await expect(bloque.getByRole('link', { name: 'Armar la prueba →' })).toBeVisible()
    for (const viejo of ['Qué rendirá en la etapa técnica', 'Qué prueba del puesto rendirá', 'Cuánto tiempo tendrá']) {
      await expect(bloque).not.toContainText(viejo)
    }
    await expect(page.getByRole('link', { name: /Preparar la prueba técnica/ })).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Pesos de la decisión' })).toBeVisible()
    // El checklist y el botón miran la misma regla: no dice «Todo listo»
    await expect(page.getByRole('button', { name: 'Publicar en el portal' })).toBeDisabled()
    await expect(page.locator('main')).toContainText('publicar su prueba técnica')
    await expect(page.locator('main')).not.toContainText('Todo listo')

    // El editor vacío (V68): el caso plegado, los criterios, la guía y los generales
    await page.goto(`/admin/vacantes/${vacanteA}/prueba`)
    await expect(page.getByRole('region', { name: 'Balance de la prueba' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Agregar un caso' })).toBeVisible()
    await expect(page.locator('main')).not.toContainText(/cuestionario/i)

    // Por la API, con cuatro faltas: 90 puntos, un general que nadie califica, un criterio
    // de IA que solo mira un enlace y sin fecha límite. Sin enunciado: no es falta (V68).
    await escribirPrueba(equipo, vacanteA, {
      criterios: [
        {
          nombre: 'Conocimiento contable', queEvalua: 'Domina el registro y el cierre.',
          puntosCalificados: 20, calificador: 'IA',
          preguntas: [
            { tipo: 'OPCION_UNICA', enunciado: OU, puntos: 4, opciones: [{ texto: 'Libro diario', puntos: 4 }, { texto: 'Libro mayor', puntos: 0 }, { texto: 'Caja', puntos: 0 }] },
            { tipo: 'OPCION_MULTIPLE', enunciado: MULTI, puntos: 6, opciones: [{ texto: 'Factura', puntos: 3 }, { texto: 'Guía de remisión', puntos: 3 }, { texto: 'Recibo de luz', puntos: 0 }] },
            { tipo: 'ABIERTA', enunciado: ABIERTA, queDebeTener: 'La cuenta y el monto.' },
          ],
        },
        {
          nombre: 'Manejo de Excel', queEvalua: 'Usa Excel con soltura.',
          preguntas: [
            { tipo: 'ESCALA', enunciado: ESCALA, puntos: 10, opciones: [{ texto: null, puntos: 0 }, { texto: null, puntos: 5 }, { texto: null, puntos: 10 }] },
            { tipo: 'OPCION_UNICA', enunciado: OU2, puntos: 10, opciones: [{ texto: 'BUSCARV', puntos: 10 }, { texto: 'SUMA', puntos: 0 }] },
          ],
        },
        { nombre: 'Comunicación', queEvalua: 'Explica con claridad.', puntosCalificados: 40, calificador: 'IA', preguntas: [] },
      ],
      entregables: [
        { nombre: 'Tablero.xlsx', detalle: 'La conciliación de marzo', formato: 'ARCHIVO', obligatorio: true, de: ABIERTA },
        { nombre: 'Video de 2 min', formato: 'ENLACE', obligatorio: false, todaLaPrueba: true },
        { nombre: 'Informe.pdf', formato: 'ARCHIVO', obligatorio: false, cubre: [OU2] },
      ],
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 90, herramientasPermitidas: 'Excel' },
      fechaLimite: null,
    })
    const conFaltas = await publicarPrueba(equipo, vacanteA)
    expect(conFaltas.estado).toBe(400)
    const faltas: string[] = conFaltas.cuerpo.faltas
    expect(faltas).toHaveLength(4)
    expect(faltas.some((f) => f.includes('suman 90 de 100'))).toBe(true)
    expect(faltas.some((f) => f.includes('«Informe.pdf»: nadie lo califica'))).toBe(true)
    expect(faltas.some((f) => f.includes('«Comunicación» lo califica la IA y solo mira enlaces'))).toBe(true)
    expect(faltas.some((f) => f.includes('Falta la fecha límite'))).toBe(true)
    expect((await editorDe(equipo, vacanteA)).publicada).toBeNull()

    // El panel lee la misma lista como botones, y la línea del criterio mixto (AC-05)
    await page.reload()
    const cabecera = page.getByRole('region', { name: 'Balance de la prueba' })
    await expect(cabecera.getByRole('list', { name: 'Lo que frena la publicación' }).getByRole('button')).toHaveCount(4, { timeout: 20_000 })
    await cabecera.getByRole('button', { name: 'Publicar la prueba' }).click()
    await expect(page.getByRole('alert').getByText('Faltan 4 cosas:')).toBeVisible()
    await expect(page.getByText('30 pts (sistema 10 + IA 20)')).toBeVisible()
    await expect(page.getByText('20 pts (sistema 20)')).toBeVisible()
    // «Mira» lo deduce el sistema: el archivo de su pregunta y el general de toda la prueba
    const conocimiento = page.getByRole('region', { name: 'Criterio Conocimiento contable' })
    await conocimiento.getByRole('button', { name: 'Conocimiento contable', exact: true }).click()
    await expect(conocimiento).toContainText('Tablero.xlsx (pregunta 3) · Video de 2 min (general)')
    // Una abierta no tiene campo de puntos
    await conocimiento.getByRole('button', { name: 'Agregar pregunta', exact: true }).click()
    const pregunta = page.getByRole('form', { name: 'Pregunta nueva' })
    await expect(pregunta.getByRole('combobox', { name: 'Tipo' })).toHaveValue('ABIERTA')
    await expect(pregunta.getByRole('spinbutton', { name: 'Puntos' })).toHaveCount(0)
    await pregunta.getByRole('combobox', { name: 'Tipo' }).selectOption('OPCION_UNICA')
    await expect(pregunta.getByRole('spinbutton', { name: 'Puntos' }).first()).toBeVisible()
    await pregunta.getByRole('button', { name: 'Cancelar' }).click()

    // Se corrigen las tres del contenido y la fecha se pone desde la configuración
    const editor = await editorDe(equipo, vacanteA)
    await exigir(`${RUTA(vacanteA)}/entregables/${entregableDe(editor, 'Informe.pdf')}`, equipo, 'DELETE')
    await cambiarCriterio(equipo, vacanteA, 'Comunicación', { puntosCalificados: 50, calificador: 'PERSONA' })
    await exigir(`${RUTA(vacanteA)}/borrador`, equipo, 'PUT', {
      enunciado: ENUNCIADO, herramientasPermitidas: 'Excel', modalidad: 'CRONOMETRADA', duracionMinutos: 90,
    })
    await page.reload()
    await page.getByRole('button', { name: /Falta la fecha límite para dar la prueba/ }).click()
    const configuracion = page.getByRole('dialog', { name: 'Configuración de la prueba' })
    const fecha = configuracion.getByLabel('Fecha límite para dar la prueba')
    await expect(fecha).toBeFocused()
    await fecha.fill(new Date(Date.now() + 20 * 24 * 3_600_000 - 5 * 3_600_000).toISOString().slice(0, 16))
    await configuracion.getByRole('button', { name: 'Listo' }).click()
    await expect(configuracion).toHaveCount(0, { timeout: 20_000 })
    await expect(page.getByText('100 de 100 pts').first()).toBeVisible({ timeout: 20_000 })
    // Doble clic: no crea dos versiones
    await page.getByRole('button', { name: 'Publicar la prueba' }).dblclick()
    await expect(page.getByText(/^Publicada\./)).toBeVisible({ timeout: 20_000 })
    expect(
      Number(uno(`select count(*) as n from version_banco where vacante_id = ${vacanteA} and proposito = 'PRUEBA_PUESTO'`).n),
    ).toBe(1)

    // El bloque de la vacante y su publicación
    await page.goto(`/admin/vacantes/${vacanteA}`)
    await expect(page.getByRole('group', { name: 'Prueba técnica' })).toContainText(
      'Publicada · 3 criterios · 2 entregables · 90 min', { timeout: 20_000 })
    await page.getByRole('button', { name: 'Publicar en el portal' }).click()
    await expect(page.locator('main')).toContainText('Publicada el', { timeout: 20_000 })
  })

  test('recorrido 7 (panel): la vacante existente con PLANTILLA sigue con su bloque de siempre (AC-01, AC-27)', async ({ page }) => {
    const existente = Number(uno(`select id from vacante where instrumento_etapa_tecnica = 'PLANTILLA'
                                    and eliminada_en is null and titulo not like 'QA-%' order by id limit 1`).id)
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${existente}`)
    await page.getByRole('button', { name: 'Configuración de la vacante' }).click()
    const bloque = page.getByRole('group', { name: 'Prueba técnica' })
    await expect(bloque.getByRole('combobox', { name: /Qué rendirá en la etapa técnica/ })).toBeVisible({ timeout: 20_000 })
    await expect(bloque.getByRole('combobox', { name: 'Qué prueba del puesto rendirá' })).toBeVisible()
    await expect(bloque.getByRole('spinbutton', { name: /Cuánto tiempo tendrá/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Preparar la prueba técnica →' })).toBeVisible()
    await expect(bloque.getByRole('link', { name: 'Armar la prueba →' })).toHaveCount(0)
  })

  test('recorrido 2: la candidata rinde con reloj, no entrega con huecos y entrega completa (AC-08..AC-10)', async ({ page }) => {
    quien.ana = await candidataEnLaPrueba(equipo, vacanteA, 'Ana', correos)
    expect(estadoDe(quien.ana.postulacion)).toBe('PRUEBA_TURNO_CANDIDATO')

    // AC-08: la API del portal no trae puntos, claves, criterios ni calificadores
    const vista = await verLaPrueba(quien.ana)
    expect(vista.estado).toBe(200)
    const crudo = JSON.stringify(vista.cuerpo)
    expect(crudo).not.toMatch(/puntos|puntaje|criterio|calificador|queDebeTener|correcta/i)
    expect(vista.cuerpo.delEditor).toBe(true)
    expect(vista.cuerpo.cuestionario).toBe(false)
    // AC-09: sin cambio inesperado
    expect(vista.cuerpo.cambioTexto ?? null).toBeNull()

    await entrarAlPortalCon(page, quien.ana.token)
    await page.goto(`/procesos/${quien.ana.uuid}/prueba`)
    await expect(page.getByRole('heading', { name: 'Demuestra cómo trabajas.' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(ENUNCIADO)).toBeVisible()
    await expect(page.getByText('Tendrás 90 minutos desde que pulses Empezar')).toBeVisible()
    await expect(page.getByText('Fecha límite', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Empezar prueba' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Sí, empezar' }).click()
    await expect(page.getByText('Tiempo restante')).toBeVisible({ timeout: 20_000 })

    // Los cuatro tipos, con los mismos componentes que la evaluación
    await expect(page.getByRole('group', { name: `Pregunta 1 · ${OU}` }).getByRole('radio')).toHaveCount(3)
    await expect(page.getByRole('group', { name: `Pregunta 2 · ${MULTI}` }).getByRole('checkbox')).toHaveCount(3)
    await expect(page.getByRole('textbox', { name: `Pregunta 3 · ${ABIERTA}` })).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Niveles, del menor al mayor' }).getByRole('radio')).toHaveCount(3)
    await expect(page.getByText(/cambio inesperado/i)).toHaveCount(0)

    // Dos sin responder (una abierta con solo espacios) y sin el obligatorio: no se entrega
    await page.getByText('a. Libro diario', { exact: true }).click()
    await page.getByText('Factura', { exact: true }).click()
    await page.getByText('Guía de remisión', { exact: true }).click()
    await page.getByRole('textbox', { name: `Pregunta 3 · ${ABIERTA}` }).fill('     ')
    await page.getByRole('radiogroup', { name: 'Niveles, del menor al mayor' }).getByText('3', { exact: true }).click()
    await expect(page.getByText('Guardado.')).toHaveCount(3, { timeout: 15_000 })
    await page.getByRole('button', { name: 'Entregar prueba' }).click()
    const falta = page.getByRole('alert').filter({ hasText: 'Para entregar te falta' })
    await expect(falta).toContainText('responder 2 preguntas (la 3 y la 5)')
    await expect(falta).toContainText('Te falta subir «Tablero.xlsx»')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await falta.getByRole('button', { name: 'Ir a la pregunta 3' }).click()
    await expect(page.getByRole('textbox', { name: `Pregunta 3 · ${ABIERTA}` })).toBeFocused()

    // Y el servidor tampoco, llamado directamente
    const directa = await entregarLaPrueba(quien.ana)
    expect(directa.estado).toBe(400)
    expect(directa.cuerpo.faltas).toEqual([
      'Falta responder la pregunta 3.', 'Falta responder la pregunta 5.', 'Falta subir «Tablero.xlsx».',
    ])

    // Se completa y se entrega
    await page.getByRole('textbox', { name: `Pregunta 3 · ${ABIERTA}` }).fill('En la cuenta 1041 había un depósito duplicado de S/ 1 250.')
    await page.getByText('a. BUSCARV', { exact: true }).click()
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'tablero.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 la conciliación'),
    })
    await expect(page.getByText('Recibimos tablero.pdf')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Guardado.')).toHaveCount(5, { timeout: 15_000 })
    await page.getByRole('button', { name: 'Entregar prueba' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Entregar', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/procesos/${quien.ana.uuid}$`), { timeout: 20_000 })
    expect(estadoDe(quien.ana.postulacion)).toBe('PRUEBA_CALIFICANDO')
    expect(notaDeLaEtapa(quien.ana.postulacion)).toBeNull()
  })

  test('recorrido 3: la IA (simulada) y una persona completan la rúbrica; nota de la etapa y «por confirmar» (AC-12..AC-17, AC-25)', async ({ page }) => {
    const pub = await publicadaDe(vacanteA)
    const c1 = criterioDe(pub, 'Conocimiento contable').id as number
    const c2 = criterioDe(pub, 'Manejo de Excel').id as number
    const c3 = criterioDe(pub, 'Comunicación').id as number

    // AC-15: las cerradas ya cuentan; el mixto está pendiente y el de persona en blanco
    let fila = await filaDe(vacanteA, quien.ana.postulacion)
    const nota = (id: number) => fila.notasCriterio.find((n: any) => n.clave === `prueba:${id}`)
    expect(nota(c1)).toMatchObject({ estado: 'PENDIENTE', puntaje: null, maximo: 30 })
    expect(nota(c2)).toMatchObject({ estado: 'CALIFICADO', puntaje: 20, maximo: 20 })
    expect(nota(c3)).toMatchObject({ estado: 'EN_BLANCO', puntaje: null, maximo: 50 })
    expect(fila.notaEtapa ?? null).toBeNull()

    // La IA (simulada) califica su parte del criterio mixto
    sembrarNotaDeLaIa(quien.ana.postulacion, c1, 16, pub.versionGuia)
    const ficha = await pruebaDe(quien.ana.postulacion)
    expect(ficha.nota).toBeNull()
    expect(ficha.criterios.find((c: any) => c.criterioId === c1)).toMatchObject({ sistema: 10, calificada: 16, nota: 26 })

    // AC-17: los límites del ajuste
    const ajuste = (criterio: number) => `/panel/postulaciones/${quien.ana.postulacion}/prueba-propia/criterios/${criterio}/nota`
    expect((await pedir(ajuste(c3), equipo, 'PUT', { puntaje: 51, motivo: MOTIVO })).estado).toBe(400)
    expect((await pedir(ajuste(c3), equipo, 'PUT', { puntaje: 20, motivo: '   ' })).estado).toBe(400)
    expect((await pedir(ajuste(c2), equipo, 'PUT', { puntaje: 10, motivo: MOTIVO })).estado).toBe(400)
    const sinPermiso = await tokenDePanel(sembrarEquipoSin('sin-ajustar', ['ajustar_nota']))
    expect((await pedir(ajuste(c3), sinPermiso, 'PUT', { puntaje: 20, motivo: MOTIVO })).estado).toBe(403)
    expect(notaDeLaEtapa(quien.ana.postulacion)).toBeNull()

    // La ficha: el desglose y el de persona por calificar
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${vacanteA}`)
    await page.getByRole('tab', { name: /Prueba del puesto/ }).click()
    await page.getByRole('button', { name: /Toda la tanda/ }).first().click()
    await page.getByRole('row').filter({ hasText: 'Ana Prueba Editor QA' }).getByRole('button', { name: /Ana Prueba Editor QA/ }).click()
    const prueba = page.getByRole('row').filter({ hasText: 'La prueba técnica, criterio a criterio' }).first()
    await expect(prueba).toContainText('Conocimiento contable · Sistema 10/10 + IA 16/20', { timeout: 20_000 })
    await expect(prueba).toContainText('Manejo de Excel · Sistema 20/20')
    await expect(prueba).toContainText('Libro diario (4 pts) · la marcó')
    await expect(prueba).toContainText('3 (10 pts) · la marcó')
    await expect(prueba).toContainText('Falta «Comunicación»: la califica una persona.')
    await expect(prueba).toContainText('tablero.pdf')

    await prueba.getByRole('button', { name: 'Calificar a mano Comunicación' }).click()
    await prueba.getByRole('spinbutton', { name: /Parte calificada \(persona\)/ }).fill('35')
    await prueba.getByRole('textbox', { name: 'Motivo · queda registrado' }).fill(MOTIVO)
    await prueba.getByRole('button', { name: 'Guardar la nota' }).click()
    await expect(prueba).toContainText('Nota de la prueba: 81 de 100', { timeout: 20_000 })
    await expect(prueba).toContainText('Comunicación · Persona 35/50')
    // AC-16: era lo último; nota de la etapa y «por confirmar»
    expect(notaDeLaEtapa(quien.ana.postulacion)).toBe(81)
    expect(estadoDe(quien.ana.postulacion)).toBe('PRUEBA_POR_CONFIRMAR')
  })

  test('recorrido 6: vencer con huecos deja la prueba sin completar; con todo, se entrega sola (AC-11)', async ({ page }) => {
    // El barrido de vencimientos pasa cada 60 s: esperarlo no cabe en los 60 s por defecto.
    test.setTimeout(180_000)
    quien.beto = await candidataEnLaPrueba(equipo, vacanteA, 'Beto', correos)
    quien.carla = await candidataEnLaPrueba(equipo, vacanteA, 'Carla', correos)
    await responderPorApi(quien.beto, { ou: 'Caja' })
    const p = await responderPorApi(quien.carla, {
      ou: 'Libro mayor', multi: ['Factura'], abierta: 'Crucé el banco con el mayor.', nivel: 1, ou2: 'SUMA',
    })
    expect(await subirArchivo(quien.carla, p.entregables.find((e: any) => e.nombre === 'Tablero.xlsx').id)).toBe(200)
    vencer(quien.beto.postulacion)
    vencer(quien.carla.postulacion)
    await esperarAlBarrido([quien.beto.postulacion, quien.carla.postulacion])

    // Con todo respondido: entregada sola
    expect(uno(`select no_completada, es_entrega_automatica from intento_prueba where postulacion_id = ${quien.carla.postulacion}`))
      .toEqual({ no_completada: false, es_entrega_automatica: true })
    expect(estadoDe(quien.carla.postulacion)).toBe('PRUEBA_CALIFICANDO')
    // Con huecos: «no completada», sin IA, sin nota y sin moverse de etapa
    expect(uno(`select no_completada from intento_prueba where postulacion_id = ${quien.beto.postulacion}`).no_completada).toBe(true)
    expect(estadoDe(quien.beto.postulacion)).toBe('PRUEBA_TURNO_CANDIDATO')
    expect(notaDeLaEtapa(quien.beto.postulacion)).toBeNull()
    expect(trabajosDeIaDe([quien.beto.postulacion])).toBe(0)
    expect((await entregarLaPrueba(quien.beto)).estado).toBe(409)

    // No sale en el ranking ni en su Excel
    const ranking = await exigir<any>(`/panel/vacantes/${vacanteA}/ranking?etapa=PRUEBA_PUESTO`, equipo)
    expect(ranking.filas.map((f: any) => f.postulacionId)).not.toContain(quien.beto.postulacion)
    const ruta = test.info().outputPath('ranking-prueba.xlsx')
    writeFileSync(ruta, await excelPorLaApi(vacanteA, 'PRUEBA_PUESTO',
      [quien.ana.postulacion, quien.beto.postulacion, quien.carla.postulacion]))
    const libro = leerElLibro(ruta)
    expect(libro.filas.flat().join(' ')).not.toContain('Beto')
    expect(libro.filas.flat().join(' ')).toContain('Ana')

    // El portal se lo dice
    await entrarAlPortalCon(page, quien.beto.token)
    await page.goto(`/procesos/${quien.beto.uuid}/prueba`)
    await expect(page.getByRole('heading', { name: 'Tu tiempo terminó y la prueba quedó sin completar.' })).toBeVisible({ timeout: 20_000 })

    // La lista «No completaron la prueba» y el cierre de su proceso desde ahí
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${vacanteA}`)
    await page.getByRole('tab', { name: /Prueba del puesto/ }).click()
    await page.getByRole('button', { name: /Toda la tanda/ }).first().click()
    await expect(page.getByRole('row').filter({ hasText: 'Beto Prueba Editor QA' })).toHaveCount(0)
    const lista = page.locator('details').filter({ hasText: 'No completaron la prueba (1)' })
    await lista.locator('summary').click()
    await expect(lista).toContainText('Beto Prueba Editor QA · le faltaron 4 preguntas y «Tablero.xlsx»')
    await lista.getByRole('button', { name: 'Cerrar su proceso' }).click()
    const dialogo = page.getByRole('dialog')
    await dialogo.getByRole('checkbox').uncheck()
    await dialogo.getByRole('textbox', { name: 'Por qué no continúa' }).fill('No completó la prueba técnica en su tiempo.')
    await dialogo.getByRole('button', { name: 'Descartar sin avisar' }).click()
    await expect(lista).toContainText('Descartada, sin avisar', { timeout: 20_000 })
    expect(estadoDe(quien.beto.postulacion)).toBe('NO_CONTINUA')
  })

  test('recorrido 5: con candidatas dentro, el contenido se congela y se cambian puntos y guía (AC-07, AC-18, AC-19, AC-24)', async ({ page }) => {
    // AC-07: desde la primera rendición no hay borrador ni otra publicación
    expect((await pedir(`${RUTA(vacanteA)}/borrador`, equipo, 'POST')).estado).toBe(409)
    expect((await publicarPrueba(equipo, vacanteA)).estado).toBe(409)

    // AC-19: la parte calificada de 50 con un 35 pasa a 40 (y otro criterio sube 10): 28 de 40
    const pub = await publicadaDe(vacanteA)
    const c1 = criterioDe(pub, 'Conocimiento contable').id as number
    const c3 = criterioDe(pub, 'Comunicación').id as number
    const ou2 = criterioDe(pub, 'Manejo de Excel').preguntas.find((q: any) => q.enunciado === OU2)
    const cambio = await pedir(`${RUTA(vacanteA)}/publicada/puntos`, equipo, 'PUT', {
      preguntas: [{ id: ou2.id, puntos: 20, opciones: ou2.opciones.map((o: any) => ({ id: o.id, puntos: o.texto === 'BUSCARV' ? 20 : 0 })) }],
      // «Comunicación» no tiene cerradas: vale lo que su parte calificada (V69)
      criterios: [{ id: c3, puntos: 40 }],
    })
    expect(cambio.estado).toBe(200)
    const ana = await pruebaDe(quien.ana.postulacion)
    expect(ana.criterios.find((c: any) => c.criterioId === c3)).toMatchObject({ calificada: 28, calificadaMaximo: 40 })
    expect(Number(ana.nota)).toBe(84)
    expect(notaDeLaEtapa(quien.ana.postulacion)).toBe(84)
    expect(estadoDe(quien.ana.postulacion)).toBe('PRUEBA_POR_CONFIRMAR')
    expect(trabajosDeIaDe([quien.ana.postulacion, quien.carla.postulacion])).toBe(0)

    // AC-18: Carla tiene nota de la IA; corregir la guía con la IA apagada sale en la ventana y no guarda
    sembrarNotaDeLaIa(quien.carla.postulacion, c1, 12, pub.versionGuia)
    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${vacanteA}/prueba`)
    await page.getByRole('button', { name: 'Corregir las instrucciones de la IA' }).click()
    const form = page.getByRole('form', { name: 'Corregir las instrucciones de la IA' })
    await form.getByRole('textbox', { name: /Guía de calificación/ }).fill('Premia que nombre la cuenta y el monto.')
    await form.getByRole('button', { name: 'Guardar las instrucciones' }).click()
    await expect(page.getByRole('alertdialog', { name: 'Volver a calificar' })).toBeVisible()
    await page.getByRole('button', { name: 'Sí, volver a calificar' }).click()
    await expect(page.getByRole('dialog')).toContainText('No se guardó el cambio', { timeout: 20_000 })
    expect(Number(uno(`select version_guia from version_banco where id = ${pub.id}`).version_guia)).toBe(pub.versionGuia)

    // AC-24: «Recalificando con la guía nueva» en la fila afectada, en la API y en el panel
    trabajos.push(sembrarRecalificacionEnCurso(quien.carla.postulacion))
    expect((await filaDe(vacanteA, quien.carla.postulacion)).recalificando).toBe(true)
    expect((await filaDe(vacanteA, quien.ana.postulacion)).recalificando).toBe(false)
    await page.goto(`/admin/vacantes/${vacanteA}`)
    await page.getByRole('tab', { name: /Prueba del puesto/ }).click()
    await page.getByRole('button', { name: /Toda la tanda/ }).first().click()
    await expect(page.getByRole('row').filter({ hasText: 'Carla Prueba Editor QA' })).toContainText('Recalificando con la guía nueva')
    await expect(page.getByRole('row').filter({ hasText: 'Ana Prueba Editor QA' })).not.toContainText('Recalificando')
  })

  test('recorrido 4: otra vacante copia la prueba con su caso, tiempo y entregables (AC-20, AC-22)', async ({ page }) => {
    const copiables = await exigir<any[]>(`${RUTA(vacanteB)}/copiables`, equipo)
    expect(copiables.map((c) => c.vacanteId)).toContain(vacanteA)
    const previa = await exigir<any>(`${RUTA(vacanteB)}/copiables/${vacanteA}`, equipo)
    expect(previa.prueba.enunciado).toBe(ENUNCIADO)
    expect(previa.prueba.duracionMinutos).toBe(90)
    expect(previa.prueba.entregables.map((e: any) => e.nombre)).toEqual(['Tablero.xlsx', 'Video de 2 min'])

    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${vacanteB}/prueba`)
    await page.getByRole('button', { name: 'Copiar de otra vacante' }).click()
    const dialogo = page.getByRole('dialog')
    await dialogo.getByText(titulo(NOMBRE_A)).click()
    await expect(dialogo).toContainText('Tablero.xlsx', { timeout: 20_000 })
    await expect(dialogo).toContainText('90 min')
    await expect(dialogo).toContainText(ENUNCIADO)
    await dialogo.getByRole('button', { name: 'Copiar esta prueba' }).click()
    // El alcance viaja con la copia (el archivo, en su pregunta; el general, en los generales)
    // y la fecha límite no: es de la vacante (AC-14).
    await expect(page.getByRole('region', { name: /Entregables generales/ })).toContainText('Video de 2 min', { timeout: 20_000 })
    await expect(page.getByRole('region', { name: /Entregables generales/ })).toContainText('Cubre: toda la prueba')
    await expect(page.getByRole('region', { name: 'Criterio Conocimiento contable' })).toContainText('· 3 preguntas · 1 archivo')
    await expect(page.getByText('30 pts (sistema 10 + IA 20)')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Balance de la prueba' })).toContainText('90 min · falta la fecha límite')
    await page.getByRole('button', { name: 'Ver el caso' }).click()
    await expect(page.getByRole('textbox', { name: /^Enunciado/ })).toHaveValue(ENUNCIADO)

    // Otra empresa no la ve ni la copia
    const b = await empresaB(correos)
    expect((await pedir(`${RUTA(vacanteA)}`, b.token)).estado).toBe(404)
    expect((await pedir(`${RUTA(vacanteA)}/copia`, b.token, 'POST', { vacanteOrigenId: vacanteA })).estado).toBe(404)

    // AC-22: «Comunicación» en dos vacantes son dos columnas distintas, por id. La copia
    // no trajo la fecha: se le pone la suya antes de publicar.
    expect((await fijarFechaLimite(equipo, vacanteB, enVeinteDias())).estado).toBe(200)
    expect((await publicarPrueba(equipo, vacanteB)).estado).toBe(200)
    await exigir(`/panel/vacantes/${vacanteB}/publicacion`, equipo, 'POST')
    quien.dani = await candidataEnLaPrueba(equipo, vacanteB, 'Dani', correos)
    const deA = criterioDe(await publicadaDe(vacanteA), 'Comunicación').id
    const deB = criterioDe(await publicadaDe(vacanteB), 'Comunicación').id
    expect(deA).not.toBe(deB)
    const claves = (await filaDe(vacanteB, quien.dani.postulacion)).notasCriterio.map((n: any) => n.clave)
    expect(claves).toContain(`prueba:${deB}`)
    expect(claves).not.toContain(`prueba:${deA}`)
  })

  test('sin editar_vacante el editor se ve en lectura; la personalización del banco y de las pruebas ya no existe (AC-26, AC-28)', async ({ page }) => {
    const lector = sembrarEquipoSin('lectura', ['editar_vacante', 'ajustar_nota'])
    const token = await tokenDePanel(lector)
    expect((await editorDe(token, vacanteB)).puedeEditar).toBe(false)
    expect((await pedir(`${RUTA(vacanteB)}/criterios`, token, 'POST', { nombre: 'X' })).estado).toBe(403)
    await entrarAlPanelCon(page, token)
    await page.goto(`/admin/vacantes/${vacanteA}/prueba`)
    await expect(page.getByText('La ves en lectura: cambiarla pide el permiso de editar esta vacante.').first()).toBeVisible({ timeout: 20_000 })
    // AC-23 (V68): ningún botón que acabe en 403; la configuración se abre en lectura.
    const main = page.locator('main')
    for (const nombre of ['Publicar la prueba', 'Abrir un borrador', 'Cambiar los puntos', 'Corregir las instrucciones de la IA', 'Agregar criterio']) {
      await expect(main.getByRole('button', { name: nombre })).toHaveCount(0)
    }
    await main.getByRole('button', { name: 'Configuración', exact: true }).click()
    const configuracion = page.getByRole('dialog', { name: 'Configuración de la prueba' })
    await expect(configuracion.getByLabel('Fecha límite para dar la prueba')).not.toBeEditable()
    await configuracion.getByRole('button', { name: 'Guía: Tiempo' }).hover()
    await expect(configuracion.getByRole('tooltip')).toContainText(/^Cronometrada: .*desde que la abre, nunca después de la fecha límite\. Sin cronómetro: hasta la fecha límite\.$/)

    // AC-26: encender o apagar, desde la empresa o desde la plataforma: 400 y nada cambia
    const b = await empresaB(correos)
    const antes = await exigir<any>('/panel/organizacion/personalizacion', b.token)
    for (const instrumento of ['BANCO', 'PRUEBA']) {
      const encender = await pedir('/panel/organizacion/personalizacion', b.token, 'POST', { instrumento })
      expect(encender.estado).toBe(400)
      expect(JSON.stringify(encender.cuerpo)).toContain('Esta personalización ya no existe')
      expect((await pedir(`/panel/organizacion/personalizacion/${instrumento}`, b.token, 'DELETE')).estado).toBe(400)
      expect((await pedir(`/panel/plataforma/empresas/${b.id}/personalizacion/${instrumento}`, equipo, 'POST', { motivo: 'QA: comprobar que ya no existe' })).estado).toBe(400)
      expect((await pedir(`/panel/plataforma/empresas/${b.id}/personalizacion/${instrumento}`, equipo, 'DELETE', { motivo: 'QA: comprobar que ya no existe' })).estado).toBe(400)
    }
    const despues = await exigir<any>('/panel/organizacion/personalizacion', b.token)
    expect(despues.bancoPropio).toBe(antes.bancoPropio)
    expect(despues.pruebasPuestoPropias).toBe(antes.pruebasPuestoPropias)
    expect(Number(uno(`select count(*) as n from plantilla_prueba where organizacion_id = ${b.id}`).n)).toBe(0)
  })

  test('recorrido 7: una vacante con plantilla rinde y entrega como siempre (AC-09, AC-27)', async () => {
    vacanteC = await crearVacante(equipo, NOMBRE_C, await lugarDe(equipo))
    await exigir(`/panel/vacantes/${vacanteC}/aplicacion-evaluacion`, equipo, 'POST', { aplica: false })
    // Decisión del 01/10: asignarle una plantilla por la API la pasa a PLANTILLA
    const plantillas = await exigir<{ id: number }[]>('/panel/plantillas-prueba', equipo)
    let asignada = false
    for (const p of plantillas) {
      const versiones = await exigir<{ id: number; estado: string }[]>(`/panel/plantillas-prueba/${p.id}/versiones`, equipo)
      const publicada = versiones.find((v) => v.estado === 'PUBLICADA')
      if (publicada) {
        await exigir(`/panel/vacantes/${vacanteC}/plantilla-prueba`, equipo, 'POST', { versionPlantillaPruebaId: publicada.id })
        asignada = true
        break
      }
    }
    expect(asignada).toBe(true)
    expect((await exigir<any>(`/panel/vacantes/${vacanteC}`, equipo)).instrumentoEtapaTecnica).toBe('PLANTILLA')
    await exigir(`/panel/vacantes/${vacanteC}/publicacion`, equipo, 'POST')

    const eva = await candidataEnLaPrueba(equipo, vacanteC, 'Eva', correos)
    const p = (await iniciarLaPrueba(eva)).cuerpo
    expect(p.delEditor).toBeFalsy()
    expect(intentoDe(eva.postulacion)).toBeGreaterThan(0)
    expect(uno(`select version_plantilla_prueba_id is not null as plantilla, version_banco_id is null as sin_banco
                  from intento_prueba where postulacion_id = ${eva.postulacion}`)).toEqual({ plantilla: true, sin_banco: true })
    for (const e of p.entregables.filter((x: any) => x.esObligatorio)) {
      expect(await subirArchivo(eva, e.id, 'entrega.pdf')).toBe(200)
    }
    // Como hoy: con preguntas en blanco se entrega, porque solo se exigen los entregables
    const entrega = await entregarLaPrueba(eva)
    expect(entrega.estado).toBe(200)
    expect(estadoDe(eva.postulacion)).toBe('PRUEBA_CALIFICANDO')
  })
})
