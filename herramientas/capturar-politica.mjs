/**
 * La politica de privacidad publica, en los tres anchos.
 *
 * Es la pagina que Google Play exige poder leer sin cuenta, asi que **no
 * intercepta nada**: no le pide datos a ningun backend porque no los usa.
 *
 *   node herramientas/capturar-politica.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'

const TAMANOS = [
  { nombre: 'ancho', viewport: { width: 1920, height: 1200 } },
  { nombre: 'escritorio', viewport: { width: 1280, height: 900 } },
  { nombre: 'movil', viewport: { width: 375, height: 812 } },
]

await mkdir('capturas', { recursive: true })
const navegador = await chromium.launch()

for (const { nombre, viewport } of TAMANOS) {
  const contexto = await navegador.newContext({ viewport })
  const pagina = await contexto.newPage()
  await pagina.goto(`${PORTAL}/politica-de-privacidad`, { waitUntil: 'networkidle' })
  await pagina.screenshot({ path: `capturas/politica-${nombre}.png`, fullPage: true })
  console.log(`capturas/politica-${nombre}.png`)
  await contexto.close()
}

await navegador.close()
