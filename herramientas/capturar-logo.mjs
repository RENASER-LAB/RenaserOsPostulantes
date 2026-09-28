/** El logotipo de la cabecera a cuatro aumentos: a 28 px no se juzga a simple
 *  vista si la hormiga que cruza la X se sigue reconociendo. */
import { chromium } from 'playwright'
const navegador = await chromium.launch({ channel: 'chrome' })
const pagina = await navegador.newPage({ viewport: { width: 400, height: 200 }, deviceScaleFactor: 4 })
await pagina.goto(`${process.env.PORTAL ?? 'http://localhost:5174'}/ingresar`, { waitUntil: 'networkidle' })
await pagina.locator('header a').first().screenshot({ path: 'capturas/logo.png' })
await navegador.close()
console.log('capturas/logo.png')
