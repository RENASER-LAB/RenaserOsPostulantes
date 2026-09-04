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
  /**
   * Qué se rinde en la etapa técnica de esta vacante. Uno de los dos, nunca los dos.
   *
   * `PLANTILLA` = la prueba del puesto de siempre · `CUESTIONARIO_TECNICO` = el
   * cuestionario CAZATALENTOS que la IA escribe para esta vacante.
   */
  instrumentoEtapaTecnica: InstrumentoTecnico
  /** Minutos del candidato en esa etapa. `null` = los que traiga el instrumento elegido. */
  minutosEtapaTecnica: number | null
}

export type InstrumentoTecnico = 'PLANTILLA' | 'CUESTIONARIO_TECNICO'

/** El cuerpo de elegir instrumento. Los minutos vacíos dejan los del instrumento. */
export interface ElegirInstrumentoTecnico {
  instrumento: InstrumentoTecnico
  minutos: number | null
}

/** El cuerpo de crear y de editar. Los campos de texto admiten venir vacios. */
export interface GuardarVacante {
  solicitudTalentoId: number
  puestoId?: number
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

export interface GuardarPuesto {
  nombre: string
  nivelPuestoCodigo: string
  familiaCodigo: string
  /** Los clientes antiguos pueden conservarlo; el panel deja que lo genere el servidor. */
  codigo?: string
}

export interface PlantillaPruebaPanel {
  id: number
  nombre: string
  /** Nulo = sirve para cualquier puesto. */
  puestoId: number | null
  esActiva: boolean
}

/**
 * Una version de plantilla de prueba: el `VersionResponse` de Java, uno a uno.
 *
 * ⚠️ **Solo dos estados, y no tres.** Una version de prueba nace en BORRADOR y
 * al publicarse queda congelada; **no hay archivar ni despublicar**, a
 * diferencia del banco de preguntas (`EstadoDeVersion`). El backend lo explica
 * en `ServicioPlantillaPrueba`: una vacante con postulantes no puede quedarse
 * apuntando a una version que ya no se puede usar. La salida a un error en una
 * publicada es otra version, no volver atras.
 */
export type EstadoVersionPrueba = 'BORRADOR' | 'PUBLICADA'

export interface VersionPrueba {
  id: number
  plantillaPruebaId: number
  version: number
  enunciado: string
  /*
    ⚠️ **Estos tres se leen porque se escriben.** `actualizarVersion` es un PUT
    que reemplaza la version entera: si la API no los devolviera, cargar el
    formulario con lo que da y guardarlo los pondria en nulo sin que nadie los
    tocara. Faltaban en `VersionResponse` justo por eso, y se añadieron.
  */
  materiales: string | null
  herramientasPermitidas: string | null
  minutosExtra: number | null
  modalidad: ModalidadDePrueba
  duracionMinutos: number | null
  plazoDias: number | null
  minutoCambioMin: number | null
  minutoCambioMax: number | null
  estado: EstadoVersionPrueba
  publicadaEn: FechaIso | null
  /** Lo que esta prueba le dice a la IA que la califica. **Orienta, no sustituye a la rubrica.** */
  guiaCalificacion: string | null
  /** El enunciado subido como archivo. ⚠️ El enlace **caduca** (180 dias). */
  urlConsigna: string | null
}

/**
 * CRONOMETRADA es lo normal: el candidato tiene un reloj. PLAZO_ABIERTO es de
 * las pruebas viejas que se cargaron tal cual, con dias en vez de minutos.
 */
export type ModalidadDePrueba = 'CRONOMETRADA' | 'PLAZO_ABIERTO'

/**
 * Lo que se manda al crear o reemplazar una version en borrador.
 *
 * ⚠️ **`actualizarVersion` REEMPLAZA, no parchea**: el backend escribe todos
 * los campos con lo que llegue, asi que mandar el formulario a medias borra lo
 * que no viaje. Se manda siempre entero.
 */
export interface GuardarVersionPrueba {
  enunciado: string
  materiales: string | null
  herramientasPermitidas: string | null
  modalidad: ModalidadDePrueba
  duracionMinutos: number | null
  plazoDias: number | null
  /** El cambio inesperado no tiene minuto fijo: se sortea uno de este rango al empezar. */
  minutoCambioMin: number | null
  minutoCambioMax: number | null
  minutosExtra: number | null
  guiaCalificacion: string | null
}

/** El tope de la guia de calificacion, el mismo `@Size` que el backend. */
export const MAXIMO_GUIA_CALIFICACION = 2000

/** Una forma posible del cambio inesperado. Se sortea una al empezar el intento. */
export interface VarianteDeCambio {
  id: number
  texto: string
  orden: number
}

/**
 * Una pregunta del catalogo de pruebas.
 *
 * ⚠️ **El catalogo es global**, no de la version: quitar una pregunta de una
 * version no la borra, porque otras pueden estar usandola.
 */
export type TipoDePreguntaDePrueba = 'PREVIA' | 'UNIVERSAL' | 'ESPECIFICA'

export interface PreguntaDePrueba {
  id: number
  codigo: string
  enunciado: string
  tipo: TipoDePreguntaDePrueba
  /** Nulo = sirve para cualquier puesto. */
  puestoId: number | null
}

export interface GuardarPreguntaDePrueba {
  codigo: string
  enunciado: string
  tipo: TipoDePreguntaDePrueba
  puestoId: number | null
  /** Que mide la pregunta. No se le enseña a quien lee la respuesta. */
  revela: string | null
}

export type FormatoDeEntregable = 'ARCHIVO' | 'ENLACE' | 'CUALQUIERA'

export interface EntregableDePrueba {
  id: number
  nombre: string
  detalle: string
  formato: FormatoDeEntregable
  esObligatorio: boolean
}

export interface GuardarEntregable {
  nombre: string
  detalle: string
  formato: FormatoDeEntregable
  esObligatorio: boolean
}

/** SISTEMA lo comprueba el codigo, AGENTE la IA, PERSONA quien evalua a mano. */
export type MetodoDeVerificacion = 'SISTEMA' | 'AGENTE' | 'PERSONA'

export interface CriterioDeRubrica {
  id: number
  codigo: string
  nombre: string
  /*
    ⚠️ **Se lee porque se escribe.** Corregir un criterio lo reemplaza entero, así que sin
    esto el formulario se abría en blanco y guardar la borraba sin que nadie la tocara. Es
    la misma razón por la que `VersionPrueba` devuelve `materiales`.
  */
  descripcion: string | null
  puntos: number | null
  metodoVerificacion: MetodoDeVerificacion
}

export interface GuardarCriterioRubrica {
  codigo: string
  nombre: string
  descripcion: string | null
  puntos: number
  metodoVerificacion: MetodoDeVerificacion
}

/** La version entera: lo que hace falta para componerla y para publicarla. */
export interface VersionCompletaPrueba {
  version: VersionPrueba
  variantes: VarianteDeCambio[]
  preguntas: PreguntaDePrueba[]
  entregables: EntregableDePrueba[]
  rubrica: CriterioDeRubrica[]
}

/**
 * Lo que devuelve subir el enunciado.
 *
 * `expira` viaja a proposito: el enlace lo firma el almacen y caduca, asi que
 * se puede avisar antes de que salga un correo con un enlace muerto.
 */
export interface ConsignaSubida {
  archivoId: number
  urlConsigna: string
  expira: FechaIso
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
  /**
   * El nombre CORTO —`CV_RESULTADOS`, `CAJA`, `DIVISAS`—. Rotula una columna
   * donde el largo no cabe; el largo se queda para explicarla.
   *
   * ⚠️ **Puede venir vacio mientras el backend viaja en paralelo**, y quien lo
   * pinte tiene que caer al nombre largo en vez de dejar la cabecera muda.
   */
  codigo: string | null
  puntaje: number | null
  maximo: number | null
  peso: number
  explicacion: string | null
  origen: string | null
  /**
   * Cuanta evidencia sostiene esa nota, **de 0 a 100** —no de 0 a 1—.
   * Confirmado en `DtosPerfilIntegral.java:50`: tratarla como fraccion pintaria
   * un 87 % como un 8.700 %.
   */
  confianza: number | null
  /** No-nulo significa que una PERSONA corrigio la nota, y por que. */
  motivoAjuste: string | null
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
  /**
   * Donde vive, ya compuesta: «Arequipa — Camaná». Nula mientras nadie la haya
   * declarado.
   *
   * ⚠️ **Hoy es nula en casi toda la base**: la ciudad se pide al crear cuenta y
   * a quien ya tenia cuenta no se le pregunta nunca. Por eso el filtro de ciudad
   * del panel se arma de las filas y no del catalogo: un desplegable con las 196
   * provincias sobre una tanda sin una sola ciudad promete lo que no hay.
   */
  ciudad: string | null
  /**
   * El ubigeo de nivel 2, o `EXT` para el extranjero.
   *
   * ⚠️ **Que este puesto NO implica que `ciudad` lo este.** Son dos consultas y
   * el nombre puede faltar; pintar `ciudad` dando por hecho que hay codigo, o al
   * reves, deja una celda en blanco sin motivo.
   */
  ciudadCodigo: string | null
  /**
   * Lo que pide ganar, del perfil. Cualquiera de los dos extremos puede faltar.
   *
   * ⚠️ **Va con candado: solo viaja con el permiso `ver_pretension`.** Sin el
   * llega en nulo y el backend ni lanza la consulta. Lo decidio la V36 a
   * proposito —«si la pretension apareciera junto a la nota pesaria en la
   * decision, que es justo lo que este sistema busca evitar»— y solo el rol
   * DIRECCION lo tiene; TALENTO no.
   *
   * ⚠️ **Por eso un nulo aqui NO significa «no pidio sueldo».** Los dos motivos
   * —sin permiso y sin declarar— son indistinguibles desde el navegador, y la
   * pantalla no puede afirmar ninguno de los dos. Ver `POR_QUE_NO_HAY_PRETENSION`
   * en `ranking.ts`.
   */
  pretensionMin: number | null
  pretensionMax: number | null
  /** `PEN`, `USD` o nulo. */
  pretensionMoneda: string | null
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
  /**
   * Lo que lleva rendido, sobre 100.
   *
   * Opcional a proposito: un backend anterior al cambio no manda el campo, y
   * entonces llega `undefined`, no `null`. Quien lo pinte comprueba con `!=
   * null` —que cubre los dos— y nunca con `!== null`.
   */
  ponderado?: Ponderado | null
}

/**
 * Lo ya rendido: las dos etapas que existen, reescaladas sobre 100.
 *
 * `sobre100` viene vacio mientras falte cualquiera de las dos notas. Las tres
 * cifras del desglose se pueden quedar vacias por su cuenta sin que eso anule
 * el total. Enseñan de donde sale la cifra, no permiten recalcularla: los pesos
 * con que se mezclan no viajan aqui y cambian por vacante.
 *
 * ⚠️ **No hay nota del banco de preguntas, y no es un olvido**: esa no se
 * guarda suelta en ninguna parte. `perfil` ya la contiene, mezclada con la del
 * curriculum.
 */
export interface Ponderado {
  sobre100: number | null
  cv: number | null
  perfil: number | null
  prueba: number | null
}

/**
 * Lo que se le manda al backend para que arme el Excel del ranking.
 *
 * ⚠️ **`postulacionIds` viaja YA ORDENADO y el backend escribe esas filas en ese
 * orden.** El servidor no sabe que es un filtro ni un orden: filtrar y ordenar
 * ocurre en el cliente, y lo que se exporta es exactamente lo que se esta
 * viendo. De ahi que `filtroDescrito` sea obligatorio — una hoja sin decir de
 * que recorte salio se lee como si fuera la tanda entera.
 */
export interface PedirExcelDelRanking {
  /** Solo `PERFIL_INTEGRAL` y `PRUEBA_PUESTO`; el backend rechaza las otras. */
  etapa: string
  postulacionIds: number[]
  filtroDescrito: string
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

/**
 * Una de las cosas que la prueba pedia entregar, y como llego.
 *
 * ⚠️ **`enlace` y `archivoId` viajan solo con `descargar_entregables`.** Quien
 * abre la ficha ve QUE entrego y cuando; llegar al contenido pide el mismo
 * permiso da igual que sea archivo o enlace. Cuando falta —o cuando no hay nada
 * que ensenar— el porque viene escrito en `porQueNoSeVe`.
 */
export interface EntregaDeLaPrueba {
  entregableRequeridoId: number
  nombre: string
  detalle: string
  /** ARCHIVO, ENLACE o CUALQUIERA: lo que la prueba admitia. */
  formato: string
  esObligatorio: boolean
  loEntrego: boolean
  enlace: string | null
  archivoId: number | null
  archivoNombre: string | null
  /** Pudo entregarlo varias veces antes del plazo; esta es la ultima. */
  version: number | null
  subidoEn: string | null
  porQueNoSeVe: string | null
}

/** El enlace firmado del bucket, con cuando caduca. */
export interface EnlaceArchivo {
  url: string
  /** ⚠️ Se llama `expiraEn` en el record de Java. `expira` es del almacen, y no sale por HTTP. */
  expiraEn: string
  nombre: string
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
  /** Que pilar alimenta esta respuesta, dicho para leer. Nulo si no cuelga de ninguno. */
  pilar: string | null
  pilarCodigo: string | null
  /**
   * Las cuatro señales que el agente marco.
   *
   * ⚠️ **Nula NO significa «ninguna se cumplio»: significa que ese banco no las
   * media.** Solo el banco CAZATALENTOS puntua asi. Pintar cuatro noes sobre una
   * evaluacion anterior la convertiria en un cero de cuatro.
   */
  senales: Senales | null
}

/**
 * Las cuatro señales de una respuesta, presentes o ausentes.
 *
 * ⚠️ **El puntaje NO es el conteo de estas cuatro.** `episodio` es una PUERTA:
 * sin el, el puntaje es 0 aunque las otras tres esten marcadas. `cumpleSenalCero`
 * tambien fuerza el 0, y cuando falta `dato` la pregunta puede declarar un tope
 * que recorta el resultado. Con la puerta abierta, el puntaje es 1 mas las otras
 * tres que esten.
 *
 * Quien las pinte tiene que contar con ver un 0 con casillas marcadas: es
 * correcto, no un error de calculo.
 */
export interface Senales {
  episodio: boolean
  autoria: boolean
  dato: boolean
  incomodidad: boolean
  cumpleSenalCero: boolean | null
}

/**
 * Un patron del cuestionario completo: lo que solo se ve mirando las 50-85
 * respuestas juntas. No descarta a nadie — es una pregunta para la conversacion.
 */
export interface PatronDelCuestionario {
  codigo: string
  titulo: string
  descripcion: string
  deCuantas: number
  total: number
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
  patrones: PatronDelCuestionario[]
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
  /**
   * Si esta petición pudo siquiera consultar la pretensión salarial.
   *
   * Sin el permiso `ver_pretension` —solo lo tiene Dirección— el backend ni lanza
   * la consulta, así que una columna vacía tiene dos lecturas opuestas. Este
   * booleano es lo único que las separa desde el navegador.
   */
  puedeVerPretension: boolean
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

/**
 * Lo que el agente POTENCIAL_RIESGO marcó al cerrar el perfil integral.
 *
 * ⚠️ **`descripcion`, no `texto`.** Esta interfaz declaraba `texto`, un campo
 * que el backend no manda en ninguna versión: `HallazgoResponse` es
 * `(tipo, descripcion, evidencia, esCanalizable, sugerencia)`. La ficha pintaba
 * la etiqueta —FORTALEZA, RIESGO CRITICO— seguida de un `undefined` que React
 * no dibuja, así que durante meses la lista fue una columna de rótulos sin una
 * sola frase. Los cinco nombres de aquí son ahora los del backend, letra por
 * letra: si uno cambia allá, TypeScript no lo va a notar y esto vuelve a pasar.
 *
 * Los cinco tipos —FORTALEZA · RIESGO_CRITICO · RIESGO_DESARROLLABLE ·
 * PREFERENCIA · FALTA_EVIDENCIA— no se mezclan entre sí: un riesgo que se puede
 * corregir y algo que sencillamente no sabemos no son lo mismo.
 */
export interface Hallazgo {
  tipo: string
  /** Qué es, en una frase. */
  descripcion: string
  /** En qué se basó. Puede faltar. */
  evidencia: string | null
  /** Si es de las cosas que se pueden trabajar dentro. */
  esCanalizable: boolean
  /** Qué hacer con eso, cuando el agente propuso algo. */
  sugerencia: string | null
}

/**
 * Una alerta del perfil: `CONTRADICCION` o `DEMASIADO_IDEAL`.
 *
 * ⚠️ **Nunca descarta a nadie (RF-64)**: es una pregunta para la conversación
 * final, no un veredicto. La `CONTRADICCION` no la escribe la IA — la levanta el
 * sistema comparando dos respuestas de la misma persona entre sí.
 *
 * ⚠️ **Se declara pero HOY no se pinta en ninguna pantalla.** Está aquí porque
 * el backend la manda y un tipo que calla lo que llega es el que produjo el
 * fallo de `Hallazgo`: la ficha enseña solo fortalezas, riesgos y faltas de
 * evidencia, por decisión, y las alertas se quedaron fuera. El ranking sigue
 * contándolas, así que ese número no se puede abrir en ninguna parte; el día que
 * se quiera, la lista está a una línea de distancia.
 */
export interface AlertaDelPerfil {
  tipo: string
  descripcion: string
  creadoEn: FechaIso
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
  /**
   * Puede llegar sin definir contra un backend anterior al campo. Quien la pinte
   * la trata como lista vacía, que es lo que era hasta ahora en la práctica.
   */
  alertas?: AlertaDelPerfil[]
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

/**
 * Un area de la organizacion: la estructura de la empresa.
 *
 * ⚠️ `esActiva` **solo dice algo en la lista de todas**. `GET /areas` filtra por
 * activas, asi que ahi llega siempre `true` y no distingue nada. Dejo de ser
 * opcional cuando aparecio la segunda lista: un `esActiva` que puede faltar se
 * lee como `false` con un `??` mal puesto y pinta viva un area retirada.
 */
export interface AreaPanel {
  id: number
  nombre: string
  esActiva: boolean
}

/**
 * Lo que se lleva por delante borrar un area, contado ANTES de borrarla.
 *
 * Se pide al abrir la confirmacion, no al confirmar: quien borra tiene que ver
 * cuantas solicitudes y cuantas personas se mueven mientras todavia puede
 * arrepentirse.
 */
export interface ImpactoDeBorrarArea {
  areaId: number
  nombre: string
  solicitudes: number
  usuarios: number
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
  /**
   * Cuanto se espera que dure responder este banco.
   *
   * ⚠️ **Null en todo banco anterior a la V44**, que es cuando el tiempo se mudo
   * aqui desde la plantilla de evaluacion. Los archivados se quedaron sin el a
   * proposito: sus evaluaciones ya rendidas siguen leyendo el de su plantilla, y
   * reescribirlo hacia atras cambiaria lo que se le dijo a esa gente.
   */
  /* Opcional a proposito: un backend anterior a la V44 NO manda el campo, asi
     que quien lo pinta comprueba `typeof === 'number'`, no `!== null`. */
  minutosObjetivo?: number | null
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
  puestoId: number
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
  puestoId: number | null
  puestoNombre: string | null
  nivelPuestoCodigo: string | null
  familiaCodigo: string | null
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

// ---------- La prueba tecnica del puesto (metodo CAZATALENTOS) ----------
// Copiados de `DtosFichaVacante` y `DtosCuestionarioTecnico` del backend.

export type EstadoFichaDelPuesto = 'BORRADOR' | 'COMPLETA'
export type TamanoDeEmpresa = 'MICRO' | 'MEDIA' | 'GRANDE'

/**
 * El cuerpo del PUT de la ficha.
 *
 * ⚠️ **Es un reemplazo completo, no un parche.** Lo que no viaje se borra en el
 * servidor: el formulario manda los 22 campos siempre, aunque solo cambie uno.
 * Todos admiten `null` porque BORRADOR se guarda a medias.
 */
export interface GuardarFichaDelPuesto {
  q1Resultado: string | null
  q2Riesgo: string | null
  q3DiaReal: string | null
  q4EpocaDorada: string | null
  q5Estructura: string | null
  q6Autonomia: string | null
  q7JefeDirecto: string | null
  q8LoIncomodo: string | null
  q9Requerimientos: string | null
  q10Espejo: string | null
  genteEnEmpresa: number | null
  genteACargo: number | null
  /** El orden ES la velocidad de daño: el 1 es el que se nota primero. Sin huecos. */
  riesgo1: string | null
  riesgo2: string | null
  riesgo3: string | null
  riesgo4: string | null
  eliminatoria1: string | null
  eliminatoria2: string | null
  requerimiento1: string | null
  requerimiento2: string | null
  requerimiento3: string | null
  /** F1..F7 separadas por coma, p. ej. `F4` o `F4,F1`. */
  familias: string | null
}

/** La version de pesos que corresponde al tamaño derivado, para asignarla con un clic. */
export interface PesosSugeridos {
  id: number
  etiqueta: string
  yaAsignada: boolean
}

export interface FichaDelPuesto extends GuardarFichaDelPuesto {
  id: number
  vacanteId: number
  /** Derivado de `genteEnEmpresa`: ≤30 MICRO · 31–200 MEDIA · 200+ GRANDE. */
  tamano: TamanoDeEmpresa | null
  /** COMPLETA es lo que enciende «generar cuestionario». La calcula el servidor. */
  estado: EstadoFichaDelPuesto
  actualizadoEn: FechaIso | null
  pesosSugeridos: PesosSugeridos | null
}

export interface PreguntaDelCuestionario {
  id: number
  codigo: string
  /** EXPERIENCIA · RIESGO_1 · RIESGO_2 · RIESGO_3 · REQUERIMIENTO · DILEMA · PRESENCIAL */
  bloque: string
  enunciado: string
  c3Esperado: string | null
  c4Esperado: string | null
  senalDeCero: string | null
  /** La muestra de trabajo: nunca se envia al candidato. */
  presencial: boolean
  orden: number | null
}

/**
 * El cuestionario de la vacante: el borrador si hay, si no la publicada.
 *
 * `generacion` es el ultimo trabajo del REDACTOR: SIN_PEDIR · EN_CURSO ·
 * FALLIDA · LISTA. `desactualizado`: la ficha cambio despues de generar esto.
 * Sin version todavia, `versionBancoId` y `estado` vienen nulos y `preguntas` vacia.
 */
export interface CuestionarioTecnico {
  versionBancoId: number | null
  estado: string | null
  desactualizado: boolean
  generacion: string
  preguntas: PreguntaDelCuestionario[]
}

/** Lo que contesta pedir la generacion: 202 y si se encolo o no. */
export interface GeneracionPedida {
  encolada: boolean
}

/** ⚠️ Reemplazo completo de la pregunta: van los cuatro campos aunque cambie uno. */
export interface CorregirPreguntaTecnica {
  enunciado: string
  c3Esperado: string | null
  c4Esperado: string | null
  senalDeCero: string | null
}
