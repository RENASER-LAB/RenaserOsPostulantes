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


/** El detalle de una vacante: embudo, ranking y requisitos. */
const RANKING = {
  vacanteId: 1, vacante: 'Ingeniero/a de Infraestructura',
  puesto: 'Ingeniero de Infraestructura', nivelPuesto: 'MEDIO',
  total: 34, conPasadaFina: 21, calificados: 21, enCurso: 11, fallidos: 2,
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

/** Lo que responde cada ruta. Nada de esto sale de aqui. */
export const RESPUESTAS = {
  '/vacantes': VACANTES,
  '/sesiones-simulacion': SESIONES,
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
  '/plantillas-prueba': [
    { id: 1, nombre: 'Reto con entregables', versiones: [{ id: 4, etiqueta: 'v2', estado: 'PUBLICADA' }] },
  ],
  '/parametros': [
    { codigo: 'evaluacion.dias', valor: '14', tipo: 'ENTERO',
      descripcion: 'Días que dura el plazo de la evaluación escrita.' },
    { codigo: 'prueba.minutos', valor: '120', tipo: 'ENTERO',
      descripcion: 'Minutos del cronómetro de la prueba del puesto.' },
  ],
  '/pesos/versiones': [
    { id: 2, etiqueta: 'v2', estado: 'PUBLICADA', publicadaEn: '2026-03-02T09:00:00Z' },
  ],
  '/banco-preguntas/versiones': [
    { id: 3, nombre: 'v3', estado: 'PUBLICADA', nivelPuestoCodigo: 'MEDIO',
      publicadaEn: '2026-04-11T09:00:00Z' },
  ],
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
      { codigo: 'SIMULACION_POR_CONFIRMAR', nombre: 'Simulación por confirmar',
        etapaCodigo: 'SIMULACION', esperaA: 'EQUIPO', orden: 5, esFinal: false },
      { codigo: 'NO_CONTINUA', nombre: 'No continúa',
        etapaCodigo: null, esperaA: 'NADIE', orden: 20, esFinal: true },
    ],
  },
  '/vacantes/1': VACANTES[0],
  '/vacantes/1/embudo': { porEstado: {
    PERFIL_TURNO_CANDIDATO: 6, PERFIL_CALIFICANDO: 5, PRUEBA_TURNO_CANDIDATO: 4,
    PRUEBA_POR_CONFIRMAR: 3, SIMULACION_POR_CONFIRMAR: 2, NO_CONTINUA: 14 } },
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
  '/postulaciones/91/rubrica-prueba': RUBRICA,
  '/postulaciones/91/rubrica-simulacion': RUBRICA,
  '/postulaciones/91/validacion': VALIDACION,
  '/vacantes/1/requisitos': REQUISITOS,
}
