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
import { RESPUESTAS as PANEL } from './datos-panel.mjs'
import { UBIGEO } from './ubigeo-simulado.mjs'

/*
 * ⚠️ **El 8080 esta ocupado.** Ahi vive `postgresql-adminer-1`, que responde 200
 * y hace creer que hay un backend. Se deja como valor por defecto porque es
 * adonde apunta el proxy de Vite sin configurar, pero para levantarlo de verdad
 * hay que darle un puerto libre: `PUERTO=8082 node herramientas/backend-simulado.mjs`.
 */
const PUERTO = Number(process.env.PUERTO ?? 8080)
const ahora = () => new Date()
const enMinutos = (m) => new Date(Date.now() + m * 60_000).toISOString()

// ---------- Datos ----------

const VACANTES = [
  {
    id: 1,
    titulo: 'Desarrollador web',
    nombreEmpresa: 'Renaser Consulting',
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
    /*
     * RANGO y con fecha de cambio: es la unica que enciende el «Actualizado
     * el …» en ambar y la unica que tiene un aviso en la campana.
     */
    remuneracion: {
      tipo: 'RANGO',
      min: 3000,
      max: 4500,
      moneda: 'PEN',
      texto: 'S/ 3 000 a 4 500',
      actualizadaEn: '2026-09-14T10:00:00Z',
    },
    requisitosObjetivos: [
      { id: 11, descripcion: 'Tres años o más en infraestructura o plataforma.' },
      { id: 12, descripcion: 'Experiencia con contenedores en producción.' },
      { id: 13, descripcion: 'Residir en Lima o poder mudarte.' },
    ],
  },
  {
    id: 2,
    titulo: 'Líder de operaciones',
    nombreEmpresa: 'Clínica San Juan',
    descripcion: 'Convertir datos dispersos en decisiones que alguien toma el lunes.',
    proposito: 'Que las decisiones del comité dejen de apoyarse en intuición.',
    responsabilidades: 'Levantar y limpiar las fuentes.\nConstruir los indicadores que se miran cada semana.',
    requisitos: 'SQL con soltura.\nSaber decir que un dato no alcanza para concluir.',
    modalidad: 'Presencial',
    horario: 'Jornada completa',
    ubicacion: 'Lima',
    /* FIJA y sin cambios: el monto a secas, sin pie. */
    remuneracion: {
      tipo: 'FIJA',
      min: 6500,
      max: null,
      moneda: 'PEN',
      texto: 'S/ 6 500',
      actualizadaEn: null,
    },
    requisitosObjetivos: [{ id: 21, descripcion: 'Dos años o más analizando datos de negocio.' }],
  },
  {
    id: 3,
    titulo: 'Analista de experiencia del cliente',
    nombreEmpresa: 'Transportes del Sur',
    descripcion: 'Resolver antes de que el cliente tenga que insistir.',
    proposito: 'Que un cliente con un problema termine la conversación mejor de lo que la empezó.',
    responsabilidades: 'Atender los casos difíciles.\nDejar escrito lo que se aprende de cada uno.',
    requisitos: 'Haber tratado con clientes molestos sin perder el criterio.',
    modalidad: 'Presencial',
    horario: 'Jornada completa',
    ubicacion: 'Lima',
    /*
     * OCULTA, que es el caso que hay que poder mirar: el portal tiene que
     * DECIRLO —«La empresa no publica el sueldo»— y no dejar un hueco, y ademas
     * es lo que explica que al postular aqui no se le pida su pretension.
     */
    remuneracion: {
      tipo: 'OCULTA',
      min: null,
      max: null,
      moneda: null,
      texto: '',
      actualizadaEn: null,
    },
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
  { uuid: 'a1', vacante: 'Desarrollador web', empresa: 'Renaser Consulting', estado: 'PRUEBA_TURNO_CANDIDATO', estadoNombre: 'Prueba habilitada', grupoPrioridad: 'A', diasSinCambio: 1, creadoEn: '2026-08-12T11:02:00Z', avisosSinLeer: 1, remuneracion: VACANTES[0].remuneracion, miPretension: { monto: 7000, moneda: 'PEN', texto: 'S/ 7 000' } },
  { uuid: 'b2', vacante: 'Líder de operaciones', empresa: 'Clínica San Juan', estado: 'PERFIL_TURNO_CANDIDATO', estadoNombre: 'Evaluación pendiente', grupoPrioridad: 'B', diasSinCambio: 2, creadoEn: '2026-08-15T09:20:00Z', avisosSinLeer: 0, remuneracion: VACANTES[1].remuneracion, miPretension: { monto: 5000, moneda: 'PEN', texto: 'S/ 5 000' } },
  /* Sin pretension declarada, y NO porque no quisiera decirlo: su vacante tenia
     el sueldo oculto y no se le exigio. Es el caso que el portal tiene que saber
     contar con esas palabras, nunca con un guion. */
  { uuid: 'c3', vacante: 'Analista de experiencia del cliente', empresa: 'Transportes del Sur', estado: 'SIMULACION_TURNO_CANDIDATO', estadoNombre: 'Simulación por confirmar', grupoPrioridad: 'A', diasSinCambio: 0, creadoEn: '2026-08-01T15:40:00Z', avisosSinLeer: 2, remuneracion: VACANTES[2].remuneracion, miPretension: null },
  { uuid: 'd4', vacante: 'Líder de operaciones', empresa: 'Clínica San Juan', estado: 'PERFIL_CALIFICANDO', estadoNombre: 'Calificando', grupoPrioridad: 'B', diasSinCambio: 0, creadoEn: '2026-08-18T08:00:00Z', avisosSinLeer: 0, remuneracion: VACANTES[1].remuneracion, miPretension: null },
  { uuid: 'e5', vacante: 'Desarrollador web', empresa: 'Renaser Consulting', estado: 'DECISION_TURNO_CANDIDATO', estadoNombre: 'Evidencia adicional', grupoPrioridad: 'A', diasSinCambio: 3, creadoEn: '2026-07-20T10:00:00Z', avisosSinLeer: 0, remuneracion: VACANTES[0].remuneracion, miPretension: null },
  { uuid: 'f6', vacante: 'Analista de experiencia del cliente', empresa: 'Transportes del Sur', estado: 'CONTRATADO', estadoNombre: 'Contratado', grupoPrioridad: 'A', diasSinCambio: 5, creadoEn: '2026-06-10T10:00:00Z', avisosSinLeer: 0, remuneracion: VACANTES[2].remuneracion, miPretension: null },
  { uuid: 'g7', vacante: 'Líder de operaciones', empresa: 'Clínica San Juan', estado: 'NO_CONTINUA', estadoNombre: 'No continúa', grupoPrioridad: 'C', diasSinCambio: 9, creadoEn: '2026-06-02T10:00:00Z', avisosSinLeer: 0, remuneracion: VACANTES[1].remuneracion, miPretension: null },
]

/*
 * Los avisos de la campana.
 *
 * Son cuatro y no uno porque lo que hay que poder mirar es la lista: el panel
 * con sus divisores, el punto de los que no se han leido, el escalonado de la
 * entrada y como queda cuando ya no queda ninguno sin leer.
 *
 * ⚠️ **Va en un `let` y se muta.** Marcar leido es la mitad de esta pantalla
 * —el punto de cada fila de «Mis procesos» se apaga con el—, y con una constante
 * el boton no haria nada y pareceria roto.
 */
let AVISOS = [
  {
    id: 1,
    tipo: 'REMUNERACION_ACTUALIZADA',
    titulo: 'Cambió el sueldo de Desarrollador web',
    cuerpo: 'Ahora dice S/ 3 000 a 4 500. Cuando postulaste decía S/ 2 800 a 4 000.',
    postulacionUuid: 'a1',
    vacanteId: 1,
    leidoEn: null,
    creadoEn: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    tipo: 'REMUNERACION_ACTUALIZADA',
    titulo: 'Cambió el sueldo de Analista de experiencia del cliente',
    cuerpo: 'La empresa dejó de publicarlo. Tu postulación sigue igual.',
    postulacionUuid: 'c3',
    vacanteId: 3,
    leidoEn: null,
    creadoEn: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    tipo: 'REMUNERACION_ACTUALIZADA',
    titulo: 'Cambió el sueldo de Analista de experiencia del cliente',
    cuerpo: 'Antes decía S/ 3 200. La empresa lo actualizó mientras tu proceso seguía abierto.',
    postulacionUuid: 'c3',
    vacanteId: 3,
    leidoEn: null,
    creadoEn: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
  },
  {
    /* Ya leido: sin punto, y no cuenta para el numero de la campana. */
    id: 4,
    tipo: 'REMUNERACION_ACTUALIZADA',
    titulo: 'Cambió el sueldo de Líder de operaciones',
    cuerpo: 'Ahora dice S/ 6 500.',
    postulacionUuid: 'b2',
    vacanteId: 2,
    leidoEn: '2026-09-13T12:00:00Z',
    creadoEn: '2026-09-12T18:30:00Z',
  },
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

/*
 * Cuantos avisos sin leer tiene cada postulacion, contados AHORA.
 *
 * ⚠️ **No se guarda en la fixtura.** Con el numero escrito a mano, marcar leido
 * apagaba la campana y dejaba encendido el punto de la fila en «Mis procesos»,
 * que es justo el desajuste que la campana existe para no tener.
 */
function conAvisos(p) {
  return {
    ...p,
    avisosSinLeer: AVISOS.filter((a) => a.postulacionUuid === p.uuid && a.leidoEn === null).length,
  }
}

const evaluaciones = new Map()
const pruebas = new Map()
const inscripciones = new Map()

/**
 * Modo «red mala»: hace fallar uno de cada N guardados de respuesta.
 *
 * Se enciende con POST /_fallos/5 y se apaga con POST /_fallos/0. Sirve para
 * ver que hace el portal cuando un guardado no llega, que es justo lo que no se
 * puede provocar a mano.
 */
let fallaUnoDeCada = 0
let guardadosVistos = 0

/**
 * Preguntas de relleno hasta llegar a veinte, que es el tamaño con el que se
 * vio el fallo de las respuestas perdidas.
 */
function relleno(desde, hasta) {
  const preguntas = []
  for (let i = desde; i <= hasta; i++) {
    preguntas.push({
      id: i,
      posicion: i,
      tipo: 'ABIERTA',
      enunciado: `Pregunta ${i}: cuenta una situación en la que tuviste que decidir con información incompleta.`,
      situacion: null,
      opciones: null,
      respuestaTexto: null,
      respuestaOpcionId: null,
    })
  }
  return preguntas
}

function evaluacionDe(uuid) {
  if (!evaluaciones.has(uuid)) {
    evaluaciones.set(uuid, {
      id: 900,
      estado: 'PENDIENTE',
      venceEn: null,
      iniciadaEn: null,
      terminadaEn: null,
      minutosObjetivo: 45,
      total: 20,
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
        ...relleno(5, 20),
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

/**
 * El panel del equipo.
 *
 * Sirve las mismas fixturas que usan las capturas, para poder recorrer `/admin`
 * en el navegador sin levantar el Spring ni tocar `renaser-postgres`. Solo lee:
 * lo que muta responde 200 y no guarda nada, porque este simulado existe para
 * MIRAR el panel, no para probar su lógica de escritura — eso es el trabajo de
 * `verificar-panel.mjs`, que sí va contra el backend de verdad.
 *
 * El dev-login acepta cualquier id: aquí no hay usuarios que validar.
 */
function atenderPanel(ruta, metodo, res, cuerpo) {
  if (ruta === '/auth/dev-login') {
    return responder(res, 200, { token: 'panel-de-mentira', usuarioId: 1, roles: ['TALENTO'] })
  }

  /*
   * Cambiar el sueldo de una vacante, que es lo unico que el panel escribe y el
   * portal tiene que enseñar acto seguido.
   *
   * ⚠️ **La frase se arma AQUI, como en el backend de verdad**, y no en la
   * pantalla: `texto` viaja ya escrito para que el portal, el panel y el correo
   * digan el mismo sueldo caracter a caracter. Si el simulado dejara que lo
   * escribiera cada uno, la prueba que fija justo eso pasaria en falso.
   */
  const remu = ruta.match(/^\/vacantes\/(\d+)\/remuneracion$/)
  if (remu && metodo !== 'GET') {
    const v = VACANTES.find((x) => String(x.id) === remu[1])
    if (!v) return responder(res, 404, { detail: 'No existe esa vacante' })
    const nueva = cuerpo?.remuneracion ?? {}
    /*
     * ⚠️ **Esconder el sueldo de una vacante PUBLICADA se rechaza (V54).** Es
     * media regla del trato: quien postulo lo hizo con una cifra delante, y
     * quitarla despues la borra de la pantalla que el ya vio. El backend
     * devuelve 4xx y hay una prueba que lo fija, asi que el simulado tiene que
     * negarse igual o la prueba pasaria contra un doble mas permisivo que el
     * original — que es la forma mas silenciosa de que un doble mienta.
     */
    if (nueva.tipo === 'OCULTA' && v.remuneracion?.tipo !== 'OCULTA') {
      return responder(res, 409, {
        detail: 'No se puede dejar de publicar el sueldo de una vacante ya publicada',
      })
    }
    const moneda = nueva.moneda ?? 'PEN'
    const cifra = (n) => `${moneda === 'PEN' ? 'S/' : moneda} ${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`
    v.remuneracion = {
      tipo: nueva.tipo ?? 'OCULTA',
      min: nueva.min ?? null,
      max: nueva.max ?? null,
      moneda: nueva.tipo === 'OCULTA' ? null : moneda,
      texto:
        nueva.tipo === 'RANGO'
          ? `${cifra(nueva.min)} a ${String(nueva.max).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`
          : nueva.tipo === 'FIJA'
            ? cifra(nueva.min)
            : '',
      actualizadaEn: ahora().toISOString(),
    }
    return responder(res, 200, v.remuneracion)
  }

  if (metodo !== 'GET') return responder(res, 200, { ok: true })

  // El ranking llega con `?etapa=`; la fixtura es la misma para las cinco.
  const sinConsulta = ruta.split('?')[0]
  if (sinConsulta in PANEL) return responder(res, 200, PANEL[sinConsulta])

  // Lo que el backend real tampoco tiene todavía se dice como lo que es.
  if (sinConsulta === '/bandeja') {
    return responder(res, 500, { detail: 'GET /panel/bandeja devuelve 500 también en el real' })
  }

  return responder(res, 404, { mensaje: `El simulado no tiene ${metodo} /panel${sinConsulta}` })
}

const servidor = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost')

  if (pathname.startsWith('/api/v1/panel')) {
    const rutaPanel = pathname.replace(/^\/api\/v1\/panel/, '') || '/'
    console.log(`${req.method} /panel${rutaPanel}`)
    const cuerpoPanel = req.method === 'GET' ? null : await leerCuerpo(req)
    return atenderPanel(rutaPanel, req.method, res, cuerpoPanel)
  }

  const ruta = pathname.replace(/^\/api\/v1\/portal/, '').replace(/^\/api/, '')
  const metodo = req.method
  const partes = ruta.split('/').filter(Boolean)
  const cuerpo = metodo === 'GET' ? null : await leerCuerpo(req)

  console.log(`${metodo} ${ruta}`)

  // Control del modo «red mala»
  if (partes[0] === '_fallos') {
    fallaUnoDeCada = Number(partes[1] ?? 0) || 0
    guardadosVistos = 0
    return responder(res, 200, { fallaUnoDeCada })
  }

  // Vacantes y textos publicos
  if (ruta === '/vacantes' && metodo === 'GET') return responder(res, 200, VACANTES)
  // Antes de la ficha: si no, `/vacantes/1/consentimiento` cae en la regla de
  // abajo —que solo mira `partes[1]`— y devuelve la vacante.
  if (partes[0] === 'vacantes' && partes[2] === 'consentimiento' && metodo === 'GET') {
    const v = VACANTES.find((x) => String(x.id) === partes[1])
    if (!v) return responder(res, 404, { detail: 'No existe esa vacante' })
    return responder(res, 200, {
      nombreEmpresa: v.nombreEmpresa,
      version: '1.0',
      texto:
        `${v.nombreEmpresa} tratará los datos que envíes en este formulario —tu currículum, `
        + 'tus respuestas y los resultados de las evaluaciones— con la única finalidad de '
        + 'evaluar tu candidatura a este puesto.\n\n'
        + 'Los datos se conservarán mientras dure el proceso y hasta doce meses después de su '
        + 'cierre, salvo que pidas su eliminación antes.\n\n'
        + 'Parte de la evaluación se apoya en sistemas automatizados. Ninguna decisión final '
        + 'se toma de forma automática: siempre la revisa una persona.',
    })
  }
  if (partes[0] === 'vacantes' && partes[1] && metodo === 'GET') {
    const v = VACANTES.find((x) => String(x.id) === partes[1])
    return v ? responder(res, 200, v) : responder(res, 404, { mensaje: 'No existe esa vacante' })
  }
  if (ruta === '/consentimientos/textos') return responder(res, 200, CONSENTIMIENTOS)

  // Cuenta
  if (ruta === '/catalogos/ubigeo') return responder(res, 200, UBIGEO)
  if (ruta === '/cuentas' && metodo === 'POST') return responder(res, 201)
  if (ruta === '/auth/login' && metodo === 'POST') return responder(res, 200, { token: 'token-de-mentira', usuarioId: 1 })
  /*
   * Como se llama quien tiene el token guardado. Faltaba, y el portal la pide en
   * cada carga: eran dos 404 en la consola en toda pantalla con sesion.
   *
   * El simulado no valida el token —no hay usuarios que validar— asi que siempre
   * es la misma persona.
   */
  if (ruta === '/auth/sesion' && metodo === 'GET') {
    return responder(res, 200, { usuarioId: 1, nombre: 'Nando', apellidos: 'Pérez' })
  }

  // Postulaciones
  if (ruta === '/postulaciones' && metodo === 'POST') return responder(res, 201, { codigo: 'a1' })
  if (ruta === '/postulaciones' && metodo === 'GET')
    return responder(res, 200, POSTULACIONES.map(conAvisos))
  if (partes[0] === 'postulaciones' && partes[1] && partes[2] === 'retiro') return responder(res, 200)
  if (partes[0] === 'postulaciones' && partes[1] && metodo === 'GET') {
    const crudo = POSTULACIONES.find((p) => p.uuid === partes[1])
    if (!crudo) return responder(res, 404, { mensaje: 'No existe esa postulación' })
    const resumen = conAvisos(crudo)
    const historial = HISTORIALES[resumen.uuid] ?? [
      { estadoAnterior: null, estadoNuevo: 'POSTULADA', fueElSistema: true, ocurridaEn: resumen.creadoEn },
      { estadoAnterior: 'POSTULADA', estadoNuevo: resumen.estado, fueElSistema: true, ocurridaEn: resumen.creadoEn },
    ]
    return responder(res, 200, { resumen, historial })
  }
  // Avisos (la campana)
  if (ruta === '/avisos' && metodo === 'GET') {
    return responder(res, 200, {
      sinLeer: AVISOS.filter((a) => a.leidoEn === null).length,
      avisos: AVISOS,
    })
  }
  if (ruta === '/avisos/lectura' && metodo === 'POST') {
    const marcados = AVISOS.filter((a) => a.leidoEn === null).length
    AVISOS = AVISOS.map((a) => (a.leidoEn ? a : { ...a, leidoEn: ahora().toISOString() }))
    return responder(res, 200, { marcados })
  }
  if (partes[0] === 'avisos' && partes[1] && partes[2] === 'lectura' && metodo === 'POST') {
    AVISOS = AVISOS.map((a) =>
      String(a.id) === partes[1] && !a.leidoEn ? { ...a, leidoEn: ahora().toISOString() } : a,
    )
    return responder(res, 200)
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
      guardadosVistos++
      if (fallaUnoDeCada > 0 && guardadosVistos % fallaUnoDeCada === 0) {
        console.log(`  ↑ este se cae a proposito (1 de cada ${fallaUnoDeCada})`)
        return responder(res, 500, { mensaje: 'Fallo simulado' })
      }
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
      guardadosVistos++
      if (fallaUnoDeCada > 0 && guardadosVistos % fallaUnoDeCada === 0) {
        console.log(`  ↑ este se cae a proposito (1 de cada ${fallaUnoDeCada})`)
        return responder(res, 500, { mensaje: 'Fallo simulado' })
      }
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
