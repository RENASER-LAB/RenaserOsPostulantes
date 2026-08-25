/**
 * Captura de la validacion practica.
 *
 * ⚠️ La ruta existe pero **no se enlaza desde ningun sitio**: el backend no
 * expone nada de esta etapa y `VALIDACION_TURNO_CANDIDATO` sigue llevando al
 * detalle del proceso. Esto es lo unico que la mira.
 *
 *   node herramientas/capturar-validacion.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const UUID = '9f1c0f3e-1111-2222-3333-444455556666'

const DETALLE = {
  resumen: {
    uuid: UUID, vacante: 'Analista de Datos',
    estado: 'VALIDACION_TURNO_CANDIDATO', estadoNombre: 'Validación en curso',
    grupoPrioridad: null, diasSinCambio: 6, creadoEn: '2026-07-28T10:00:00Z',
  },
  historial: [
    { estadoAnterior: null, estadoNuevo: 'PERFIL_TURNO_CANDIDATO', fueElSistema: true, ocurridaEn: '2026-07-28T10:00:00Z' },
    { estadoAnterior: 'PERFIL_TURNO_CANDIDATO', estadoNuevo: 'PRUEBA_TURNO_CANDIDATO', fueElSistema: true, ocurridaEn: '2026-08-02T09:00:00Z' },
    { estadoAnterior: 'PRUEBA_TURNO_CANDIDATO', estadoNuevo: 'SIMULACION_TURNO_CANDIDATO', fueElSistema: true, ocurridaEn: '2026-08-09T09:00:00Z' },
    { estadoAnterior: 'SIMULACION_TURNO_CANDIDATO', estadoNuevo: 'VALIDACION_TURNO_CANDIDATO', fueElSistema: false, ocurridaEn: '2026-08-18T09:00:00Z' },
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
  await contexto.route('**/api/v1/portal/postulaciones/*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DETALLE) }))

  const pagina = await contexto.newPage()
  const fallos = []
  pagina.on('console', (m) => m.type() === 'error' && fallos.push(m.text()))
  pagina.on('pageerror', (e) => fallos.push(String(e)))
  await pagina.goto(`${PORTAL}/procesos/${UUID}/validacion`, { waitUntil: 'networkidle' })

  const archivo = `capturas/validacion-${t.nombre}.png`
  await pagina.screenshot({ path: archivo, fullPage: true })
  console.log(`${archivo}${fallos.length ? `  ⚠ ${fallos.length} error(es)` : ''}`)
  for (const f of fallos) console.log(`    ${f.slice(0, 150)}`)
  await contexto.close()
}
await navegador.close()
