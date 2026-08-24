/**
 * Capturas de la prueba del puesto, en sus dos formas.
 *
 * La misma pantalla del backend sirve un reto con entregables y un cuestionario
 * de veinte preguntas sin ninguno. Lo que no tiene contenido no se pinta, y eso
 * hay que verlo.
 *
 *   node herramientas/capturar-prueba.mjs                   # antes de empezar
 *   node herramientas/capturar-prueba.mjs --caso reto       # en curso, con entregables
 *   node herramientas/capturar-prueba.mjs --caso cuestionario
 *   node herramientas/capturar-prueba.mjs --caso cambio     # el cambio inesperado
 *   node herramientas/capturar-prueba.mjs --caso agotado    # sin tiempo
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const caso = process.argv.includes('--caso') ? process.argv[process.argv.indexOf('--caso') + 1] : 'antes'

const ENUNCIADO = `Tienes el volcado de ventas de los últimos seis meses. El área comercial pide un reporte semanal que hoy alguien arma a mano cada lunes y tarda tres horas.

Queremos ver cómo lo resolverías tú: qué dejas fuera, qué automatizas y qué decides no tocar.

El enunciado completo está en https://renaser.example/pruebas/analista-datos.pdf`

const ENTREGABLES = [
  { id: 1, nombre: 'El reporte funcionando', detalle: 'Como lo entregarías al área comercial el lunes.', formato: 'ARCHIVO', esObligatorio: true, entregado: true },
  { id: 2, nombre: 'Cómo lo montaste', detalle: 'Un documento corto o un repositorio: lo que explique tus decisiones.', formato: null, esObligatorio: true, entregado: false },
  { id: 3, nombre: 'Un video corto explicándolo', detalle: null, formato: 'ENLACE', esObligatorio: false, entregado: false },
]

const PREGUNTAS_RETO = [
  { id: 1, tipo: 'ABIERTA', enunciado: '¿Qué decidiste dejar fuera, y por qué?', respuestaTexto: 'Dejé fuera el desglose por vendedor: no lo miran cada semana y duplicaba el tiempo de carga.' },
  { id: 2, tipo: 'ABIERTA', enunciado: '¿Dónde podría fallar tu solución?', respuestaTexto: null },
]

const PREGUNTAS_CUESTIONARIO = Array.from({ length: 3 }, (_, i) => ({
  id: i + 1, tipo: 'ABIERTA',
  enunciado: [
    'Un proveedor entrega tarde por tercera vez en el mes y el área que lo necesita ya se quejó. ¿Qué haces, en orden?',
    'Te encargan bajar el gasto de caja chica un 20% sin frenar la operación. ¿Por dónde empiezas?',
    '¿Cómo llevas el control de lo que se comprometió con cada proveedor?',
  ][i],
  respuestaTexto: i === 0 ? 'Primero hablo con el proveedor para entender si es puntual o de fondo.' : null,
}))

const base = {
  id: 5, modalidad: 'Remota', iniciadoEn: new Date(Date.now() - 40 * 60000).toISOString(),
  duracionMinutos: 120, enunciado: ENUNCIADO,
  materiales: 'El volcado en CSV y el reporte de la semana pasada, adjuntos en el correo.',
  herramientasPermitidas: 'Las que quieras, incluida IA. Te vamos a preguntar qué verificaste.',
  cambioTexto: null,
}

const CASOS = {
  antes: { ...base, estadoIntento: 'PENDIENTE', iniciadoEn: null, venceEn: null, preguntas: PREGUNTAS_RETO, entregables: ENTREGABLES },
  reto: { ...base, estadoIntento: 'EN_CURSO', venceEn: new Date(Date.now() + 72 * 60000).toISOString(), preguntas: PREGUNTAS_RETO, entregables: ENTREGABLES },
  cambio: { ...base, estadoIntento: 'EN_CURSO', venceEn: new Date(Date.now() + 55 * 60000).toISOString(), preguntas: PREGUNTAS_RETO, entregables: ENTREGABLES,
    cambioTexto: 'El área comercial adelanta la reunión al martes. Ajusta tu entrega a eso y explica qué recortaste.' },
  cuestionario: { ...base, estadoIntento: 'EN_CURSO', venceEn: new Date(Date.now() + 47 * 60000).toISOString(),
    enunciado: 'Responde con tus palabras. No hay respuestas de manual: nos interesa cómo decides.',
    materiales: null, herramientasPermitidas: null, duracionMinutos: 60,
    preguntas: PREGUNTAS_CUESTIONARIO, entregables: [] },
  agotado: { ...base, estadoIntento: 'EN_CURSO', venceEn: new Date(Date.now() - 60000).toISOString(), preguntas: PREGUNTAS_RETO, entregables: ENTREGABLES },
}

if (!(caso in CASOS)) { console.error(`Caso desconocido: ${caso}. Hay: ${Object.keys(CASOS).join(', ')}`); process.exit(1) }

await mkdir('capturas', { recursive: true })
const navegador = await chromium.launch({ channel: 'chrome' })

for (const t of [{ nombre: 'ancho', width: 1920, height: 1000 },
  { nombre: 'escritorio', width: 1280, height: 900 },
  { nombre: 'movil', width: 375, height: 812 }]) {
  const contexto = await navegador.newContext({
    viewport: { width: t.width, height: t.height }, locale: 'es-PE',
    storageState: { cookies: [], origins: [{ origin: PORTAL, localStorage: [{ name: 'renaser_portal_token', value: 'captura' }] }] },
  })
  await contexto.route(`**/api/v1/portal/prueba/${UUID}`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CASOS[caso]) }))
  await contexto.route('**/api/v1/portal/prueba/**/respuestas/**', (r) => r.fulfill({ status: 200, body: '' }))

  const pagina = await contexto.newPage()
  const fallos = []
  pagina.on('console', (m) => m.type() === 'error' && fallos.push(m.text()))
  pagina.on('pageerror', (e) => fallos.push(String(e)))
  await pagina.goto(`${PORTAL}/procesos/${UUID}/prueba`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(400)

  const archivo = `capturas/prueba-${caso}-${t.nombre}.png`
  await pagina.screenshot({ path: archivo, fullPage: true })
  console.log(`${archivo}${fallos.length ? `  ⚠ ${fallos.length} error(es)` : ''}`)
  for (const f of fallos) console.log(`    ${f.slice(0, 150)}`)
  await contexto.close()
}
await navegador.close()
