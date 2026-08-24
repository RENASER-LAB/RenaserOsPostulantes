/**
 * Los 18 estados de una postulacion, traducidos a lo que ve el candidato.
 *
 * Este archivo es el corazon del portal. El backend manda un estado con nombre
 * —nunca un numero de etapa— y aqui se decide cuatro cosas: en que etapa pintar
 * la barra, que titulo poner, que texto de ayuda y que boton mostrar.
 *
 * Si el backend añade un estado, se toca este archivo y nada mas.
 *
 * El nombre de cada estado es `ETAPA_MOMENTO`, y el momento dice de quien se
 * espera algo. Para el candidato la regla es corta:
 *
 *   TURNO_CANDIDATO  -> le toca a el, hay boton
 *   CALIFICANDO      -> la IA esta trabajando, se consulta solo
 *   POR_HABILITAR    -> espera al equipo de Talento
 *   POR_CONFIRMAR    -> espera a que una persona decida
 *
 * Ver `ai-agents--spring-ai/docs/03-ESTADOS-POSTULACION.md`.
 */

import { rutas } from '@/rutas'

// ---------- Las etapas que se pintan en la barra ----------

export const ETAPAS = [
  { clave: 'PERFIL', etiqueta: 'Perfil' },
  { clave: 'PRUEBA', etiqueta: 'Prueba' },
  { clave: 'SIMULACION', etiqueta: 'Simulación' },
  { clave: 'VALIDACION', etiqueta: 'Validación' },
  { clave: 'DECISION', etiqueta: 'Decisión' },
] as const

export type Etapa = (typeof ETAPAS)[number]['clave']

/** Cuantos tramos tiene la barra de pasos. */
export const TOTAL_ETAPAS = ETAPAS.length

export function indiceDeEtapa(etapa: Etapa): number {
  return ETAPAS.findIndex((e) => e.clave === etapa)
}

// ---------- De quien se espera algo ----------

export type EsperaA =
  | 'CANDIDATO'
  | 'SISTEMA'
  | 'EQUIPO'
  | 'RESPONSABLE'
  | 'NADIE'

// ---------- Los 18 estados ----------

export const ESTADOS = [
  'POSTULADA',
  'PERFIL_TURNO_CANDIDATO',
  'PERFIL_CALIFICANDO',
  'PERFIL_POR_CONFIRMAR',
  'PRUEBA_TURNO_CANDIDATO',
  'PRUEBA_CALIFICANDO',
  'PRUEBA_POR_CONFIRMAR',
  'SIMULACION_POR_HABILITAR',
  'SIMULACION_TURNO_CANDIDATO',
  'SIMULACION_POR_CONFIRMAR',
  'VALIDACION_POR_HABILITAR',
  'VALIDACION_TURNO_CANDIDATO',
  'VALIDACION_POR_CONFIRMAR',
  'DECISION_TURNO_CANDIDATO',
  'DECISION_POR_CONFIRMAR',
  'CONTRATADO',
  'NO_CONTINUA',
  'CERRADA',
] as const

export type EstadoPostulacion = (typeof ESTADOS)[number]

// ---------- Lo que el portal enseña de cada estado ----------

export interface Accion {
  /** El texto del boton. */
  etiqueta: string
  /** A donde lleva, a partir del codigo de la postulacion. */
  destino: (uuid: string) => string
}

export interface Momento {
  /** En que tramo de la barra esta. `null` en los finales, que no pintan barra. */
  etapa: Etapa | null
  esperaA: EsperaA
  /** Lo que se pone en grande: que esta pasando. */
  titulo: string
  /** Una linea que explica el titulo. */
  ayuda: string
  /** El boton, si le toca al candidato hacer algo. */
  accion: Accion | null
}

/** Solo mirar el estado y su detalle: no lleva nada del recorrido dentro. */
const MOMENTOS: Record<EstadoPostulacion, Momento> = {
  // ---- Entrada ----
  POSTULADA: {
    etapa: 'PERFIL',
    esperaA: 'SISTEMA',
    titulo: 'Estamos revisando tu postulación',
    ayuda: 'Comprobamos los requisitos indispensables del puesto. No tienes que hacer nada.',
    accion: null,
  },

  // ---- Perfil Integral ----
  PERFIL_TURNO_CANDIDATO: {
    etapa: 'PERFIL',
    esperaA: 'CANDIDATO',
    titulo: 'Tienes una evaluación pendiente',
    ayuda: 'Tus respuestas se guardan solas. Puedes salir y volver donde lo dejaste.',
    accion: { etiqueta: 'Continuar evaluación', destino: rutas.evaluacion },
  },
  PERFIL_CALIFICANDO: {
    etapa: 'PERFIL',
    esperaA: 'SISTEMA',
    titulo: 'Estamos calificando tus respuestas',
    ayuda: 'Se juntan tu currículum y tu evaluación en un solo perfil. Suele tardar poco.',
    accion: null,
  },
  PERFIL_POR_CONFIRMAR: {
    etapa: 'PERFIL',
    esperaA: 'EQUIPO',
    titulo: 'Tu perfil está en revisión',
    ayuda: 'Una persona del equipo revisa el resultado y confirma si continúas.',
    accion: null,
  },

  // ---- Prueba del puesto ----
  PRUEBA_TURNO_CANDIDATO: {
    etapa: 'PRUEBA',
    esperaA: 'CANDIDATO',
    titulo: 'Prueba del puesto habilitada',
    ayuda: 'El cronómetro empieza cuando confirmes, y no se detiene al cerrar la página.',
    accion: { etiqueta: 'Abrir prueba', destino: rutas.prueba },
  },
  PRUEBA_CALIFICANDO: {
    etapa: 'PRUEBA',
    esperaA: 'SISTEMA',
    titulo: 'Estamos calificando tu prueba',
    ayuda: 'Se revisa tu entregable y la explicación de tus decisiones.',
    accion: null,
  },
  PRUEBA_POR_CONFIRMAR: {
    etapa: 'PRUEBA',
    esperaA: 'EQUIPO',
    titulo: 'Tu prueba está en revisión',
    ayuda: 'Una persona del equipo revisa el resultado y confirma si continúas.',
    accion: null,
  },

  // ---- Simulación de trabajo ----
  SIMULACION_POR_HABILITAR: {
    etapa: 'SIMULACION',
    esperaA: 'EQUIPO',
    titulo: 'Esperando una fecha de simulación',
    ayuda: 'Todavía no hay una sesión con cupo para tu vacante. Te avisaremos en cuanto la haya.',
    accion: null,
  },
  SIMULACION_TURNO_CANDIDATO: {
    etapa: 'SIMULACION',
    esperaA: 'CANDIDATO',
    titulo: 'Confirma tu simulación',
    ayuda: 'Elige una de las fechas disponibles. La sesión es grupal y dura dos horas.',
    accion: { etiqueta: 'Elegir fecha', destino: rutas.simulacion },
  },
  SIMULACION_POR_CONFIRMAR: {
    etapa: 'SIMULACION',
    esperaA: 'EQUIPO',
    titulo: 'Tu simulación está en revisión',
    ayuda: 'Pasó la sesión. Falta calificarla y tener la conversación final.',
    accion: null,
  },

  // ---- Validación práctica ----
  VALIDACION_POR_HABILITAR: {
    etapa: 'VALIDACION',
    esperaA: 'EQUIPO',
    titulo: 'Preparando tu periodo de validación',
    ayuda: 'Falta registrar los datos de la vinculación. Te avisaremos cuando empiece.',
    accion: null,
  },
  VALIDACION_TURNO_CANDIDATO: {
    etapa: 'VALIDACION',
    esperaA: 'CANDIDATO',
    titulo: 'Validación en curso',
    ayuda: 'Estás trabajando el periodo acordado. Las métricas se registran solas.',
    accion: { etiqueta: 'Ver detalle', destino: rutas.proceso },
  },
  VALIDACION_POR_CONFIRMAR: {
    etapa: 'VALIDACION',
    esperaA: 'RESPONSABLE',
    titulo: 'Tu validación está en revisión',
    ayuda: 'Terminó el periodo. El responsable del área completa las últimas métricas.',
    accion: null,
  },

  // ---- Decisión ----
  DECISION_TURNO_CANDIDATO: {
    etapa: 'DECISION',
    esperaA: 'CANDIDATO',
    titulo: 'Necesitamos una evidencia más',
    ayuda: 'Hay una duda concreta que queremos resolver antes de decidir.',
    accion: { etiqueta: 'Enviar evidencia', destino: rutas.decision },
  },
  DECISION_POR_CONFIRMAR: {
    etapa: 'DECISION',
    esperaA: 'RESPONSABLE',
    titulo: 'Decisión final en curso',
    ayuda: 'Ya está todo evaluado. Falta la decisión de la persona responsable.',
    accion: null,
  },

  // ---- Finales ----
  CONTRATADO: {
    etapa: null,
    esperaA: 'NADIE',
    titulo: 'Te damos la bienvenida',
    ayuda: 'El proceso terminó y se te contrató. Nos pondremos en contacto contigo.',
    accion: { etiqueta: 'Ver resultado', destino: rutas.proceso },
  },
  NO_CONTINUA: {
    etapa: null,
    esperaA: 'NADIE',
    titulo: 'Proceso finalizado',
    ayuda: 'En esta oportunidad no continúas en el proceso. Gracias por participar.',
    accion: { etiqueta: 'Ver resultado', destino: rutas.proceso },
  },
  CERRADA: {
    etapa: null,
    esperaA: 'NADIE',
    titulo: 'Postulación cerrada',
    ayuda: 'Esta postulación terminó sin llegar a una decisión. Ya no recibirás avisos.',
    accion: { etiqueta: 'Ver detalle', destino: rutas.proceso },
  },
}

// ---------- Lo que usa el resto del portal ----------

/**
 * Que enseñar de un estado. Si el backend manda uno que no conocemos, se
 * devuelve un momento neutro en vez de romper la pantalla: el candidato ve que
 * su proceso sigue vivo y nosotros no perdemos la postulacion.
 */
export function momentoDe(estado: string): Momento {
  return (
    MOMENTOS[estado as EstadoPostulacion] ?? {
      etapa: null,
      esperaA: 'EQUIPO',
      titulo: 'Tu proceso sigue activo',
      ayuda: 'Cuando haya una acción pendiente aparecerá aquí y te llegará un correo.',
      accion: null,
    }
  )
}

export function esEstadoConocido(estado: string): estado is EstadoPostulacion {
  return estado in MOMENTOS
}

/** Los tres estados que cierran una postulacion. */
export function esFinal(estado: string): boolean {
  return estado === 'CONTRATADO' || estado === 'NO_CONTINUA' || estado === 'CERRADA'
}

/** Le toca al candidato: hay boton y hay algo que hacer. */
export function leTocaAlCandidato(estado: string): boolean {
  return momentoDe(estado).esperaA === 'CANDIDATO' && !esFinal(estado)
}

/**
 * La IA esta calificando. No hay nada que hacer, pero la pantalla tiene que
 * enterarse cuando acabe: estos son los estados que se vuelven a consultar solos.
 */
export function estaCalificando(estado: string): boolean {
  return estado === 'POSTULADA' || momentoDe(estado).esperaA === 'SISTEMA'
}

/**
 * Cuantos tramos de la barra van llenos.
 *
 * Los estados finales llenan la barra entera si se contrato, y la dejan donde
 * estaba si no. Como el estado final no dice en que etapa se cayo, el que llama
 * puede pasar la etapa que traiga el historial.
 */
export function tramosCompletados(estado: string, etapaDeCorte?: Etapa): number {
  if (estado === 'CONTRATADO') return TOTAL_ETAPAS
  const etapa = momentoDe(estado).etapa ?? etapaDeCorte
  return etapa === undefined || etapa === null ? 0 : indiceDeEtapa(etapa)
}

// ---------- El recorrido, hito por hito ----------

/**
 * En que punto esta cada una de las cinco etapas.
 *
 * `cumplida` no es lo mismo que «pasada y apagada»: el portal la sigue
 * enseñando con el mismo peso, porque lo que el candidato ya demostro es suyo.
 * `cortada` es la etapa donde se detuvo una postulacion que no continua.
 */
export type PasoDelRecorrido = 'cumplida' | 'en_curso' | 'pendiente' | 'cortada'

export interface Hito {
  clave: Etapa
  etiqueta: string
  paso: PasoDelRecorrido
}

/**
 * Las cinco etapas con su estado, para pintar la linea de hitos.
 *
 * Se calcula desde el estado y nada mas: la lista de postulaciones no trae
 * historial —eso solo llega en el detalle— asi que aqui no hay fechas por
 * etapa y no se inventan.
 *
 * `etapaDeCorte` la puede pasar quien conozca el historial; sin ella, una
 * postulacion cerrada no sabe donde se detuvo y se pinta entera pendiente,
 * que es preferible a señalar una etapa equivocada.
 */
export function recorridoDe(estado: string, etapaDeCorte?: Etapa): Hito[] {
  const contratado = estado === 'CONTRATADO'
  const cortado = estado === 'NO_CONTINUA' || estado === 'CERRADA'
  const actual = momentoDe(estado).etapa ?? etapaDeCorte ?? null
  const indiceActual = actual === null ? -1 : indiceDeEtapa(actual)

  return ETAPAS.map((etapa, i) => {
    let paso: PasoDelRecorrido
    if (contratado) paso = 'cumplida'
    else if (i < indiceActual) paso = 'cumplida'
    else if (i === indiceActual) paso = cortado ? 'cortada' : 'en_curso'
    else paso = 'pendiente'
    return { clave: etapa.clave, etiqueta: etapa.etiqueta, paso }
  })
}

// ---------- El historial se cuenta en pasado ----------

/**
 * Como se nombra un cambio de estado cuando ya ocurrio.
 *
 * Los titulos de `MOMENTOS` estan escritos para el estado ACTUAL y en presente
 * —«Tienes una evaluacion pendiente»—, asi que leidos en un registro de hace
 * tres semanas suenan a que sigue pendiente. Aqui cada estado se nombra como el
 * hecho que fue.
 */
const COMO_OCURRIO: Record<EstadoPostulacion, string> = {
  POSTULADA: 'Enviaste tu postulación',
  PERFIL_TURNO_CANDIDATO: 'Se habilitó tu evaluación',
  PERFIL_CALIFICANDO: 'Entregaste tu evaluación',
  PERFIL_POR_CONFIRMAR: 'Tu perfil pasó a revisión del equipo',
  PRUEBA_TURNO_CANDIDATO: 'Se habilitó tu prueba del puesto',
  PRUEBA_CALIFICANDO: 'Entregaste tu prueba',
  PRUEBA_POR_CONFIRMAR: 'Tu prueba pasó a revisión del equipo',
  SIMULACION_POR_HABILITAR: 'Pasaste a la etapa de simulación',
  SIMULACION_TURNO_CANDIDATO: 'Se abrieron fechas para tu simulación',
  SIMULACION_POR_CONFIRMAR: 'Tu simulación pasó a revisión del equipo',
  VALIDACION_POR_HABILITAR: 'Pasaste a la etapa de validación',
  VALIDACION_TURNO_CANDIDATO: 'Empezó tu periodo de validación',
  VALIDACION_POR_CONFIRMAR: 'Terminó tu periodo de validación',
  DECISION_TURNO_CANDIDATO: 'Se te pidió una evidencia adicional',
  DECISION_POR_CONFIRMAR: 'Tu proceso pasó a la decisión final',
  CONTRATADO: 'Te contrataron',
  NO_CONTINUA: 'El proceso terminó sin continuar',
  CERRADA: 'La postulación se cerró',
}

/** El nombre de un cambio en el registro. En pasado, no en presente. */
export function comoOcurrio(estado: string): string {
  return COMO_OCURRIO[estado as EstadoPostulacion] ?? 'Tu postulación cambió de estado'
}

// ---------- Lo que el historial sabe y la lista no ----------

/**
 * Un cambio de estado, con lo minimo que hace falta para leerlo.
 *
 * Se declara aqui en vez de importar el tipo de la API para que el dominio no
 * dependa de la forma exacta del contrato: cualquier cosa con estas dos claves
 * sirve.
 */
export interface CambioDeEstado {
  estadoNuevo: string
  ocurridaEn: string
}

/**
 * Cuando se alcanzo cada etapa, leido del historial.
 *
 * La lista de postulaciones no trae historial, asi que alli el recorrido va sin
 * fechas. Aqui si las hay, y son las de verdad: la primera vez que la
 * postulacion entro en cada etapa.
 */
export function fechasDelRecorrido(
  historial: CambioDeEstado[],
): Partial<Record<Etapa, string>> {
  const fechas: Partial<Record<Etapa, string>> = {}
  for (const paso of historial) {
    const etapa = momentoDe(paso.estadoNuevo).etapa
    // La primera entrada manda: volver a una etapa no reescribe cuando llegó.
    if (etapa !== null && fechas[etapa] === undefined) fechas[etapa] = paso.ocurridaEn
  }
  return fechas
}

/**
 * En que etapa se detuvo una postulacion que ya termino.
 *
 * Los tres estados finales no dicen donde se cayo la persona, asi que hay que
 * mirar hacia atras: la ultima etapa por la que paso. Sin esto, el recorrido de
 * una postulacion cerrada se pinta entero vacio, y quien hizo la evaluacion y la
 * prueba ve, el dia que le dicen que no, un expediente en blanco.
 */
export function etapaDeCorteDe(historial: CambioDeEstado[]): Etapa | undefined {
  for (let i = historial.length - 1; i >= 0; i--) {
    const etapa = momentoDe(historial[i]!.estadoNuevo).etapa
    if (etapa !== null) return etapa
  }
  return undefined
}

/** El color de la etiqueta de estado en la tarjeta de proceso. */
export function tonoDe(estado: string): 'good' | 'warn' | 'bad' | 'info' {
  if (estado === 'CONTRATADO') return 'good'
  if (estado === 'NO_CONTINUA' || estado === 'CERRADA') return 'info'
  return leTocaAlCandidato(estado) ? 'warn' : 'good'
}

/** El texto corto de esa misma etiqueta. */
export function resumenDe(estado: string): string {
  if (esFinal(estado)) return 'Proceso finalizado'
  if (leTocaAlCandidato(estado)) return 'Te toca a ti'
  if (estaCalificando(estado)) return 'Calificando'
  return 'En revisión'
}
