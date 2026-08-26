/**
 * Postular de punta a punta, contra el backend de verdad y en Chrome visible.
 *
 * Recorre lo que la fase 1 tenía que arreglar:
 *
 *   1. El tablón dice de qué empresa es cada vacante.
 *   2. La ficha también, y no como un metadato más.
 *   3. **Postular sin aceptar el tratamiento de datos se para en la pantalla**,
 *      no en el servidor. Es el candado: sin él, el backend responde 400 y el
 *      candidato se entera después de subir su currículum.
 *   4. Aceptando, la postulación entra y sale en «Mis procesos» con su empresa.
 *
 * ⚠️ **ESCRIBE EN LA BASE LOCAL** (`renaser-postgres`): crea una cuenta nueva y
 * una postulación. Nunca contra producción — comprueba a dónde apunta tu
 * `.env.local` antes de correrlo.
 *
 *   PORTAL=http://localhost:5199 node herramientas/e2e-postular.mjs
 */
import { chromium } from 'playwright'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const API = process.env.API ?? 'http://localhost:8081'

// Un correo distinto en cada corrida: la cuenta se crea de verdad y dos
// corridas seguidas chocarían con «ese correo ya existe».
const SELLO = Date.now()
const CORREO = `e2e.postular.${SELLO}@example.com`
const CLAVE = 'unaClaveDePrueba123'

const pasos = []
const anotar = (texto, bien = true) => {
  pasos.push(`${bien ? '✓' : '✗'} ${texto}`)
  console.log(`${bien ? '✓' : '✗'} ${texto}`)
}

const vacantes = await (await fetch(`${API}/api/v1/portal/vacantes`)).json()
if (!Array.isArray(vacantes) || vacantes.length === 0) {
  console.error('No hay vacantes publicadas en la base local. Publica una y vuelve a correrlo.')
  process.exit(1)
}
const vacante = vacantes[0]

const navegador = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 220 })
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-PE' })
const pagina = await contexto.newPage()

const errores = []
pagina.on('pageerror', (e) => errores.push(String(e)))

try {
  // ---------- 1 · El tablón nombra a la empresa ----------
  await pagina.goto(PORTAL, { waitUntil: 'domcontentloaded' })
  await pagina.getByRole('heading', { name: vacante.titulo }).first().waitFor({ timeout: 15_000 })
  const hayEmpresa = await pagina.getByText(vacante.nombreEmpresa).first().isVisible()
  anotar(`El tablón dice que «${vacante.titulo}» es de ${vacante.nombreEmpresa}`, hayEmpresa)

  // ---------- 2 · Crear la cuenta ----------
  await pagina.goto(`${PORTAL}/registro?vacante=${vacante.id}`, { waitUntil: 'domcontentloaded' })
  await pagina.getByLabel('Nombre', { exact: true }).fill('Prueba')
  await pagina.getByLabel('Apellidos').fill('De Punta a Punta')
  await pagina.getByLabel('Correo').fill(CORREO)
  await pagina.getByLabel('Contraseña', { exact: true }).fill(CLAVE)
  await pagina.getByLabel('Repite la contraseña').fill(CLAVE)
  // El consentimiento de la plataforma, que es distinto del de la empresa.
  await pagina.locator('input[type=checkbox]').first().check()
  await pagina.getByRole('button', { name: /crear/i }).click()
  await pagina.waitForURL(/\/vacantes\/\d+\/postular/, { timeout: 20_000 })
  anotar(`Cuenta creada (${CORREO}) y de vuelta en el formulario de postular`)

  // ---------- 3 · La ficha del formulario dice la empresa ----------
  // Se espera al formulario: nada más cambiar de dirección la pantalla todavía
  // está en «Cargando el puesto…» y preguntar ahí no comprueba nada.
  await pagina.locator('input[type=file]').waitFor({ timeout: 15_000 })
  const enElFormulario = await pagina.getByText(vacante.nombreEmpresa).first().isVisible()
  anotar('El formulario de postular dice a qué empresa vas', enElFormulario)

  // ---------- 4 · Intentar sin aceptar: TIENE que pararse aquí ----------
  await pagina.setInputFiles('input[type=file]', {
    name: 'curriculum.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 curriculum de prueba de punta a punta'),
  })
  await pagina.locator('textarea').first().fill(
    'Ordené el reporte semanal de ocupación: pasó de tres días de trabajo a salir solo cada lunes.',
  )
  for (const grupo of await pagina.locator('fieldset').all()) {
    await grupo.getByText('Sí', { exact: true }).click()
  }

  const peticiones = []
  pagina.on('request', (r) => {
    if (r.url().includes('/postulaciones') && r.method() === 'POST') peticiones.push(r.url())
  })

  await pagina.getByRole('button', { name: /enviar mi postulación/i }).click()
  await pagina.waitForTimeout(1200)

  const seParo = await pagina.getByText(/sin este permiso/i).isVisible()
  anotar('Sin aceptar el tratamiento, la pantalla lo para y explica por qué', seParo)
  anotar('...y no llega ni una petición al servidor', peticiones.length === 0)

  // ---------- 5 · Aceptar y enviar ----------
  await pagina.locator('input[type=checkbox]').check()
  await pagina.getByRole('button', { name: /enviar mi postulación/i }).click()

  // Si dijo que sí a todos los requisitos no sale el aviso; si saliera, se cierra.
  const aviso = pagina.getByRole('button', { name: /enviarla de todos modos/i })
  if (await aviso.isVisible().catch(() => false)) await aviso.click()

  await pagina.waitForURL(/\/procesos$/, { timeout: 25_000 })
  anotar('La postulación entró y el portal llevó a «Mis procesos»')

  // ---------- 6 · Sale con su empresa ----------
  await pagina.getByRole('heading', { name: vacante.titulo }).first().waitFor({ timeout: 15_000 })
  const conEmpresa = await pagina.getByText(vacante.nombreEmpresa).first().isVisible()
  anotar('El proceso nuevo dice de qué empresa es', conEmpresa)

  await pagina.screenshot({ path: 'capturas/e2e-postular.png', fullPage: true })
} catch (causa) {
  anotar(`Se cortó: ${causa instanceof Error ? causa.message.split('\n')[0] : causa}`, false)
  await pagina.screenshot({ path: 'capturas/e2e-postular-fallo.png', fullPage: true }).catch(() => {})
} finally {
  console.log('\n--- Resumen ---')
  for (const p of pasos) console.log(p)
  if (errores.length) {
    console.log('\n⚠ Errores de JavaScript en la página:')
    for (const e of errores) console.log(`   ${e.slice(0, 200)}`)
  }
  const fallo = pasos.some((p) => p.startsWith('✗')) || errores.length > 0
  await pagina.waitForTimeout(1500)
  await navegador.close()
  process.exit(fallo ? 1 : 0)
}
