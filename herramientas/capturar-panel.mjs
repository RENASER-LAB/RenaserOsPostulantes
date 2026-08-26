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

import { RESPUESTAS } from './datos-panel.mjs'

const PANTALLAS = [
  { nombre: 'vacantes', ruta: '/admin' },
  { nombre: 'simulacion', ruta: '/admin/simulacion' },
  { nombre: 'configuracion', ruta: '/admin/configuracion' },
  { nombre: 'vacante', ruta: '/admin/vacantes/1' },
  { nombre: 'ficha', ruta: '/admin/vacantes/1', abrirFicha: true },
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

    if (pantalla.abrirFicha) {
      const fila = pagina.getByText('Camila Reyes Ortiz').first()
      if (await fila.count()) {
        await fila.click()
        await pagina.waitForTimeout(900)
      }
    }

    const archivo = `${SALIDA}/panel-${pantalla.nombre}-${tamano.nombre}.png`
    await pagina.screenshot({ path: archivo, fullPage: true })
    console.log(`${archivo}${fallos.length ? `  ⚠ ${fallos.length} error(es)` : ''}`)
    for (const f of fallos.slice(0, 3)) console.log(`    ${f}`)

    await contexto.close()
  }
}

await navegador.close()
