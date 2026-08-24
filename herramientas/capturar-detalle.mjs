/**
 * Capturas del detalle de una postulacion.
 *
 * Igual que `capturar.mjs`: la respuesta se intercepta y no se consulta el
 * backend real, que es la base de produccion.
 *
 *   node herramientas/capturar-detalle.mjs                # en curso, con turno
 *   node herramientas/capturar-detalle.mjs --caso espera  # esperando al equipo
 *   node herramientas/capturar-detalle.mjs --caso rechazo # ya no continua
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

const resumen = {
  uuid: UUID, vacante: 'Coordinador de Proyectos', grupoPrioridad: 'PRIORIDAD_ALTA',
  creadoEn: '2026-08-04T14:12:00Z',
}

const HISTORIAL_BASE = [
  { estadoAnterior: null, estadoNuevo: 'POSTULADA', fueElSistema: false, ocurridaEn: '2026-08-04T14:12:00Z' },
  { estadoAnterior: 'POSTULADA', estadoNuevo: 'PERFIL_TURNO_CANDIDATO', fueElSistema: true, ocurridaEn: '2026-08-04T14:13:00Z' },
  { estadoAnterior: 'PERFIL_TURNO_CANDIDATO', estadoNuevo: 'PERFIL_CALIFICANDO', fueElSistema: false, ocurridaEn: '2026-08-11T21:40:00Z' },
  { estadoAnterior: 'PERFIL_CALIFICANDO', estadoNuevo: 'PERFIL_POR_CONFIRMAR', fueElSistema: true, ocurridaEn: '2026-08-11T22:03:00Z' },
  { estadoAnterior: 'PERFIL_POR_CONFIRMAR', estadoNuevo: 'PRUEBA_TURNO_CANDIDATO', fueElSistema: false, ocurridaEn: '2026-08-14T10:26:00Z' },
]

const CASOS = {
  turno: {
    resumen: { ...resumen, estado: 'PRUEBA_TURNO_CANDIDATO', estadoNombre: 'Prueba habilitada', diasSinCambio: 2 },
    historial: HISTORIAL_BASE,
  },
  espera: {
    resumen: { ...resumen, estado: 'PRUEBA_POR_CONFIRMAR', estadoNombre: 'Prueba en revisión', diasSinCambio: 1 },
    historial: [...HISTORIAL_BASE,
      { estadoAnterior: 'PRUEBA_TURNO_CANDIDATO', estadoNuevo: 'PRUEBA_CALIFICANDO', fueElSistema: false, ocurridaEn: '2026-08-22T16:30:00Z' },
      { estadoAnterior: 'PRUEBA_CALIFICANDO', estadoNuevo: 'PRUEBA_POR_CONFIRMAR', fueElSistema: true, ocurridaEn: '2026-08-22T16:55:00Z' }],
  },
  rechazo: {
    resumen: { ...resumen, estado: 'NO_CONTINUA', estadoNombre: 'No continúa', diasSinCambio: 5 },
    historial: [...HISTORIAL_BASE,
      { estadoAnterior: 'PRUEBA_TURNO_CANDIDATO', estadoNuevo: 'PRUEBA_CALIFICANDO', fueElSistema: false, ocurridaEn: '2026-08-22T16:30:00Z' },
      { estadoAnterior: 'PRUEBA_CALIFICANDO', estadoNuevo: 'PRUEBA_POR_CONFIRMAR', fueElSistema: true, ocurridaEn: '2026-08-22T16:55:00Z' },
      { estadoAnterior: 'PRUEBA_POR_CONFIRMAR', estadoNuevo: 'NO_CONTINUA', fueElSistema: false, ocurridaEn: '2026-08-24T09:10:00Z' }],
  },
}

const caso = process.argv.includes('--caso') ? process.argv[process.argv.indexOf('--caso') + 1] : 'turno'
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
  await contexto.route(`**/api/v1/portal/postulaciones/${UUID}`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CASOS[caso]) }))
  const pagina = await contexto.newPage()
  const fallos = []
  pagina.on('console', (m) => m.type() === 'error' && fallos.push(m.text()))
  pagina.on('pageerror', (e) => fallos.push(String(e)))
  await pagina.goto(`${PORTAL}/procesos/${UUID}`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(600)
  const archivo = `capturas/detalle-${caso}-${t.nombre}.png`
  await pagina.screenshot({ path: archivo, fullPage: true })
  console.log(`${archivo}${fallos.length ? `  ⚠ ${fallos.length} error(es)` : ''}`)
  for (const f of fallos) console.log(`    ${f.slice(0, 160)}`)
  await contexto.close()
}
await navegador.close()
