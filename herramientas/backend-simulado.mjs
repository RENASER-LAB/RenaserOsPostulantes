/**
 * Un Spring de mentira para revisar el portal sin levantar el de verdad.
 *
 * Habla el mismo contrato que `src/api/tipos.ts` y guarda el estado en memoria,
 * asi que responder la evaluacion, subir entregables o inscribirse a una sesion
 * funcionan de verdad mientras el proceso viva. No toca ninguna base de datos:
 * el backend real escribe en la Supabase de produccion, y esto no.
 *
 * Escucha en el 8080, que es adonde apunta el proxy de Vite por defecto, y
 * responde bajo /api/v1/portal, que es la base que usa src/api/cliente.ts.
 */

import { createServer } from 'node:http'

const PUERTO = 8080
const ahora = () => new Date()
const enMinutos = (m) => new Date(Date.now() + m * 60_000).toISOString()

// ---------- Datos ----------

const VACANTES = [
  {
    id: 1,
    titulo: 'Ingeniero/a de Infraestructura',
    descripcion: 'Sostener una plataforma que no se cae y que el equipo entiende.',
    proposito:
      'Que la plataforma sostenga el crecimiento del próximo año sin sobresaltos, y que el equipo sepa por qué está montada como está.',
    responsabilidades:
      'Diseñar y mantener la infraestructura de los servicios en producción.\nAutomatizar despliegues y dejar el camino documentado.\nResponder a incidentes y escribir qué pasó, sin culpables.\nAcompañar al equipo de desarrollo en decisiones de arquitectura.',
    requisitos:
      'Haber sostenido un servicio con usuarios reales, no solo entornos de prueba.\nCriterio para elegir lo simple cuando lo complejo es tentador.\nCapacidad de explicar una decisión técnica a quien no es técnico.',
    modalidad: 'Híbrido',
    horario: 'Jornada completa',
    ubicacion: 'Lima',
    compensacionPublica: 'Rango acordado en la conversación final',
    requisitosObjetivos: [
      { id: 11, descripcion: 'Tres años o más en infraestructura o plataforma.' },
      { id: 12, descripcion: 'Experiencia con contenedores en producción.' },
      { id: 13, descripcion: 'Residir en Lima o poder mudarte.' },
    ],
  },
  {
    id: 2,
    titulo: 'Analista de Datos',
    descripcion: 'Convertir datos dispersos en decisiones que alguien toma el lunes.',
    proposito: 'Que las decisiones del comité dejen de apoyarse en intuición.',
    responsabilidades: 'Levantar y limpiar las fuentes.\nConstruir los indicadores que se miran cada semana.',
    requisitos: 'SQL con soltura.\nSaber decir que un dato no alcanza para concluir.',
    modalidad: 'Presencial',
    horario: 'Jornada completa',
    ubicacion: 'Lima',
    compensacionPublica: null,
    requisitosObjetivos: [{ id: 21, descripcion: 'Dos años o más analizando datos de negocio.' }],
  },
  {
    id: 3,
    titulo: 'Especialista en Servicio',
    descripcion: 'Resolver antes de que el cliente tenga que insistir.',
    proposito: 'Que un cliente con un problema termine la conversación mejor de lo que la empezó.',
    responsabilidades: 'Atender los casos difíciles.\nDejar escrito lo que se aprende de cada uno.',
    requisitos: 'Haber tratado con clientes molestos sin perder el criterio.',
    modalidad: 'Presencial',
    horario: 'Jornada completa',
    ubicacion: 'Lima',
    compensacionPublica: null,
    requisitosObjetivos: [],
  },
]

const CONSENTIMIENTOS = [
  {
    tipo: 'TRATAMIENTO_DATOS',
    version: '2026-01',
    texto:
      'Renaser Consulting tratará tus datos personales con la finalidad de evaluar tu postulación al puesto al que te presentas.\n\nEn la evaluación participa un sistema de inteligencia artificial que puntúa tus respuestas y tus entregables. Ninguna decisión de descarte se toma de forma automática: una persona del equipo revisa el resultado antes de continuar o cerrar tu proceso.\n\nTus datos pueden almacenarse en servidores ubicados fuera del Perú. Puedes solicitar su eliminación en cualquier momento desde tu panel.',
  },
  {
    tipo: 'FUTUROS_CONTACTOS',
    version: '2026-01',
    texto:
      'Si lo autorizas, conservaremos tu perfil en el Radar de Talento para considerarte en futuras convocatorias, aunque esta postulación no continúe.\n\nEs opcional y no afecta a tu proceso actual. Puedes retirarlo cuando quieras.',
  },
]

// Una postulacion por situacion, para poder recorrer todas las pantallas.
const POSTULACIONES = [
  { uuid: 'a1', vacante: 'Ingeniero/a de Infraestructura', estado: 'PRUEBA_TURNO_CANDIDATO', estadoNombre: 'Prueba habilitada', grupoPrioridad: 'A', diasSinCambio: 1, creadoEn: '2026-08-12T11:02:00Z' },
  { uuid: 'b2', vacante: 'Analista de Datos', estado: 'PERFIL_TURNO_CANDIDATO', estadoNombre: 'Evaluación pendiente', grupoPrioridad: 'B', diasSinCambio: 2, creadoEn: '2026-08-15T09:20:00Z' },
  { uuid: 'c3', vacante: 'Especialista en Servicio', estado: 'SIMULACION_TURNO_CANDIDATO', estadoNombre: 'Simulación por confirmar', grupoPrioridad: 'A', diasSinCambio: 0, creadoEn: '2026-08-01T15:40:00Z' },
  { uuid: 'd4', vacante: 'Analista de Datos', estado: 'PERFIL_CALIFICANDO', estadoNombre: 'Calificando', grupoPrioridad: 'B', diasSinCambio: 0, creadoEn: '2026-08-18T08:00:00Z' },
  { uuid: 'e5', vacante: 'Ingeniero/a de Infraestructura', estado: 'DECISION_TURNO_CANDIDATO', estadoNombre: 'Evidencia adicional', grupoPrioridad: 'A', diasSinCambio: 3, creadoEn: '2026-07-20T10:00:00Z' },
  { uuid: 'f6', vacante: 'Especialista en Servicio', estado: 'CONTRATADO', estadoNombre: 'Contratado', grupoPrioridad: 'A', diasSinCambio: 5, creadoEn: '2026-06-10T10:00:00Z' },
  { uuid: 'g7', vacante: 'Analista de Datos', estado: 'NO_CONTINUA', estadoNombre: 'No continúa', grupoPrioridad: 'C', diasSinCambio: 9, creadoEn: '2026-06-02T10:00:00Z' },
]

const HISTORIALES = {
  a1: [
    { estadoAnterior: null, estadoNuevo: 'POSTULADA', fueElSistema: true, ocurridaEn: '2026-08-12T11:02:00Z' },
    { estadoAnterior: 'POSTULADA', estadoNuevo: 'PERFIL_TURNO_CANDIDATO', fueElSistema: true, ocurridaEn: '2026-08-13T08:30:00Z' },
    { estadoAnterior: 'PERFIL_TURNO_CANDIDATO', estadoNuevo: 'PERFIL_CALIFICANDO', fueElSistema: true, ocurridaEn: '2026-08-15T19:58:00Z' },
    { estadoAnterior: 'PERFIL_CALIFICANDO', estadoNuevo: 'PERFIL_POR_CONFIRMAR', fueElSistema: true, ocurridaEn: '2026-08-16T17:40:00Z' },
    { estadoAnterior: 'PERFIL_POR_CONFIRMAR', estadoNuevo: 'PRUEBA_TURNO_CANDIDATO', fueElSistema: false, ocurridaEn: '2026-08-18T09:12:00Z' },
  ],
}

const evaluaciones = new Map()
const pruebas = new Map()
const inscripciones = new Map()

function evaluacionDe(uuid) {
  if (!evaluaciones.has(uuid)) {
    evaluaciones.set(uuid, {
      id: 900,
      estado: 'PENDIENTE',
      venceEn: null,
      iniciadaEn: null,
      terminadaEn: null,
      minutosObjetivo: 45,
      total: 4,
      respondidas: 0,
      preguntas: [
        {
          id: 1, posicion: 1, tipo: 'ABIERTA',
          enunciado: '¿Qué haces en los primeros quince minutos, y en qué orden?',
          situacion: 'Un despliegue rutinario deja el servicio caído a las once de la noche. El responsable del área no contesta y el equipo espera tu indicación.',
          opciones: null, respuestaTexto: null, respuestaOpcionId: null,
        },
        {
          id: 2, posicion: 2, tipo: 'OPCION_MULTIPLE',
          enunciado: '¿Qué haces primero?',
          situacion: 'Un cliente pide una función que ya existe, pero no la encuentra en la interfaz.',
          opciones: [
            { id: 21, letra: 'A', texto: 'Le enseño dónde está y anoto que no se encuentra.' },
            { id: 22, letra: 'B', texto: 'Abro una petición de mejora y le respondo cuando esté.' },
            { id: 23, letra: 'C', texto: 'Le explico que ya existe y cierro el caso.' },
          ],
          respuestaTexto: null, respuestaOpcionId: null,
        },
        {
          id: 3, posicion: 3, tipo: 'ABIERTA',
          enunciado: 'Cuéntanos una decisión técnica que tomaste y que hoy tomarías distinta.',
          situacion: null, opciones: null, respuestaTexto: null, respuestaOpcionId: null,
        },
        {
          id: 4, posicion: 4, tipo: 'ABIERTA',
          enunciado: '¿Cómo decides qué se queda fuera?',
          situacion: 'Tienes que entregar el viernes y no llegas a todo.',
          opciones: null, respuestaTexto: null, respuestaOpcionId: null,
        },
      ],
    })
  }
  return evaluaciones.get(uuid)
}

function pruebaDe(uuid) {
  if (!pruebas.has(uuid)) {
    pruebas.set(uuid, {
      id: 700,
      estadoIntento: 'PENDIENTE',
      modalidad: 'REMOTA',
      iniciadoEn: null,
      venceEn: null,
      duracionMinutos: 120,
      enunciado:
        'El servicio de pagos lleva cuarenta minutos caído. Tienes los registros del despliegue, el tablero de métricas y un equipo de tres personas. Escribe el plan de recuperación y qué harías después para que no se repita.',
      materiales: 'Registros del despliegue, tablero de métricas e inventario de servicios.',
      herramientasPermitidas: 'Las que uses a diario, incluida la documentación.',
      cambioTexto: null,
      preguntas: [
        { id: 71, tipo: 'ABIERTA', enunciado: '¿Por qué elegiste ese orden?', respuestaTexto: null },
        { id: 72, tipo: 'ABIERTA', enunciado: '¿Qué cambiarías del despliegue actual?', respuestaTexto: null },
      ],
      entregables: [
        { id: 81, nombre: 'Plan de recuperación', detalle: 'Un documento corto, con pasos numerados.', formato: 'PDF', esObligatorio: true, entregado: false },
        { id: 82, nombre: 'Cronología del incidente', detalle: 'Qué pasó y cuándo.', formato: 'PDF o enlace', esObligatorio: true, entregado: false },
        { id: 83, nombre: 'Qué cambiarías para que no se repita', detalle: null, formato: 'Enlace', esObligatorio: false, entregado: false },
      ],
    })
  }
  return pruebas.get(uuid)
}

const SESIONES = [
  { id: 501, fechaHora: enMinutos(60 * 24 * 6), duracionMinutos: 120, modalidad: 'REMOTA', lugar: null, enlace: 'https://meet.renaser.pe/simulacion-26ago', plazasLibres: 4 },
  { id: 502, fechaHora: enMinutos(60 * 24 * 8), duracionMinutos: 120, modalidad: 'REMOTA', lugar: null, enlace: 'https://meet.renaser.pe/simulacion-28ago', plazasLibres: 1 },
  { id: 503, fechaHora: enMinutos(60 * 24 * 13), duracionMinutos: 120, modalidad: 'PRESENCIAL', lugar: 'Av. Javier Prado 1234, San Isidro', enlace: null, plazasLibres: 6 },
]

const TRAMOS = [
  { codigo: 'BIENVENIDA', nombre: 'Bienvenida y contexto del caso', minutoInicio: 0, minutoFin: 15 },
  { codigo: 'TRABAJO', nombre: 'Trabajo en equipo sobre el caso', minutoInicio: 15, minutoFin: 75 },
  { codigo: 'PRESENTACION', nombre: 'Presentación de cada grupo', minutoInicio: 75, minutoFin: 105 },
  { codigo: 'CIERRE', nombre: 'Cierre y preguntas', minutoInicio: 105, minutoFin: 120 },
]

// ---------- Enrutado ----------

function responder(res, estado, cuerpo) {
  const texto = cuerpo === undefined ? '' : JSON.stringify(cuerpo)
  res.writeHead(estado, {
    'content-type': 'application/json; charset=utf-8',
    date: ahora().toUTCString(),
    'content-length': Buffer.byteLength(texto),
  })
  res.end(texto)
}

async function leerCuerpo(req) {
  const trozos = []
  for await (const t of req) trozos.push(t)
  const crudo = Buffer.concat(trozos).toString('utf8')
  try {
    return JSON.parse(crudo)
  } catch {
    return crudo
  }
}

const servidor = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost')
  const ruta = pathname.replace(/^\/api\/v1\/portal/, '').replace(/^\/api/, '')
  const metodo = req.method
  const partes = ruta.split('/').filter(Boolean)
  const cuerpo = metodo === 'GET' ? null : await leerCuerpo(req)

  console.log(`${metodo} ${ruta}`)

  // Vacantes y textos publicos
  if (ruta === '/vacantes' && metodo === 'GET') return responder(res, 200, VACANTES)
  if (partes[0] === 'vacantes' && partes[1] && metodo === 'GET') {
    const v = VACANTES.find((x) => String(x.id) === partes[1])
    return v ? responder(res, 200, v) : responder(res, 404, { mensaje: 'No existe esa vacante' })
  }
  if (ruta === '/consentimientos/textos') return responder(res, 200, CONSENTIMIENTOS)

  // Cuenta
  if (ruta === '/cuentas' && metodo === 'POST') return responder(res, 201)
  if (ruta === '/auth/login' && metodo === 'POST') return responder(res, 200, { token: 'token-de-mentira', usuarioId: 1 })

  // Postulaciones
  if (ruta === '/postulaciones' && metodo === 'POST') return responder(res, 201, { codigo: 'a1' })
  if (ruta === '/postulaciones' && metodo === 'GET') return responder(res, 200, POSTULACIONES)
  if (partes[0] === 'postulaciones' && partes[1] && partes[2] === 'retiro') return responder(res, 200)
  if (partes[0] === 'postulaciones' && partes[1] && metodo === 'GET') {
    const resumen = POSTULACIONES.find((p) => p.uuid === partes[1])
    if (!resumen) return responder(res, 404, { mensaje: 'No existe esa postulación' })
    const historial = HISTORIALES[resumen.uuid] ?? [
      { estadoAnterior: null, estadoNuevo: 'POSTULADA', fueElSistema: true, ocurridaEn: resumen.creadoEn },
      { estadoAnterior: 'POSTULADA', estadoNuevo: resumen.estado, fueElSistema: true, ocurridaEn: resumen.creadoEn },
    ]
    return responder(res, 200, { resumen, historial })
  }
  if (ruta === '/consentimientos/futuros/retiro') return responder(res, 200)
  if (ruta === '/solicitudes-borrado') return responder(res, 200)

  // Evaluacion
  if (partes[0] === 'evaluacion' && partes[1]) {
    const ev = evaluacionDe(partes[1])
    if (partes[2] === 'inicio') {
      ev.estado = 'EN_CURSO'
      ev.iniciadaEn = ahora().toISOString()
      ev.venceEn = enMinutos(45)
      return responder(res, 200, ev)
    }
    if (partes[2] === 'respuestas' && partes[3]) {
      const pregunta = ev.preguntas.find((p) => String(p.id) === partes[3])
      if (pregunta) {
        pregunta.respuestaTexto = cuerpo?.texto ?? pregunta.respuestaTexto
        pregunta.respuestaOpcionId = cuerpo?.opcionId ?? pregunta.respuestaOpcionId
      }
      ev.respondidas = ev.preguntas.filter((p) => p.respuestaTexto || p.respuestaOpcionId).length
      return responder(res, 200)
    }
    if (partes[2] === 'entrega') {
      ev.estado = 'ENTREGADA'
      ev.terminadaEn = ahora().toISOString()
      return responder(res, 200, { estado: ev.estado, respondidas: ev.respondidas, total: ev.total })
    }
    return responder(res, 200, ev)
  }

  // Prueba del puesto
  if (partes[0] === 'prueba' && partes[1]) {
    const pr = pruebaDe(partes[1])
    if (partes[2] === 'inicio') {
      pr.estadoIntento = 'EN_CURSO'
      pr.iniciadoEn = ahora().toISOString()
      pr.venceEn = enMinutos(pr.duracionMinutos)
      // El cambio inesperado aparece desde el arranque para poder revisarlo.
      pr.cambioTexto = 'El cliente adelanta la migración una semana. Ajusta tu plan y explica qué sacrificas.'
      return responder(res, 200, pr)
    }
    if (partes[2] === 'respuestas' && partes[3]) {
      const pregunta = pr.preguntas.find((p) => String(p.id) === partes[3])
      if (pregunta) pregunta.respuestaTexto = cuerpo?.texto ?? null
      return responder(res, 200)
    }
    if (partes[2] === 'entregables' && partes[3]) {
      const entregable = pr.entregables.find((e) => String(e.id) === partes[3])
      if (entregable) entregable.entregado = true
      return responder(res, 200)
    }
    if (partes[2] === 'entrega') {
      pr.estadoIntento = 'ENTREGADA'
      const faltantes = pr.entregables.filter((e) => e.esObligatorio && !e.entregado).length
      return responder(res, 200, { estado: 'ENTREGADA', completa: faltantes === 0, faltantes })
    }
    return responder(res, 200, pr)
  }

  // Simulacion
  if (partes[0] === 'simulacion' && partes[1]) {
    const uuid = partes[1]
    if (partes[2] === 'sesiones' && partes[3] && metodo === 'POST') {
      const sesion = SESIONES.find((s) => String(s.id) === partes[3]) ?? SESIONES[0]
      const mia = {
        inscripcionId: 601,
        sesionId: sesion.id,
        fechaHora: sesion.fechaHora,
        duracionMinutos: sesion.duracionMinutos,
        modalidad: sesion.modalidad,
        lugar: sesion.lugar,
        enlace: sesion.enlace,
        enunciado: 'Un cliente importante amenaza con irse. Tienen dos horas para decidir qué le ofrecen y quién se lo dice.',
        asistio: null,
        tramos: TRAMOS,
      }
      inscripciones.set(uuid, mia)
      return responder(res, 200, mia)
    }
    if (partes[2] === 'sesiones') return responder(res, 200, SESIONES)
    const mia = inscripciones.get(uuid)
    return mia ? responder(res, 200, mia) : responder(res, 404, { mensaje: 'Todavía no hay inscripción' })
  }

  return responder(res, 404, { mensaje: `Sin ruta para ${metodo} ${ruta}` })
})

servidor.listen(PUERTO, () => {
  console.log(`Backend simulado en http://localhost:${PUERTO} — no toca ninguna base de datos`)
})
