/**
 * Recorre el panel del equipo CONTRA EL BACKEND LOCAL DE VERDAD, sin
 * interceptar nada: entra con el dev-login, mira las tres pestañas, abre una
 * ficha del ranking y crea una sesion de simulacion.
 *
 * ⚠️ Escribe en la base local (renaser-postgres). No es para producción.
 *
 *   node herramientas/verificar-panel.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
await mkdir('capturas', { recursive: true })
const navegador = await chromium.launch({ channel: 'chrome' })
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-PE' })
const pagina = await contexto.newPage()
const fallos = []
pagina.on('pageerror', (e) => fallos.push(String(e).slice(0, 160)))
pagina.on('console', (m) => m.type() === 'error' && fallos.push(m.text().slice(0, 160)))

const foto = async (nombre) => {
  await pagina.screenshot({ path: `capturas/panel-${nombre}.png`, fullPage: true })
  console.log(`capturas/panel-${nombre}.png`)
}

// 1 · Entrar
await pagina.goto(`${PORTAL}/admin/entrar`, { waitUntil: 'domcontentloaded' })
await pagina.getByRole('button', { name: 'Entrar al panel' }).waitFor()
await foto('entrar')
// ⚠️ El panel entra con correo y contraseña desde la reescritura del login. La
// entrada de desarrollo sigue ahí pero **plegada**, y hay que abrirla: el campo
// no existe en el DOM accesible hasta que el `<details>` se despliega.
await pagina.getByText('Entrar con un id de desarrollo').click()
await pagina.getByLabel('Identificador de RENASER OS').fill('andy-dev')
await pagina.getByRole('button', { name: 'Entrar como desarrollo' }).click()
await pagina.waitForURL('**/admin', { timeout: 10000 })
await pagina.getByRole('table').waitFor({ timeout: 10000 })
await foto('vacantes')

// 2 · El detalle de la vacante con postulantes (la 4, Administrador)
await pagina.getByRole('link', { name: /Ver postulantes/ }).first().click()
await pagina.getByRole('heading', { name: 'El ranking de la tanda' }).waitFor({ timeout: 10000 })
await pagina.waitForTimeout(800)
await foto('vacante-detalle')

// 3 · Abrir la ficha del primero del ranking
const filas = pagina.locator('tbody tr')
await filas.first().click()
await pagina.waitForTimeout(900)
await foto('vacante-ficha')

// 4 · Simulacion: crear una sesion de prueba
await pagina.getByRole('link', { name: 'Simulación' }).click()
await pagina.getByRole('heading', { name: 'Sesiones de simulación.' }).waitFor({ timeout: 10000 })
await foto('sesiones')
await pagina.getByRole('button', { name: 'Crear sesión' }).click()
const manana = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
await pagina.getByLabel('Fecha', { exact: true }).fill(manana)
await pagina.getByLabel('Lugar (si es presencial)').fill('Oficina de San Isidro')
const casillas = pagina.locator('fieldset input[type=checkbox]')
if (await casillas.count()) await casillas.first().check()
await foto('sesion-formulario')
await pagina.getByRole('button', { name: 'Crear la sesión' }).click()
await pagina.waitForTimeout(1200)
await foto('sesion-creada')

// 5 · Configuracion
await pagina.getByRole('link', { name: 'Configuración' }).click()
await pagina.getByRole('heading', { name: 'Configuración.' }).waitFor({ timeout: 10000 })
await pagina.waitForTimeout(800)
await foto('configuracion')

console.log(fallos.length ? `⚠ errores de consola:\n  ${fallos.join('\n  ')}` : '✓ sin errores de consola')
await navegador.close()
