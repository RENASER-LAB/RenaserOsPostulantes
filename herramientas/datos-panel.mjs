/**
 * Los datos de mentira del panel del equipo, en un solo sitio.
 *
 * Los usan dos herramientas: `backend-simulado.mjs`, que los sirve bajo
 * `/api/v1/panel` para poder recorrer el panel en el navegador sin base de
 * datos, y `capturar-panel.mjs`, que los intercepta para las capturas. Estaban
 * duplicados y se separaron a la primera.
 *
 * ⚠️ **Copian los `record` de `src/panel/api/tipos.ts` uno a uno.** Si el
 * contrato cambia allá y aquí no, la pantalla revienta con un
 * `Cannot read properties of undefined`. Es a proposito: preferible que se
 * caiga a que enseñe algo que el backend real no daria.
 */

export const VACANTES = [
  { id: 1, titulo: 'Ingeniero/a de Infraestructura', estado: 'PUBLICADA', tipoCierre: 'MANUAL',
    puestoId: 1, solicitudTalentoId: 7, responsableUsuarioId: 1,
    publicadaEn: '2026-07-02T09:00:00Z', cerradaEn: null, aplicaEvaluacion: true,
    plantillaEvaluacionId: 1, versionPlantillaPruebaId: 4, versionPesosId: 2 },
  { id: 2, titulo: 'Analista de Datos', estado: 'PUBLICADA', tipoCierre: 'MANUAL',
    puestoId: 2, solicitudTalentoId: 8, responsableUsuarioId: 1,
    publicadaEn: '2026-07-19T09:00:00Z', cerradaEn: null, aplicaEvaluacion: true,
    plantillaEvaluacionId: 1, versionPlantillaPruebaId: 4, versionPesosId: 2 },
  { id: 3, titulo: 'Coordinador de Proyectos', estado: 'BORRADOR', tipoCierre: 'MANUAL',
    puestoId: 3, solicitudTalentoId: 9, responsableUsuarioId: 1,
    publicadaEn: null, cerradaEn: null, aplicaEvaluacion: false,
    plantillaEvaluacionId: null, versionPlantillaPruebaId: null, versionPesosId: null },
  { id: 4, titulo: 'Especialista en Servicio', estado: 'CERRADA', tipoCierre: 'MANUAL',
    puestoId: 4, solicitudTalentoId: 10, responsableUsuarioId: 1,
    publicadaEn: '2026-05-04T09:00:00Z', cerradaEn: '2026-08-01T09:00:00Z',
    aplicaEvaluacion: true, plantillaEvaluacionId: 1, versionPlantillaPruebaId: 4,
    versionPesosId: 2 },
]

export const SESIONES = [
  { id: 1, fechaHora: '2026-09-02T14:00:00Z', duracionMinutos: 120, modalidad: 'GRUPAL',
    lugar: null, enlace: 'https://meet.example.com/abc', cupo: 8, inscritos: 5,
    estado: 'ABIERTA', enunciado: 'Un cliente amenaza con irse.', vacanteIds: [1],
    responsableIds: [1],
    tramos: [
      { codigo: 'APERTURA', nombre: 'Apertura', minutoInicio: 0, minutoFin: 15 },
      { codigo: 'TRABAJO', nombre: 'Trabajo en grupo', minutoInicio: 15, minutoFin: 95 },
      { codigo: 'CIERRE', nombre: 'Cierre', minutoInicio: 95, minutoFin: 120 },
    ] },
  { id: 2, fechaHora: '2026-09-05T15:00:00Z', duracionMinutos: 120, modalidad: 'GRUPAL',
    lugar: 'Oficina de Miraflores', enlace: null, cupo: 6, inscritos: 6, estado: 'LLENA',
    enunciado: null, vacanteIds: [2], responsableIds: [1], tramos: [] },
]

/**
 * Quien eligio la sesion 1.
 *
 * ⚠️ **No hay ninguna fila con `asistio: false`, y no es un olvido.** Se
 * comprobo contra el backend vivo: marcar que alguien no vino pone
 * `es_vigente = false` y `GET /inscritos` solo devuelve las vigentes, asi que
 * esa fila **deja de existir en esta lista**. Una fixtura con un ausente dentro
 * enseñaria un estado que la API nunca devuelve, y fue justo lo que escondio el
 * fallo: la persona se desvanecia al marcarla y nada lo decia.
 *
 * Quedan los dos que si llegan: sin pasar lista, y presente.
 */
export const INSCRITOS = [
  { inscripcionId: 11, postulacionId: 91, candidato: 'Camila Reyes Ortiz',
    vacante: 'Ingeniero/a de Infraestructura', inscritaEn: '2026-08-24T18:10:00Z',
    asistio: null },
  { inscripcionId: 12, postulacionId: 92, candidato: 'Diego Napuri Salas',
    vacante: 'Ingeniero/a de Infraestructura', inscritaEn: '2026-08-24T19:02:00Z',
    asistio: true },
  { inscripcionId: 13, postulacionId: 93, candidato: 'Rosa Huaman Lopez',
    vacante: 'Analista de Datos', inscritaEn: '2026-08-25T09:40:00Z', asistio: null },
]

/**
 * La matriz de un rol: el catalogo entero, con `alcance: null` en lo que no
 * tiene. **Llega ordenado por grupo y orden desde el backend**, y la fixtura lo
 * copia asi para que la pantalla se vea con el orden real y no con uno inventado.
 */
export const PERMISOS_DEL_ROL = [
  { codigo: 'ver_candidatos', etiqueta: 'Ver la lista de candidatos', grupo: 'CANDIDATOS',
    orden: 1, alcance: 'TODO' },
  { codigo: 'abrir_ficha_candidato', etiqueta: 'Abrir la ficha completa de un candidato',
    grupo: 'CANDIDATOS', orden: 2, alcance: 'SUS_VACANTES' },
  { codigo: 'ver_cv_completo', etiqueta: 'Ver el curriculum sin ocultar datos',
    grupo: 'CANDIDATOS', orden: 3, alcance: null },
  { codigo: 'ver_pretension', etiqueta: 'Ver la pretension salarial', grupo: 'CANDIDATOS',
    orden: 41, alcance: 'PROPIO' },
  { codigo: 'crear_sesiones_simulacion',
    etiqueta: 'Crear sesiones de simulacion con fecha y cupo', grupo: 'SESIONES',
    orden: 1, alcance: null },
  { codigo: 'marcar_eventos_simulacion',
    etiqueta: 'Marcar los eventos observables de una sesion', grupo: 'SESIONES',
    orden: 3, alcance: 'SUS_VACANTES' },
  { codigo: 'marcar_asistencia', etiqueta: 'Marcar quien asistio a una sesion',
    grupo: 'SESIONES', orden: 4, alcance: 'TODO' },
  { codigo: 'ver_inscritos_simulacion',
    etiqueta: 'Ver quien eligio cada sesion de simulacion', grupo: 'SESIONES',
    orden: 9, alcance: 'SUS_VACANTES' },
  { codigo: 'ver_vacantes', etiqueta: 'Ver las vacantes', grupo: 'VACANTES', orden: 1,
    alcance: 'TODO' },
  { codigo: 'publicar_vacante', etiqueta: 'Publicar una vacante', grupo: 'VACANTES',
    orden: 4, alcance: null },
]

/*
 * El detalle de una vacante: embudo, ranking y requisitos.
 *
 * ⚠️ **Las filas reparten a la gente por etapas a proposito, y una esta
 * terminada.** El ranking enseña por defecto solo a quien esta parado en la
 * etapa de la pestaña, asi que una fixtura con una persona por etapa daria
 * cinco tablas de una fila y las capturas pareceran rotas sin estarlo. Y sin
 * una fila terminada —NO_CONTINUA no empieza por el prefijo de ninguna etapa—
 * no hay forma de ver que esas quedan fuera de las cinco pestañas.
 *
 * Las cifras de arriba cuadran con estas ocho filas. Una fixtura con `total:
 * 34` sobre ocho filas hace que la linea de «se ven N de M» parezca un fallo
 * del panel: es la tercera vez que una fixtura inventada manda a buscar en el
 * sitio equivocado.
 */
const RANKING = {
  vacanteId: 1, vacante: 'Ingeniero/a de Infraestructura',
  puesto: 'Ingeniero de Infraestructura', nivelPuesto: 'MEDIO',
  total: 8, conPasadaFina: 5, calificados: 6, enCurso: 1, fallidos: 1,
  filas: [
    { puesto: 1, postulacionId: 91, uuid: 'p1', candidato: 'Camila Reyes Ortiz',
      correo: 'camila@example.com', estado: 'PRUEBA_POR_CONFIRMAR',
      estadoNombre: 'Prueba en revisión', estadoCalificacion: 'CALIFICADA', pasada: 'FINA',
      archivoNombre: 'cv-camila.pdf', grupoPrioridad: 'A', notaEtapa: 88, notaCurriculum: 76,
      adecuacion: 84, potencial: 91, altoRendimiento: 79, confianzaEvidencia: 86,
      resumen: 'Sostuvo una plataforma con usuarios reales y lo explica sin jerga.',
      riesgosCriticos: 0, fortalezas: 4, alertas: 1, actualizadoEn: '2026-08-22T10:00:00Z',
      notasCriterio: [
        { criterio: 'Criterio técnico', puntaje: 9, maximo: 10, peso: 0.4,
          explicacion: 'Eligió lo simple donde lo complejo era tentador.', origen: 'PRUEBA' },
        { criterio: 'Comunicación', puntaje: 8, maximo: 10, peso: 0.3,
          explicacion: 'Explicó una decisión de arquitectura a alguien no técnico.',
          origen: 'EVALUACION' },
      ] },
    { puesto: 2, postulacionId: 92, uuid: 'p2', candidato: 'Diego Salazar Nuñez',
      correo: 'diego@example.com', estado: 'PERFIL_CALIFICANDO',
      estadoNombre: 'Calificando el perfil', estadoCalificacion: 'EN_CURSO', pasada: 'RAPIDA',
      archivoNombre: 'cv-diego.pdf', grupoPrioridad: 'B', notaEtapa: 71, notaCurriculum: 68,
      adecuacion: 70, potencial: 74, altoRendimiento: 62, confianzaEvidencia: 58,
      resumen: 'Buena base, poca evidencia de haber respondido a un incidente.',
      riesgosCriticos: 1, fortalezas: 2, alertas: 2, actualizadoEn: '2026-08-24T18:20:00Z',
      notasCriterio: [] },
    { puesto: 3, postulacionId: 93, uuid: 'p3', candidato: 'Valeria Chumpitaz Ríos',
      correo: 'valeria@example.com', estado: 'SIMULACION_POR_CONFIRMAR',
      estadoNombre: 'Simulación por confirmar', estadoCalificacion: 'CALIFICADA', pasada: 'FINA',
      archivoNombre: null, grupoPrioridad: 'A', notaEtapa: 69, notaCurriculum: 72,
      adecuacion: 66, potencial: 70, altoRendimiento: 71, confianzaEvidencia: 74,
      resumen: 'Trabajo sólido y sin sobresaltos.',
      riesgosCriticos: 0, fortalezas: 3, alertas: 0, actualizadoEn: '2026-08-20T09:00:00Z',
      notasCriterio: [] },
    { puesto: 4, postulacionId: 94, uuid: 'p4', candidato: 'Rodrigo Ayala Pinto',
      correo: 'rodrigo@example.com', estado: 'PERFIL_POR_CONFIRMAR',
      estadoNombre: 'Perfil por confirmar', estadoCalificacion: 'CALIFICADA', pasada: 'FINA',
      archivoNombre: 'cv-rodrigo.pdf', grupoPrioridad: 'A', notaEtapa: 84, notaCurriculum: 80,
      adecuacion: 82, potencial: 85, altoRendimiento: 77, confianzaEvidencia: 81,
      resumen: 'Llevó un equipo pequeño durante una migración que salió mal y lo cuenta entero.',
      riesgosCriticos: 0, fortalezas: 3, alertas: 1, actualizadoEn: '2026-08-23T12:10:00Z',
      notasCriterio: [] },
    { puesto: 5, postulacionId: 96, uuid: 'p6', candidato: 'Marcos Ibáñez Trujillo',
      correo: 'marcos@example.com', estado: 'PRUEBA_TURNO_CANDIDATO',
      estadoNombre: 'Prueba habilitada', estadoCalificacion: 'PENDIENTE', pasada: 'FINA',
      archivoNombre: 'cv-marcos.pdf', grupoPrioridad: 'B', notaEtapa: 75, notaCurriculum: 75,
      adecuacion: 73, potencial: 78, altoRendimiento: 70, confianzaEvidencia: 69,
      resumen: 'Perfil sólido de operación; menos evidencia de decidir con poca información.',
      riesgosCriticos: 0, fortalezas: 2, alertas: 1, actualizadoEn: '2026-08-24T08:30:00Z',
      notasCriterio: [] },
    { puesto: 6, postulacionId: 98, uuid: 'p8', candidato: 'Ana Belén Zegarra',
      correo: 'ana@example.com', estado: 'DECISION_POR_CONFIRMAR',
      estadoNombre: 'En decisión final', estadoCalificacion: 'CALIFICADA', pasada: 'FINA',
      archivoNombre: 'cv-ana.pdf', grupoPrioridad: 'A', notaEtapa: 73, notaCurriculum: 79,
      adecuacion: 81, potencial: 76, altoRendimiento: 75, confianzaEvidencia: 80,
      resumen: 'Terminó la validación con las métricas cumplidas y una duda del área.',
      riesgosCriticos: 0, fortalezas: 4, alertas: 1, actualizadoEn: '2026-08-25T16:45:00Z',
      notasCriterio: [] },
    /* La terminada: no empieza por el prefijo de ninguna etapa, asi que con el
       filtro puesto no sale en ninguna de las cinco pestañas. */
    { puesto: 7, postulacionId: 97, uuid: 'p7', candidato: 'Lucía Ferrer Zavala',
      correo: 'lucia@example.com', estado: 'NO_CONTINUA',
      estadoNombre: 'No continúa', estadoCalificacion: 'CALIFICADA', pasada: 'FINA',
      archivoNombre: 'cv-lucia.pdf', grupoPrioridad: 'C', notaEtapa: 52, notaCurriculum: 55,
      adecuacion: 51, potencial: 58, altoRendimiento: 49, confianzaEvidencia: 62,
      resumen: 'No sostuvo el caso de la prueba y el cierre quedó a medias.',
      riesgosCriticos: 2, fortalezas: 1, alertas: 3, actualizadoEn: '2026-08-19T11:00:00Z',
      notasCriterio: [] },
    /* Sin calificar todavia: la nota va vacia, que no es un cero. */
    { puesto: 8, postulacionId: 95, uuid: 'p5', candidato: 'Fátima Quispe Loayza',
      correo: 'fatima@example.com', estado: 'PERFIL_TURNO_CANDIDATO',
      estadoNombre: 'Evaluación pendiente', estadoCalificacion: 'PENDIENTE', pasada: null,
      archivoNombre: 'cv-fatima.pdf', grupoPrioridad: null, notaEtapa: null, notaCurriculum: null,
      adecuacion: null, potencial: null, altoRendimiento: null, confianzaEvidencia: null,
      resumen: null,
      riesgosCriticos: 0, fortalezas: 0, alertas: 0, actualizadoEn: null,
      notasCriterio: [] },
  ],
}

const REQUISITOS = [
  { id: 11, descripcion: 'Tres años o más en infraestructura o plataforma.',
    regla: 'INDISPENSABLE', esActivo: true },
  { id: 12, descripcion: 'Experiencia con contenedores en producción.',
    regla: 'INDISPENSABLE', esActivo: true },
  { id: 13, descripcion: 'Residir en Lima o poder mudarte.', regla: 'DESEABLE', esActivo: false },
]


/**
 * El desglose de la evaluacion del banco y las rubricas por etapa, que son lo
 * que enseña la ficha al abrir una fila. Copian `DesgloseEvaluacion` y
 * `NotaCriterioEtapa` de `src/panel/api/tipos.ts`.
 */
const EVALUACION = {
  postulacionId: 91,
  estado: 'CALIFICADA',
  entregadaEn: '2026-08-18T16:40:00Z',
  notaEvaluacion: 31.4,
  cerradas: { nota: 82, preguntas: 46 },
  abiertas: [
    { pregunta: '¿Cómo decidiste qué dejar fuera de un servicio que ya no daba abasto?',
      formato: 'V', respuesta:
        'Medimos qué endpoints movían el 90 % del tráfico y congelamos el resto durante dos semanas. Nadie lo notó, y ganamos el margen para reescribir el que sí importaba.',
      puntaje: 4, explicacion:
        'Ordena por impacto medido y acepta el coste de congelar. Cita una consecuencia observable.',
      evidenciaCitada: 'Nadie lo notó, y ganamos el margen', confianza: 0.88, motivoAjuste: null },
    { pregunta: 'Cuenta un incidente que hayas cerrado tú.', formato: 'V',
      respuesta: 'Se cayó la base un viernes. Reinicié y volvió.',
      puntaje: 1, explicacion:
        'Describe la acción pero no el diagnóstico ni qué se cambió para que no repita.',
      evidenciaCitada: 'Reinicié y volvió', confianza: 0.74, motivoAjuste: null },
    { pregunta: 'Explica una decisión técnica a quien no es técnico.', formato: 'V',
      respuesta:
        'Les dije que la migración era como cambiar los cimientos con la casa puesta: se puede, pero hay que apuntalar antes y va a haber ruido.',
      puntaje: 3, explicacion: 'La analogía sostiene el coste y el riesgo sin simplificarlo.',
      evidenciaCitada: 'hay que apuntalar antes', confianza: 0.81,
      motivoAjuste: 'Bajado de 4 a 3: la analogía es buena pero no dice cuánto dura el ruido.' },
  ],
  alineacion: [
    { bloque: 'Cómo trabaja', semaforo: 'VERDE',
      explicacion: 'Elige lo simple donde lo complejo era tentador, y lo argumenta.' },
    { bloque: 'Cómo responde a lo inesperado', semaforo: 'AMBAR',
      explicacion: 'Actúa rápido, pero deja poca huella escrita de lo que pasó.' },
    { bloque: 'Cómo trata a quien tiene al lado', semaforo: 'VERDE', explicacion: null },
  ],
}

/** La misma forma para la prueba, la simulación y las métricas de validación. */
const RUBRICA = [
  { criterioId: 1, nombre: 'Criterio técnico', puntosMaximos: 10, puntaje: 9,
    explicacion: 'Eligió lo simple donde lo complejo era tentador.', origen: 'IA' },
  { criterioId: 2, nombre: 'Manejo del cambio a mitad', puntosMaximos: 10, puntaje: 7,
    explicacion: 'Reordenó sin perder el entregable obligatorio, aunque tarde.', origen: 'IA' },
  { criterioId: 3, nombre: 'Claridad de la entrega', puntosMaximos: 10, puntaje: 8,
    explicacion: 'Se entiende sin preguntarle nada.', origen: 'andy-dev' },
]

const VALIDACION = {
  id: 5, modalidad: 'Híbrido', tipoVinculacion: 'Convenio', dias: 15,
  inicioEn: '2026-08-10T09:00:00Z', finEn: '2026-08-25T18:00:00Z',
  estado: 'EN_CURSO', responsableUsuarioId: 1,
}

/*
 * Lo que escribio el candidato en la prueba.
 *
 * ⚠️ **Las tres primeras filas son tres estados distintos a proposito**, y hay
 * que poder distinguirlos de un vistazo: contestada, abierta y dejada en blanco
 * (`respuesta: ''`), y ni siquiera abierta (`respuesta: null`). Una fixtura que
 * solo trajera respuestas llenas taparia justo el caso que quien califica
 * necesita ver.
 */
const RESPUESTAS_DE_PRUEBA = [
  { preguntaId: 1, codigo: 'PP-01', orden: 1, tipo: 'ABIERTA',
    enunciado: '¿Cómo priorizarías las tres incidencias del anexo, y por qué en ese orden?',
    respuesta:
      'Primero la caída del cobro, porque es la única que ya está costando dinero cada minuto.\n\n' +
      'Segundo el informe de cierre: tiene fecha, pero la fecha es el viernes y hoy es martes.\n\n' +
      'Tercero la migración, que es la que más me apetece y la que nadie está esperando.',
    respondidaEn: '2026-08-22T15:41:00Z' },
  { preguntaId: 2, codigo: 'PP-02', orden: 2, tipo: 'ABIERTA',
    enunciado: 'Describe una decisión técnica que tomaste y que hoy tomarías distinta.',
    respuesta: '', respondidaEn: '2026-08-22T15:52:00Z' },
  { preguntaId: 3, codigo: 'PP-03', orden: 3, tipo: 'ABIERTA',
    enunciado: '¿Qué le dirías al área que pidió el cambio a dos días de la entrega?',
    respuesta: null, respondidaEn: null },
]

/** Lo que responde cada ruta. Nada de esto sale de aqui. */
/*
 * Lo que hay dentro de una version del banco. Copia de `PreguntaResponse`:
 * `logicaInterna` no esta porque el backend no la devuelve nunca (RF-53), y no
 * hay campo `dimensiones` aunque el Excel las traiga.
 *
 * Las tres cubren lo que la lista distingue: una clave, una eliminatoria y una
 * que no es ninguna de las dos.
 */
const PREGUNTAS_DEL_BANCO = [
  { id: 101, versionBancoId: 15, codigo: 'M01', bloque: 'Autonomía', tipo: 'EF-4',
    enunciado: 'Elige la frase que más se parece a cómo trabajas.',
    situacion: null, esPuntuable: true, orden: 1, peso: 2, esClave: true,
    esEliminatorio: false, casosPedidos: null, rangosDePreguntaCodigo: null,
    formulaPuntaje: null },
  { id: 102, versionBancoId: 15, codigo: 'M02', bloque: 'Experiencia', tipo: 'V',
    enunciado: '¿Cuántas personas te reportan hoy de forma directa?',
    situacion: null, esPuntuable: true, orden: 2, peso: 1, esClave: false,
    esEliminatorio: true, casosPedidos: null, rangosDePreguntaCodigo: null,
    formulaPuntaje: null },
  { id: 103, versionBancoId: 15, codigo: 'M03', bloque: 'Consistencia', tipo: 'PC',
    enunciado: 'Prefiero decidir rápido aunque me falte información.',
    situacion: null, esPuntuable: false, orden: 3, peso: 0, esClave: false,
    esEliminatorio: false, casosPedidos: null, rangosDePreguntaCodigo: null,
    formulaPuntaje: null },
]

export const RESPUESTAS = {
  '/vacantes': VACANTES,
  '/sesiones-simulacion': SESIONES,
  '/sesiones-simulacion/1/inscritos': INSCRITOS,
  // La sesion 2 se queda sin inscritos a proposito: es el caso vacio.
  '/sesiones-simulacion/2/inscritos': [],
  '/postulaciones/91/prueba/respuestas': RESPUESTAS_DE_PRUEBA,
  // La 92 no rindio: lista vacia, que no es un error.
  '/postulaciones/92/prueba/respuestas': [],
  '/roles/1/permisos': PERMISOS_DEL_ROL,
  '/roles/2/permisos': PERMISOS_DEL_ROL,
  '/solicitudes': [
    { id: 7, estado: 'APROBADA', urgencia: 'ALTA', areaId: 1,
      resultadoPrincipal: 'Tablero de ventas al día', creadoEn: '2026-06-20T09:00:00Z' },
    { id: 11, estado: 'APROBADA', urgencia: 'MEDIA', areaId: 2,
      resultadoPrincipal: 'Rotación por debajo del 12 %', creadoEn: '2026-08-10T09:00:00Z' },
  ],
  '/areas': [
    { id: 1, nombre: 'Tecnología', esActiva: true },
    { id: 2, nombre: 'Operaciones', esActiva: true },
  ],
  '/puestos': [
    { id: 1, nombre: 'Ingeniero de Infraestructura', areaId: 1 },
    { id: 2, nombre: 'Analista de Datos', areaId: 1 },
  ],
  '/roles': [
    { id: 1, codigo: 'TALENTO', nombre: 'Talento' },
    { id: 2, codigo: 'ADMIN', nombre: 'Administración' },
  ],
  '/usuarios': [
    { id: 1, correo: 'talento@example.com', usuarioRenaserOsId: 'u-1', areaId: 1,
      esActivo: true, roles: ['TALENTO'] },
    { id: 2, correo: 'jefatura@example.com', usuarioRenaserOsId: 'u-2', areaId: 2,
      esActivo: false, roles: ['ADMIN', 'TALENTO'] },
  ],
  '/plantillas-evaluacion': [
    { id: 1, nombre: 'Banco v3 · nivel medio', nivelPuestoCodigo: 'MEDIO', familiaCodigo: null,
      version: 3, estado: 'PUBLICADA', minutosObjetivo: 75, vigenciaMeses: 12,
      publicadaEn: '2026-04-11T09:00:00Z' },
  ],
  /*
   * ⚠️ **Esta fixtura mentia y por eso el desplegable de la prueba salia vacio
   * en las capturas.** Traia un `versiones: [...]` dentro que el backend NO
   * devuelve —`PlantillaResponse` es solo `{id, nombre, puestoId, esActiva}`—,
   * y a cambio no servia ninguna version suelta, que es de donde el panel las
   * saca de verdad. La forma de aqui es ahora la del backend, y las dos
   * versiones estan abajo, cada una en su ruta.
   */
  '/plantillas-prueba': [
    { id: 1, nombre: 'Reto con entregables', puestoId: null, esActiva: true },
    { id: 2, nombre: 'Cuestionario técnico', puestoId: 1, esActiva: true },
  ],
  '/plantillas-prueba/versiones/1': {
    version: { id: 1, plantillaPruebaId: 1, version: 1, estado: 'PUBLICADA' },
    variantes: [], preguntas: [], entregables: [], rubrica: [],
  },
  '/plantillas-prueba/versiones/2': {
    version: { id: 2, plantillaPruebaId: 2, version: 3, estado: 'PUBLICADA' },
    variantes: [], preguntas: [], entregables: [], rubrica: [],
  },
  '/parametros': [
    { codigo: 'evaluacion.dias', valor: '14', tipo: 'ENTERO',
      descripcion: 'Días que dura el plazo de la evaluación escrita.' },
    { codigo: 'prueba.minutos', valor: '120', tipo: 'ENTERO',
      descripcion: 'Minutos del cronómetro de la prueba del puesto.' },
  ],
  '/pesos/versiones': [
    { id: 2, etiqueta: 'v2', estado: 'PUBLICADA', publicadaEn: '2026-03-02T09:00:00Z' },
  ],
  /*
   * ⚠️ **Tercera fixtura con una forma que la API no devuelve.** Esta traia un
   * `nombre: 'v3'` que `VersionBancoResponse` no tiene —el nombre es
   * `etiqueta`— y le faltaba `tipoBanco`, que es la mitad del corte con el que
   * se agrupa. Con el tipo corregido, esa fila pintaba «undefined».
   *
   * El escenario copia el de la base local a proposito: **dos PUBLICADA del
   * mismo nivel**, que es el caso que la pantalla existe para enseñar, mas un
   * borrador, una archivada y un banco de ALINEACION sin nivel.
   */
  '/banco-preguntas/versiones': [
    { id: 10, tipoBanco: 'NIVEL', nivelPuestoCodigo: 'MEDIO',
      etiqueta: 'Banco desde Excel · Medio — prueba local',
      estado: 'PUBLICADA', publicadaEn: '2026-08-22T22:38:36Z' },
    { id: 6, tipoBanco: 'NIVEL', nivelPuestoCodigo: 'MEDIO',
      etiqueta: 'Banco RENASER v3 · Medio',
      estado: 'PUBLICADA', publicadaEn: '2026-04-11T09:00:00Z' },
    { id: 15, tipoBanco: 'NIVEL', nivelPuestoCodigo: 'MEDIO',
      etiqueta: 'Banco CAZATALENTOS · Medio',
      estado: 'BORRADOR', publicadaEn: null },
    { id: 2, tipoBanco: 'NIVEL', nivelPuestoCodigo: 'MEDIO',
      etiqueta: 'Banco Medio V0.1', estado: 'ARCHIVADA',
      publicadaEn: '2025-11-03T09:00:00Z' },
    { id: 21, tipoBanco: 'ALINEACION', nivelPuestoCodigo: null,
      etiqueta: 'Alineación cultural · v2',
      estado: 'PUBLICADA', publicadaEn: '2026-07-01T09:00:00Z' },
  ],
  /*
   * ⚠️ Sin esto, el interceptor cae en su `?? []` y «Ver qué contiene» enseña
   * la rama de version vacia en TODAS. Que es justo el fallo que el `?? []`
   * lleva escondiendo: una ruta que la fixtura no conoce nunca da 404, da 200
   * con una lista vacia, y la captura sale creible.
   */
  '/banco-preguntas/versiones/15/preguntas': PREGUNTAS_DEL_BANCO,
  '/banco-preguntas/versiones/10/preguntas': PREGUNTAS_DEL_BANCO,
  '/banco-preguntas/versiones/6/preguntas': PREGUNTAS_DEL_BANCO,
  '/banco-preguntas/versiones/2/preguntas': PREGUNTAS_DEL_BANCO,
  '/banco-preguntas/versiones/21/preguntas': PREGUNTAS_DEL_BANCO,
  '/banco-preguntas/importaciones': [],
  /*
   * ⚠️ Sin `estados`, el embudo se queda con los codigos crudos del backend
   * —PERFIL_TURNO_CANDIDATO— porque el panel traduce con este catalogo. No es
   * un fallo del panel: es que la fixtura venia coja.
   */
  '/catalogos': {
    areas: [], puestos: [],
    nivelesPuesto: [{ codigo: 'MEDIO', nombre: 'Medio' }, { codigo: 'SENIOR', nombre: 'Sénior' }],
    estados: [
      { codigo: 'PERFIL_TURNO_CANDIDATO', nombre: 'Evaluación pendiente',
        etapaCodigo: 'PERFIL', esperaA: 'CANDIDATO', orden: 1, esFinal: false },
      { codigo: 'PERFIL_CALIFICANDO', nombre: 'Calificando el perfil',
        etapaCodigo: 'PERFIL', esperaA: 'SISTEMA', orden: 2, esFinal: false },
      { codigo: 'PRUEBA_TURNO_CANDIDATO', nombre: 'Prueba habilitada',
        etapaCodigo: 'PRUEBA', esperaA: 'CANDIDATO', orden: 3, esFinal: false },
      { codigo: 'PRUEBA_POR_CONFIRMAR', nombre: 'Prueba en revisión',
        etapaCodigo: 'PRUEBA', esperaA: 'EQUIPO', orden: 4, esFinal: false },
      { codigo: 'PERFIL_POR_CONFIRMAR', nombre: 'Perfil por confirmar',
        etapaCodigo: 'PERFIL', esperaA: 'EQUIPO', orden: 3, esFinal: false },
      { codigo: 'SIMULACION_POR_CONFIRMAR', nombre: 'Simulación por confirmar',
        etapaCodigo: 'SIMULACION', esperaA: 'EQUIPO', orden: 5, esFinal: false },
      { codigo: 'DECISION_POR_CONFIRMAR', nombre: 'En decisión final',
        etapaCodigo: 'DECISION', esperaA: 'EQUIPO', orden: 6, esFinal: false },
      { codigo: 'NO_CONTINUA', nombre: 'No continúa',
        etapaCodigo: null, esperaA: 'NADIE', orden: 20, esFinal: true },
    ],
  },
  '/vacantes/1': VACANTES[0],
  '/vacantes/1/embudo': { porEstado: {
    PERFIL_TURNO_CANDIDATO: 1, PERFIL_CALIFICANDO: 1, PERFIL_POR_CONFIRMAR: 1,
    PRUEBA_TURNO_CANDIDATO: 1, PRUEBA_POR_CONFIRMAR: 1, SIMULACION_POR_CONFIRMAR: 1,
    DECISION_POR_CONFIRMAR: 1, NO_CONTINUA: 1 } },
  '/vacantes/1/ranking': RANKING,
  '/postulaciones/91/evaluacion': EVALUACION,
  '/postulaciones/91': {
    id: 91, uuid: 'p1', candidato: 'Camila Reyes Ortiz', correo: 'camila@example.com',
    vacante: 'Ingeniero/a de Infraestructura', estado: 'PRUEBA_POR_CONFIRMAR',
    estadoNombre: 'Prueba en revisión', grupoPrioridad: 'A', motivoCierre: null,
    resultadoOrgulloso: 'Bajé el tiempo de despliegue de cuarenta minutos a seis.',
    enlaces: ['https://github.com/example'], archivoCvId: 3,
    creadoEn: '2026-08-12T11:02:00Z', movidoEn: '2026-08-22T10:00:00Z',
  },
  '/postulaciones/91/perfil-integral': {
    postulacionId: 91, estadoCalificacion: 'CALIFICADA',
    resumen: 'Sostuvo una plataforma con usuarios reales y lo explica sin jerga.',
    adecuacion: 84, potencial: 91, altoRendimiento: 79, confianzaEvidencia: 86,
    notaEtapa: 88, actualizadoEn: '2026-08-22T10:00:00Z',
    hallazgos: [
      { tipo: 'FORTALEZA', texto: 'Explica una decisión técnica a quien no es técnico.' },
      { tipo: 'ALERTA', texto: 'Poca huella escrita de los incidentes que cerró.' },
    ],
    notasCriterio: [
      { criterio: 'Criterio técnico', puntaje: 9, maximo: 10, peso: 0.4,
        explicacion: 'Eligió lo simple donde lo complejo era tentador.', origen: 'PRUEBA' },
      { criterio: 'Comunicación', puntaje: 8, maximo: 10, peso: 0.3,
        explicacion: 'Explicó una decisión de arquitectura a quien no es técnico.',
        origen: 'EVALUACION' },
    ],
  },
  '/postulaciones/91/historial': [],
  /*
   * El segundo protagonista, y hace falta por el filtro por etapa.
   *
   * Camila (91) esta en PRUEBA_POR_CONFIRMAR, asi que en la pestaña de Perfil
   * integral ya no aparece: su ficha solo se puede abrir desde la pestaña de
   * la prueba. Rodrigo esta parado en el perfil y es quien sostiene esa otra
   * captura. Sin estas cuatro rutas, el interceptor contestaria `[]` a todo y
   * la ficha saldria vacia sin decir por que.
   */
  '/postulaciones/94': {
    id: 94, uuid: 'p4', candidato: 'Rodrigo Ayala Pinto', correo: 'rodrigo@example.com',
    vacante: 'Ingeniero/a de Infraestructura', estado: 'PERFIL_POR_CONFIRMAR',
    estadoNombre: 'Perfil por confirmar', grupoPrioridad: 'A', motivoCierre: null,
    resultadoOrgulloso: 'Saqué adelante una migración que se cayó dos veces antes de salir.',
    enlaces: [], archivoCvId: 7,
    creadoEn: '2026-08-13T09:40:00Z', movidoEn: '2026-08-23T12:10:00Z',
  },
  '/postulaciones/94/perfil-integral': {
    postulacionId: 94, estadoCalificacion: 'CALIFICADA',
    resumen: 'Llevó un equipo pequeño durante una migración que salió mal y lo cuenta entero.',
    adecuacion: 82, potencial: 85, altoRendimiento: 77, confianzaEvidencia: 81,
    notaEtapa: 84, actualizadoEn: '2026-08-23T12:10:00Z',
    hallazgos: [
      { tipo: 'FORTALEZA', texto: 'Cuenta el error propio antes de que se lo pregunten.' },
      { tipo: 'ALERTA', texto: 'Poco recorrido decidiendo con presupuesto ajeno.' },
    ],
    notasCriterio: [
      { criterio: 'Criterio técnico', puntaje: 8, maximo: 10, peso: 0.4,
        explicacion: 'Volvió atrás a tiempo en vez de sostener la decisión.', origen: 'EVALUACION' },
    ],
  },
  '/postulaciones/94/evaluacion': EVALUACION,
  '/postulaciones/94/historial': [],
  '/postulaciones/91/rubrica-prueba': RUBRICA,
  '/postulaciones/91/rubrica-simulacion': RUBRICA,
  '/postulaciones/91/validacion': VALIDACION,
  '/vacantes/1/requisitos': REQUISITOS,
}
