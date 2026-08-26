/**
 * Capturas de las dos puertas del panel: entrar y aceptar una invitación.
 *
 * Son las únicas pantallas del panel que viven fuera de su armazón —quien llega
 * a ellas todavía no tiene sesión— así que no hacen falta datos ni token:
 * bastan las direcciones. Nada aquí habla con ningún backend.
 *
 *   node herramientas/capturar-panel-entrar.mjs
 *   node herramientas/capturar-panel-entrar.mjs --caso errores
 *   node herramientas/capturar-panel-entrar.mjs --caso sintoken
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const caso = process.argv.includes('--caso')
  ? process.argv[process.argv.indexOf('--caso') + 1]
  : 'vacio'

// Un token cualquiera: la pantalla no lo valida, solo lo lleva en el cuerpo al
// canjearlo. Lo que se mira aquí es la forma, no el canje.
const TOKEN = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'

const PANTALLAS =
  caso === 'sintoken'
    ? [{ nombre: 'invitacion-sin-token', ruta: '/admin/invitacion' }]
    : [
        { nombre: 'panel-entrar', ruta: '/admin/entrar' },
        { nombre: 'panel-invitacion', ruta: `/admin/invitacion?token=${TOKEN}` },
      ]

await mkdir('capturas', { recursive: true })
const navegador = await chromium.launch({ channel: 'chrome' })

for (const t of [
  { nombre: 'ancho', width: 1920, height: 1000 },
  { nombre: 'escritorio', width: 1280, height: 900 },
  { nombre: 'movil', width: 375, height: 812 },
]) {
  for (const pantalla of PANTALLAS) {
    const contexto = await navegador.newContext({
      viewport: { width: t.width, height: t.height },
      locale: 'es-PE',
    })

    const pagina = await contexto.newPage()
    const fallos = []
    pagina.on('console', (m) => m.type() === 'error' && fallos.push(m.text()))
    pagina.on('pageerror', (e) => fallos.push(String(e)))
    await pagina.goto(PORTAL + pantalla.ruta, { waitUntil: 'domcontentloaded' })
    await pagina.waitForTimeout(400)

    // Enviar en blanco para ver los errores por campo.
    if (caso === 'errores') {
      await pagina.locator('button[type="submit"]').first().click()
      await pagina.waitForTimeout(300)
    }

    const archivo = `capturas/${pantalla.nombre}-${caso}-${t.nombre}.png`
    await pagina.screenshot({ path: archivo, fullPage: true })
    console.log(`${archivo}${fallos.length ? `  ⚠ ${fallos.length} error(es)` : ''}`)
    for (const f of fallos) console.log(`    ${f.slice(0, 150)}`)
    await contexto.close()
  }
}
await navegador.close()
