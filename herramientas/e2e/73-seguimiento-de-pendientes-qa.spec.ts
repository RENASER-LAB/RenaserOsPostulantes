import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { API } from './ayuda'
import { consultar, editorDe, exigir, pedir, tokenDePanel, uno } from './ayuda-preguntas-propias'
import { literal, sql } from './base-de-datos'
import {
  DECLARADAS,
  PREGUNTAS_PRUEBA,
  PREGUNTA_ABIERTA_1,
  PREGUNTA_ABIERTA_2,
  SIN_INFO,
  curriculumCalificado,
  persona,
  rendirLaEvaluacion,
  respuestaDe,
  retrato,
  type Escenario,
} from './ayuda-informes-qa'
import {
  bloque,
  deLaEvaluacion,
  dudasDeLaEvaluacion,
  dudasDeLaPrueba,
  filaSeguimiento,
  filaTextos,
  informe,
  llegaElSeguimiento,
  notasYEtapa,
  numeroDe,
  retirarLoDelSeguimiento,
  seguimientoVivo,
  sembrarParaElSeguimiento,
  sinComillas,
  terminarTrabajo,
  trabajoVivo,
  type DudaGuardada,
  type Informe,
  type Punto,
} from './ayuda-seguimiento-qa'

/**
 * QA del seguimiento de pendientes entre etapas (specs/Ready/seguimiento-de-pendientes-entre-etapas).
 *
 * Prueba el mecanismo con reglas fijas, nunca el criterio de la IA (D-4): la IA del preview está
 * apagada y el seguimiento llega sembrado por el mismo camino que usa la plataforma (un trabajo vivo
 * del agente, abrir el informe para que el backend anote la huella pedida y guardar lo «devuelto»
 * con esa huella). Así se comprueba lo que la plataforma decide sola: cuándo un seguimiento vale,
 * qué se pide y cuándo, y cómo cambian los cuatro bloques en el informe y en el PDF.
 *
 * Es una historia en serie sobre María José: en camino → evaluación → prueba → ajuste a mano → CV
 * recalificado. Siembra su propia vacante (marca `QA-SEG-94`) y la retira al final.
 */

const CARPETA = process.env.QA_SEGUIMIENTO_EVIDENCIA ?? mkdtempSync(join(tmpdir(), 'qa-seguimiento-94-'))
const correos: string[] = []
let equipo: string
let e: Escenario
let p: number

/** El texto del PDF con los espacios juntados. */
const texto = (ruta: string): string => execFileSync('pdftotext', [ruta, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ')

/** Pide un archivo con sesión y lo guarda. */
async function bajar(ruta: string): Promise<{ estado: number; archivo: string }> {
  const r = await fetch(`${API}${ruta}`, { headers: { Authorization: `Bearer ${equipo}` } })
  const archivo = join(CARPETA, `${r.status}-${ruta.replace(/[^a-z0-9]+/gi, '-')}-${Date.now()}`)
  writeFileSync(archivo, Buffer.from(await r.arrayBuffer()))
  return { estado: r.status, archivo }
}

const veces = (t: string, trozo: string): number => t.split(trozo).length - 1
const normal = (t: string): string => t.replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Las reglas fijas del QA: cada «Resuelto» y cada «Empeoró» lleva número de pregunta, cita y
 * explicación, y la cita está literal en la respuesta de esa pregunta del anexo.
 */
function citaComprobada(detalle: string | null, anexo: Informe, prefijo = ''): { pregunta: number; cita: string } {
  const m = new RegExp(`^${prefijo}[Pp]regunta (\\d+): «(.+?)»\\. (.+)$`).exec(detalle ?? '')
  expect(m, `«${detalle}» lleva pregunta, cita y explicación`).not.toBeNull()
  const pregunta = Number(m![1])
  const respuesta = anexo.anexo?.preguntas.find((q) => q.numero === pregunta)?.respuesta ?? ''
  expect(normal(respuesta), `la cita «${m![2]}» está literal en la pregunta ${pregunta} del anexo`).toContain(normal(m![2]!))
  expect(m![3]!.trim().length).toBeGreaterThan(10)
  return { pregunta, cita: m![2]! }
}

const textos = (puntos: Punto[]): string[] => puntos.map((q) => q.texto)
const del = (i: Informe, grupo: string): Punto[] => bloque(i, 'PENDIENTE')!.puntos.filter((q) => q.grupo === grupo)
const respuestas = (postulacion: number) => respuestaDe(postulacion, PREGUNTA_ABIERTA_2)

// Lo que se va sabiendo a lo largo de la historia.
let antes: string
let evaAntes: Informe
let pruAntes: Informe
let seguimientoEva: number
let redactorEva: number
let dudasEva: DudaGuardada[]
let n2: number
let n3: number

test.describe.configure({ mode: 'serial' })

test.describe('QA · el seguimiento de pendientes entre etapas', () => {
  test.beforeAll(async () => {
    test.setTimeout(240_000)
    equipo = await tokenDePanel()
    e = await sembrarParaElSeguimiento(equipo, correos)
    p = e.maria.postulacion
  })

  test.afterAll(() => {
    retirarLoDelSeguimiento(correos)
  })

  test('AC-18 / AC-14 · sin seguimiento sale al momento con «Por contrastar», se pide una sola vez y el redactor espera', async () => {
    antes = notasYEtapa(p)
    evaAntes = await informe(equipo, p, 'evaluacion')
    pruAntes = await informe(equipo, p, 'prueba')
    expect(bloque(evaAntes, 'PIDIO_EL_CV')!.puntos.map((q) => q.etiqueta)).toEqual(Array(4).fill('Por contrastar'))
    // Con la IA apagada nadie pide nada al abrir: ni seguimiento ni redactor (nunca en lote, D-2).
    expect(filaSeguimiento(p, 'EVALUACION')).toBeNull()

    // La cola dejó el seguimiento en camino (y un redactor vivo que delataría cualquier pedido suyo).
    seguimientoEva = seguimientoVivo(p, 'EVALUACION')
    redactorEva = trabajoVivo(p, 'REDACTOR_INFORME', 'informe_evaluacion')
    const enCamino = await informe(equipo, p, 'evaluacion')
    expect(enCamino.textosEnCamino, 'el visor vuelve a preguntar').toBe(true)
    expect(bloque(enCamino, 'PIDIO_EL_CV')!.puntos.map((q) => q.etiqueta)).toEqual(Array(4).fill('Por contrastar'))
    expect(bloque(enCamino, 'PENDIENTE')!.puntos.filter((q) => q.origen === 'CV')).toEqual([])
    const pedido = filaSeguimiento(p, 'EVALUACION')!
    expect(pedido.huella_pedida).toBeTruthy()
    expect(pedido.huella).toBeNull()
    expect(filaTextos(p, 'EVALUACION'), 'con el seguimiento en camino no se pide al redactor').toBeNull()

    // Abrirlo otra vez —visor, PDF o .zip— antes de que llegue no pide otro.
    await informe(equipo, p, 'evaluacion')
    const pdf = await bajar(`/panel/postulaciones/${p}/informes/evaluacion/pdf`)
    expect(pdf.estado).toBe(200)
    // El PDF pinta los chips en mayúsculas: «CV · POR CONTRASTAR».
    expect(texto(pdf.archivo)).toContain('CV · POR CONTRASTAR')
    expect((await bajar(`/panel/postulaciones/${p}/informes/zip`)).estado).toBe(200)
    const otra = filaSeguimiento(p, 'EVALUACION')!
    expect(otra.huella_pedida).toBe(pedido.huella_pedida)
    expect(otra.pedida_en).toBe(pedido.pedida_en)
    expect(Number(uno(`select count(*) as n from seguimiento_pendiente where postulacion_id = ${p}`).n)).toBe(1)
    expect(filaTextos(p, 'EVALUACION')).toBeNull()
  })

  test('AC-01 / AC-02 / AC-03 / AC-12 / AC-14 · llega el de la evaluación: estados con su cita, lo resuelto no pasa y el redactor se pide una vez', async () => {
    n2 = numeroDe(evaAntes, PREGUNTA_ABIERTA_1)
    n3 = numeroDe(evaAntes, PREGUNTA_ABIERTA_2)
    const hecho = dudasDeLaEvaluacion(evaAntes, {
      resuelta: { pregunta: n3, cita: 'acordamos un cronograma de EPP' },
      empeoro: { pregunta: n2, cita: 'cerramos con un costo por contratación de S/ 310' },
    })
    dudasEva = hecho.dudas
    llegaElSeguimiento(p, 'EVALUACION', dudasEva, seguimientoEva)

    const eva = await informe(equipo, p, 'evaluacion')
    const pidio = bloque(eva, 'PIDIO_EL_CV')!.puntos
    expect(textos(pidio), 'las mismas dudas, en el mismo orden').toEqual(textos(bloque(evaAntes, 'PIDIO_EL_CV')!.puntos))
    const de = (q: Punto) => pidio.find((x) => x.texto === q.texto)!
    // AC-03: empeoró, con pregunta, cita y explicación.
    expect(de(hecho.planillas).etiqueta).toBe('Empeoró')
    expect(citaComprobada(de(hecho.planillas).detalle, eva)).toEqual({ pregunta: n2, cita: 'cerramos con un costo por contratación de S/ 310' })
    // AC-01: resuelto, con pregunta, cita y explicación.
    expect(de(hecho.sst).etiqueta).toBe('Resuelto')
    expect(de(hecho.sst).detalle).toBe(`Pregunta ${n3}: «acordamos un cronograma de EPP». Cuenta que acordó con el comité un cronograma de equipos de protección.`)
    citaComprobada(de(hecho.sst).detalle, eva)
    // AC-02: sigue pendiente, con su pregunta de validación.
    for (const q of [hecho.excel, hecho.ingles]) {
      expect(de(q).etiqueta).toBe('Sigue pendiente')
      expect(de(q).detalle).toBe(q.detalle)
    }
    for (const q of pidio) expect(q.origen).toBe('CV')

    // «Por verificar en la prueba del puesto»: primero lo que empeoró, luego lo pendiente y después lo
    // de la evaluación; lo resuelto no pasa.
    const pendiente = bloque(eva, 'PENDIENTE')!.puntos
    const deLaEva = bloque(evaAntes, 'PENDIENTE')!.puntos
    expect(textos(pendiente)).toEqual([hecho.planillas.texto, hecho.excel.texto, hecho.ingles.texto, ...textos(deLaEva)])
    expect(pendiente.slice(0, 3).map((q) => [q.origen, q.etiqueta])).toEqual([['CV', 'Empeoró'], ['CV', 'Sigue pendiente'], ['CV', 'Sigue pendiente']])
    expect(pendiente[0]!.detalle).toBe(`Pregunta ${n2}: «cerramos con un costo por contratación de S/ 310». ${DECLARADAS[0]!.pregunta}`)
    expect(pendiente[1]!.detalle).toBe(DECLARADAS[1]!.pregunta)
    expect(pendiente.slice(3)).toEqual(deLaEva)
    expect(textos(pendiente)).not.toContain(hecho.sst.texto)

    // AC-14: con el seguimiento al día, el redactor se pide; abrirlo otra vez no lo pide de nuevo.
    const textosPedidos = filaTextos(p, 'EVALUACION')
    expect(textosPedidos?.huella_pedida, 'el redactor se pide al llegar el seguimiento').toBeTruthy()
    await informe(equipo, p, 'evaluacion')
    expect(filaTextos(p, 'EVALUACION')).toEqual(textosPedidos)
    terminarTrabajo(redactorEva, 'FALLIDO')

    // El PDF: «Resuelto» con su cita, y en «Por verificar en la prueba del puesto» la pendiente y no
    // la resuelta (la resuelta sale una vez; las abiertas, en los dos bloques).
    const pdf = await bajar(`/panel/postulaciones/${p}/informes/evaluacion/pdf`)
    expect(pdf.estado).toBe(200)
    const t = texto(pdf.archivo)
    for (const parte of ['Lo que pidió el CV', 'CV · RESUELTO', 'CV · EMPEORÓ', 'CV · SIGUE PENDIENTE', 'Por verificar en la prueba del puesto',
      `Pregunta ${n3}: «acordamos un cronograma de EPP».`, `Pregunta ${n2}: «cerramos con un costo por contratación de S/ 310».`]) {
      expect(t).toContain(parte)
    }
    expect(t).not.toContain('POR CONTRASTAR')
    expect(veces(t, SIN_INFO.texto), 'la resuelta solo en «Lo que pidió el CV»').toBe(1)
    for (const d of DECLARADAS) expect(veces(t, d.texto), `«${d.texto}» en los dos bloques`).toBe(2)
    expect(t.indexOf(DECLARADAS[0]!.texto, t.indexOf('Por verificar en la prueba del puesto')))
      .toBeLessThan(t.indexOf('QAINF falta evidencia', t.indexOf('Por verificar en la prueba del puesto')))

    // AC-12: el seguimiento no cambia ninguna nota, el grupo ni la etapa.
    expect(notasYEtapa(p)).toBe(antes)
    expect(eva.nota).toEqual(evaAntes.nota)
    expect(eva.grupo).toBe(evaAntes.grupo)
  })

  test('AC-08 / AC-09 / AC-17 / AC-12 · el de la prueba: «Lo que aclaró la prueba» y la entrevista solo con lo abierto', async () => {
    // Sin seguimiento de la prueba vigente, su informe sale como hoy.
    const sinSeguir = await informe(equipo, p, 'prueba')
    expect(bloque(sinSeguir, 'ACLARO_LA_PRUEBA')).toBeUndefined()
    expect(del(sinSeguir, 'Del CV').map((q) => q.etiqueta)).toEqual(['Declarada', 'Declarada', 'Declarada', 'Sin información'])

    const vivo = seguimientoVivo(p, 'PRUEBA')
    const enCamino = await informe(equipo, p, 'prueba')
    expect(enCamino.textosEnCamino).toBe(true)
    expect(filaSeguimiento(p, 'PRUEBA')!.huella_pedida).toBeTruthy()

    const q2 = numeroDe(pruAntes, PREGUNTAS_PRUEBA[1])
    const q3 = numeroDe(pruAntes, PREGUNTAS_PRUEBA[2])
    const excel = sinComillas(bloque(evaAntes, 'PIDIO_EL_CV')!.puntos.find((q) => q.texto.includes(DECLARADAS[1]!.texto))!.texto)
    const dudas = dudasDeLaPrueba(dudasEva, deLaEvaluacion(pruAntes), {
      delCv: excel,
      cita: { pregunta: q3, cita: '45 personas, S/ 13 950 en total', explicacion: 'Calcula el costo total del plan para las 45 personas.' },
      faltaEvidencia: { pregunta: q2, cita: 'cubrirías las 45 vacantes en seis semanas', explicacion: 'Explica cómo cubriría las vacantes del caso con su plan.' },
      patron: { pregunta: q2, cita: '45 personas', explicacion: 'Habla de un posible error propio.' },
    })
    // AC-08: la prueba recibe solo lo que siguió abierto tras la evaluación (y lo de la evaluación, D-1).
    expect(dudas.filter((d) => d.origen === 'CV').map((d) => d.texto)).toEqual(
      dudasEva.filter((d) => d.estado !== 'RESUELTA').map((d) => d.texto))
    llegaElSeguimiento(p, 'PRUEBA', dudas, vivo)

    const pru = await informe(equipo, p, 'prueba')
    const codigos = pru.bloques.map((b) => b.codigo)
    // AC-09 / AC-17: el bloque nuevo, justo antes de «Por verificar en la entrevista», tono BIEN.
    expect(codigos.indexOf('ACLARO_LA_PRUEBA')).toBe(codigos.indexOf('PENDIENTE') - 1)
    const aclaro = bloque(pru, 'ACLARO_LA_PRUEBA')!
    expect([aclaro.titulo, aclaro.tono]).toEqual(['Lo que aclaró la prueba', 'BIEN'])
    expect(textos(aclaro.puntos)).toEqual([`«${excel}»`, 'QAINF falta evidencia: liderazgo de equipos grandes'])
    expect(citaComprobada(aclaro.puntos[0]!.detalle, pru)).toEqual({ pregunta: q3, cita: '45 personas, S/ 13 950 en total' })
    expect(citaComprobada(aclaro.puntos[1]!.detalle, pru)).toEqual({ pregunta: q2, cita: 'cubrirías las 45 vacantes en seis semanas' })

    // «Por verificar en la entrevista»: «De la prueba» igual; «De la evaluación» sin lo que la prueba
    // aclaró y con su etiqueta de hoy; «Del CV» solo lo abierto, primero lo que empeoró.
    expect(del(pru, 'De la prueba')).toEqual(del(pruAntes, 'De la prueba'))
    expect(del(pru, 'De la evaluación').map((q) => [q.texto, q.etiqueta])).toEqual(
      [['QAINF demasiado ideal: todas sus campañas salieron perfectas', 'Demasiado ideal']])
    const delCv = del(pru, 'Del CV')
    expect(delCv.map((q) => [q.texto, q.etiqueta])).toEqual([
      [`«${DECLARADAS[0]!.texto}»`, 'Empeoró'],
      [`«${DECLARADAS[2]!.texto}»`, 'Sigue pendiente'],
    ])
    // Lo que empeoró en la evaluación cita el anexo de la evaluación, y lo dice.
    expect(delCv[0]!.detalle).toBe(`En la evaluación, pregunta ${n2}: «cerramos con un costo por contratación de S/ 310». ${DECLARADAS[0]!.pregunta}`)
    expect(delCv[1]!.detalle).toBe(DECLARADAS[2]!.pregunta)

    const pdf = await bajar(`/panel/postulaciones/${p}/informes/prueba/pdf`)
    expect(pdf.estado).toBe(200)
    const t = texto(pdf.archivo)
    expect(t).toContain('Lo que aclaró la prueba')
    expect(t).toContain(`Pregunta ${q3}: «45 personas, S/ 13 950 en total».`)
    expect(t.indexOf('Lo que aclaró la prueba')).toBeLessThan(t.indexOf('Por verificar en la entrevista'))
    expect(t, 'lo resuelto en la evaluación no se repite en la prueba').not.toContain(SIN_INFO.texto)
    expect(veces(t, DECLARADAS[1]!.texto), 'lo que aclaró la prueba sale una vez').toBe(1)
    expect(t).not.toContain('CV · DECLARADA')
    expect(t).not.toContain('CV · SIN INFORMACIÓN')

    expect(notasYEtapa(p)).toBe(antes)
    expect(pru.nota).toEqual(pruAntes.nota)
  })

  test('AC-15 · un ajuste a mano de una nota no repite el seguimiento ni quita los estados', async () => {
    const eva = filaSeguimiento(p, 'EVALUACION')
    const pru = filaSeguimiento(p, 'PRUEBA')
    const trabajos = () => Number(uno(`select count(*) as n from trabajo_ia where postulacion_id = ${p}
                                         and agente_codigo = 'SEGUIMIENTO_PENDIENTES'`).n)
    const cuantos = trabajos()
    await exigir(`/panel/postulaciones/${p}/evaluacion/respuestas/${respuestas(p)}/nota`, equipo, 'PUT',
      { puntaje: 24, motivo: 'QA-SEG-94: ajuste a mano de la evaluación' })
    const criterio = Number(uno(`select n.criterio_banco_id from nota_criterio_prueba n join intento_prueba i on i.id = n.intento_prueba_id
                                  where i.postulacion_id = ${p} order by n.id desc limit 1`).criterio_banco_id)
    await exigir(`/panel/postulaciones/${p}/prueba-propia/criterios/${criterio}/nota`, equipo, 'PUT',
      { puntaje: 18, motivo: 'QA-SEG-94: ajuste a mano de la prueba' })

    const evaDespues = await informe(equipo, p, 'evaluacion')
    const pruDespues = await informe(equipo, p, 'prueba')
    expect(bloque(evaDespues, 'PIDIO_EL_CV')!.puntos.map((q) => q.etiqueta).sort())
      .toEqual(['Empeoró', 'Resuelto', 'Sigue pendiente', 'Sigue pendiente'])
    expect(bloque(pruDespues, 'ACLARO_LA_PRUEBA')).toBeDefined()
    expect(filaSeguimiento(p, 'EVALUACION')).toEqual(eva)
    expect(filaSeguimiento(p, 'PRUEBA')).toEqual(pru)
    expect(trabajos()).toBe(cuantos)
  })

  test('AC-16 · con la prueba sin empezar o en curso no se pide su seguimiento', async () => {
    const diana = await persona(e.vacante, 'Diana', 'Prueba Sin Entregar', correos)
    await rendirLaEvaluacion(diana)
    curriculumCalificado(diana.postulacion, true)
    retrato(diana.postulacion)
    sql(`insert into transicion_estado (postulacion_id, estado_anterior_codigo, estado_nuevo_codigo, es_sistema, aviso_al_candidato, ocurrida_en)
         values (${diana.postulacion}, 'PERFIL_CALIFICANDO', 'PERFIL_POR_CONFIRMAR', true, 'CORREO', now());
         update postulacion set estado_codigo = 'PERFIL_POR_CONFIRMAR', movido_en = now() where id = ${diana.postulacion};`)
    const guia = Number((await editorDe(equipo, e.vacante)).publicada.versionGuia)
    sql(`insert into nota_respuesta (respuesta_id, puntaje, explicacion, evidencia_citada, version_guia, c1_episodio, c2_autoria, c3_dato, c4_incomodidad)
         values (${respuestaDe(diana.postulacion, PREGUNTA_ABIERTA_1)}, 40, ${literal('QA-SEG-94 explicación de la abierta 1.')},
                 ${literal('cubrí 45 puestos en 6 semanas')}, ${guia}, true, true, true, false);`)
    await exigir(`/panel/postulaciones/${diana.postulacion}/evaluacion/respuestas/${respuestas(diana.postulacion)}/nota`, equipo, 'PUT',
      { puntaje: 20, motivo: 'QA-SEG-94: nota de la abierta 2' })

    // Su evaluación ya tiene seguimiento: si la prueba estuviera lista, lo siguiente sería pedir el suyo.
    const vivoEva = seguimientoVivo(diana.postulacion, 'EVALUACION')
    const eva = await informe(equipo, diana.postulacion, 'evaluacion')
    llegaElSeguimiento(diana.postulacion, 'EVALUACION', dudasDeLaEvaluacion(eva, {
      resuelta: { pregunta: numeroDe(eva, PREGUNTA_ABIERTA_2), cita: 'acordamos un cronograma de EPP' },
      empeoro: { pregunta: numeroDe(eva, PREGUNTA_ABIERTA_1), cita: 'cubrí 45 puestos en 6 semanas' },
    }).dudas, vivoEva)
    const vivoPrueba = seguimientoVivo(diana.postulacion, 'PRUEBA')

    const abrirTodo = async () => {
      expect((await pedir(`/panel/postulaciones/${diana.postulacion}/informes/prueba`, equipo)).estado).not.toBe(200)
      expect((await pedir(`/panel/postulaciones/${diana.postulacion}/informes/evaluacion`, equipo)).estado).toBe(200)
      expect((await bajar(`/panel/postulaciones/${diana.postulacion}/informes/zip`)).estado).toBe(200)
      expect((await bajar(`/panel/vacantes/${e.vacante}/informes/zip`)).estado).toBe(200)
      expect(filaSeguimiento(diana.postulacion, 'PRUEBA'), 'no se pide el seguimiento de la prueba').toBeNull()
    }
    // Sin empezar: ya está en la etapa de la prueba.
    await exigir(`/panel/postulaciones/${diana.postulacion}/confirmacion-avance`, equipo, 'POST', { motivo: 'QA-SEG-94: pasa a la prueba' })
    await abrirTodo()
    // En curso: empezó y respondió algo, sin entregar.
    const prueba = await exigir<any>(`/portal/prueba/${diana.uuid}/inicio`, diana.token, 'POST')
    await exigir(`/portal/prueba/${diana.uuid}/respuestas/${prueba.preguntas[0].id}`, diana.token, 'PUT',
      { texto: 'Si la rotación sigue, es error mío y lo asumo.' })
    await abrirTodo()
    terminarTrabajo(vivoPrueba, 'FALLIDO')
  })

  test('AC-11 · con el CV recalificado ningún informe enseña los estados anteriores y el seguimiento nuevo se pide', async () => {
    const pedidoEva = filaSeguimiento(p, 'EVALUACION')!
    const pedidoPrueba = filaSeguimiento(p, 'PRUEBA')!
    // La recalificación borra las afirmaciones y las vuelve a escribir; esta vez una pregunta cambia.
    const cv = Number(uno(`select id from cv where postulacion_id = ${p}`).id)
    sql(`begin;
         create temp table copia as select texto, clasificacion, pregunta_validacion from afirmacion_cv where cv_id = ${cv} order by id;
         delete from afirmacion_cv where cv_id = ${cv};
         insert into afirmacion_cv (cv_id, texto, clasificacion, pregunta_validacion)
           select ${cv}, texto, clasificacion,
                  case when texto = ${literal(DECLARADAS[0]!.texto)} then '¿Qué parte de la planilla cerrabas tú?' else pregunta_validacion end
             from copia;
         commit;`)

    const eva = await informe(equipo, p, 'evaluacion')
    expect(bloque(eva, 'PIDIO_EL_CV')!.puntos.map((q) => q.etiqueta)).toEqual(Array(4).fill('Por contrastar'))
    expect(bloque(eva, 'PENDIENTE')!.puntos.filter((q) => q.origen === 'CV')).toEqual([])
    const pru = await informe(equipo, p, 'prueba')
    expect(bloque(pru, 'ACLARO_LA_PRUEBA')).toBeUndefined()
    expect(del(pru, 'Del CV').map((q) => q.etiqueta)).toEqual(['Declarada', 'Declarada', 'Declarada', 'Sin información'])
    expect(textos(del(pru, 'De la evaluación'))).toContain('QAINF falta evidencia: liderazgo de equipos grandes')
    const t = texto((await bajar(`/panel/postulaciones/${p}/informes/evaluacion/pdf`)).archivo)
    expect(t).toContain('CV · POR CONTRASTAR')
    expect(t).not.toContain('CV · RESUELTO')

    // Se pide el nuevo: primero el de la evaluación; el de la prueba espera a que llegue.
    const vivoEva = seguimientoVivo(p, 'EVALUACION')
    const vivoPrueba = seguimientoVivo(p, 'PRUEBA')
    await informe(equipo, p, 'prueba')
    await informe(equipo, p, 'evaluacion')
    const nuevo = filaSeguimiento(p, 'EVALUACION')!
    expect(nuevo.huella_pedida).toBeTruthy()
    expect(nuevo.huella_pedida).not.toBe(pedidoEva.huella_pedida)
    expect(filaSeguimiento(p, 'PRUEBA')!.huella_pedida, 'la prueba espera al de la evaluación').toBe(pedidoPrueba.huella_pedida)
    terminarTrabajo(vivoEva, 'FALLIDO')
    terminarTrabajo(vivoPrueba, 'FALLIDO')

    // AC-07: si ese seguimiento falla del todo, el informe sigue con «Por contrastar», ya no viene en
    // camino y la misma huella no se vuelve a pedir (no se paga dos veces) hasta que algo cambie.
    const tras = await informe(equipo, p, 'evaluacion')
    expect(tras.textosEnCamino).toBe(false)
    expect(bloque(tras, 'PIDIO_EL_CV')!.puntos.map((q) => q.etiqueta)).toEqual(Array(4).fill('Por contrastar'))
    expect(filaSeguimiento(p, 'EVALUACION')!.pedida_en).toBe(nuevo.pedida_en)
  })

  // Va al final: en serie, lo que falle aquí no deja sin correr a los demás.
  test('Spec 12 · lo resuelto en la evaluación no vuelve a «Por verificar en la entrevista» aunque a la prueba no le quede nada abierto', async () => {
    // La evaluación resuelve las cuatro dudas del CV (con los datos de hoy) y no deja nada por verificar.
    const vivo = seguimientoVivo(p, 'EVALUACION')
    const eva = await informe(equipo, p, 'evaluacion')
    const resueltas = bloque(eva, 'PIDIO_EL_CV')!.puntos.map<DudaGuardada>((q, i) => ({
      codigo: `D${i + 1}`, origen: 'CV', texto: sinComillas(q.texto),
      clasificacion: String(uno(`select clasificacion from afirmacion_cv where texto = ${literal(sinComillas(q.texto))} limit 1`).clasificacion),
      preguntaDeValidacion: q.detalle, estado: 'RESUELTA', pregunta: n3, entregable: null, cita: 'acordamos un cronograma de EPP',
      explicacion: 'Cuenta un acuerdo propio con el comité.', citadaEn: 'EVALUACION',
    }))
    llegaElSeguimiento(p, 'EVALUACION', resueltas, vivo)
    sql(`begin;
         delete from hallazgo_perfil where tipo = 'FALTA_EVIDENCIA'
            and perfil_talento_id in (select id from perfil_talento where postulacion_id = ${p});
         delete from alerta where postulacion_id = ${p};
         commit;`)
    const evaResuelta = await informe(equipo, p, 'evaluacion')
    expect(bloque(evaResuelta, 'PIDIO_EL_CV')!.puntos.map((q) => q.etiqueta)).toEqual(Array(4).fill('Resuelto'))
    expect(bloque(evaResuelta, 'PENDIENTE')!.puntos).toEqual([])

    const pru = await informe(equipo, p, 'prueba')
    expect(del(pru, 'De la evaluación')).toEqual([])
    // Las cuatro se cerraron en la evaluación: ninguna vuelve como «Declarada» o «Sin información».
    expect(textos(del(pru, 'Del CV')), 'lo resuelto en la evaluación no se repite en la prueba').toEqual([])
    expect(consultar(`select 1 from seguimiento_pendiente where postulacion_id = ${p} and etapa = 'EVALUACION' and huella = huella_pedida`))
      .toHaveLength(1)
  })
})
