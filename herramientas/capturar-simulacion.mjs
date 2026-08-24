/**
 * Capturas de la simulacion, en sus dos momentos.
 *
 * `--caso elegir` enseña las fechas disponibles; `--caso elegida`, la sesion ya
 * reservada con su agenda; `--caso llena`, el caso raro de una fecha sin plazas
 * —el backend las filtra, pero si alguien recorta el cupo con gente inscrita
 * puede llegar— y `--caso sinfechas`, cuando todavia no hay ninguna publicada.
 *
 *   node herramientas/capturar-simulacion.mjs --caso elegir
 *   node herramientas/capturar-simulacion.mjs --caso elegida
 *   node herramientas/capturar-simulacion.mjs --caso llena
 *   node herramientas/capturar-simulacion.mjs --caso sinfechas
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const caso = process.argv.includes('--caso') ? process.argv[process.argv.indexOf('--caso') + 1] : 'elegir'
const UUID = '9f1c0f3e-1111-2222-3333-444455556666'

const SESIONES = [
  { id: 41, fechaHora: '2026-09-04T09:00:00Z', duracionMinutos: 120, modalidad: 'Presencial', lugar: 'Oficina de San Isidro', enlace: null, plazasLibres: 3 },
  { id: 42, fechaHora: '2026-09-09T15:00:00Z', duracionMinutos: 120, modalidad: 'Presencial', lugar: 'Oficina de San Isidro', enlace: null, plazasLibres: 1 },
  { id: 43, fechaHora: '2026-09-12T09:00:00Z', duracionMinutos: 120, modalidad: 'Remota', lugar: null, enlace: null, plazasLibres: caso === 'llena' ? 0 : 5 },
]

const MI_SESION = {
  inscripcionId: 7, sesionId: 41,
  fechaHora: '2026-09-04T09:00:00Z', duracionMinutos: 120,
  modalidad: 'Sesión grupal', lugar: 'Oficina de San Isidro',
  enlace: null,
  enunciado:
    'Trabajarás sobre el reporte semanal de una operación real, con los datos que te entreguemos al empezar.',
  asistio: null,
  tramos: [
    { codigo: 'BIENVENIDA', nombre: 'Bienvenida y entrega del encargo', minutoInicio: 0, minutoFin: 15 },
    { codigo: 'PREGUNTAS', nombre: 'Preguntas al equipo', minutoInicio: 15, minutoFin: 30 },
    { codigo: 'TRABAJO', nombre: 'Trabajo', minutoInicio: 30, minutoFin: 80 },
    { codigo: 'CAMBIO', nombre: 'Aparece un cambio en el encargo', minutoInicio: 80, minutoFin: 100 },
    { codigo: 'ENTREGA', nombre: 'Entrega', minutoInicio: 100, minutoFin: 110 },
    { codigo: 'CIERRE', nombre: 'Conversación final', minutoInicio: 110, minutoFin: 120 },
  ],
}

await mkdir('capturas', { recursive: true })
const navegador = await chromium.launch({ channel: 'chrome' })

for (const t of [{ nombre: 'ancho', width: 1920, height: 1000 },
  { nombre: 'escritorio', width: 1280, height: 900 },
  { nombre: 'movil', width: 375, height: 812 }]) {
  const contexto = await navegador.newContext({
    viewport: { width: t.width, height: t.height }, locale: 'es-PE',
    storageState: { cookies: [], origins: [{ origin: PORTAL, localStorage: [{ name: 'renaser_portal_token', value: 'captura' }] }] },
  })

  // El orden importa: la ruta mas especifica primero, porque Playwright usa la
  // primera que encaje y `/simulacion/*` tambien casa con `/simulacion/*/sesiones`.
  await contexto.route('**/api/v1/portal/simulacion/*/sesiones', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(caso === 'sinfechas' ? [] : SESIONES) }))
  await contexto.route('**/api/v1/portal/simulacion/*', (r) =>
    caso === 'elegida'
      ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MI_SESION) })
      : r.fulfill({ status: 404, contentType: 'application/problem+json', body: JSON.stringify({ detail: 'Todavía no elegiste fecha' }) }))

  const pagina = await contexto.newPage()
  const fallos = []
  pagina.on('console', (m) => m.type() === 'error' && fallos.push(m.text()))
  pagina.on('pageerror', (e) => fallos.push(String(e)))
  await pagina.goto(`${PORTAL}/procesos/${UUID}/simulacion`, { waitUntil: 'networkidle' })

  // Con una fecha marcada se ve el estado que de verdad importa mirar.
  if (caso === 'elegir') {
    await pagina.locator('label:has(input[name=fecha])').first().click()
    await pagina.waitForTimeout(200)
  }

  const archivo = `capturas/simulacion-${caso}-${t.nombre}.png`
  await pagina.screenshot({ path: archivo, fullPage: true })
  console.log(`${archivo}${fallos.length ? `  ⚠ ${fallos.length} error(es)` : ''}`)
  for (const f of fallos) console.log(`    ${f.slice(0, 150)}`)
  await contexto.close()
}
await navegador.close()
