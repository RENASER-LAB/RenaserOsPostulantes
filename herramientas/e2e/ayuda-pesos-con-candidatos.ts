/**
 * El terreno de la QA de «cambiar los pesos con candidatos dentro y dejar de prestar el banco
 * y las pruebas» (V74, specs/pesos-con-candidatos-y-fin-del-prestamo.md).
 *
 * Todo lo sembrado lleva una marca en el título (`QA-PCP-74` en la suite; otra para dejar
 * casos a la vista de la revisión humana): las vacantes y sus solicitudes, las dos versiones
 * de pesos, la prueba de RENASER que ya no se presta y la empresa cliente. Las cuentas de
 * candidato se identifican por su correo exacto.
 *
 * Casi todo va por la API, el camino del panel y del portal: crear la vacante, escribir y
 * publicar sus preguntas y su prueba, postular, responder, entregar, poner la nota de la
 * abierta, cambiar los pesos. Con SQL solo va lo que la API no deja crear o el preview no
 * puede producir:
 *
 *   - las dos versiones de pesos con sus repartos exactos (publicarlas por la API exige el
 *     editor de pesos entero, y aquí lo que importa es saber de antemano cada número);
 *   - lo que la IA (apagada en el preview) habría dejado: las notas de 0 a 100 de los
 *     criterios del currículum y el retrato al cerrar el Perfil Integral;
 *   - la prueba del puesto ya calificada, la simulación de un facilitador y una decisión
 *     tomada, como las dejan sus pantallas;
 *   - las vacantes de antes de la V74 de una empresa cliente, tal como las dejó la migración:
 *     con la versión fija del banco de RENASER o con una prueba de RENASER asignada.
 *
 * ⚠️ Una postulación con historial no se borra (V6): la limpieza retira las cuentas, marca
 * eliminadas las vacantes y devuelve a una versión de RENASER todo lo que apuntaba a las dos
 * versiones de la prueba, para poder borrarlas.
 */

import { spawn } from 'node:child_process'

import { API } from './ayuda'
import { borrarCuentasDePrueba, CLAVE_DE_CANDIDATO, crearCuentaDeCandidato } from './ayuda-candidato'
import { baseDeDatos, correoDePrueba, literal, sql } from './base-de-datos'
import {
  consultar,
  empezarEvaluacion,
  entregar,
  escribirBorrador,
  exigir,
  pedir,
  postular,
  postulacionPorUuid,
  publicarPreguntas,
  responder,
  uno,
} from './ayuda-preguntas-propias'
import { crearVacante, criterioDe, escribirPrueba, lugarDe, publicarPrueba, RUTA as RUTA_PRUEBA } from './ayuda-prueba-propia'

export const MARCA = 'QA-PCP-74'

/** La pregunta abierta de las preguntas propias: vale los 100 puntos de la evaluación. */
export const PREGUNTA = 'Cuéntanos un cierre de caja difícil y cómo lo resolviste.'
const RESPUESTA = 'En marzo la caja no cuadraba por 1.200 soles; lo hallé en dos días revisando los vales.'
/** El caso de la prueba del editor: se lee dentro del reloj. */
export const CASO = 'La sede de Arequipa cerró marzo con 1.200 soles de diferencia en caja.'

const sembrado = (marca: string) => `${marca} sembrado a mano para revisar`
const prefijoDeCorreo = (marca: string) => `qa.${marca.toLowerCase().replace(/[^a-z0-9]/g, '')}`
const prefijoDeEmpresa = (marca: string) => `${marca}-CLIENTA-`

type Fila = Record<string, string | number | null>

/** Un INSERT … RETURNING id: la fila nueva, o un error que dice cuál falló. */
function insertar(consulta: string): number {
  const filas = JSON.parse(sql(`with f as (${consulta}) select coalesce(json_agg(f), '[]') from f;`)) as Fila[]
  if (filas.length !== 1) throw new Error(`La inserción devolvió ${filas.length} filas: ${consulta}`)
  return Number(filas[0]!.id)
}

export const plataforma = (): number => Number(uno('select id from organizacion where es_plataforma').id)

/** La versión de pesos de RENASER que toma una vacante nueva: la publicada más reciente. */
export const pesosDeRenaser = (): number =>
  Number(uno(`select id from version_pesos where organizacion_id = ${plataforma()} and estado = 'PUBLICADA'
               order by publicada_en desc nulls last, id desc limit 1`).id)

// ---------------------------------------------------------------- Las dos versiones de pesos

export interface Reparto {
  /** Cuánto pesa la prueba del puesto en la nota final (el Perfil Integral y la simulación, 40 y 15). */
  pruebaPuesto: number
  validacion: number
  /** El reparto del Perfil Integral entre currículum y preguntas: suman 40. */
  cv: number
  evaluacion: number
  /** El peso de cada criterio del currículum en Ejecución; los que no se nombran, 0. */
  curriculum: Record<string, number>
  /** El de cada criterio de la simulación en Ejecución; los que no se nombran, 10. */
  simulacion: Record<string, number>
  /** El de cada criterio de la validación en Ejecución; los que no se nombran, 10. */
  validacionPorCriterio?: Record<string, number>
}

/**
 * Una versión de pesos publicada de RENASER con el reparto dicho, para el nivel Ejecución.
 *
 * Publicada «en 2001»: una vacante nueva toma la publicada más reciente, y estas dos no
 * deben colarse en las vacantes que otras pruebas creen mientras existen.
 */
export function crearVersionDePesos(marca: string, nombre: string, r: Reparto): { id: number; etiqueta: string } {
  const etiqueta = `${marca} ${nombre} ${Date.now()}`
  const id = insertar(`insert into version_pesos (organizacion_id, etiqueta, estado, publicada_en)
                       values (${plataforma()}, ${literal(etiqueta)}, 'PUBLICADA', timestamptz '2001-01-01')
                       returning id`)
  const valores = (m: Record<string, number>) =>
    Object.entries(m).map(([codigo, peso]) => `(${literal(codigo)}, ${peso})`).join(', ') || `('', 0)`
  sql(`
    begin;
    insert into peso_etapa (version_pesos_id, etapa_codigo, peso) values
      (${id}, 'PERFIL_INTEGRAL', 40), (${id}, 'PRUEBA_PUESTO', ${r.pruebaPuesto}),
      (${id}, 'SIMULACION', 15), (${id}, 'VALIDACION', ${r.validacion});
    insert into peso_componente_perfil (version_pesos_id, componente, peso) values
      (${id}, 'CV', ${r.cv}), (${id}, 'EVALUACION', ${r.evaluacion}), (${id}, 'PSICOMETRICO', 0);
    insert into peso_criterio (version_pesos_id, nivel_puesto_codigo, criterio_id, peso)
      select ${id}, 'EJECUCION', c.id, coalesce(m.peso, 0)
        from criterio c left join (values ${valores(r.curriculum)}) as m(codigo, peso) on m.codigo = c.codigo
       where c.etapa_codigo = 'PERFIL_INTEGRAL' and c.version_plantilla_prueba_id is null;
    insert into peso_criterio (version_pesos_id, nivel_puesto_codigo, criterio_id, peso)
      select ${id}, 'EJECUCION', c.id, coalesce(m.peso, 10)
        from criterio c left join (values ${valores(r.simulacion)}) as m(codigo, peso) on m.codigo = c.codigo
       where c.etapa_codigo = 'SIMULACION' and c.version_plantilla_prueba_id is null and c.puntos is null;
    insert into peso_criterio (version_pesos_id, nivel_puesto_codigo, criterio_id, peso)
      select ${id}, 'EJECUCION', c.id, coalesce(m.peso, 10)
        from criterio c left join (values ${valores(r.validacionPorCriterio ?? {})}) as m(codigo, peso) on m.codigo = c.codigo
       where c.etapa_codigo = 'VALIDACION' and c.version_plantilla_prueba_id is null and c.puntos is null;
    commit;`)
  return { id, etiqueta }
}

// ---------------------------------------------------------------- La vacante con candidatos

/**
 * Una vacante de RENASER publicada con preguntas propias (una abierta de 100 puntos) y
 * prueba del editor, en la versión de pesos dicha y sin el pase automático: quien llega a la
 * mínima espera a que el equipo lo mueva.
 */
export async function vacanteConPreguntasYPrueba(equipo: string, marca: string, nombre: string,
                                                 versionPesos: number): Promise<number> {
  const vacante = await crearVacante(equipo, nombre, await lugarDe(equipo), undefined, marca)
  await escribirBorrador(equipo, vacante, [
    {
      nombre: 'General',
      preguntas: [{ tipo: 'ABIERTA', enunciado: PREGUNTA, puntos: 100, queDebeTener: 'El monto, la causa y el plazo.' }],
    },
  ])
  await publicarPreguntas(equipo, vacante)
  await escribirPrueba(equipo, vacante, {
    criterios: [
      {
        nombre: 'Caja',
        puntosCalificados: 100,
        calificador: 'IA',
        preguntas: [{ tipo: 'ABIERTA', enunciado: '¿Cómo hallarías el descuadre de marzo?', queDebeTener: 'La cuenta y el monto.' }],
      },
    ],
    datos: { enunciado: CASO, modalidad: 'CRONOMETRADA', duracionMinutos: 90, guiaCalificacion: 'Mira las cifras.' },
  })
  const publicada = await publicarPrueba(equipo, vacante)
  if (publicada.estado !== 200) throw new Error(`publicar la prueba contestó ${publicada.estado}`)
  // Sin nadie dentro se guarda sin preguntar, como siempre (AC-06)
  await exigir(`/panel/vacantes/${vacante}/version-pesos`, equipo, 'POST', { versionPesosId: versionPesos })
  await exigir(`/panel/vacantes/${vacante}/publicacion`, equipo, 'POST')
  await exigir(`/panel/vacantes/${vacante}/calificacion-automatica`, equipo, 'POST', { activa: false })
  return vacante
}

/** El primer objeto con `tipo: 'ABIERTA'` de una respuesta de la API, buscado a cualquier profundidad. */
function primeraAbierta(nodo: unknown): number | null {
  if (Array.isArray(nodo)) {
    for (const n of nodo) {
      const id = primeraAbierta(n)
      if (id !== null) return id
    }
    return null
  }
  if (nodo && typeof nodo === 'object') {
    const o = nodo as Record<string, unknown>
    if (o.tipo === 'ABIERTA' && typeof o.id === 'number') return o.id
    for (const v of Object.values(o)) {
      const id = primeraAbierta(v)
      if (id !== null) return id
    }
  }
  return null
}

/**
 * Una vacante sin preguntas propias, en la versión de pesos dicha, con una prueba del editor
 * de un solo criterio que califica una PERSONA, y una candidata que ya la entregó: la prueba
 * espera a que alguien le ponga la nota desde el panel, que es lo que la cierra (por el mismo
 * `CierreDeLaPruebaPropia` que usa la IA cuando la califica ella).
 */
export async function pruebaPropiaEntregada(equipo: string, marca: string, versionPesos: number,
                                            correos: string[]): Promise<{ vacante: number; postulacion: number; criterio: number }> {
  const vacante = await crearVacante(equipo, 'Cajera con la prueba a mano', await lugarDe(equipo), undefined, marca)
  await exigir(`/panel/vacantes/${vacante}/aplicacion-evaluacion`, equipo, 'POST', { aplica: false })
  await escribirPrueba(equipo, vacante, {
    criterios: [
      {
        nombre: 'Caja',
        puntosCalificados: 100,
        calificador: 'PERSONA',
        preguntas: [{ tipo: 'ABIERTA', enunciado: '¿Dónde está el descuadre de marzo?', queDebeTener: 'La cuenta y el monto.' }],
      },
    ],
    datos: { enunciado: CASO, modalidad: 'CRONOMETRADA', duracionMinutos: 60, guiaCalificacion: 'Mira las cifras.' },
  })
  const publicada = await publicarPrueba(equipo, vacante)
  if (publicada.estado !== 200) throw new Error(`publicar la prueba contestó ${publicada.estado}`)
  const criterio = Number(criterioDe((publicada.cuerpo as any).publicada, 'Caja').id)
  await exigir(`/panel/vacantes/${vacante}/version-pesos`, equipo, 'POST', { versionPesosId: versionPesos })
  await exigir(`/panel/vacantes/${vacante}/publicacion`, equipo, 'POST')
  await exigir(`/panel/vacantes/${vacante}/calificacion-automatica`, equipo, 'POST', { activa: false })

  const pia = await soloPostula(marca, vacante, 'Pía', correos)
  await exigir(`/panel/postulaciones/${pia.postulacion}/confirmacion-avance`, equipo, 'POST', {
    motivo: `${marca}: pasa a la prueba técnica`,
  })
  await exigir(`/portal/prueba/${pia.uuid}/inicio`, pia.token, 'POST')
  const pregunta = primeraAbierta(await exigir<unknown>(`/portal/prueba/${pia.uuid}`, pia.token))
  if (pregunta === null) throw new Error('La prueba empezada no trae su pregunta abierta')
  await exigir(`/portal/prueba/${pia.uuid}/respuestas/${pregunta}`, pia.token, 'PUT', {
    texto: 'En la cuenta 1041 hay un depósito duplicado de 1 250 soles.',
  })
  await exigir(`/portal/prueba/${pia.uuid}/entrega`, pia.token, 'POST')
  return { vacante, postulacion: pia.postulacion, criterio }
}

export interface Candidato {
  nombre: string
  correo: string
  token: string
  uuid: string
  postulacion: number
}

/** Cuenta de candidato por la API, con login. */
export async function cuenta(marca: string, nombre: string, correos: string[]): Promise<{ correo: string; token: string }> {
  const correo = correoDePrueba(prefijoDeCorreo(marca))
  correos.push(correo)
  await crearCuentaDeCandidato({ nombre, apellidos: 'Pesos QA', correo })
  const r = await fetch(`${API}/portal/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena: CLAVE_DE_CANDIDATO }),
  })
  if (!r.ok) throw new Error(`login portal de ${correo} falló: ${r.status}`)
  return { correo, token: (await r.json()).token as string }
}

/** Postula y no hace nada más: queda sin ninguna nota. */
export async function soloPostula(marca: string, vacante: number, nombre: string, correos: string[]): Promise<Candidato> {
  const { correo, token } = await cuenta(marca, nombre, correos)
  const uuid = await postular(token, vacante)
  return { nombre: `${nombre} Pesos QA`, correo, token, uuid, postulacion: postulacionPorUuid(uuid) }
}

const criterioGlobal = (codigo: string): number =>
  Number(uno(`select id from criterio where codigo = ${literal(codigo)} and version_plantilla_prueba_id is null`).id)

/**
 * Un candidato calificado en el Perfil Integral, como lo deja el flujo de siempre:
 * postula, responde y entrega por la API; la IA pone las notas del currículum de 0 a 100 y
 * cierra el retrato (sembrado: está apagada); y una persona pone la nota de la abierta desde
 * el panel, que recalcula el Perfil Integral con los pesos de la vacante.
 */
export async function candidatoCalificado(
  equipo: string,
  marca: string,
  vacante: number,
  nombre: string,
  notas: { resultados: number; personas: number; abierta: number },
  correos: string[],
): Promise<Candidato> {
  const c = await soloPostula(marca, vacante, nombre, correos)
  await empezarEvaluacion(c.token, c.uuid)
  const preguntaId = Number(
    uno(`select o.pregunta_id from orden_pregunta o join postulacion p on p.evaluacion_id = o.evaluacion_id
          where p.id = ${c.postulacion}`).pregunta_id,
  )
  await responder(c.token, c.uuid, preguntaId, { texto: RESPUESTA })
  await entregar(c.token, c.uuid)
  const respuesta = Number(
    uno(`select r.id from respuesta r join postulacion p on p.evaluacion_id = r.evaluacion_id
          where p.id = ${c.postulacion} and r.pregunta_id = ${preguntaId}`).id,
  )
  sql(`begin;
       insert into nota_criterio (postulacion_id, criterio_id, puntaje, explicacion, origen) values
         (${c.postulacion}, ${criterioGlobal('CV_RESULTADOS')}, ${notas.resultados}, ${literal(`${marca}: resultados del currículum`)}, 'AGENTE'),
         (${c.postulacion}, ${criterioGlobal('CV_PERSONAS')}, ${notas.personas}, ${literal(`${marca}: gestión de personas del currículum`)}, 'AGENTE');
       insert into perfil_talento (postulacion_id, confianza_evidencia, version_pesos_id, actualizado_en, creado_en)
       select p.id, 70, v.version_pesos_id, now(), now()
         from postulacion p join vacante v on v.id = p.vacante_id where p.id = ${c.postulacion};
       insert into transicion_estado (postulacion_id, estado_anterior_codigo, estado_nuevo_codigo,
                                      es_sistema, aviso_al_candidato, ocurrida_en)
       values (${c.postulacion}, 'PERFIL_CALIFICANDO', 'PERFIL_POR_CONFIRMAR', true, 'CORREO', now());
       update postulacion set estado_codigo = 'PERFIL_POR_CONFIRMAR', movido_en = now() where id = ${c.postulacion};
       commit;`)
  await exigir(`/panel/postulaciones/${c.postulacion}/evaluacion/respuestas/${respuesta}/nota`, equipo, 'PUT', {
    puntaje: notas.abierta,
    motivo: `${marca}: la IA no pudo calificarla`,
  })
  return c
}

/**
 * Lo que dejan las etapas de después para un candidato ya decidido: la prueba del puesto
 * calificada (sus puntos no dependen de los pesos), la simulación que puso un facilitador con
 * los pesos de la vacante, y la decisión tomada con la vara de entonces.
 */
export function yaDecidido(postulacion: number, versionPesos: number, prueba: number,
                           simulacion: Record<string, number>, notaDecidida: number): void {
  const decide = Number(uno("select id from usuario where usuario_renaser_os_id = 'dev-equipo'").id)
  const criterios = consultar(`select id, codigo from criterio where etapa_codigo = 'SIMULACION'
                                 and version_plantilla_prueba_id is null and puntos is null order by orden`)
  const filas = criterios
    .map((c) => `(${postulacion}, ${c.id}, ${simulacion[String(c.codigo)] ?? 5}, 'Puesta por el facilitador', 'PERSONA')`)
    .join(', ')
  sql(`begin;
       insert into nota_etapa (postulacion_id, etapa_codigo, puntaje, version_pesos_id, calculada_en)
       values (${postulacion}, 'PRUEBA_PUESTO', ${prueba}, ${versionPesos}, now());
       insert into nota_criterio (postulacion_id, criterio_id, puntaje, explicacion, origen) values ${filas};
       insert into nota_etapa (postulacion_id, etapa_codigo, puntaje, version_pesos_id, calculada_en)
       select ${postulacion}, 'SIMULACION', sum(nc.puntaje), ${versionPesos}, now()
         from nota_criterio nc join criterio c on c.id = nc.criterio_id
        where nc.postulacion_id = ${postulacion} and c.etapa_codigo = 'SIMULACION';
       insert into decision (postulacion_id, semaforo, nota_global, version_pesos_id, decidida_por_usuario_id,
                             motivo, decidida_en)
       values (${postulacion}, 'VERDE', ${notaDecidida}, ${versionPesos}, ${decide}, 'Encaja', now());
       update postulacion set estado_codigo = 'CONTRATADO', movido_en = now() where id = ${postulacion};
       commit;`)
}

// ---------------------------------------------------------------- Lo que se lee

export const notaDe = (postulacion: number, etapa: string): number | null => {
  const filas = consultar(`select puntaje from nota_etapa where postulacion_id = ${postulacion}
                             and etapa_codigo = ${literal(etapa)}`)
  return filas.length ? Number(filas[0]!.puntaje) : null
}

export const versionDeLaNota = (postulacion: number, etapa: string): number | null => {
  const filas = consultar(`select version_pesos_id from nota_etapa where postulacion_id = ${postulacion}
                             and etapa_codigo = ${literal(etapa)}`)
  return filas.length ? Number(filas[0]!.version_pesos_id) : null
}

export const grupoDe = (postulacion: number): string | null =>
  (uno(`select grupo_prioridad from postulacion where id = ${postulacion}`).grupo_prioridad as string | null) ?? null

export const versionDeLaVacante = (vacante: number): number =>
  Number(uno(`select version_pesos_id from vacante where id = ${vacante}`).version_pesos_id)

export const estadoDe = (postulacion: number): string =>
  String(uno(`select estado_codigo from postulacion where id = ${postulacion}`).estado_codigo)

/**
 * El equipo pasa a la prueba del puesto a un candidato con el Perfil Integral calificado, y él
 * la empieza y responde su abierta, sin entregarla todavía.
 */
export async function enLaPruebaSinEntregar(equipo: string, marca: string, c: Candidato): Promise<void> {
  await exigir(`/panel/postulaciones/${c.postulacion}/confirmacion-avance`, equipo, 'POST', {
    motivo: `${marca}: pasa a la prueba técnica`,
  })
  await exigir(`/portal/prueba/${c.uuid}/inicio`, c.token, 'POST')
  const pregunta = primeraAbierta(await exigir<unknown>(`/portal/prueba/${c.uuid}`, c.token))
  if (pregunta === null) throw new Error('La prueba empezada no trae su pregunta abierta')
  await exigir(`/portal/prueba/${c.uuid}/respuestas/${pregunta}`, c.token, 'PUT', {
    texto: 'En la cuenta 1041 hay un depósito duplicado de 1 250 soles.',
  })
}

/** La nota de un criterio de la simulación, en la escala de su peso. */
export const notaDeSimulacion = (postulacion: number, codigo: string): number =>
  Number(uno(`select nc.puntaje from nota_criterio nc join criterio c on c.id = nc.criterio_id
               where nc.postulacion_id = ${postulacion} and c.codigo = ${literal(codigo)}
                 and c.version_plantilla_prueba_id is null`).puntaje)

/** La nota de un criterio tal como se puso y sobre cuánto (V75): «8/10», o «/» si aún no se apuntó. */
export const comoSePuso = (postulacion: number, codigo: string): string =>
  String(uno(`select coalesce(nc.puntaje_original::text, '') || '/' || coalesce(nc.maximo_original::text, '') as v
                from nota_criterio nc join criterio c on c.id = nc.criterio_id
               where nc.postulacion_id = ${postulacion} and c.codigo = ${literal(codigo)}
                 and c.version_plantilla_prueba_id is null`).v)

/**
 * La validación que puso un facilitador ANTES de la V75: las notas en la escala de los pesos
 * de la vacante y sin apuntar cómo se pusieron (`puntaje_original` vacío), como quedaron las
 * filas que la migración no rellena. Los criterios que no se nombran, 6. La nota de la etapa
 * es su suma.
 */
export function validacionDeAntesDeLaV75(postulacion: number, versionPesos: number,
                                         notas: Record<string, number>): void {
  const criterios = consultar(`select id, codigo from criterio where etapa_codigo = 'VALIDACION'
                                 and version_plantilla_prueba_id is null and puntos is null order by orden`)
  const filas = criterios
    .map((c) => `(${postulacion}, ${c.id}, ${notas[String(c.codigo)] ?? 6}, 'Puesta por el facilitador', 'PERSONA')`)
    .join(', ')
  sql(`begin;
       insert into nota_criterio (postulacion_id, criterio_id, puntaje, explicacion, origen) values ${filas};
       insert into nota_etapa (postulacion_id, etapa_codigo, puntaje, version_pesos_id, calculada_en)
       select ${postulacion}, 'VALIDACION', sum(nc.puntaje), ${versionPesos}, now()
         from nota_criterio nc join criterio c on c.id = nc.criterio_id
        where nc.postulacion_id = ${postulacion} and c.etapa_codigo = 'VALIDACION';
       commit;`)
}

/** El id de un criterio global (simulación, validación o currículum) por su código. */
export const idDelCriterio = (codigo: string): number => criterioGlobal(codigo)

/** Todo lo que el cambio de pesos no debe tocar, en una línea que se compara antes y después. */
export function loQueNoSeMueve(vacante: number): string {
  return sql(`
    select (select string_agg(p.id || p.estado_codigo || coalesce(p.movido_en::text, ''), ',' order by p.id)
              from postulacion p where p.vacante_id = ${vacante}) || '/' ||
           (select count(*) from transicion_estado t join postulacion p on p.id = t.postulacion_id
             where p.vacante_id = ${vacante}) || '/' ||
           (select count(*) from trabajo_ia t join postulacion p on p.id = t.postulacion_id
             where p.vacante_id = ${vacante}) || '/' ||
           (select coalesce(string_agg(d.postulacion_id || ':' || d.nota_global || '@' || d.version_pesos_id, ','), '')
              from decision d join postulacion p on p.id = d.postulacion_id where p.vacante_id = ${vacante});`)
}

/** Todas las notas de la vacante con su versión, en una línea. */
export function fotoDeLasNotas(vacante: number): string {
  return sql(`
    select coalesce(string_agg(x, ',' order by x), '') from (
      select ne.postulacion_id || ne.etapa_codigo || ne.puntaje || '@' || ne.version_pesos_id as x
        from nota_etapa ne join postulacion p on p.id = ne.postulacion_id where p.vacante_id = ${vacante}
      union all
      select nc.postulacion_id || '#' || nc.criterio_id || '=' || nc.puntaje
        from nota_criterio nc join postulacion p on p.id = nc.postulacion_id where p.vacante_id = ${vacante}
      union all
      select pt.postulacion_id || 'retrato@' || pt.version_pesos_id
        from perfil_talento pt join postulacion p on p.id = pt.postulacion_id where p.vacante_id = ${vacante}
      union all
      select p.id || 'grupo' || coalesce(p.grupo_prioridad, '-') from postulacion p where p.vacante_id = ${vacante}
      union all
      select 'vacante@' || v.version_pesos_id from vacante v where v.id = ${vacante}) t;`)
}

export const registrosDelCambio = (vacante: number): Fila[] =>
  consultar(`select usuario_id, creado_en, valor_anterior::text as antes, valor_nuevo::text as despues
               from auditoria where accion = 'asignar_version_pesos' and entidad_id = ${vacante} order by id`)

// ---------------------------------------------------------------- La empresa cliente

export interface Clienta {
  id: number
  usuario: number
  token: string
  areaId: number
  puestoId: number
}

/**
 * Una empresa cliente como la da de alta la plataforma (`ServicioPlataformaImpl#sembrar`):
 * los roles de RENASER y su matriz sin `administrar_plataforma`, sus parámetros y un
 * usuario de Talento, Dirección y Administración que entra con correo y contraseña. Sin
 * banco, sin pruebas y sin pesos propios. Con un área y un puesto de Ejecución.
 */
export async function empresaClienta(marca: string, correos: string[]): Promise<Clienta> {
  const conClave = correoDePrueba(`${prefijoDeCorreo(marca)}.clave`)
  correos.push(conClave)
  await crearCuentaDeCandidato({ nombre: 'Clave', apellidos: 'Pesos QA', correo: conClave })
  const deRenaser = plataforma()
  const id = insertar(`insert into organizacion (codigo, nombre)
                       values (${literal(`${prefijoDeEmpresa(marca)}${Date.now()}`)}, ${literal(`${marca} Constructora Andina S.A.C.`)})
                       returning id`)
  sql(`begin;
       insert into rol (organizacion_id, codigo, nombre, descripcion, es_sistema)
         select ${id}, codigo, nombre, descripcion, es_sistema from rol
          where organizacion_id = ${deRenaser} and codigo not like 'QA\\_%';
       insert into rol_permiso (rol_id, permiso_id, alcance)
         select nuevo.id, rp.permiso_id, rp.alcance from rol_permiso rp
           join rol origen on origen.id = rp.rol_id and origen.organizacion_id = ${deRenaser}
           join rol nuevo on nuevo.organizacion_id = ${id} and nuevo.codigo = origen.codigo
           join permiso p on p.id = rp.permiso_id and p.codigo <> 'administrar_plataforma';
       insert into parametro (organizacion_id, codigo, valor, tipo, descripcion)
         select ${id}, codigo, valor, tipo, descripcion from parametro where organizacion_id = ${deRenaser}
         on conflict (organizacion_id, codigo) do nothing;
       commit;`)
  const correo = correoDePrueba(`${prefijoDeCorreo(marca)}.b`)
  const persona = insertar(`insert into persona (nombre, apellidos) values ('Tania', ${literal(`${marca} Talento`)}) returning id`)
  const usuario = insertar(`insert into usuario (organizacion_id, persona_id, correo, contrasena_hash, es_equipo, es_activo)
                            select ${id}, ${persona}, ${literal(correo)}, u.contrasena_hash, true, true
                              from usuario u where u.correo = ${literal(conClave)} returning id`)
  sql(`insert into usuario_rol (usuario_id, rol_id)
       select ${usuario}, id from rol where organizacion_id = ${id} and codigo in ('TALENTO', 'DIRECCION', 'ADMINISTRADOR');`)
  const areaId = insertar(`insert into area (organizacion_id, nombre) values (${id}, ${literal(`${marca} Administración`)}) returning id`)
  const puestoId = insertar(`insert into puesto (organizacion_id, codigo, nombre, nivel_puesto_codigo, familia_codigo)
                             values (${id}, ${literal(`QA_PCP_74_${Date.now()}`)}, ${literal(`${marca} Asistente contable`)},
                                     'EJECUCION', 'OPERACIONES')
                             returning id`)
  const r = await fetch(`${API}/panel/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena: CLAVE_DE_CANDIDATO }),
  })
  if (!r.ok) throw new Error(`login de panel de la clienta falló: ${r.status} ${await r.text()}`)
  return { id, usuario, token: (await r.json()).token as string, areaId, puestoId }
}

/** El banco de RENASER para Ejecución: el publicado hoy y uno anterior, distinto. */
export function bancosDeRenaser(): { publicado: number; anterior: number } {
  const delNivel = `from version_banco where organizacion_id = ${plataforma()} and tipo_banco = 'NIVEL'
                      and vacante_id is null and nivel_puesto_codigo = 'EJECUCION'`
  const publicado = Number(uno(`select id ${delNivel} and estado = 'PUBLICADA'
                                 order by publicada_en desc, id desc limit 1`).id)
  const otros = consultar(`select id ${delNivel} and id <> ${publicado} and estado <> 'BORRADOR'
                             and exists (select 1 from pregunta q where q.version_banco_id = version_banco.id)
                           order by publicada_en asc nulls last, id asc limit 1`)
  if (!otros.length) throw new Error('RENASER no tiene otra versión de su banco de Ejecución con preguntas que fijar')
  return { publicado, anterior: Number(otros[0]!.id) }
}

/** La versión publicada de la prueba de RENASER que traen todas las bases sembradas. */
export const pruebaDeRenaser = (): { version: number; nombre: string } => {
  const f = uno(`select v.id, p.nombre from version_plantilla_prueba v join plantilla_prueba p on p.id = v.plantilla_prueba_id
                  where p.organizacion_id = ${plataforma()} and v.estado = 'PUBLICADA' and p.nombre not like 'QA-%'
                  order by v.id limit 1`)
  return { version: Number(f.id), nombre: String(f.nombre) }
}

/**
 * Otra prueba de RENASER, publicada y genérica (sin puesto): antes de la V74 cualquier
 * clienta la veía en su desplegable. Ahora no debe salir en ningún sitio.
 */
export function otraPruebaDeRenaser(marca: string): { version: number; nombre: string } {
  const nombre = `${marca} Prueba de RENASER que no se presta`
  const plantilla = insertar(`insert into plantilla_prueba (organizacion_id, nombre)
                              values (${plataforma()}, ${literal(nombre)}) returning id`)
  const version = insertar(`insert into version_plantilla_prueba (plantilla_prueba_id, version, enunciado, modalidad,
                                                                  plazo_dias, estado, publicada_en)
                            values (${plantilla}, 1, ${literal(sembrado(marca))}, 'PLAZO_ABIERTO', 3, 'PUBLICADA', now())
                            returning id`)
  sql(`insert into criterio (codigo, nombre, etapa_codigo, version_plantilla_prueba_id, puntos, metodo_verificacion, orden)
       values ('QA_PCP_74', 'Criterio de la prueba prestada', 'PRUEBA_PUESTO', ${version}, 100, 'AGENTE', 1);`)
  return { version, nombre }
}

/**
 * Una vacante de la clienta de ANTES de la V74, tal como la dejó la migración: publicada (o
 * en el estado que se diga), con el banco de RENASER fijado (`fija`) o con una prueba de
 * RENASER asignada (`pruebaAsignada`), o con la prueba del puesto todavía sin elegir.
 */
export function vacanteViejaDeLaClienta(
  b: Clienta,
  marca: string,
  nombre: string,
  como: { estado?: string; aplicaEvaluacion: boolean; fija?: number | null; pruebaAsignada?: number | null },
): number {
  const solicitud = insertar(`
    insert into solicitud_talento (organizacion_id, origen, urgencia, estado, area_id, puesto_id,
                                   resultado_principal, motivo, consecuencia_no_contratar,
                                   analisis_capacidad, responsable_usuario_id)
    values (${b.id}, 'DIRECTA', 'NORMAL', 'CON_VACANTE', ${b.areaId}, ${b.puestoId},
            ${literal(sembrado(marca))}, ${literal(sembrado(marca))}, ${literal(sembrado(marca))},
            ${literal(sembrado(marca))}, ${b.usuario})
    returning id`)
  const plantillaEvaluacion = Number(uno(`select id from plantilla_evaluacion where organizacion_id = ${plataforma()}
                                            and nivel_puesto_codigo = 'EJECUCION' and estado = 'PUBLICADA'
                                          order by version desc limit 1`).id)
  const estado = como.estado ?? 'PUBLICADA'
  return insertar(`
    insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo, descripcion, tipo_cierre, estado,
                         version_pesos_id, responsable_usuario_id, aplica_evaluacion, origen_preguntas,
                         plantilla_evaluacion_id, instrumento_etapa_tecnica, version_plantilla_prueba_id,
                         version_banco_fija_id, ciudad_ubigeo, publicada_en)
    values (${b.id}, ${solicitud}, ${b.puestoId}, ${literal(`${marca} ${nombre}`)}, ${literal(sembrado(marca))},
            'PERMANENTE', ${literal(estado)}, ${pesosDeRenaser()}, ${b.usuario}, ${como.aplicaEvaluacion}, 'NIVEL',
            ${plantillaEvaluacion}, 'PLANTILLA', ${como.pruebaAsignada ?? 'null'}, ${como.fija ?? 'null'}, '1501',
            ${estado === 'BORRADOR' ? 'null' : 'now()'})
    returning id`)
}

/** La versión del banco con la que quedó atada la evaluación de una postulación. */
export const bancoQueRinde = (postulacion: number): number =>
  Number(uno(`select e.version_banco_nivel_id from evaluacion e join postulacion p on p.evaluacion_id = e.id
               where p.id = ${postulacion}`).version_banco_nivel_id)

// ---------------------------------------------------------------- El enunciado del editor

/** Sube un PDF como enunciado del borrador de la prueba del editor. */
export async function subirEnunciado(token: string, vacante: number, nombre: string): Promise<any> {
  const formulario = new FormData()
  formulario.append('archivo', new Blob(['%PDF-1.4 el caso de la caja de marzo'], { type: 'application/pdf' }), nombre)
  const r = await fetch(`${API}${RUTA_PRUEBA(vacante)}/borrador/consigna`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formulario,
  })
  const texto = await r.text()
  if (!r.ok) throw new Error(`subir el enunciado a ${vacante} contestó ${r.status}: ${texto}`)
  return JSON.parse(texto)
}

/** El archivo y el enlace guardado del enunciado de la versión de la prueba de una vacante. */
export function enunciadoGuardado(vacante: number): { archivo: number | null; enlace: string | null }[] {
  return consultar(`select consigna_archivo_id as archivo, url_consigna as enlace from version_banco
                     where vacante_id = ${vacante} and proposito = 'PRUEBA_PUESTO' order by id`).map((f) => ({
    archivo: f.archivo === null ? null : Number(f.archivo),
    enlace: (f.enlace as string | null) ?? null,
  }))
}

// ---------------------------------------------------------------- Lo que no se puede hacer en una línea

/**
 * Lo primero que hace el cambio de pesos real con cada nota de la simulación y la validación
 * (`RecalculoConOtrosPesos.Escalas#llevarALaNueva`), en la misma transacción: a la que todavía
 * no guarda cómo se puso, le apunta su nota y el máximo que tenía en la versión de antes, y solo
 * después la lleva a la escala nueva.
 *
 * Para las sesiones que imitan ese cambio a mitad: si reescriben `puntaje` sin esto, el primer
 * cambio de verdad toma como original la nota ya reescalada (un 0 por peso 0 se queda en 0 para
 * siempre), cosa que el cambio real no deja pasar. Va antes de reescribir nada.
 */
export const apuntarComoSePusieron = (vacante: number, postulacion: number, versionDeAntes: number): string => `
  update nota_criterio nc
     set puntaje_original = nc.puntaje,
         maximo_original = (select pc.peso from peso_criterio pc
                             where pc.criterio_id = nc.criterio_id and pc.version_pesos_id = ${versionDeAntes}
                               and pc.nivel_puesto_codigo = (select pu.nivel_puesto_codigo from vacante v
                                                               join puesto pu on pu.id = v.puesto_id
                                                              where v.id = ${vacante}))
    from criterio c
   where c.id = nc.criterio_id and c.etapa_codigo in ('SIMULACION', 'VALIDACION')
     and c.version_plantilla_prueba_id is null and c.puntos is null
     and nc.postulacion_id = ${postulacion} and nc.puntaje_original is null;`

/**
 * Una transacción que se queda abierta mientras el script duerme (con `pg_sleep`), en otra
 * sesión del mismo clon. Sirve para sostener «a mitad» una operación —el cambio de pesos— y
 * ver qué hace lo que llega mientras tanto. Devuelve cuando la sesión confirma.
 */
export function sesionAbierta(script: string): Promise<string> {
  const db = baseDeDatos()
  db.sql('select 1;') // vuelve a comprobar que el contenedor es el del clon
  return new Promise((resolve, reject) => {
    const psql = spawn('docker', ['exec', '-i', db.id, 'psql', '-X', '-q', '-A', '-t', '-h', '/var/run/postgresql',
      '-U', db.config.PGUSER, '-d', db.config.PGDATABASE, '-v', 'ON_ERROR_STOP=1'])
    let salida = ''
    let error = ''
    psql.stdout.on('data', (d: Buffer) => { salida += d.toString() })
    psql.stderr.on('data', (d: Buffer) => { error += d.toString() })
    psql.on('error', reject)
    psql.on('close', (codigo) =>
      codigo === 0 ? resolve(salida) : reject(new Error(`la sesión abierta salió con ${codigo}: ${error}`)))
    psql.stdin.end(script)
  })
}

/** Una cuenta de panel de RENASER (entra por el dev-login) con Talento menos esos permisos. */
export function equipoSin(marca: string, sufijo: string, sin: readonly string[]): string {
  const renaserOsId = `${prefijoDeCorreo(marca).replace(/\./g, '-')}-${sufijo}`
  const codigo = `${marca.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${sufijo.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
  const deRenaser = plataforma()
  const rol = insertar(`insert into rol (organizacion_id, codigo, nombre, descripcion)
                        values (${deRenaser}, ${literal(codigo)}, ${literal(codigo)}, ${literal(sembrado(marca))}) returning id`)
  sql(`insert into rol_permiso (rol_id, permiso_id, alcance)
       select ${rol}, rp.permiso_id, rp.alcance from rol_permiso rp
         join rol t on t.id = rp.rol_id and t.organizacion_id = ${deRenaser} and t.codigo = 'TALENTO'
         join permiso p on p.id = rp.permiso_id
        where p.codigo not in (${sin.map((c) => literal(c)).join(', ')});`)
  const persona = insertar(`insert into persona (nombre, apellidos) values ('QA', ${literal(renaserOsId)}) returning id`)
  const usuario = insertar(`insert into usuario (organizacion_id, persona_id, usuario_renaser_os_id, es_equipo, es_activo)
                            values (${deRenaser}, ${persona}, ${literal(renaserOsId)}, true, true) returning id`)
  sql(`insert into usuario_rol (usuario_id, rol_id) values (${usuario}, ${rol});`)
  return renaserOsId
}

// ---------------------------------------------------------------- La limpieza

/**
 * Quita lo sembrado con esa marca y nada más: las cuentas por correo exacto, las vacantes
 * (borradas si nadie postuló; eliminadas si no), las solicitudes, la prueba de RENASER de la
 * prueba, la empresa cliente (desactivada) y las dos versiones de pesos.
 */
export function retirarLoSembrado(marca: string, correos: readonly string[]): void {
  const vacantes = consultar(`select id from vacante where titulo like ${literal(`${marca} %`)}`).map((f) => Number(f.id))
  const deRenaser = pesosDeRenaser()
  if (vacantes.length) {
    const ids = vacantes.join(',')
    sql(`begin;
         delete from ejecucion_ia where trabajo_ia_id in (
           select t.id from trabajo_ia t join postulacion p on p.id = t.postulacion_id
            where p.vacante_id in (${ids}) and t.estado = 'EN_CURSO');
         delete from trabajo_ia where estado = 'EN_CURSO'
            and postulacion_id in (select id from postulacion where vacante_id in (${ids}));
         commit;`)
  }
  if (correos.length) borrarCuentasDePrueba(correos)
  if (vacantes.length) {
    const ids = vacantes.join(',')
    // Lo que sobrevive con historial deja de apuntar a las versiones de la prueba
    sql(`begin;
         update nota_etapa set version_pesos_id = ${deRenaser}
          where postulacion_id in (select id from postulacion where vacante_id in (${ids}));
         update perfil_talento set version_pesos_id = ${deRenaser}
          where postulacion_id in (select id from postulacion where vacante_id in (${ids}));
         update decision set version_pesos_id = ${deRenaser}
          where postulacion_id in (select id from postulacion where vacante_id in (${ids}));
         update vacante set version_pesos_id = ${deRenaser} where id in (${ids});
         delete from aviso_portal where vacante_id in (${ids});
         delete from plantilla_correo_vacante where vacante_id in (${ids});
         delete from vacante where id in (${ids})
            and not exists (select 1 from postulacion p where p.vacante_id = vacante.id)
            and not exists (select 1 from version_banco b where b.vacante_id = vacante.id);
         update vacante set eliminada_en = now() where id in (${ids}) and eliminada_en is null;
         commit;`)
  }
  sql(`update solicitud_talento set estado = 'ARCHIVADA'
        where motivo = ${literal(sembrado(marca))} and estado <> 'ARCHIVADA';`)
  // Las copias que hizo una clienta al personalizar sus pesos dejan de colgar de las de la prueba
  sql(`update version_pesos set copiada_de_version_id = null
        where copiada_de_version_id in (select id from version_pesos where etiqueta like ${literal(`${marca} %`)});`)
  sql(`begin;
       create temporary table qa_pcp_versiones on commit drop as
         select id from version_pesos where etiqueta like ${literal(`${marca} %`)}
            and not exists (select 1 from vacante v where v.version_pesos_id = version_pesos.id)
            and not exists (select 1 from nota_etapa n where n.version_pesos_id = version_pesos.id)
            and not exists (select 1 from perfil_talento t where t.version_pesos_id = version_pesos.id)
            and not exists (select 1 from decision d where d.version_pesos_id = version_pesos.id);
       delete from peso_criterio where version_pesos_id in (select id from qa_pcp_versiones);
       delete from peso_componente_perfil where version_pesos_id in (select id from qa_pcp_versiones);
       delete from peso_dimension where version_pesos_id in (select id from qa_pcp_versiones);
       delete from peso_etapa where version_pesos_id in (select id from qa_pcp_versiones);
       delete from version_pesos where id in (select id from qa_pcp_versiones);
       -- La que algo retuviera deja de ofrecerse: un borrador no sale en ningún desplegable
       update version_pesos set estado = 'BORRADOR' where etiqueta like ${literal(`${marca} %`)};
       commit;`)
  sql(`begin;
       create temporary table qa_pcp_pruebas on commit drop as
         select v.id from version_plantilla_prueba v join plantilla_prueba p on p.id = v.plantilla_prueba_id
          where p.nombre like ${literal(`${marca} %`)}
            and not exists (select 1 from vacante x where x.version_plantilla_prueba_id = v.id)
            and not exists (select 1 from intento_prueba i where i.version_plantilla_prueba_id = v.id);
       delete from criterio where version_plantilla_prueba_id in (select id from qa_pcp_pruebas);
       delete from version_plantilla_prueba where id in (select id from qa_pcp_pruebas);
       delete from plantilla_prueba p where p.nombre like ${literal(`${marca} %`)}
          and not exists (select 1 from version_plantilla_prueba v where v.plantilla_prueba_id = p.id);
       commit;`)
  const panel = `${prefijoDeCorreo(marca).replace(/\./g, '-')}-%`
  const roles = `${marca.toUpperCase().replace(/[^A-Z0-9]/g, '_')}\\_%`
  sql(`begin;
       create temporary table qa_pcp_panel on commit drop as
         select id, persona_id from usuario where usuario_renaser_os_id like ${literal(panel)};
       delete from usuario_rol where usuario_id in (select id from qa_pcp_panel);
       delete from usuario u where u.id in (select id from qa_pcp_panel)
          and not exists (select 1 from auditoria a where a.usuario_id = u.id);
       update usuario set es_activo = false, usuario_renaser_os_id = 'qa-retirada-' || gen_random_uuid()
        where id in (select id from qa_pcp_panel);
       delete from persona where id in (select persona_id from qa_pcp_panel)
          and not exists (select 1 from usuario u where u.persona_id = persona.id);
       delete from rol_permiso where rol_id in (select id from rol where codigo like ${literal(roles)});
       delete from rol r where r.codigo like ${literal(roles)}
          and not exists (select 1 from usuario_rol ur where ur.rol_id = r.id);
       commit;`)
  for (const { id } of consultar(`select id from organizacion where codigo like ${literal(`${prefijoDeEmpresa(marca)}%`)}`)) {
    sql(`begin;
         delete from usuario_rol where usuario_id in (select id from usuario where organizacion_id = ${id})
            and not exists (select 1 from auditoria a where a.usuario_id = usuario_rol.usuario_id);
         update usuario set es_activo = false, correo = 'e2e.retirada.' || gen_random_uuid() || '@example.com'
          where organizacion_id = ${id};
         update organizacion set es_activa = false where id = ${id};
         commit;`)
  }
}

export { pedir, exigir, uno, consultar }
