/**
 * Los contratos del backend, copiados uno a uno.
 *
 * Cada tipo de aqui es un `record` de Java al otro lado. Si cambia alla, cambia
 * aqui. Las fechas llegan como texto ISO —lo que Jackson hace con un `Instant`—
 * y se convierten donde se usan, no aqui.
 *
 * Origen:
 *   portal/dto/DtosPortal.java
 *   perfilintegral/dto/DtosEvaluacion.java
 *   prueba/dto/DtosPrueba.java
 *   simulacion/dto/DtosSimulacion.java
 */

/** Una fecha y hora del servidor, en texto ISO 8601. */
export type FechaIso = string

// ---------- Vacantes y consentimientos ----------

export interface RequisitoPublico {
  id: number
  descripcion: string
}

export interface VacantePublica {
  id: number
  titulo: string
  descripcion: string | null
  proposito: string | null
  responsabilidades: string | null
  requisitos: string | null
  modalidad: string | null
  horario: string | null
  ubicacion: string | null
  compensacionPublica: string | null
  requisitosObjetivos: RequisitoPublico[]
}

export interface TextoConsentimientoPublico {
  tipo: string
  version: string
  texto: string
}

// ---------- Cuenta ----------

export interface CrearCuenta {
  nombre: string
  apellidos: string
  correo: string
  contrasena: string
  /** Obligatorio: sin esto no se puede postular. */
  aceptaProceso: boolean
  /** Opcional y distinto del anterior: entrar al Radar de Talento. */
  aceptaFuturosContactos?: boolean
}

export interface Login {
  correo: string
  contrasena: string
}

export interface Sesion {
  token: string
  usuarioId: number
}

export interface PedirBorrado {
  motivo?: string
}

// ---------- Postulaciones ----------

export interface MiPostulacion {
  uuid: string
  vacante: string
  /** Uno de los 18. Ver `dominio/estados.ts`. */
  estado: string
  estadoNombre: string
  /**
   * La clasificacion interna del equipo. Llega en la respuesta pero
   * NO se enseña al candidato.
   */
  grupoPrioridad: string | null
  diasSinCambio: number
  creadoEn: FechaIso
}

export interface PasoHistorial {
  estadoAnterior: string | null
  estadoNuevo: string
  fueElSistema: boolean
  ocurridaEn: FechaIso
}

export interface MiPostulacionDetalle {
  resumen: MiPostulacion
  historial: PasoHistorial[]
}

/** Lo que se manda al postular. Va como multipart, no como JSON. */
export interface DatosPostulacion {
  vacanteId: number
  cv: File
  resultadoOrgulloso: string
  portafolio?: string
  linkedin?: string
  github?: string
  requisitosConfirmados?: number[]
}

// ---------- Evaluacion (Perfil Integral) ----------

export interface OpcionCandidato {
  id: number
  letra: string
  texto: string
}

/**
 * El detalle de una respuesta del banco v3.
 *
 * Es un objeto suelto —en la base viaja como `jsonb`— y **cada formato usa solo
 * sus claves**: un `EF-4` manda `mas` y `menos`, un `SEC` manda `orden`, y
 * ninguno manda las del otro. Por eso estan todas opcionales aqui en vez de ser
 * seis tipos distintos: lo que decide cual toca es `pregunta.tipo`, y de armar
 * el envio se encarga `paginas/evaluacion/bancoV3.ts`.
 *
 * La forma exacta la comprueba el backend en `ValidadorDetalleV3`; si no
 * cuadra, responde 400.
 */
export interface DetalleRespuesta {
  /** EF-4: la opcion que mas se parece al candidato. */
  mas?: number
  /** EF-4: la que menos. Tiene que ser distinta de `mas`. */
  menos?: number
  /** SJT-R: id de opcion (como cadena) contra su nota, del 1 al 5. */
  calificaciones?: Record<string, number>
  /** SEC: los ids de todas las opciones, en el orden que eligio. */
  orden?: number[]
  /** INV y DE: los ids que marco. Vacio significa «ninguna», y es respuesta. */
  marcadas?: number[]
  /** CD: numero de campo (como cadena) contra lo que escribio. */
  campos?: Record<string, string>
}

/** CD: un campo del caso, con la etiqueta que ve el candidato. */
export interface CampoCasoCandidato {
  orden: number
  etiqueta: string
}

export interface PreguntaEvaluacion {
  id: number
  posicion: number
  /**
   * El formato del item. Los ocho del banco v3 —`EF-4`, `SJT-R`, `SEC`, `INV`,
   * `DE`, `CD`, `V`, `PC`— mas `OPCION_MULTIPLE` y las abiertas del banco viejo.
   */
  tipo: string
  enunciado: string
  /** El contexto del caso. Puede no haberlo. */
  situacion: string | null
  opciones: OpcionCandidato[] | null
  respuestaTexto: string | null
  respuestaOpcionId: number | null
  /**
   * Lo respondido en los formatos que necesitan detalle, para poder repintarlo
   * al volver. Un examen de 190 preguntas no se hace de una sentada.
   *
   * Opcional a proposito: el backend todavia no lo devuelve en todas partes, y
   * sin el la pantalla tiene que seguir funcionando —solo que sin recordar—.
   */
  respuestaDetalle?: DetalleRespuesta | null
  /** CD: los campos del caso. Opcional mientras el backend no los mande. */
  campos?: CampoCasoCandidato[] | null
  /** CD: cuantos campos pide el caso, cuando no vienen sus etiquetas. */
  casosPedidos?: number | null
}

export interface EvaluacionCandidato {
  id: number
  estado: string
  venceEn: FechaIso | null
  iniciadaEn: FechaIso | null
  terminadaEn: FechaIso | null
  minutosObjetivo: number | null
  total: number
  respondidas: number
  preguntas: PreguntaEvaluacion[]
}

/**
 * Una de las tres: `opcionId` para las de opcion unica (`PC`), `texto` para las
 * abiertas y los datos sueltos (`V`), y `detalle` para los seis formatos del
 * banco v3 que necesitan mandar mas de un valor.
 */
export interface ResponderEvaluacion {
  opcionId?: number
  texto?: string
  detalle?: DetalleRespuesta
  /** Cuanto tardo. Sirve para detectar prisas, no para penalizar. */
  segundos?: number
}

export interface EntregaEvaluacion {
  estado: string
  respondidas: number
  total: number
}

// ---------- Prueba del puesto ----------

export interface PreguntaPrueba {
  id: number
  tipo: string
  enunciado: string
  respuestaTexto: string | null
}

export interface EntregableRequerido {
  id: number
  nombre: string
  detalle: string | null
  formato: string | null
  esObligatorio: boolean
  entregado: boolean
}

export type EstadoIntento = 'PENDIENTE' | 'EN_CURSO' | 'ENTREGADA'

export interface MiPrueba {
  id: number
  estadoIntento: EstadoIntento
  modalidad: string | null
  iniciadoEn: FechaIso | null
  /** La hora en que se acaba, segun el servidor. El cronometro sale de aqui. */
  venceEn: FechaIso | null
  duracionMinutos: number | null
  enunciado: string | null
  materiales: string | null
  herramientasPermitidas: string | null
  /** El cambio inesperado. Llega en `null` hasta que toca enseñarlo. */
  cambioTexto: string | null
  preguntas: PreguntaPrueba[]
  entregables: EntregableRequerido[]
}

export interface EntregaPrueba {
  estado: string
  completa: boolean
  faltantes: number
}

// ---------- Simulacion ----------

export interface SesionDisponible {
  id: number
  fechaHora: FechaIso
  duracionMinutos: number
  modalidad: string
  lugar: string | null
  enlace: string | null
  plazasLibres: number
}

export interface TramoSesion {
  codigo: string
  nombre: string
  minutoInicio: number
  minutoFin: number
}

export interface MiSesion {
  inscripcionId: number
  sesionId: number
  fechaHora: FechaIso
  duracionMinutos: number
  modalidad: string
  lugar: string | null
  enlace: string | null
  enunciado: string | null
  asistio: boolean | null
  tramos: TramoSesion[]
}
