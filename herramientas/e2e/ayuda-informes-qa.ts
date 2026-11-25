/**
 * El terreno de la QA de los informes por etapa (V84, specs/Ready/informe-pdf-por-etapa).
 *
 * La base sintética del clon no trae a nadie calificado, así que la QA siembra su propia vacante
 * con todo lo que los informes leen. Casi todo va por la API (crear la vacante, sus preguntas
 * propias y su prueba del editor, postular, responder, entregar, poner las notas que pone una
 * persona); con SQL solo va lo que la IA —apagada en el preview— habría dejado:
 *
 *   - las ocho notas del currículum (una ajustada a mano), lo leído del CV y sus afirmaciones;
 *   - el retrato con sus hallazgos y una alerta;
 *   - la nota de la IA de una abierta de la evaluación, con sus cuatro señales;
 *   - las notas de la IA de tres criterios de la prueba.
 *
 * Las personas:
 *   - **María José** (completa): los tres informes, con listas de más de cinco puntos, textos
 *     larguísimos, tildes, «ñ», comillas, saltos de línea y texto parecido a HTML, pretensión
 *     y celular guardados, enlaces de toda clase y notas ajustadas a mano;
 *   - **Bruno** (calificándose): entregó la evaluación y la IA la está calificando;
 *   - **Carla** (solo CV): currículum calificado, sin evaluación.
 *
 * Todo lleva la marca `QA-INF-84`; `retirarLoDeLaQa` lo quita sin tocar nada ajeno.
 */

import { CELULAR_DE_PRUEBA, CLAVE_DE_CANDIDATO, crearCuentaDeCandidato } from './ayuda-candidato'
import { API } from './ayuda'
import { correoDePrueba, literal, sql } from './base-de-datos'
import { equipoSin, retirarLoSembrado } from './ayuda-pesos-con-candidatos'
import {
  consultar,
  editorDe,
  empezarEvaluacion,
  entregar,
  escribirBorrador,
  exigir,
  postular,
  postulacionPorUuid,
  publicarPreguntas,
  responder,
  uno,
} from './ayuda-preguntas-propias'
import { crearVacante, criterioDe, escribirPrueba, lugarDe, publicarPrueba } from './ayuda-prueba-propia'
import { celularUnico } from './ayuda-whatsapp'

export const MARCA = 'QA-INF-84'
export const PUESTO = 'Analista de Recursos Humanos'
export const PRETENSION = 4750
const PREFIJO_CORREO = 'qa.inf.84'

/**
 * Lo que nunca debe salir en un informe: la pretensión y el celular, en todas sus formas. El
 * del CV es fijo; el de cada cuenta es único desde la V92 y `persona` lo añade al sembrarla.
 */
export const PROHIBIDOS = ['4750', '4 750', '4.750', '4,750', '987654321', '987 654 321', CELULAR_DE_PRUEBA]
/** El contenido del entregable subido: el informe nombra el archivo, nunca lo de dentro. */
export const CONTENIDO_DEL_ENTREGABLE = 'CONTENIDO-SECRETO-QA-INF-84'

// ---------------------------------------------------------------- Textos

export const PREGUNTA_CERRADA = '¿Cuántas entrevistas haces por semana en una campaña masiva?'
export const PREGUNTA_ABIERTA_1 = 'Cuéntanos una campaña de selección masiva que lideraste.'
export const PREGUNTA_ABIERTA_2 = '¿Cómo resolviste un conflicto con el comité de seguridad?'
export const RESPUESTA_1 =
  'En la campaña de «Navidad Ñandú» cubrí 45 puestos en 6 semanas.\n' +
  'Usé <b>entrevistas grupales</b> & filtros por WhatsApp; la rotación bajó de 32 % a 18 %. ' +
  'Mi jefa dijo: "no se puede". Igual lo hicimos. ' +
  'Tramo largo para forzar varias líneas: ' +
  'coordiné con tres tiendas, dos turnos y un equipo de cuatro reclutadoras, revisando cada lunes los avances, ' +
  'los descartes por referencias y los ingresos efectivos; cerramos con un costo por contratación de S/ 310. '.repeat(3)
export const RESPUESTA_2 = 'Me reuní con el comité, escuché sus quejas y acordamos un cronograma de EPP.'
export const RESUMEN_DEL_RETRATO =
  'María José demuestra campañas de selección masiva con cifras propias. Su punto débil es la nómina: la nombra sin ejemplos.'

/** Siete demostradas: más de cinco, para ver que salen todas (AC-01h). */
export const DEMOSTRADAS = Array.from({ length: 7 }, (_, i) => `QAINF demostrada ${i + 1}: cubrió ${10 + i} puestos en retail`)
export const CONTRADICHAS = ['QAINF contradicha 1: jefa de área y practicante a la vez en 2022', 'QAINF contradicha 2: dos títulos el mismo año']
export const DECLARADAS = [
  { texto: 'QAINF declarada 1: manejo de planillas y nómina', pregunta: '¿Cuántos colaboradores tenía tu última planilla?' },
  { texto: 'QAINF declarada 2: Excel avanzado', pregunta: 'Cuéntame un reporte que armaste tú.' },
  { texto: 'QAINF declarada 3: inglés intermedio', pregunta: '¿En qué reuniones usaste el inglés?' },
]
export const SIN_INFO = { texto: 'QAINF sin información: certificación en SST', pregunta: '¿Dónde y cuándo te certificaste?' }
/** Siete fortalezas del retrato (AC-07 queda sin efecto por D-1: deben salir todas). */
export const FORTALEZAS = Array.from({ length: 7 }, (_, i) => `QAINF fortaleza ${i + 1}: lidera campañas con cifras propias`)
export const A_FORTALECER = [
  { texto: 'QAINF a fortalecer 1: delega poco', sugerencia: 'Darle un equipo de dos en el primer mes.' },
  { texto: 'QAINF a fortalecer 2: reportes sin indicadores', sugerencia: 'Pedirle un tablero semanal.' },
]
export const CRITICA = 'QAINF crítica: nunca llevó nómina'
export const FALTA_EVIDENCIA = 'QAINF falta evidencia: liderazgo de equipos grandes'
export const ALERTA = 'QAINF demasiado ideal: todas sus campañas salieron perfectas'

/** La explicación del primer criterio: una sigla no corta la frase (AC-01d). */
export const EXPLICACION_CON_SIGLA =
  'Lideró RR. HH. en tres tiendas y redujo la rotación de 32 % a 18 %. Le falta mostrar la nómina con cifras.'
/** Una explicación larguísima: tiene que salir entera, sin «…» (D-1). */
export const EXPLICACION_LARGA =
  'QAINF explicación larga: ' +
  'describe con detalle cada campaña, sus plazos, los filtros y los resultados de cada tienda, y aun así deja dudas sobre la nómina; '.repeat(5) +
  'FIN-DE-LA-EXPLICACION.'
export const MOTIVO_CV = 'QAINF motivo CV: el puesto pide nómina desde el primer mes'
export const MOTIVO_PRUEBA = 'QAINF motivo prueba: la hoja de cálculo no abrió'
export const MOTIVO_PERSONA = 'QAINF motivo persona: presentación clara y breve'

export const CASO = 'Una cadena de tres tiendas necesita 45 personas en seis semanas; la rotación es del 32 %.'
export const CRITERIOS_PRUEBA = ['Diagnóstico del problema', 'Plan de reclutamiento', 'Presupuesto del plan', 'Presentación ejecutiva'] as const
export const PREGUNTAS_PRUEBA = [
  '¿Qué causa la rotación en las tres tiendas?',
  '¿Cómo cubrirías las 45 vacantes en seis semanas?',
  '¿Cuánto cuesta tu plan y por qué?',
  'Resume tu plan en cinco líneas para el gerente.',
] as const
export const ENTREGABLES = ['Cronograma por tienda', 'Presupuesto en hoja de cálculo'] as const

// ---------------------------------------------------------------- Escenario

export interface Persona {
  nombre: string
  correo: string
  token: string
  uuid: string
  postulacion: number
  /** El celular de su cuenta: nuevo en cada siembra (V92) y entre los PROHIBIDOS. */
  celular: ReturnType<typeof celularUnico>
}

export interface Escenario {
  vacante: number
  titulo: string
  maria: Persona
  bruno: Persona
  carla: Persona
  /** dev-login de una cuenta de Talento sin «ver_respuestas_evaluacion». */
  sinRespuestas: string
  /** dev-login de una cuenta de Talento sin «ver_embudo». */
  sinEmbudo: string
}

function insertarId(consulta: string): number {
  const filas = JSON.parse(sql(`with f as (${consulta}) select coalesce(json_agg(f), '[]') from f;`)) as { id: number }[]
  if (filas.length !== 1) throw new Error(`La inserción devolvió ${filas.length} filas: ${consulta}`)
  return Number(filas[0]!.id)
}

async function persona(vacante: number, nombre: string, apellidos: string, correos: string[]): Promise<Persona> {
  const correo = correoDePrueba(PREFIJO_CORREO)
  correos.push(correo)
  // Desde la V92 un celular es de una sola cuenta: cada persona lleva uno nuevo y, como el de la
  // cuenta tampoco puede salir en un informe, entra en los prohibidos con sus dos formas.
  const celular = celularUnico()
  PROHIBIDOS.push(celular.e164.slice(3), celular.escrito)
  await crearCuentaDeCandidato({ nombre, apellidos, correo, telefono: celular.escrito })
  const r = await fetch(`${API}/portal/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena: CLAVE_DE_CANDIDATO }),
  })
  if (!r.ok) throw new Error(`login portal de ${correo} falló: ${r.status}`)
  const token = (await r.json()).token as string
  const uuid = await postular(token, vacante)
  return { nombre: `${nombre} ${apellidos}`, correo, token, uuid, postulacion: postulacionPorUuid(uuid), celular }
}

/** Lo que la IA habría dejado al leer el currículum: notas, datos, afirmaciones. */
function curriculumCalificado(p: number, conAfirmaciones: boolean): void {
  const ajusta = Number(uno("select id from usuario where usuario_renaser_os_id = 'dev-equipo'").id)
  const criterios = consultar(`select id from criterio where etapa_codigo = 'PERFIL_INTEGRAL'
                                  and version_plantilla_prueba_id is null order by orden`).map((f) => Number(f.id))
  const filas = criterios.map((id, i) => {
    const explicacion = i === 0 ? EXPLICACION_CON_SIGLA : i === 1 ? EXPLICACION_LARGA : `QAINF criterio ${i + 1}: lo demuestra con un ejemplo.`
    const puntaje = 50 + i * 5
    if (i === 2) {
      return `(${p}, ${id}, 41, ${literal(explicacion)}, 'AGENTE', ${ajusta}, ${literal(MOTIVO_CV)}, now())`
    }
    return `(${p}, ${id}, ${puntaje}, ${literal(explicacion)}, 'AGENTE', null, null, null)`
  })
  sql(`insert into nota_criterio (postulacion_id, criterio_id, puntaje, explicacion, origen,
                                  ajustada_por_usuario_id, motivo_ajuste, ajustada_en) values ${filas.join(', ')};`)
  sql(`update cv set texto_extraido = ${literal('Analista de selección con cuatro años en retail. '.repeat(20))}
        where postulacion_id = ${p};`)
  if (!conAfirmaciones) return
  sql(`insert into dato_cv (postulacion_id, nombre, email, telefono, perfil_resumen, habilidades,
                            experiencia_meses_total, ultimo_puesto, ultima_empresa, ultima_meses_duracion, educacion_maxima)
       values (${p}, 'QAINF', 'qainf@example.com', '987654321',
               ${literal('Analista de RR. HH. con foco en selección masiva y clima laboral en retail.')},
               'Selección masiva | Excel | Entrevistas por competencias | Onboarding | Clima laboral | SST | Power BI',
               50, 'Analista de Selección', 'Retail Sur S.A.C.', 29, 'Licenciada en Psicología');`)
  const cv = Number(uno(`select id from cv where postulacion_id = ${p}`).id)
  const afirmaciones = [
    ...DEMOSTRADAS.map((t) => `(${cv}, ${literal(t)}, 'DEMOSTRADA', null)`),
    ...CONTRADICHAS.map((t) => `(${cv}, ${literal(t)}, 'CONTRADICHA', null)`),
    ...DECLARADAS.map((d) => `(${cv}, ${literal(d.texto)}, 'DECLARADA', ${literal(d.pregunta)})`),
    `(${cv}, ${literal(SIN_INFO.texto)}, 'FALTA_INFO', ${literal(SIN_INFO.pregunta)})`,
  ]
  sql(`insert into afirmacion_cv (cv_id, texto, clasificacion, pregunta_validacion) values ${afirmaciones.join(', ')};`)
}

/** El retrato con sus hallazgos, como lo cierra la IA al acabar el Perfil Integral. */
function retrato(p: number): void {
  const perfil = insertarId(`insert into perfil_talento (postulacion_id, confianza_evidencia, resumen, version_pesos_id,
                                                         actualizado_en, creado_en)
                             select p.id, 70, ${literal(RESUMEN_DEL_RETRATO)}, v.version_pesos_id, now(), now()
                               from postulacion p join vacante v on v.id = p.vacante_id where p.id = ${p} returning id`)
  const hallazgos = [
    ...FORTALEZAS.map((t) => `(${perfil}, 'FORTALEZA', ${literal(t)}, null, null)`),
    ...A_FORTALECER.map((h) => `(${perfil}, 'RIESGO_DESARROLLABLE', ${literal(h.texto)}, ${literal(h.sugerencia)}, null)`),
    `(${perfil}, 'RIESGO_CRITICO', ${literal(CRITICA)}, null, null)`,
    `(${perfil}, 'FALTA_EVIDENCIA', ${literal(FALTA_EVIDENCIA)}, null, 'Solo menciona equipos de cuatro.')`,
  ]
  sql(`insert into hallazgo_perfil (perfil_talento_id, tipo, descripcion, sugerencia, evidencia) values ${hallazgos.join(', ')};
       insert into alerta (postulacion_id, tipo, descripcion) values (${p}, 'DEMASIADO_IDEAL', ${literal(ALERTA)});`)
}

/** Las redes del perfil: dos que no son web y seis que sí (salen como mucho cuatro). */
function enlacesDelPerfil(correo: string): void {
  const persona = Number(uno(`select persona_id from usuario where correo = ${literal(correo)}`).persona_id)
  sql(`insert into perfil_candidato (persona_id) values (${persona}) on conflict (persona_id) do nothing;`)
  const perfil = Number(uno(`select id from perfil_candidato where persona_id = ${persona}`).id)
  const enlaces: [string, string][] = [
    ['LINKEDIN', 'https://www.linkedin.com/in/qa-inf-84'],
    ['OTRO', 'javascript:alert(1)'],
    ['OTRO', 'ftp://archivos.example.com/cv.pdf'],
    ['GITHUB', 'https://github.com/qa-inf-84'],
    ['PORTAFOLIO', 'http://portafolio-qa-inf-84.example.com'],
    ['PUBLICACION', 'https://blog-qa-inf-84.example.com/campana'],
    ['PRODUCTO', 'https://producto-qa-inf-84.example.com'],
  ]
  sql(`insert into enlace_perfil (perfil_candidato_id, tipo, url) values
       ${enlaces.map(([t, u]) => `(${perfil}, ${literal(t)}, ${literal(u)})`).join(', ')};`)
}

const respuestaDe = (p: number, enunciado: string): number =>
  Number(
    uno(`select r.id from respuesta r join postulacion p on p.evaluacion_id = r.evaluacion_id
           join pregunta q on q.id = r.pregunta_id
          where p.id = ${p} and q.enunciado = ${literal(enunciado)}`).id,
  )

/** Responde y entrega la evaluación de preguntas propias por el portal. */
async function rendirLaEvaluacion(c: Persona): Promise<void> {
  await empezarEvaluacion(c.token, c.uuid)
  const preguntas = consultar(`select q.id, q.enunciado from orden_pregunta o
                                 join postulacion p on p.evaluacion_id = o.evaluacion_id
                                 join pregunta q on q.id = o.pregunta_id
                                where p.id = ${c.postulacion} order by o.posicion`)
  for (const q of preguntas) {
    const enunciado = String(q.enunciado)
    if (enunciado === PREGUNTA_CERRADA) {
      const opcion = Number(uno(`select id from opcion where pregunta_id = ${q.id} and texto = 'Más de 40'`).id)
      await responder(c.token, c.uuid, Number(q.id), { opcionId: opcion })
    } else if (enunciado === PREGUNTA_ABIERTA_1) {
      await responder(c.token, c.uuid, Number(q.id), { texto: RESPUESTA_1 })
    } else {
      await responder(c.token, c.uuid, Number(q.id), { texto: RESPUESTA_2 })
    }
  }
  await entregar(c.token, c.uuid)
}

/** Crea la vacante con preguntas propias y prueba del editor, publicada y sin pase automático. */
async function vacante(equipo: string, marca: string): Promise<{ id: number; criteriosPrueba: Record<string, number> }> {
  const id = await crearVacante(equipo, PUESTO, await lugarDe(equipo), undefined, marca)
  await escribirBorrador(equipo, id, [
    {
      nombre: 'Selección',
      preguntas: [
        {
          tipo: 'OPCION_UNICA',
          enunciado: PREGUNTA_CERRADA,
          puntos: 20,
          opciones: [{ texto: 'Más de 40', puntos: 20 }, { texto: 'Menos de 10', puntos: 0 }],
        },
        { tipo: 'ABIERTA', enunciado: PREGUNTA_ABIERTA_1, puntos: 50, queDebeTener: 'Cifras, plazos y su papel.' },
      ],
    },
    {
      nombre: 'Relaciones laborales',
      preguntas: [{ tipo: 'ABIERTA', enunciado: PREGUNTA_ABIERTA_2, puntos: 30, queDebeTener: 'El conflicto y el acuerdo.' }],
    },
  ])
  await publicarPreguntas(equipo, id)
  await escribirPrueba(equipo, id, {
    criterios: CRITERIOS_PRUEBA.map((nombre, i) => ({
      nombre,
      puntosCalificados: i < 2 ? 30 : 20,
      calificador: i === 3 ? ('PERSONA' as const) : ('IA' as const),
      preguntas: [{ tipo: 'ABIERTA' as const, enunciado: PREGUNTAS_PRUEBA[i]!, queDebeTener: 'Cifras del caso.' }],
    })),
    entregables: [
      { nombre: ENTREGABLES[0], formato: 'ARCHIVO', obligatorio: true, todaLaPrueba: true },
      { nombre: ENTREGABLES[1], formato: 'CUALQUIERA', obligatorio: false, todaLaPrueba: true },
    ],
    datos: { enunciado: CASO, modalidad: 'CRONOMETRADA', duracionMinutos: 120, guiaCalificacion: 'Mira las cifras.' },
  })
  const publicada = await publicarPrueba(equipo, id)
  if (publicada.estado !== 200) throw new Error(`publicar la prueba contestó ${publicada.estado}`)
  const criteriosPrueba: Record<string, number> = {}
  for (const nombre of CRITERIOS_PRUEBA) {
    criteriosPrueba[nombre] = Number(criterioDe((publicada.cuerpo as any).publicada, nombre).id)
  }
  await exigir(`/panel/vacantes/${id}/publicacion`, equipo, 'POST')
  await exigir(`/panel/vacantes/${id}/calificacion-automatica`, equipo, 'POST', { activa: false })
  return { id, criteriosPrueba }
}

/**
 * Siembra el escenario entero. `correos` recoge las cuentas para la limpieza. La suite usa
 * `MARCA`; para dejar casos a la vista de la revisión humana se usa otra marca que no empiece
 * por `QA-INF-84`, y así la limpieza de la suite no los toca.
 */
export async function sembrarInformes(equipo: string, correos: string[], marca: string = MARCA): Promise<Escenario> {
  const { id, criteriosPrueba } = await vacante(equipo, marca)
  const titulo = String(uno(`select titulo from vacante where id = ${id}`).titulo)

  // ---- María José: los tres informes
  const maria = await persona(id, 'María José', "Ñahui O'Connor", correos)
  sql(`update postulacion set pretension_monto = ${PRETENSION}, pretension_moneda = 'PEN', pretension_declarada_en = now()
        where id = ${maria.postulacion};`)
  enlacesDelPerfil(maria.correo)
  await rendirLaEvaluacion(maria)
  curriculumCalificado(maria.postulacion, true)
  retrato(maria.postulacion)
  sql(`insert into transicion_estado (postulacion_id, estado_anterior_codigo, estado_nuevo_codigo, es_sistema,
                                      aviso_al_candidato, ocurrida_en)
       values (${maria.postulacion}, 'PERFIL_CALIFICANDO', 'PERFIL_POR_CONFIRMAR', true, 'CORREO', now());
       update postulacion set estado_codigo = 'PERFIL_POR_CONFIRMAR', movido_en = now() where id = ${maria.postulacion};`)
  // La abierta 1 la calificó la IA con sus cuatro señales; la 2 la pone una persona, que cierra la nota.
  const guia = Number((await editorDe(equipo, id)).publicada.versionGuia)
  sql(`insert into nota_respuesta (respuesta_id, puntaje, explicacion, evidencia_citada, version_guia,
                                   c1_episodio, c2_autoria, c3_dato, c4_incomodidad)
       values (${respuestaDe(maria.postulacion, PREGUNTA_ABIERTA_1)}, 42,
               ${literal('QAINF explicación abierta 1: cuenta la campaña con cifras propias y su papel.')},
               ${literal('cubrí 45 puestos en 6 semanas')}, ${guia}, true, true, true, false);`)
  await exigir(`/panel/postulaciones/${maria.postulacion}/evaluacion/respuestas/${respuestaDe(maria.postulacion, PREGUNTA_ABIERTA_2)}/nota`,
    equipo, 'PUT', { puntaje: 20, motivo: 'QAINF motivo abierta 2: la IA no la calificó' })

  // Su prueba del editor: pasa a la etapa, responde, entrega un archivo y deja otro sin entregar.
  await exigir(`/panel/postulaciones/${maria.postulacion}/confirmacion-avance`, equipo, 'POST', {
    motivo: `${marca}: pasa a la prueba técnica`,
  })
  const prueba = await exigir<any>(`/portal/prueba/${maria.uuid}/inicio`, maria.token, 'POST')
  for (const q of prueba.preguntas as any[]) {
    await exigir(`/portal/prueba/${maria.uuid}/respuestas/${q.id}`, maria.token, 'PUT', {
      texto: `QAINF respuesta de la prueba a «${q.enunciado}»: 45 personas, S/ 13 950 en total.`,
    })
  }
  const cronograma = (prueba.entregables as any[]).find((e) => e.nombre === ENTREGABLES[0])
  const subida = await subirArchivoConContenido(maria, Number(cronograma.id))
  if (subida !== 200) throw new Error(`subir el cronograma contestó ${subida}`)
  await exigir(`/portal/prueba/${maria.uuid}/entrega`, maria.token, 'POST')
  const intento = Number(uno(`select id from intento_prueba where postulacion_id = ${maria.postulacion}`).id)
  const notasIa: [string, number][] = [[CRITERIOS_PRUEBA[0], 27], [CRITERIOS_PRUEBA[1], 17], [CRITERIOS_PRUEBA[2], 15]]
  sql(`insert into nota_criterio_prueba (intento_prueba_id, criterio_banco_id, puntaje, explicacion, evidencia, origen, version_guia)
       values ${notasIa
         .map(([n, v]) => `(${intento}, ${criteriosPrueba[n]}, ${v}, ${literal(`QAINF explicación de ${n}: usa las cifras del caso.`)}, 'cifras del caso', 'IA', 1)`)
         .join(', ')};`)
  // Una persona ajusta el presupuesto y pone la nota de la presentación: eso cierra la prueba.
  await exigir(`/panel/postulaciones/${maria.postulacion}/prueba-propia/criterios/${criteriosPrueba[CRITERIOS_PRUEBA[2]]}/nota`,
    equipo, 'PUT', { puntaje: 11, motivo: MOTIVO_PRUEBA })
  await exigir(`/panel/postulaciones/${maria.postulacion}/prueba-propia/criterios/${criteriosPrueba[CRITERIOS_PRUEBA[3]]}/nota`,
    equipo, 'PUT', { puntaje: 19, motivo: MOTIVO_PERSONA })

  // ---- Bruno: entregó la evaluación y la IA la está calificando
  const bruno = await persona(id, 'Bruno', 'Díaz Calificándose', correos)
  await rendirLaEvaluacion(bruno)
  sql(`insert into trabajo_ia (organizacion_id, agente_codigo, postulacion_id, referencia_tabla, referencia_id, estado, modo)
       select organizacion_id, 'EVALUADOR', id, 'postulacion', id, 'EN_CURSO', 'FINA' from postulacion where id = ${bruno.postulacion};`)

  // ---- Carla: solo el currículum calificado
  const carla = await persona(id, 'Carla', 'Solo CV', correos)
  curriculumCalificado(carla.postulacion, false)

  return {
    vacante: id,
    titulo,
    maria,
    bruno,
    carla,
    sinRespuestas: equipoSin(marca, 'sin-respuestas', ['ver_respuestas_evaluacion']),
    sinEmbudo: equipoSin(marca, 'sin-embudo', ['ver_embudo']),
  }
}

/** Una explicación de criterio de largo corriente (unos 240 caracteres, el techo que la spec pide al redactor). */
export const EXPLICACION_CORRIENTE =
  'Muestra resultados con cifras en sus dos últimos puestos: redujo el tiempo de contratación de 30 a 18 días y cubrió ' +
  '45 vacantes de temporada en seis semanas; falta evidencia de su papel exacto en el equipo.'

/**
 * Un currículum corriente para Carla: ocho explicaciones de largo normal, cinco demostradas, una que no
 * cuadra y tres dudas con su pregunta. Con esto los tres bloques tienen que empezar en la primera hoja (D-1).
 */
export function curriculumCorriente(p: number): void {
  const cv = Number(uno(`select id from cv where postulacion_id = ${p}`).id)
  const afirmaciones = [
    ...['Redujo el tiempo de contratación de 30 a 18 días', 'Cubrió 45 vacantes de temporada en seis semanas',
      'Diseñó el proceso de inducción de tiendas', 'Lideró un equipo de cuatro reclutadoras',
      'Implementó entrevistas por competencias'].map((t) => `(${cv}, ${literal(t)}, 'DEMOSTRADA', null)`),
    `(${cv}, 'Jefa de área y practicante en el mismo periodo', 'CONTRADICHA', null)`,
    `(${cv}, 'Manejo de planillas y nómina', 'DECLARADA', '¿Cuántos colaboradores tenía tu última planilla?')`,
    `(${cv}, 'Excel avanzado', 'DECLARADA', 'Cuéntame un reporte que armaste tú.')`,
    `(${cv}, 'Inglés intermedio', 'FALTA_INFO', '¿En qué reuniones usaste el inglés?')`,
  ]
  sql(`begin;
       update nota_criterio set explicacion = ${literal(EXPLICACION_CORRIENTE)}
        where postulacion_id = ${p} and criterio_id in (select id from criterio where etapa_codigo = 'PERFIL_INTEGRAL'
                                                          and version_plantilla_prueba_id is null);
       insert into dato_cv (postulacion_id, nombre, perfil_resumen, habilidades, experiencia_meses_total, ultimo_puesto,
                            ultima_empresa, ultima_meses_duracion, educacion_maxima)
       values (${p}, 'Carla', 'Analista de selección con foco en retail y campañas masivas.',
               'Selección masiva | Excel | Entrevistas | Onboarding | Clima', 62, 'Analista de Selección Senior',
               'Tiendas del Sur S.A.', 30, 'Bachiller en Psicología');
       insert into afirmacion_cv (cv_id, texto, clasificacion, pregunta_validacion) values ${afirmaciones.join(', ')};
       commit;`)
}

/** Un currículum con mucho de todo (F-1, D-1): cada punto lleva su número para buscarlo entero en el PDF. */
export const MUCHO = {
  explicacion: [EXPLICACION_CORRIENTE, EXPLICACION_CORRIENTE, EXPLICACION_CORRIENTE].join(' '),
  demostradas: Array.from({ length: 12 }, (_, i) =>
    `QAINF mucho demostrada ${i + 1}: cubrió ${20 + i} vacantes de temporada con entrevistas grupales y filtros por WhatsApp`),
  contradichas: Array.from({ length: 4 }, (_, i) =>
    `QAINF mucho contradicha ${i + 1}: dos cargos de jornada completa en el mismo periodo de 202${i}`),
  dudas: Array.from({ length: 6 }, (_, i) => ({
    texto: `QAINF mucho duda ${i + 1}: maneja planillas de más de ${100 + i * 10} personas`,
    pregunta: `¿Pregunta de validación número ${i + 1} sobre la planilla que cerraste?`,
    clasificacion: i % 3 === 2 ? 'FALTA_INFO' : 'DECLARADA',
  })),
}

/**
 * El currículum de Carla con mucho contenido: ocho explicaciones el triple de largas, doce demostradas,
 * cuatro que no cuadran y seis dudas. Reemplaza lo leído del CV y sus afirmaciones (sin tocar nada ajeno a
 * esa postulación). Con esto la primera hoja tiene que guardar el comienzo de cada bloque y lo demás pasa
 * a la segunda sin partir ningún punto (D-1).
 */
export function curriculumConMucho(p: number): void {
  const cv = Number(uno(`select id from cv where postulacion_id = ${p}`).id)
  const afirmaciones = [
    ...MUCHO.demostradas.map((t) => `(${cv}, ${literal(t)}, 'DEMOSTRADA', null)`),
    ...MUCHO.contradichas.map((t) => `(${cv}, ${literal(t)}, 'CONTRADICHA', null)`),
    ...MUCHO.dudas.map((d) => `(${cv}, ${literal(d.texto)}, '${d.clasificacion}', ${literal(d.pregunta)})`),
  ]
  sql(`begin;
       update nota_criterio set explicacion = ${literal(MUCHO.explicacion)}
        where postulacion_id = ${p} and criterio_id in (select id from criterio where etapa_codigo = 'PERFIL_INTEGRAL'
                                                          and version_plantilla_prueba_id is null);
       delete from afirmacion_cv where cv_id = ${cv};
       delete from dato_cv where postulacion_id = ${p};
       insert into dato_cv (postulacion_id, nombre, perfil_resumen, habilidades, experiencia_meses_total, ultimo_puesto,
                            ultima_empresa, ultima_meses_duracion, educacion_maxima)
       values (${p}, 'Carla', 'Analista de selección con foco en retail y campañas masivas.',
               'Selección masiva | Excel | Entrevistas | Onboarding | Clima', 62, 'Analista de Selección Senior',
               'Tiendas del Sur S.A.', 30, 'Bachiller en Psicología');
       insert into afirmacion_cv (cv_id, texto, clasificacion, pregunta_validacion) values ${afirmaciones.join(', ')};
       commit;`)
}

/** Un PDF de entregable con un contenido reconocible, para comprobar que el informe no lo copia. */
async function subirArchivoConContenido(c: Persona, entregable: number): Promise<number> {
  const formulario = new FormData()
  formulario.append('archivo', new Blob([`%PDF-1.4 ${CONTENIDO_DEL_ENTREGABLE}`], { type: 'application/pdf' }), 'cronograma.pdf')
  const r = await fetch(`${API}/portal/prueba/${c.uuid}/entregables/${entregable}/archivo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}` },
    body: formulario,
  })
  return r.status
}
/** Quita lo de la QA: los textos del redactor (V84), los trabajos sembrados y lo de la marca. */
export function retirarLoDeLaQa(correos: readonly string[], marca: string = MARCA): void {
  const vacantes = consultar(`select id from vacante where titulo like ${literal(`${marca} %`)}`).map((f) => Number(f.id))
  if (vacantes.length) {
    const ids = vacantes.join(',')
    sql(`begin;
         delete from texto_informe where postulacion_id in (select id from postulacion where vacante_id in (${ids}));
         delete from ejecucion_ia where trabajo_ia_id in (
           select t.id from trabajo_ia t join postulacion p on p.id = t.postulacion_id where p.vacante_id in (${ids}));
         delete from trabajo_ia where postulacion_id in (select id from postulacion where vacante_id in (${ids}));
         delete from nota_criterio_prueba where intento_prueba_id in (
           select i.id from intento_prueba i join postulacion p on p.id = i.postulacion_id where p.vacante_id in (${ids}));
         commit;`)
  }
  retirarLoSembrado(marca, correos)
}
