/**
 * Capturas de la pantalla de postular, incluido su caso critico.
 *
 * `--caso nocumple` responde «no» a un requisito indispensable y abre el aviso:
 * es el unico descarte automatico del sistema y la parte que hay que mirar mas
 * de cerca.
 *
 *   node herramientas/capturar-postular.mjs
 *   node herramientas/capturar-postular.mjs --caso errores
 *   node herramientas/capturar-postular.mjs --caso nocumple
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const caso = process.argv.includes('--caso') ? process.argv[process.argv.indexOf('--caso') + 1] : 'vacio'

const VACANTE = {
  id: 1, titulo: 'Analista de Datos', descripcion: null,
  proposito: 'Que los reportes semanales salgan solos.',
  responsabilidades: null, requisitos: null,
  modalidad: 'Híbrido', horario: 'L-V, 9 a 18', ubicacion: 'Lima', compensacionPublica: null,
  requisitosObjetivos: [
    { id: 1, descripcion: 'Tengo disponibilidad para trabajar de forma híbrida en Lima.' },
    { id: 2, descripcion: 'Tengo experiencia demostrable con SQL.' },
    { id: 3, descripcion: 'Tengo título universitario o técnico concluido.' },
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
  await contexto.route('**/api/v1/portal/vacantes/*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(VACANTE) }))

  const pagina = await contexto.newPage()
  const fallos = []
  pagina.on('console', (m) => m.type() === 'error' && fallos.push(m.text()))
  pagina.on('pageerror', (e) => fallos.push(String(e)))
  await pagina.goto(`${PORTAL}/vacantes/1/postular`, { waitUntil: 'networkidle' })

  if (caso === 'errores') {
    await pagina.locator('button[type="submit"]').click()
    await pagina.waitForTimeout(300)
  }

  if (caso === 'nocumple') {
    // Rellenar todo y decir que no cumple uno: el aviso tiene que salir.
    await pagina.setInputFiles('input[type=file]', {
      name: 'curriculum.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 de prueba'),
    })
    await pagina.locator('textarea').fill('Ordené el reporte semanal que antes tardaba tres horas cada lunes.')
    for (const [n, valor] of [[1, 'Sí'], [2, 'No'], [3, 'Sí']]) {
      await pagina.locator(`fieldset:has(input[name=requisito-${n}])`).getByText(valor, { exact: true }).click()
    }
    await pagina.waitForTimeout(200)
    await pagina.locator('button[type="submit"]').click()
    await pagina.waitForTimeout(400)
  }

  const archivo = `capturas/postular-${caso}-${t.nombre}.png`
  await pagina.screenshot({ path: archivo, fullPage: true })
  console.log(`${archivo}${fallos.length ? `  ⚠ ${fallos.length} error(es)` : ''}`)
  for (const f of fallos) console.log(`    ${f.slice(0, 150)}`)
  await contexto.close()
}
await navegador.close()
