/** El logotipo a cuatro aumentos: la hormiga dentro de la X es lo unico que
 *  sobrevive de la marca, y a 22px no se juzga a simple vista. */
import { chromium } from 'playwright'
const navegador = await chromium.launch({ channel: 'chrome' })
const pagina = await navegador.newPage({ viewport: { width: 400, height: 200 }, deviceScaleFactor: 4 })
await pagina.goto(`${process.env.PORTAL ?? 'http://localhost:5174'}/ingresar`, { waitUntil: 'networkidle' })
await pagina.locator('header a').first().screenshot({ path: 'capturas/logo.png' })
await navegador.close()
console.log('capturas/logo.png')
