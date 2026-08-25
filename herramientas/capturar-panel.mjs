/**
 * Capturas del panel del equipo, para poder mirarlo de verdad.
 *
 * `verificar-panel.mjs` recorre el panel contra el backend local y **escribe en
 * la base**; esto no. Aqui las respuestas se interceptan y se sirve un
 * escenario de prueba, asi que mirar una pantalla es gratis y no deja rastro.
 *
 *   node herramientas/capturar-panel.mjs
 *
 * Las imagenes quedan en `capturas/`, que no se versiona.
 */

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const SALIDA = 'capturas'

const VACANTES = [
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

const SESIONES = [
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

/** Lo que responde cada ruta. Nada de esto sale de aqui. */
const RESPUESTAS = {
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
  '/catalogos': { areas: [], puestos: [], nivelesPuesto: [
    { codigo: 'MEDIO', nombre: 'Medio' }, { codigo: 'SENIOR', nombre: 'Sénior' }] },
  '/vacantes/1': VACANTES[0],
  '/vacantes/1/embudo': { porEstado: {
    PERFIL_TURNO_CANDIDATO: 6, PERFIL_CALIFICANDO: 5, PRUEBA_TURNO_CANDIDATO: 4,
    PRUEBA_POR_CONFIRMAR: 3, SIMULACION_POR_CONFIRMAR: 2, NO_CONTINUA: 14 } },
  '/vacantes/1/ranking': RANKING,
  '/vacantes/1/requisitos': REQUISITOS,
}

const PANTALLAS = [
  { nombre: 'vacantes', ruta: '/admin' },
  { nombre: 'simulacion', ruta: '/admin/simulacion' },
  { nombre: 'configuracion', ruta: '/admin/configuracion' },
  { nombre: 'vacante', ruta: '/admin/vacantes/1' },
  { nombre: 'entrar', ruta: '/admin/entrar', sinSesion: true },
]

const TAMANOS = [
  { nombre: 'ancho', width: 1920, height: 1000 },
  { nombre: 'escritorio', width: 1280, height: 900 },
]

await mkdir(SALIDA, { recursive: true })
const navegador = await chromium.launch({ channel: 'chrome' })

for (const tamano of TAMANOS) {
  for (const pantalla of PANTALLAS) {
    const contexto = await navegador.newContext({
      viewport: { width: tamano.width, height: tamano.height },
      locale: 'es-PE',
      storageState: {
        cookies: [],
        origins: pantalla.sinSesion
          ? []
          : [{ origin: PORTAL, localStorage: [{ name: 'renaser_panel_token', value: 'captura' }] }],
      },
    })

    await contexto.route('**/api/v1/panel/**', (ruta) => {
      const camino = new URL(ruta.request().url()).pathname.replace('/api/v1/panel', '')
      const cuerpo = RESPUESTAS[camino] ?? RESPUESTAS[`/${camino.split('/')[1]}`] ?? []
      return ruta.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(cuerpo),
      })
    })

    const pagina = await contexto.newPage()
    const fallos = []
    pagina.on('console', (m) => m.type() === 'error' && fallos.push(m.text().slice(0, 140)))
    pagina.on('pageerror', (e) => fallos.push(String(e).slice(0, 140)))

    await pagina.goto(`${PORTAL}${pantalla.ruta}`, { waitUntil: 'domcontentloaded' })
    await pagina.waitForTimeout(2200)

    const archivo = `${SALIDA}/panel-${pantalla.nombre}-${tamano.nombre}.png`
    await pagina.screenshot({ path: archivo, fullPage: true })
    console.log(`${archivo}${fallos.length ? `  ⚠ ${fallos.length} error(es)` : ''}`)
    for (const f of fallos.slice(0, 3)) console.log(`    ${f}`)

    await contexto.close()
  }
}

await navegador.close()
