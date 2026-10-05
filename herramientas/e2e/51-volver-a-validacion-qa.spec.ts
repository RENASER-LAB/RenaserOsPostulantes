import { expect, test } from '@playwright/test'
import { EQUIPO, corte, entrarAlPanel, filasDelRanking, pestana } from './ayuda'
import { apiPanel, detalleDe, detail } from './ayuda-configuracion'
import { correoDePrueba, literal, sql } from './base-de-datos'
import { borrarCuentasDePrueba } from './limpieza-cuentas'

/**
 * QA de «volver a entrar en Validación»: lo que el 51 no recorre.
 *
 * El 51 lleva a una sola persona con el periodo en curso. Aquí:
 * - «Avanzar» en lote desde el panel con los CINCO estados del periodo a la vez
 *   (sin periodo, por habilitar ya habilitado con trabajo real, en curso, vencido
 *   y terminado con métricas): cada una entra a su paso, con su coletilla, y su
 *   periodo queda idéntico y único (AC-01 a AC-06).
 * - Dos «Avanzar» a la vez sobre la misma persona: uno gana y el otro recibe 409
 *   sin escribir (paso 13 de la spec).
 * - Movimientos manuales a Validación con un periodo ya en curso o terminado, y
 *   dentro de la propia etapa (AC-10, AC-11, AC-12).
 * - Mover a mano a la prueba en una vacante sin prueba lista: 409 con el mensaje de
 *   «Avanzar», sin transición, sin intento y sin correo (AC-15).
 *
 * ⚠️ **Este archivo ESCRIBE**, sobre terreno propio: una vacante y sus personas,
 * reconocibles por la marca y el prefijo de correo. Lo avanzado no se borra (las
 * transiciones son inmutables, V6): las cuentas se retiran del camino y la vacante
 * se marca eliminada, igual que en el 51.
 */

const MARCA = 'QA-VALIDACION-51QA'
const TITULO = `${MARCA} Volver a validación en lote`
const TEXTO_SEMBRADO = 'Sembrada por el QA de volver a validación (51-volver-a-validacion-qa)'
const PREFIJO_CORREO = 'e2e.validacion51qa'
const MOTIVO = 'Vuelve tras revisar su simulación (QA lote)'
const COLETILLA = {
  enCurso: 'su periodo de validación ya estaba en curso',
  vencido: 'su periodo de validación ya había vencido',
  cerrado: 'su periodo de validación ya estaba cerrado',
} as const

type Fila = Record<string, string | number | null>

const filas = (consulta: string): Fila[] =>
  JSON.parse(sql(`select coalesce(json_agg(f), '[]') from (${consulta}) f;`)) as Fila[]

function unaFila(consulta: string): Fila {
  const halladas = filas(consulta)
  if (halladas.length !== 1) throw new Error(`Se esperaba una fila y llegaron ${halladas.length}: ${consulta}`)
  return halladas[0]!
}

function idInsertado(insercion: string): number {
  const creadas = JSON.parse(sql(`with f as (${insercion}) select coalesce(json_agg(f), '[]') from f;`)) as Fila[]
  if (creadas.length !== 1) throw new Error(`La inserción devolvió ${creadas.length} filas: ${insercion}`)
  return Number(creadas[0]!.id)
}

const estadoDe = (postulacion: number): string =>
  String(unaFila(`select estado_codigo from postulacion where id = ${postulacion}`).estado_codigo)

const cuantos = (consulta: string): number => Number(unaFila(`select count(*) as n from (${consulta}) c`).n)

/** El periodo entero, tal como está guardado: tiene que ser idéntico antes y después. */
const periodoDe = (postulacion: number): Fila =>
  unaFila(`select id, modalidad, tipo_vinculacion, dias, inicio_en, fin_en, estado,
                  habilitada_por_usuario_id, responsable_usuario_id, creado_en
             from validacion where postulacion_id = ${postulacion}`)

/** La última transición guardada de la postulación. */
const ultimaTransicion = (postulacion: number): Fila =>
  unaFila(`select estado_anterior_codigo, estado_nuevo_codigo, motivo from transicion_estado
            where postulacion_id = ${postulacion} order by id desc limit 1`)

async function enviar(camino: string, cuerpo?: unknown): Promise<void> {
  const r = await apiPanel(camino, { method: 'POST', cuerpo })
  if (r.estado !== 200) throw new Error(`POST ${camino} → ${detalleDe(r)}`)
}

interface Persona {
  postulacion: number
  usuario: number
  correo: string
  nombre: string
}

let equipo: Fila
let vacante = 0
const correos: string[] = []

function sembrarVacante(): number {
  equipo = unaFila(`select id, organizacion_id from usuario where usuario_renaser_os_id = ${literal(EQUIPO)}`)
  const origen = unaFila(`select solicitud_talento_id, puesto_id, version_pesos_id
                            from vacante
                           where organizacion_id = ${equipo.organizacion_id}
                             and eliminada_en is null and titulo not like ${literal('QA-VALIDACION-51%')}
                           order by id limit 1`)
  const solicitud = idInsertado(`
    insert into solicitud_talento (organizacion_id, origen, urgencia, estado, area_id,
                                   puesto_id, nivel_puesto_codigo, familia_codigo,
                                   resultado_principal, motivo, consecuencia_no_contratar,
                                   analisis_capacidad, responsable_usuario_id)
    select s.organizacion_id, s.origen, s.urgencia, 'CON_VACANTE', s.area_id,
           s.puesto_id, s.nivel_puesto_codigo, s.familia_codigo,
           ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)},
           ${literal(TEXTO_SEMBRADO)}, ${equipo.id}
    from solicitud_talento s where s.id = ${origen.solicitud_talento_id}
    returning id`)
  // Sin plantilla asignada: no tiene prueba lista. Validación no la necesita, y el
  // caso del AC-15 justo la exige así.
  return idInsertado(`
    insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo, descripcion,
                         tipo_cierre, estado, version_pesos_id, responsable_usuario_id,
                         aplica_evaluacion, instrumento_etapa_tecnica, remuneracion_tipo, publicada_en)
    values (${equipo.organizacion_id}, ${solicitud}, ${origen.puesto_id}, ${literal(TITULO)},
            ${literal(TEXTO_SEMBRADO)}, 'PERMANENTE', 'PUBLICADA', ${origen.version_pesos_id},
            ${equipo.id}, false, 'PLANTILLA', 'OCULTA', now())
    returning id`)
}

function sembrarPersona(nombre: string, apellidos: string, estado: string): Persona {
  const correo = correoDePrueba(PREFIJO_CORREO)
  correos.push(correo)
  const persona = idInsertado(`
    insert into persona (nombre, apellidos, ciudad_ubigeo)
    values (${literal(nombre)}, ${literal(apellidos)}, '1501') returning id`)
  const usuario = idInsertado(`
    insert into usuario (organizacion_id, persona_id, correo, es_equipo, es_activo)
    values (${equipo.organizacion_id}, ${persona}, ${literal(correo)}, false, true) returning id`)
  const postulacion = idInsertado(`
    insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo, creado_en, movido_en)
    values (${equipo.organizacion_id}, ${usuario}, ${vacante}, ${literal(estado)}, now(), now())
    returning id`)
  return { postulacion, usuario, correo, nombre: `${nombre} ${apellidos}` }
}

const entrarAValidacion = (p: Persona) =>
  enviar(`/postulaciones/${p.postulacion}/confirmacion-avance`, { motivo: 'Simulación calificada (QA 51)' })
const habilitarSimulacion = (p: Persona) =>
  enviar(`/postulaciones/${p.postulacion}/validacion/habilitacion`, { modalidad: 'SIMULACION_EXTENDIDA', dias: 5 })
const iniciar = (p: Persona) => enviar(`/postulaciones/${p.postulacion}/validacion/inicio`)
const mover = (p: Persona, estadoDestino: string, motivo: string) =>
  enviar(`/postulaciones/${p.postulacion}/transiciones`, { estadoDestino, motivo })
const retroceder = (p: Persona) => mover(p, 'SIMULACION_POR_CONFIRMAR', 'Retrocede para revisar su simulación (QA 51)')

/** Por la API: entra a Validación, se habilita y se inicia, y se la retrocede. */
async function conPeriodoEnCurso(p: Persona): Promise<void> {
  await entrarAValidacion(p)
  await habilitarSimulacion(p)
  await iniciar(p)
  await retroceder(p)
}

/** Por la API: periodo iniciado, métricas completas, cerrado, y se la retrocede desde Decisión. */
async function conPeriodoTerminado(p: Persona): Promise<void> {
  await entrarAValidacion(p)
  await habilitarSimulacion(p)
  await iniciar(p)
  await mover(p, 'VALIDACION_POR_CONFIRMAR', 'Revisión anticipada (QA 51)')
  const metricas = await apiPanel<{ criterioId: number }[]>(`/postulaciones/${p.postulacion}/validacion/metricas`)
  if (metricas.estado !== 200 || metricas.cuerpo.length === 0) throw new Error(`Sin métricas: ${detalleDe(metricas)}`)
  for (const { criterioId } of metricas.cuerpo) {
    await enviar(`/postulaciones/${p.postulacion}/validacion/metricas/${criterioId}`, {
      puntaje: 3,
      explicacion: 'Métrica sembrada por el QA 51',
    })
  }
  await enviar(`/postulaciones/${p.postulacion}/validacion/cierre`)
  await retroceder(p)
}

function retirar(): void {
  const huerfanos = filas(
    `select correo from usuario where correo like ${literal(`${PREFIJO_CORREO}.%@example.com`)}`,
  ).map((f) => String(f.correo))
  const todos = [...new Set([...correos, ...huerfanos])]
  if (todos.length) borrarCuentasDePrueba(todos)

  const vivas = filas(`select id from vacante where titulo like ${literal(`${MARCA}%`)} and eliminada_en is null`)
  if (vivas.length) {
    const ids = vivas.map((f) => Number(f.id)).join(',')
    sql(`
      begin;
      delete from aviso_portal where vacante_id in (${ids});
      delete from vacante
        where id in (${ids})
          and not exists (select 1 from postulacion p where p.vacante_id = vacante.id);
      update vacante set eliminada_en = now() where id in (${ids}) and eliminada_en is null;
      commit;`)
  }
  sql(`delete from solicitud_talento
        where motivo = ${literal(TEXTO_SEMBRADO)}
          and not exists (select 1 from vacante v where v.solicitud_talento_id = solicitud_talento.id);`)
  sql(`update solicitud_talento set estado = 'ARCHIVADA'
        where motivo = ${literal(TEXTO_SEMBRADO)} and estado <> 'ARCHIVADA';`)
}

// Las personas, por el estado de su periodo al volver.
let sinPeriodo: Persona
let habilitada: Persona
let enCurso: Persona
let vencida: Persona
let terminada: Persona
let carrera: Persona
let manualEnCurso: Persona
let manualTerminada: Persona
let sinPrueba: Persona
const antes = new Map<number, Fila>()

test.beforeAll(async () => {
  test.setTimeout(120_000)
  retirar()
  vacante = sembrarVacante()

  sinPeriodo = sembrarPersona('Ana', 'Sinperiodo Lote', 'SIMULACION_POR_CONFIRMAR')
  habilitada = sembrarPersona('Beto', 'Habilitado Lote', 'SIMULACION_POR_CONFIRMAR')
  enCurso = sembrarPersona('Carla', 'Encurso Lote', 'SIMULACION_POR_CONFIRMAR')
  vencida = sembrarPersona('Dario', 'Vencido Lote', 'SIMULACION_POR_CONFIRMAR')
  terminada = sembrarPersona('Elena', 'Cerrada Lote', 'SIMULACION_POR_CONFIRMAR')
  carrera = sembrarPersona('Luis', 'Carrera Lote', 'SIMULACION_POR_CONFIRMAR')
  manualEnCurso = sembrarPersona('Juan', 'Manualencurso Lote', 'SIMULACION_POR_CONFIRMAR')
  manualTerminada = sembrarPersona('Karen', 'Manualterminado Lote', 'SIMULACION_POR_CONFIRMAR')
  sinPrueba = sembrarPersona('Fede', 'Sinprueba Lote', 'PERFIL_POR_CONFIRMAR')

  // AC-01: por habilitar, ya habilitado con trabajo real, figura contractual, 10 días y responsable.
  await entrarAValidacion(habilitada)
  await enviar(`/postulaciones/${habilitada.postulacion}/validacion/habilitacion`, {
    modalidad: 'TRABAJO_REAL',
    tipoVinculacion: 'Locación de servicios',
    dias: 10,
    responsableUsuarioId: Number(equipo.id),
  })
  await retroceder(habilitada)

  for (const p of [enCurso, vencida, carrera, manualEnCurso]) await conPeriodoEnCurso(p)
  // AC-03: el fin ya pasó mientras estaba fuera de Validación (el sondeo no la toca ahí).
  sql(`update validacion set inicio_en = now() - interval '6 days', fin_en = now() - interval '1 day'
        where postulacion_id = ${vencida.postulacion};`)
  for (const p of [terminada, manualTerminada]) await conPeriodoTerminado(p)

  for (const p of [habilitada, enCurso, vencida, terminada, carrera, manualEnCurso, manualTerminada]) {
    antes.set(p.postulacion, periodoDe(p.postulacion))
  }
})

test.afterAll(() => {
  retirar()
})

test.describe('Volver a Validación: los cuatro estados del periodo, carreras y movimientos manuales', () => {
  test('«Avanzar» en lote lleva a cada una al paso de su periodo, con su coletilla y el periodo intacto', async ({ page }) => {
    test.setTimeout(90_000)
    const lote = [sinPeriodo, habilitada, enCurso, vencida, terminada]
    for (const p of lote) expect(estadoDe(p.postulacion)).toBe('SIMULACION_POR_CONFIRMAR')
    expect(cuantos(`select 1 from validacion where postulacion_id = ${sinPeriodo.postulacion}`)).toBe(0)
    expect(antes.get(habilitada.postulacion)).toMatchObject({
      estado: 'POR_HABILITAR', modalidad: 'TRABAJO_REAL', tipo_vinculacion: 'Locación de servicios', dias: 10,
    })
    expect(antes.get(vencida.postulacion)!.estado).toBe('EN_CURSO')
    expect(antes.get(terminada.postulacion)!.estado).toBe('TERMINADA')
    const notasAntes = filas(`select criterio_id, puntaje from nota_criterio
                               where postulacion_id = ${terminada.postulacion} order by criterio_id`)

    await entrarAlPanel(page)
    await page.goto(`/admin/vacantes/${vacante}`)
    await expect(page.getByRole('tablist', { name: 'Etapa del ranking' })).toBeVisible()
    await pestana(page, 'Simulación').click()
    await corte(page, 'Pendiente').click()

    for (const p of lote) {
      const fila = filasDelRanking(page).filter({ hasText: p.nombre })
      await expect(fila).toHaveCount(1)
      await fila.locator('input[type="checkbox"]').check()
    }
    await page.getByLabel('Motivo (obligatorio)').fill(MOTIVO)
    const avanzar = page.getByRole('button', { name: /^Avanzar a/ })
    await expect(avanzar).toBeEnabled()
    await avanzar.click()

    const resultado = page.locator('[role="status"]').filter({ hasText: /Avanzaron|No avanzaron/ })
    await expect(resultado).toBeVisible({ timeout: 30_000 })
    await expect(resultado).not.toContainText('No avanzaron')
    for (const p of lote) await expect(resultado).toContainText(p.nombre)

    // El paso real de cada una, y lo que quedó escrito.
    const esperado: [Persona, string, string][] = [
      [sinPeriodo, 'VALIDACION_POR_HABILITAR', MOTIVO],
      [habilitada, 'VALIDACION_POR_HABILITAR', MOTIVO],
      [enCurso, 'VALIDACION_TURNO_CANDIDATO', `${MOTIVO} · ${COLETILLA.enCurso}`],
      [vencida, 'VALIDACION_POR_CONFIRMAR', `${MOTIVO} · ${COLETILLA.vencido}`],
      [terminada, 'VALIDACION_POR_CONFIRMAR', `${MOTIVO} · ${COLETILLA.cerrado}`],
    ]
    for (const [p, estado, motivo] of esperado) {
      expect(estadoDe(p.postulacion), p.nombre).toBe(estado)
      expect(ultimaTransicion(p.postulacion), p.nombre).toEqual({
        estado_anterior_codigo: 'SIMULACION_POR_CONFIRMAR', estado_nuevo_codigo: estado, motivo,
      })
      expect(cuantos(`select 1 from validacion where postulacion_id = ${p.postulacion}`), p.nombre).toBe(1)
    }
    // AC-05: sin periodo, nace «por habilitar».
    expect(periodoDe(sinPeriodo.postulacion).estado).toBe('POR_HABILITAR')
    // AC-06: los que ya lo tenían, idéntico fila a fila; las métricas, también.
    for (const p of [habilitada, enCurso, vencida, terminada]) {
      expect(periodoDe(p.postulacion), p.nombre).toEqual(antes.get(p.postulacion))
    }
    expect(filas(`select criterio_id, puntaje from nota_criterio
                   where postulacion_id = ${terminada.postulacion} order by criterio_id`)).toEqual(notasAntes)

    // En la pantalla: cada una en el corte de su paso.
    await pestana(page, 'Validación').click()
    await corte(page, 'Pendiente').click()
    for (const p of [sinPeriodo, habilitada, vencida, terminada]) {
      await expect(filasDelRanking(page).filter({ hasText: p.nombre }), p.nombre).toHaveCount(1)
    }
    await expect(filasDelRanking(page).filter({ hasText: enCurso.nombre })).toHaveCount(0)
    await corte(page, 'Le toca al candidato').click()
    await expect(filasDelRanking(page).filter({ hasText: enCurso.nombre })).toHaveCount(1)

    // Y la ficha lo explica: vencido y cerrado, cada uno con su coletilla.
    await corte(page, 'Pendiente').click()
    for (const [p, coletilla] of [[vencida, COLETILLA.vencido], [terminada, COLETILLA.cerrado]] as const) {
      await filasDelRanking(page).filter({ hasText: p.nombre }).getByRole('button', { name: p.nombre, exact: true }).click()
      const ficha = page.locator(`#ficha-${p.postulacion}`)
      await expect(ficha.getByRole('heading', { name: 'Cómo llegó hasta aquí' })).toBeVisible()
      await expect(ficha.getByRole('listitem').filter({ hasText: `${MOTIVO} · ${coletilla}` })).toHaveCount(1, {
        timeout: 15_000,
      })
      await filasDelRanking(page).filter({ hasText: p.nombre }).getByRole('button', { name: p.nombre, exact: true }).click()
    }

    // AC-04: al cerrar, pasa a Decisión con la nota de las mismas métricas.
    const notaAntes = unaFila(`select puntaje from nota_etapa
                                where postulacion_id = ${terminada.postulacion} and etapa_codigo = 'VALIDACION'`)
    await enviar(`/postulaciones/${terminada.postulacion}/validacion/cierre`)
    expect(estadoDe(terminada.postulacion)).toBe('DECISION_POR_CONFIRMAR')
    expect(unaFila(`select puntaje from nota_etapa
                     where postulacion_id = ${terminada.postulacion} and etapa_codigo = 'VALIDACION'`)).toEqual(notaAntes)
  })

  test('dos «Avanzar» a la vez sobre la misma persona: uno gana y el otro recibe 409 sin escribir', async () => {
    const p = carrera.postulacion
    expect(estadoDe(p)).toBe('SIMULACION_POR_CONFIRMAR')
    const transicionesAntes = cuantos(`select 1 from transicion_estado where postulacion_id = ${p}`)

    const respuestas = await Promise.all(
      ['Carrera A (QA 51)', 'Carrera B (QA 51)'].map((motivo) =>
        apiPanel(`/postulaciones/${p}/confirmacion-avance`, { method: 'POST', cuerpo: { motivo } })),
    )
    const estados = respuestas.map((r) => r.estado).sort()
    expect(estados, respuestas.map(detalleDe).join(' | ')).toEqual([200, 409])
    expect(detail(respuestas.find((r) => r.estado === 409)!)).toMatch(/acaba de moverse/)

    expect(estadoDe(p)).toBe('VALIDACION_TURNO_CANDIDATO')
    expect(cuantos(`select 1 from transicion_estado where postulacion_id = ${p}`)).toBe(transicionesAntes + 1)
    expect(cuantos(`select 1 from validacion where postulacion_id = ${p}`)).toBe(1)
    expect(periodoDe(p)).toEqual(antes.get(p))
  })

  test('movimiento manual a Validación: «por habilitar» se redirige, otro paso se respeta y dentro de la etapa no se toca', async () => {
    // AC-10: periodo en curso, a mano a «por habilitar» → entra a su turno, con coletilla.
    await mover(manualEnCurso, 'VALIDACION_POR_HABILITAR', 'Vuelve a validación a mano (QA 51)')
    expect(estadoDe(manualEnCurso.postulacion)).toBe('VALIDACION_TURNO_CANDIDATO')
    expect(ultimaTransicion(manualEnCurso.postulacion).motivo).toBe(
      `Vuelve a validación a mano (QA 51) · ${COLETILLA.enCurso}`,
    )
    expect(periodoDe(manualEnCurso.postulacion)).toEqual(antes.get(manualEnCurso.postulacion))

    // AC-12: dentro de la etapa, de su turno a «por habilitar»: se mueve como hoy, sin redirigir.
    await mover(manualEnCurso, 'VALIDACION_POR_HABILITAR', 'Dentro de la etapa (QA 51)')
    expect(estadoDe(manualEnCurso.postulacion)).toBe('VALIDACION_POR_HABILITAR')
    expect(ultimaTransicion(manualEnCurso.postulacion).motivo).toBe('Dentro de la etapa (QA 51)')
    expect(cuantos(`select 1 from validacion where postulacion_id = ${manualEnCurso.postulacion}`)).toBe(1)

    // AC-11: periodo terminado, a mano a «turno del candidato» → se queda ahí y el periodo no cambia.
    await mover(manualTerminada, 'VALIDACION_TURNO_CANDIDATO', 'Vuelve a su turno a mano (QA 51)')
    expect(estadoDe(manualTerminada.postulacion)).toBe('VALIDACION_TURNO_CANDIDATO')
    expect(ultimaTransicion(manualTerminada.postulacion).motivo).toBe('Vuelve a su turno a mano (QA 51)')
    expect(periodoDe(manualTerminada.postulacion)).toEqual(antes.get(manualTerminada.postulacion))
  })

  test('mover a mano a la prueba sin prueba lista: 409 como «Avanzar», sin transición, intento ni correo', async () => {
    const p = sinPrueba.postulacion
    expect(estadoDe(p)).toBe('PERFIL_POR_CONFIRMAR')

    const manual = await apiPanel(`/postulaciones/${p}/transiciones`, {
      method: 'POST',
      cuerpo: { estadoDestino: 'PRUEBA_TURNO_CANDIDATO', motivo: 'Pasa a la prueba a mano (QA 51)' },
    })
    const avance = await apiPanel(`/postulaciones/${p}/confirmacion-avance`, {
      method: 'POST',
      cuerpo: { motivo: 'Avanza a la prueba (QA 51)' },
    })
    expect(manual.estado, detalleDe(manual)).toBe(409)
    expect(avance.estado, detalleDe(avance)).toBe(409)
    expect(detail(manual)).toBe(detail(avance))

    expect(estadoDe(p)).toBe('PERFIL_POR_CONFIRMAR')
    expect(cuantos(`select 1 from transicion_estado where postulacion_id = ${p}`)).toBe(0)
    expect(cuantos(`select 1 from intento_prueba where postulacion_id = ${p}`)).toBe(0)
    expect(cuantos(`select 1 from correo_enviado where usuario_id = ${sinPrueba.usuario}`)).toBe(0)
  })
})
