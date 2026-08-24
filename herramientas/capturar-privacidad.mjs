/**
 * Capturas de privacidad y control.
 *
 * `--caso retiro` abre el aviso de retirarse de una vacante y `--caso borrado`
 * el de pedir la eliminacion: son las dos que no se deshacen, y las dos que hay
 * que mirar de cerca. `--caso fallo` tumba la lista, que es lo unico que se
 * pinta dentro de un recuadro que ya existe.
 *
 *   node herramientas/capturar-privacidad.mjs
 *   node herramientas/capturar-privacidad.mjs --caso retiro
 *   node herramientas/capturar-privacidad.mjs --caso borrado
 *   node herramientas/capturar-privacidad.mjs --caso fallo
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const caso = process.argv.includes('--caso') ? process.argv[process.argv.indexOf('--caso') + 1] : 'lista'

const POSTULACIONES = [
  { uuid: 'aaa', vacante: 'Analista de Datos', estado: 'PERFIL_TURNO_CANDIDATO', estadoNombre: 'Perfil · te toca a ti', grupoPrioridad: null, diasSinCambio: 1, creadoEn: '2026-08-14T10:00:00Z' },
  { uuid: 'bbb', vacante: 'Administrador', estado: 'PRUEBA_CALIFICANDO', estadoNombre: 'Prueba en revisión', grupoPrioridad: null, diasSinCambio: 3, creadoEn: '2026-08-01T10:00:00Z' },
  { uuid: 'ccc', vacante: 'Asistente de Operaciones', estado: 'NO_CONTINUA', estadoNombre: 'No continúa', grupoPrioridad: null, diasSinCambio: 20, creadoEn: '2026-07-01T10:00:00Z' },
]

await mkdir('capturas', { recursive: true })
const navegador = await chromium.launch({ channel: 'chrome' })

for (const t of [{ nombre: 'escritorio', width: 1280, height: 900 }, { nombre: 'movil', width: 375, height: 812 }]) {
  const contexto = await navegador.newContext({
    viewport: { width: t.width, height: t.height }, locale: 'es-PE',
    storageState: { cookies: [], origins: [{ origin: PORTAL, localStorage: [{ name: 'renaser_portal_token', value: 'captura' }] }] },
  })
  await contexto.route('**/api/v1/portal/postulaciones', (r) =>
    caso === 'fallo'
      ? r.fulfill({ status: 500, contentType: 'application/problem+json', body: JSON.stringify({ detail: 'El sistema tuvo un problema.' }) })
      : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(POSTULACIONES) }))

  const pagina = await contexto.newPage()
  const fallos = []
  pagina.on('console', (m) => m.type() === 'error' && fallos.push(m.text()))
  pagina.on('pageerror', (e) => fallos.push(String(e)))
  await pagina.goto(`${PORTAL}/privacidad`, { waitUntil: 'networkidle' })

  if (caso === 'retiro') {
    await pagina.getByRole('button', { name: 'Retirarme' }).first().click()
    await pagina.waitForTimeout(300)
  }
  // TanStack reintenta dos veces antes de rendirse, asi que con `networkidle`
  // todavia se esta viendo el «cargando».
  if (caso === 'fallo') {
    await pagina.getByRole('button', { name: 'Intentar de nuevo' }).waitFor({ timeout: 15000 })
  }
  if (caso === 'borrado') {
    await pagina.getByRole('button', { name: 'Pedir el borrado' }).click()
    await pagina.waitForTimeout(300)
  }

  // Con un aviso abierto la pagina no hace scroll, asi que la captura entera
  // cose una imagen que nadie ve nunca: la cabecera pegajosa aparece flotando a
  // media pagina. Con el aviso abierto se captura lo que se ve y ya.
  const archivo = `capturas/privacidad-${caso}-${t.nombre}.png`
  await pagina.screenshot({ path: archivo, fullPage: caso === 'lista' })
  console.log(`${archivo}${fallos.length ? `  ⚠ ${fallos.length} error(es)` : ''}`)
  for (const f of fallos) console.log(`    ${f.slice(0, 150)}`)
  await contexto.close()
}
await navegador.close()
