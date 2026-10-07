/**
 * Las preguntas propias de una vacante (backend V66): el editor agrupado por
 * criterios, su publicacion, lo que se cambia con candidatos dentro, la copia
 * entre vacantes, las recomendaciones de la IA y el ajuste a mano de una
 * abierta.
 *
 * Archivo aparte, como las reseñas: son once rutas nuevas de una sola pantalla y
 * meterlas en `panel.ts` las perderia entre las ciento y pico que ya hay.
 *
 * ⚠️ **Los puntos viajan como numero y el servidor exige que sean enteros.** Un
 * 2,5 no se redondea aqui: lo rechaza el backend con su lista de faltas, que es
 * la misma que se pinta al publicar.
 *
 * **Un solo editor para dos cosas (V67).** La prueba técnica de la vacante se
 * escribe en el mismo editor, por otra ruta (`prueba-propia`) y con lo que le
 * falta a una prueba: el caso, el tiempo, los entregables y la parte calificada
 * de cada criterio. Cada función recibe al final la ruta; sin ella es la de las
 * preguntas propias, como siempre. Lo que solo tiene la prueba vive en
 * `pruebaPropia.ts`.
 */

import { pedir } from './cliente'

/** Por dónde va el editor: las preguntas del Perfil Integral o la prueba técnica. */
export type RutaDelEditor = 'preguntas-propias' | 'prueba-propia'

export type TipoDePreguntaPropia = 'ABIERTA' | 'OPCION_UNICA' | 'OPCION_MULTIPLE' | 'ESCALA'

export interface OpcionDeLaVersion {
  id: number
  texto: string
  puntos: number
  /** En la escala, el numero del nivel. */
  orden: number
}

export interface PreguntaDeLaVersion {
  id: number
  tipo: TipoDePreguntaPropia
  enunciado: string
  puntos: number
  criterioId: number | null
  orden: number
  queDebeTener: string | null
  opciones: OpcionDeLaVersion[]
}

export interface CriterioDeLaVersion {
  id: number
  nombre: string
  queEvalua: string | null
  orden: number
  /**
   * La suma de sus preguntas: no se escribe. En la prueba (V69) es lo que vale
   * el criterio, que sí se escribe: su parte calificada es esto menos
   * `puntosSistema`, sus cerradas.
   */
  puntos: number
  puntosSistema: number
  puntosIa: number
  preguntas: PreguntaDeLaVersion[]
  /** Solo en la prueba (V67): los puntos de su parte calificada. */
  puntosCalificados?: number | null
  /** Solo en la prueba: quién califica la parte calificada. */
  calificador?: 'IA' | 'PERSONA' | null
  /**
   * Solo en la prueba: los ids de los entregables que mira. Desde la V68 nadie
   * lo marca: lo deduce el servidor del alcance de cada entregable.
   */
  entregables?: number[] | null
}

export type FormatoDeEntregable = 'ARCHIVO' | 'ENLACE' | 'CUALQUIERA'

export interface EntregableDeLaVersion {
  id: number
  nombre: string
  /** «Qué debe contener»: lo lee el candidato. */
  detalle: string | null
  formato: FormatoDeEntregable
  obligatorio: boolean
  /** «Qué debe tener una buena entrega»: lo leen la IA y quien califica. */
  queDebeTener: string | null
  orden: number
  /** Los criterios que lo miran, deducidos del alcance. */
  criterios: number[]
  /**
   * Su alcance (V68): `PREGUNTA` (el archivo de `preguntaId`), `TODA_LA_PRUEBA`
   * o `PREGUNTAS` (las de `cubre`). Nulo en los de antes, con «Mira» a mano.
   */
  alcance?: AlcanceDeEntregable | null
  preguntaId?: number | null
  cubre?: number[] | null
}

export type AlcanceDeEntregable = 'PREGUNTA' | 'TODA_LA_PRUEBA' | 'PREGUNTAS'

/** Lo que una prueba tiene y unas preguntas no (V67). */
export interface PruebaDeLaVersion {
  enunciado: string | null
  consigna: { archivoId: number; nombre: string | null } | null
  materiales: string | null
  herramientasPermitidas: string | null
  modalidad: 'CRONOMETRADA' | 'PLAZO_ABIERTO' | null
  duracionMinutos: number | null
  /** Solo las publicadas de antes de la V68, sin fecha límite. */
  plazoDias: number | null
  /** Ya no se pinta: desde la V68 no hay «cuestionario». */
  cuestionario: boolean
  entregables: EntregableDeLaVersion[]
}

export interface VersionDePreguntas {
  id: number
  estado: 'BORRADOR' | 'PUBLICADA' | 'ARCHIVADA'
  guiaCalificacion: string | null
  minutosObjetivo: number | null
  versionGuia: number
  /** El balance lo cuadra el servidor: el panel lo pinta tal cual. */
  total: number
  cuantosCriterios: number
  cuantasPreguntas: number
  criterios: CriterioDeLaVersion[]
  sinCriterio: PreguntaDeLaVersion[]
  /** Lo que frena la publicacion, dicho entero. Vacio = se puede publicar. */
  avisos: string[]
  /** Solo en la prueba (V67). */
  prueba?: PruebaDeLaVersion | null
}

export interface ResumenDePreguntas {
  /** En la prueba (V67): SIN_PRUEBA · BORRADOR · PUBLICADA. */
  estado: 'SIN_PREGUNTAS' | 'BORRADOR' | 'PUBLICADAS' | 'SIN_PRUEBA' | 'PUBLICADA'
  puntos: number | null
  criterios: number | null
  preguntas: number | null
  /** Solo en la prueba. */
  entregables?: number | null
  minutos?: number | null
  dias?: number | null
  cuestionario?: boolean | null
}

export interface Recalificacion {
  /** Cuantas personas entregaron: a quienes recalcula un cambio de puntos. */
  rindieron: number
  /** Cuantas tienen abiertas calificadas por la IA: a quienes recalifica la guia nueva. */
  conNota: number
  alDia: number
  recalificando: number
  pendientes: number
  motivos: string[]
}

export interface EditorDePreguntas {
  vacanteId: number
  titulo: string
  nivel: string | null
  /** En la prueba (V67) es el instrumento de la vacante (PRUEBA_PROPIA…). */
  origen: 'NIVEL' | 'VACANTE' | string
  aplicaEvaluacion: boolean
  /** El panel no sabe sus permisos: viaja aqui. */
  puedeEditar: boolean
  /** En la prueba: si alguien ya empezó a rendirla (la vara se congela ahí). */
  hayPostulantes: boolean
  borrador: VersionDePreguntas | null
  publicada: VersionDePreguntas | null
  resumen: ResumenDePreguntas
  recalificacion: Recalificacion | null
  /** PERFIL_INTEGRAL o PRUEBA_PUESTO (V67). */
  proposito?: 'PERFIL_INTEGRAL' | 'PRUEBA_PUESTO'
  /**
   * Solo en la prueba (V68): la fecha límite para dar la prueba, que es de la
   * vacante, y si cambiarla pide un motivo (publicada y con gente dentro).
   */
  fechaLimite?: { cierraEn: string | null; pideMotivo: boolean } | null
}

export interface GuardarOpcion {
  texto: string | null
  puntos: number
}

export interface GuardarPregunta {
  tipo: TipoDePreguntaPropia
  enunciado: string
  puntos: number
  criterioId: number | null
  queDebeTener: string | null
  opciones: GuardarOpcion[]
}

export interface GuardarCriterio {
  nombre: string
  queEvalua: string | null
}

export interface VacanteCopiable {
  vacanteId: number
  titulo: string
  nivel: string | null
  publicadaEn: string | null
  estado: 'ACTIVA' | 'CERRADA' | 'ARCHIVADA'
  criterios: number
  preguntas: number
}

export interface OpcionPropuesta {
  texto: string | null
  puntos: number
}

export interface PreguntaPropuesta {
  tipo: TipoDePreguntaPropia
  enunciado: string
  puntos: number
  queDebeTener: string | null
  opciones: OpcionPropuesta[]
}

export interface CriterioPropuesto {
  /** Con valor, son preguntas para un criterio que ya esta en el borrador. */
  criterioExistenteId: number | null
  nombre: string | null
  queEvalua: string | null
  preguntas: PreguntaPropuesta[]
  /** Solo en la prueba (V67): lo que no suman sus cerradas, ya deducido. */
  parteCalificada?: number | null
  /**
   * Solo en la prueba (V69): lo que vale un criterio nuevo entero. Nulo en uno
   * que ya está en el borrador —sigue valiendo lo mismo— y en las propuestas
   * de antes, que solo traían la parte calificada.
   */
  puntos?: number | null
  calificador?: 'IA' | 'PERSONA' | null
  /** Ya no se usan (V68): «Mira» no lo propone la IA, se deduce. */
  entregables?: number[] | null
  entregablesExistentes?: number[] | null
}

export interface CasoPropuesto {
  enunciado: string | null
  materiales: string | null
  herramientasPermitidas: string | null
}

/** Una pregunta de la propuesta: la posición de su criterio y la suya, desde 0. */
export interface PosicionDePregunta {
  criterio: number
  pregunta: number
}

export interface EntregablePropuesto {
  nombre: string
  detalle: string | null
  formato: FormatoDeEntregable
  obligatorio: boolean | null
  queDebeTener: string | null
  /** V68: el archivo de una pregunta de la propuesta… */
  pregunta?: PosicionDePregunta | null
  /** …o un general de toda la prueba o de unas preguntas. Sin nada, de toda la prueba. */
  todaLaPrueba?: boolean | null
  cubre?: PosicionDePregunta[] | null
}

export interface EstadoDeLaRecomendacion {
  estado: 'SIN_PEDIR' | 'EN_CURSO' | 'LISTA' | 'FALLIDA' | 'DETENIDA'
  motivo: string | null
  propuestaId: number | null
  puntosQueFaltan: number | null
  indicacion: string | null
  propuesta: CriterioPropuesto[]
  /** Solo en la prueba (V67). */
  caso?: CasoPropuesto | null
  entregables?: EntregablePropuesto[] | null
}

export interface RecomendacionPedida {
  encolada: boolean
  mensaje: string
}

export interface CambioAplicado {
  personas: number
  /** Por qué no alcanzó a quien quedaba (la IA apagada, sin cupo…); nulo si alcanzó. */
  motivo?: string | null
}

export interface CorregirInstrucciones {
  guiaCalificacion: string | null
  criterios: { id: number; texto: string | null }[]
  preguntas: { id: number; texto: string | null }[]
  /** Solo en la prueba (V67): el «qué debe tener» de cada entregable. */
  entregables?: { id: number; texto: string | null }[]
}

export interface CambiarPuntos {
  preguntas: { id: number; puntos: number; opciones: { id: number; puntos: number }[] }[]
  /**
   * Solo en la prueba: lo que vale cada criterio con parte calificada (V69).
   * Su parte es eso menos sus cerradas nuevas; uno solo de cerradas vale lo que
   * sumen.
   */
  criterios?: { id: number; puntos: number }[]
}

const base = (vacanteId: number, ruta: RutaDelEditor = 'preguntas-propias') =>
  `/vacantes/${vacanteId}/${ruta}`

export const verPreguntasPropias = (vacanteId: number, ruta?: RutaDelEditor) =>
  pedir<EditorDePreguntas>(base(vacanteId, ruta))

export const abrirBorrador = (vacanteId: number, ruta?: RutaDelEditor) =>
  pedir<EditorDePreguntas>(`${base(vacanteId, ruta)}/borrador`, { metodo: 'POST' })

export const guardarDatosDelBorrador = (
  vacanteId: number,
  datos: { guiaCalificacion: string | null; minutosObjetivo: number | null },
) => pedir<EditorDePreguntas>(`${base(vacanteId)}/borrador`, { metodo: 'PUT', cuerpo: datos })

export const descartarBorrador = (vacanteId: number, ruta?: RutaDelEditor) =>
  pedir<EditorDePreguntas>(`${base(vacanteId, ruta)}/borrador`, { metodo: 'DELETE' })

export const agregarCriterio = (vacanteId: number, datos: GuardarCriterio) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/criterios`, { metodo: 'POST', cuerpo: datos })

export const editarCriterio = (vacanteId: number, criterioId: number, datos: GuardarCriterio) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/criterios/${criterioId}`, {
    metodo: 'PUT',
    cuerpo: datos,
  })

export const quitarCriterio = (vacanteId: number, criterioId: number, ruta?: RutaDelEditor) =>
  pedir<EditorDePreguntas>(`${base(vacanteId, ruta)}/criterios/${criterioId}`, { metodo: 'DELETE' })

export const moverCriterio = (
  vacanteId: number,
  criterioId: number,
  direccion: 'ARRIBA' | 'ABAJO',
  ruta?: RutaDelEditor,
) =>
  pedir<EditorDePreguntas>(`${base(vacanteId, ruta)}/criterios/${criterioId}/movimiento`, {
    metodo: 'POST',
    cuerpo: { direccion },
  })

export const agregarPregunta = (vacanteId: number, datos: GuardarPregunta, ruta?: RutaDelEditor) =>
  pedir<EditorDePreguntas>(`${base(vacanteId, ruta)}/preguntas`, { metodo: 'POST', cuerpo: datos })

export const editarPregunta = (
  vacanteId: number,
  preguntaId: number,
  datos: GuardarPregunta,
  ruta?: RutaDelEditor,
) =>
  pedir<EditorDePreguntas>(`${base(vacanteId, ruta)}/preguntas/${preguntaId}`, {
    metodo: 'PUT',
    cuerpo: datos,
  })

export const quitarPregunta = (vacanteId: number, preguntaId: number, ruta?: RutaDelEditor) =>
  pedir<EditorDePreguntas>(`${base(vacanteId, ruta)}/preguntas/${preguntaId}`, { metodo: 'DELETE' })

export const moverPregunta = (
  vacanteId: number,
  preguntaId: number,
  direccion: 'ARRIBA' | 'ABAJO',
  ruta?: RutaDelEditor,
) =>
  pedir<EditorDePreguntas>(`${base(vacanteId, ruta)}/preguntas/${preguntaId}/movimiento`, {
    metodo: 'POST',
    cuerpo: { direccion },
  })

/** 400 con `faltas` (la lista entera) si algo frena; 409 con postulantes. */
export const publicarPreguntas = (vacanteId: number, ruta?: RutaDelEditor) =>
  pedir<EditorDePreguntas>(`${base(vacanteId, ruta)}/publicacion`, { metodo: 'POST' })

export const corregirInstrucciones = (vacanteId: number, datos: CorregirInstrucciones, ruta?: RutaDelEditor) =>
  pedir<CambioAplicado>(`${base(vacanteId, ruta)}/publicada/instrucciones`, {
    metodo: 'PUT',
    cuerpo: datos,
  })

export const reintentarRecalificacion = (vacanteId: number, ruta?: RutaDelEditor) =>
  pedir<CambioAplicado>(`${base(vacanteId, ruta)}/publicada/recalificacion`, { metodo: 'POST' })

export const cambiarPuntos = (vacanteId: number, datos: CambiarPuntos, ruta?: RutaDelEditor) =>
  pedir<CambioAplicado>(`${base(vacanteId, ruta)}/publicada/puntos`, { metodo: 'PUT', cuerpo: datos })

export const listarCopiables = (vacanteId: number, buscar: string, nivel: string, ruta?: RutaDelEditor) => {
  const q = new URLSearchParams()
  if (buscar.trim()) q.set('buscar', buscar.trim())
  if (nivel) q.set('nivel', nivel)
  const consulta = q.toString()
  return pedir<VacanteCopiable[]>(`${base(vacanteId, ruta)}/copiables${consulta ? `?${consulta}` : ''}`)
}

export const verVistaPrevia = (vacanteId: number, vacanteOrigenId: number, ruta?: RutaDelEditor) =>
  pedir<VersionDePreguntas>(`${base(vacanteId, ruta)}/copiables/${vacanteOrigenId}`)

export const copiarDeOtraVacante = (vacanteId: number, vacanteOrigenId: number, ruta?: RutaDelEditor) =>
  pedir<EditorDePreguntas>(`${base(vacanteId, ruta)}/copia`, {
    metodo: 'POST',
    cuerpo: { vacanteOrigenId },
  })

export const pedirRecomendaciones = (vacanteId: number, indicacion: string | null, ruta?: RutaDelEditor) =>
  pedir<RecomendacionPedida>(`${base(vacanteId, ruta)}/recomendaciones`, {
    metodo: 'POST',
    cuerpo: { indicacion },
  })

export const verRecomendacion = (vacanteId: number, ruta?: RutaDelEditor) =>
  pedir<EstadoDeLaRecomendacion>(`${base(vacanteId, ruta)}/recomendaciones`)

export const agregarDeLaPropuesta = (
  vacanteId: number,
  propuestaId: number,
  datos: {
    criterios: number[]
    preguntas: { criterio: number; pregunta: number }[]
    /** Solo en la prueba (V67): agregar el caso propuesto y entregables sueltos. */
    caso?: boolean
    entregables?: number[]
  },
  ruta?: RutaDelEditor,
) =>
  pedir<EditorDePreguntas>(`${base(vacanteId, ruta)}/recomendaciones/${propuestaId}/agregados`, {
    metodo: 'POST',
    cuerpo: datos,
  })

/** Qué responderá quien postule: la opción de la sección de la vacante. */
export const elegirOrigenDePreguntas = (
  vacanteId: number,
  origen: 'SIN_EVALUACION' | 'NIVEL' | 'VACANTE',
) =>
  pedir<void>(`/vacantes/${vacanteId}/origen-preguntas`, { metodo: 'POST', cuerpo: { origen } })

/** Ajustar la nota de una abierta de las preguntas propias, o ponerla si la IA no pudo. */
export const ajustarNotaDeAbierta = (
  postulacionId: number,
  respuestaId: number,
  datos: { puntaje: number; motivo: string },
) =>
  pedir<void>(`/postulaciones/${postulacionId}/evaluacion/respuestas/${respuestaId}/nota`, {
    metodo: 'PUT',
    cuerpo: datos,
  })

/**
 * La lista de faltas de un 400 del editor, si la trae. El backend la manda en
 * `faltas` para que se pinte como lista y no en una sola linea.
 */
export function faltasDe(causa: unknown): string[] | null {
  const cuerpo = (causa as { cuerpo?: { faltas?: unknown } } | null)?.cuerpo
  const faltas = cuerpo?.faltas
  return Array.isArray(faltas) && faltas.every((f) => typeof f === 'string')
    ? (faltas as string[])
    : null
}
