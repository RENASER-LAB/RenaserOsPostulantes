/**
 * Los contratos del panel, copiados uno a uno de los `record` de Java.
 *
 * La regla es la misma que en `src/api/tipos.ts`: si cambia alla, cambia aqui.
 * Los records viven en `DtosVacante`, `DtosPostulacion`, `DtosPerfilIntegral`,
 * `DtosSimulacion` y `DtosAdministracion` del backend.
 */

export type FechaIso = string

// ---------- Sesion del equipo ----------

export interface SesionEquipo {
  token: string
  usuarioId: number
}

export interface LoginPanel {
  correo: string
  contrasena: string
}

/**
 * Lo que se manda al canjear la invitacion del correo.
 *
 * ⚠️ **La contrasena del panel exige minimo 12, no 8 como la del portal.** Una
 * cuenta de equipo ve los datos de muchas personas, no solo los suyos. El mismo
 * minimo tiene que estar en la validacion de la pantalla: si aqui fuera menor,
 * el envio rebotaria con un error que la pantalla pudo haber evitado.
 */
export interface AceptarInvitacionPanel {
  token: string
  nombre: string
  apellidos: string
  contrasena: string
}

// ---------- Vacantes ----------

export interface VacantePanel {
  id: number
  titulo: string
  estado: string
  tipoCierre: string
  puestoId: number
  solicitudTalentoId: number
  responsableUsuarioId: number
  publicadaEn: FechaIso | null
  cerradaEn: FechaIso | null
  aplicaEvaluacion: boolean
  plantillaEvaluacionId: number | null
  versionPlantillaPruebaId: number | null
  versionPesosId: number | null
}

/** El cuerpo de crear y de editar. Los campos de texto admiten venir vacios. */
export interface GuardarVacante {
  solicitudTalentoId: number
  puestoId: number
  titulo: string
  descripcion: string
  proposito?: string
  responsabilidades?: string
  requisitos?: string
  modalidad?: string
  horario?: string
  ubicacion?: string
  compensacionPublica?: string
  tipoCierre: string
  plazas?: number
  abreEn?: FechaIso
  cierraEn?: FechaIso
  responsableUsuarioId: number
}

export interface RequisitoPanel {
  id: number
  descripcion: string
  regla: string
  esActivo: boolean
}

export interface PuestoPanel {
  id: number
  codigo: string
  nombre: string
  /** El nivel manda: la plantilla de evaluacion tiene que ser del mismo. */
  nivelPuestoCodigo: string
  familiaCodigo: string | null
}

export interface PlantillaPruebaPanel {
  id: number
  nombre: string
  /** Nulo = sirve para cualquier puesto. */
  puestoId: number | null
  esActiva: boolean
}

/** Una version de plantilla de prueba, reducida a lo que el panel necesita. */
export interface VersionPrueba {
  id: number
  plantillaPruebaId: number
  version: number
}

// ---------- La prueba del puesto, por dentro ----------

/**
 * Una pregunta de la prueba con lo que contesto el candidato.
 *
 * ⚠️ **`respuesta` en nulo no es lo mismo que en blanco.** Nulo es que dejo la
 * pregunta sin tocar; una cadena vacia es que la abrio y no escribio nada. El
 * backend los distingue a proposito y la pantalla tambien tiene que hacerlo:
 * quien califica no juzga igual las dos cosas.
 *
 * No trae `revela` —que mide cada pregunta— porque saber que se buscaba
 * condiciona a quien lee la respuesta. Es una omision del backend, no un hueco.
 */
export interface RespuestaDePrueba {
  preguntaId: number
  codigo: string
  orden: number
  tipo: string
  enunciado: string
  respuesta: string | null
  respondidaEn: FechaIso | null
}

/**
 * Lo que contesta el backend al pedirle a la IA que califique.
 *
 * ⚠️ **Encolada no es calificada.** La llamada al modelo tarda decenas de
 * segundos y esto vuelve al momento. Lo que se puede decir es que se pidio.
 */
export interface CalificacionEncolada {
  estado: string
  mensaje: string
}

/** Igual, pero sobre la tanda entera: dice a cuantos alcanza. */
export interface PasadaEncolada {
  estado: string
  candidatos: number
  mensaje: string
}

/** Lo que devuelve fijarle a la vacante entera la fecha de cierre de la prueba. */
export interface CierrePruebaAplicado {
  cierraEn: FechaIso | null
  /** Intentos ya abiertos que se movieron a la fecha nueva. */
  intentosMovidos: number
  /**
   * Los que NO se movieron porque tienen fecha propia. Se dice: es lo que
   * sorprende, y callarlo deja creer que la fecha aplico a toda la tanda.
   *
   * ⚠️ **Se llama asi y no `conPlazoPropio`.** El `record` de Java es
   * `CierrePruebaResponse(cierraEn, intentosMovidos, intentosConPlazoPropio)`;
   * el nombre corto es una variable local de su implementacion. Con el corto
   * el campo llegaba `undefined` y el unico numero que este bloque existe para
   * no callar se perdia en silencio, con todo compilando.
   */
  intentosConPlazoPropio: number
}

/** El plazo de UNA persona, que manda sobre el de la vacante. */
export interface PlazoDePrueba {
  postulacionId: number
  venceEn: FechaIso
  yaEmpezo: boolean
}

// ---------- Postulaciones ----------

export interface ConteoEmbudo {
  porEstado: Record<string, number>
}

export interface NotaCriterio {
  criterio: string
  puntaje: number | null
  maximo: number | null
  peso: number
  explicacion: string | null
  origen: string | null
}

export interface FilaRanking {
  puesto: number
  postulacionId: number
  uuid: string
  candidato: string
  correo: string
  estado: string
  estadoNombre: string
  estadoCalificacion: string
  /** FINA, RAPIDA o nulo. Una nota de la rapida es provisional. */
  pasada: string | null
  archivoNombre: string | null
  grupoPrioridad: string | null
  notaEtapa: number | null
  notaCurriculum: number | null
  adecuacion: number | null
  potencial: number | null
  altoRendimiento: number | null
  confianzaEvidencia: number | null
  resumen: string | null
  riesgosCriticos: number
  fortalezas: number
  alertas: number
  actualizadoEn: FechaIso | null
  notasCriterio: NotaCriterio[]
}

/**
 * Una nota por criterio de una etapa que califica con rubrica: la prueba, la
 * simulacion y las metricas de la validacion comparten esta forma exacta
 * (`CalificacionPorCriterio.Vista` en el backend).
 */
export interface NotaCriterioEtapa {
  criterioId: number
  nombre: string
  puntosMaximos: number | null
  puntaje: number | null
  explicacion: string | null
  /** IA o el usuario que ajusto a mano. */
  origen: string | null
}

/** La cabecera del periodo de validacion, si el equipo ya lo habilito. */
export interface ValidacionPanel {
  id: number
  modalidad: string | null
  tipoVinculacion: string | null
  dias: number | null
  inicioEn: FechaIso | null
  finEn: FechaIso | null
  estado: string
  responsableUsuarioId: number | null
}

// ---------- El desglose de la evaluacion del banco ----------

/** Lo cerrado no se desglosa por pregunta: sale como un promedio sobre 100. */
export interface ResumenCerradas {
  nota: number
  preguntas: number
}

/** Una respuesta abierta con la nota de la IA. El puntaje va de 0 a 4. */
export interface RespuestaAbiertaVista {
  pregunta: string
  formato: string
  respuesta: string
  puntaje: number | null
  explicacion: string | null
  evidenciaCitada: string | null
  confianza: number | null
  /** Solo si un humano corrigio la nota; el porque es obligatorio alla. */
  motivoAjuste: string | null
}

export interface AlineacionVista {
  bloque: string
  semaforo: string
  explicacion: string | null
}

/**
 * La evaluacion del banco, abierta por dentro. Sin evaluacion asignada todo
 * viene vacio; entregada pero sin calificar trae las respuestas sin nota.
 * Nunca es 404: una evaluacion sin calificar es un estado normal.
 */
export interface DesgloseEvaluacion {
  postulacionId: number
  estado: string | null
  entregadaEn: FechaIso | null
  notaEvaluacion: number | null
  cerradas: ResumenCerradas
  abiertas: RespuestaAbiertaVista[]
  alineacion: AlineacionVista[]
}

export interface RankingVacante {
  vacanteId: number
  vacante: string
  puesto: string
  nivelPuesto: string
  total: number
  conPasadaFina: number
  calificados: number
  enCurso: number
  fallidos: number
  filas: FilaRanking[]
}

export interface FichaPostulacion {
  id: number
  uuid: string
  candidato: string
  correo: string
  vacante: string
  estado: string
  estadoNombre: string
  grupoPrioridad: string | null
  motivoCierre: string | null
  resultadoOrgulloso: string | null
  enlaces: string[]
  archivoCvId: number | null
  creadoEn: FechaIso
  movidoEn: FechaIso | null
}

export interface PasoHistorialPanel {
  estadoAnterior: string | null
  estadoNuevo: string
  usuarioId: number | null
  fueElSistema: boolean
  fuePorLote: boolean
  motivo: string | null
  ocurridaEn: FechaIso
}

export interface Hallazgo {
  tipo: string
  texto: string
}

export interface PerfilIntegral {
  postulacionId: number
  estadoCalificacion: string
  resumen: string | null
  adecuacion: number | null
  potencial: number | null
  altoRendimiento: number | null
  confianzaEvidencia: number | null
  notaEtapa: number | null
  actualizadoEn: FechaIso | null
  hallazgos: Hallazgo[]
  notasCriterio: NotaCriterio[]
}

// ---------- Simulacion ----------

export interface TramoSesionPanel {
  codigo: string
  nombre: string
  minutoInicio: number
  minutoFin: number
}

export interface SesionPanel {
  id: number
  fechaHora: FechaIso
  duracionMinutos: number
  modalidad: string
  lugar: string | null
  enlace: string | null
  cupo: number
  /**
   * El aforo ocupado, **no la longitud de la lista de inscritos**.
   *
   * ⚠️ Las dos cifras pueden no coincidir y eso es correcto: quien no tiene
   * `ver_inscritos_simulacion` recibe el conteo entero —es aforo, no
   * identidades— y una lista vacia. Derivar el numero de `inscritos.length`
   * enseñaria «0 de 5» en una sesion llena.
   */
  inscritos: number
  estado: string
  enunciado: string | null
  vacanteIds: number[]
  responsableIds: number[]
  tramos: TramoSesionPanel[]
}

/**
 * Quien eligio esta fecha. Una fila por inscripcion vigente.
 *
 * `inscripcionId` es lo que abre el trabajo de la sesion: es lo que piden
 * `/inscripciones/{id}/asistencia` y `/inscripciones/{id}/marcas`, y hasta el
 * commit que trajo esta ruta no habia forma de averiguarlo desde el panel.
 *
 * ⚠️ **`asistio` tiene tres valores, no dos.** `null` es «nadie lo ha marcado
 * todavia», que no es «no vino». Pintarlos igual convierte una sesion sin
 * pasar lista en una sesion a la que no fue nadie.
 */
export interface InscritoEnSesion {
  inscripcionId: number
  postulacionId: number
  candidato: string
  vacante: string
  inscritaEn: FechaIso
  asistio: boolean | null
}

/** Uno de los diez eventos observables, con la hora en que ocurrio. */
export interface MarcaSimulacion {
  evento: string
  ocurridaEn: FechaIso
}

export interface CrearSesion {
  fechaHora: FechaIso
  duracionMinutos: number
  modalidad: 'GRUPAL' | 'INDIVIDUAL'
  lugar?: string
  enlace?: string
  cupo: number
  enunciado?: string
  vacanteIds: number[]
}

// ---------- Configuracion ----------

export interface Parametro {
  codigo: string
  valor: string
  tipo: string
  descripcion: string
}

export interface UsuarioEquipo {
  id: number
  correo: string | null
  usuarioRenaserOsId: string | null
  areaId: number | null
  esActivo: boolean
  roles: string[]
}

export interface RolPanel {
  id: number
  codigo: string
  nombre?: string
}

/**
 * Los tres alcances de un permiso, de mas a menos.
 *
 * ⚠️ **No son niveles de un mismo eje**: `SUS_VACANTES` se lee de la vacante y
 * `PROPIO` de la persona que llama. En el panel `PROPIO` casi nunca sirve
 * —nadie mira ahi su propia postulacion— y el backend lo trata como «no
 * alcanza a nadie» en toda la simulacion.
 */
export type AlcancePermiso = 'TODO' | 'SUS_VACANTES' | 'PROPIO'

/**
 * Una casilla de la matriz: un permiso del catalogo y que alcance tiene este
 * rol sobre el.
 *
 * Llega el catalogo **entero**, no solo lo concedido: sin lo que falta no se
 * puede conceder nada. `alcance: null` es exactamente eso — este rol no tiene
 * este permiso.
 *
 * ⚠️ **Llega ordenado por grupo y orden desde el backend. No reordenar aqui**:
 * el orden dentro de un grupo es el del proceso, no el alfabetico.
 */
export interface PermisoDelRol {
  codigo: string
  etiqueta: string
  grupo: string
  orden: number
  alcance: AlcancePermiso | null
}

export interface AreaPanel {
  id: number
  nombre: string
  esActiva?: boolean
}

// ---------- El banco de preguntas ----------

/** BORRADOR se edita entero, PUBLICADA circula, ARCHIVADA es historia. */
export type EstadoDeVersion = 'BORRADOR' | 'PUBLICADA' | 'ARCHIVADA'

/**
 * NIVEL es el banco que se le pone delante al candidato segun el nivel del
 * puesto; ALINEACION es el otro banco y **no lleva nivel**, asi que su
 * `nivelPuestoCodigo` viaja en null.
 */
export type TipoDeBanco = 'NIVEL' | 'ALINEACION'

/**
 * Copia de `VersionBancoResponse`.
 *
 * ⚠️ **No hay campo `nombre`.** El nombre que se lee en pantalla es `etiqueta`;
 * este tipo lo declaraba y nadie lo mandaba nunca.
 */
export interface VersionBanco {
  id: number
  tipoBanco: TipoDeBanco
  nivelPuestoCodigo: string | null
  etiqueta: string
  estado: EstadoDeVersion
  publicadaEn: FechaIso | null
}

/** Copia de `CrearVersionBanco`. Nace siempre en BORRADOR y vacia. */
export interface NuevaVersionBanco {
  tipoBanco: TipoDeBanco
  /** Null en ALINEACION, obligatorio de hecho en NIVEL: sin el no rige a nadie. */
  nivelPuestoCodigo: string | null
  etiqueta: string
}

/**
 * Copia de `ResultadoImportacion`.
 *
 * ⚠️ **El Excel NO devuelve una `VersionBanco`**, que es lo que este archivo
 * declaraba. Devuelve el recuento de lo que entro, y ese recuento es lo unico
 * que permite comprobar que el archivo se leyo entero.
 */
export interface ResultadoDeImportacion {
  versionBancoId: number
  etiqueta: string
  preguntas: number
  opciones: number
  camposCaso: number
  rangos: number
  pares: number
  dimensionesAsignadas: number
}

/**
 * Copia de `PreguntaResponse`.
 *
 * ⚠️ **`logicaInterna` entra pero jamas sale** (RF-53 del backend): no esta en
 * el `record` y no hay que inventarle un hueco aqui.
 */
export interface PreguntaDelBanco {
  id: number
  versionBancoId: number
  codigo: string
  bloque: string | null
  tipo: string
  enunciado: string
  situacion: string | null
  esPuntuable: boolean
  orden: number | null
  /** 0 no suma, 1 vale hasta 3 puntos, 2 hasta 6. */
  peso: number | null
  /** El item clave (★): hay que preguntar por el en la entrevista. */
  esClave: boolean
  /** Descarta al candidato por si solo, con independencia del puntaje. */
  esEliminatorio: boolean
  casosPedidos: number | null
  rangosDePreguntaCodigo: string | null
  formulaPuntaje: string | null
}

export interface PlantillaEvaluacionPanel {
  id: number
  nombre: string
  nivelPuestoCodigo: string
  familiaCodigo: string | null
  version: number
  estado: string
  minutosObjetivo: number | null
  vigenciaMeses: number | null
  publicadaEn: FechaIso | null
}

export interface VersionPesos {
  id: number
  etiqueta: string
  estado: string
  publicadaEn: FechaIso | null
}

// ---------- Solicitudes y catalogos ----------

/** Un resultado esperado y como se sabra si se cumplio. */
export interface ResultadoEsperado {
  descripcion: string
  indicador: string | null
}

/**
 * Lo que pide `POST /solicitudes`.
 *
 * ⚠️ **`resultadosEsperados` van entre 3 y 5**, ni uno menos ni uno mas: el
 * backend lo valida con `@Size(min = 3, max = 5)`.
 */
export interface CrearSolicitud {
  areaId: number
  urgencia: string
  resultadoPrincipal: string
  motivo: string
  consecuenciaNoContratar: string
  analisisCapacidad: string
  resultadosEsperados: ResultadoEsperado[]
  nivelPuestoCodigo?: string
  familiaCodigo?: string
  modalidad?: string
  horario?: string
}

export interface SolicitudResumen {
  id: number
  estado: string
  urgencia: string
  areaId: number | null
  resultadoPrincipal: string | null
  creadoEn: FechaIso
}

export interface EntradaCatalogo {
  codigo: string
  nombre: string
}

export interface EstadoCatalogo extends EntradaCatalogo {
  etapaCodigo: string | null
  esperaA: string
  orden: number
  esFinal: boolean
}

export interface Catalogos {
  nivelesPuesto: EntradaCatalogo[]
  familias: EntradaCatalogo[]
  etapas: EntradaCatalogo[]
  urgencias: EntradaCatalogo[]
  tiposCierre: EntradaCatalogo[]
  motivosCierre: EntradaCatalogo[]
  estados: EstadoCatalogo[]
}
