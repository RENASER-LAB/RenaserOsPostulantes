/**
 * Entrar al panel de punta a punta: invitación, canje y login.
 *
 * El bucle completo, que es lo único que demuestra que la fase 2 funciona:
 *
 *   1. Alguien que ya está dentro invita a un correo nuevo.
 *   2. El invitado abre el enlace, pone su nombre y una contraseña, **y entra**.
 *   3. Sale, y vuelve a entrar con ese correo y esa contraseña.
 *   4. Una contraseña equivocada da un error genérico, no dice si el correo existe.
 *   5. El enlace ya usado no vale una segunda vez.
 *
 * El token de quien invita se saca por el `dev-login`, que el backend mantiene
 * para local. Del canje en adelante todo va por las rutas de verdad.
 *
 * ⚠️ **ESCRIBE EN LA BASE LOCAL**: crea una invitación y una cuenta de equipo.
 *
 *   PORTAL=http://localhost:5199 node herramientas/e2e-panel-entrar.mjs
 */
import { chromium } from 'playwright'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const API = process.env.API ?? 'http://localhost:8081'
const ID_DESARROLLO = process.env.ID_EQUIPO ?? 'andy-dev'

const SELLO = Date.now()
const CORREO = `e2e.equipo.${SELLO}@example.com`
// Doce como mínimo: el panel exige más que el portal porque ve datos ajenos.
const CLAVE = 'unaClaveLargaDePanel2026'

const pasos = []
const anotar = (texto, bien = true) => {
  pasos.push(`${bien ? '✓' : '✗'} ${texto}`)
  console.log(`${bien ? '✓' : '✗'} ${texto}`)
}

// ---------- Quien invita ----------
const entrada = await fetch(`${API}/api/v1/panel/auth/dev-login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ usuarioRenaserOsId: ID_DESARROLLO }),
})
if (!entrada.ok) {
  console.error(
    `No se pudo entrar como «${ID_DESARROLLO}» (${entrada.status}). `
    + 'Pasa otro con ID_EQUIPO=… o comprueba que el dev-login esté encendido en local.',
  )
  process.exit(1)
}
const { token } = await entrada.json()
anotar(`Token de equipo obtenido como «${ID_DESARROLLO}»`)

// ---------- La invitación ----------
const roles = await (
  await fetch(`${API}/api/v1/panel/roles`, { headers: { Authorization: `Bearer ${token}` } })
).json()
const rol = roles.find((r) => r.codigo === 'TALENTO') ?? roles[0]

const invitacion = await fetch(`${API}/api/v1/panel/usuarios/invitaciones`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ correo: CORREO, roles: [rol.codigo] }),
})
if (!invitacion.ok) {
  console.error(`No se pudo crear la invitación (${invitacion.status}): ${await invitacion.text()}`)
  process.exit(1)
}
const { url } = await invitacion.json()
anotar(`Invitación creada para ${CORREO} con el rol ${rol.codigo}`)

// El backend arma el enlace con `renaser.panel.url`, que puede no llevar el
// `/admin`. Se conserva el token y se deja que el portal resuelva la dirección:
// eso es justo lo que la ruta suelta de `/invitacion` tiene que arreglar.
const tokenDeLaInvitacion = new URL(url).searchParams.get('token')
const rutaDelCorreo = new URL(url).pathname
anotar(`El correo apunta a «${rutaDelCorreo}» — el portal debe recogerlo igual`)

const navegador = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 220 })
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-PE' })
const pagina = await contexto.newPage()

const errores = []
pagina.on('pageerror', (e) => errores.push(String(e)))

try {
  // ---------- 1 · Abrir el enlace tal cual lo manda el backend ----------
  await pagina.goto(`${PORTAL}${rutaDelCorreo}?token=${encodeURIComponent(tokenDeLaInvitacion)}`, {
    waitUntil: 'domcontentloaded',
  })
  await pagina.getByRole('heading', { name: /crea tu acceso/i }).waitFor({ timeout: 15_000 })
  anotar('El enlace del correo llega a la pantalla de crear el acceso, con su token')

  // ---------- 2 · Una contraseña corta se para aquí ----------
  await pagina.getByLabel('Nombre', { exact: true }).fill('Equipo')
  await pagina.getByLabel('Apellidos').fill('De Prueba')
  await pagina.getByLabel('Contraseña', { exact: true }).fill('corta123')
  await pagina.getByLabel('Repite la contraseña').fill('corta123')
  await pagina.getByRole('button', { name: /crear mi acceso/i }).click()
  await pagina.waitForTimeout(800)
  const paroLaCorta = await pagina.getByText(/al menos 12 caracteres/i).first().isVisible()
  anotar('Una contraseña de menos de 12 se para en la pantalla, no en el servidor', paroLaCorta)

  // ---------- 3 · Canjear de verdad ----------
  await pagina.getByLabel('Contraseña', { exact: true }).fill(CLAVE)
  await pagina.getByLabel('Repite la contraseña').fill(CLAVE)
  await pagina.getByRole('button', { name: /crear mi acceso/i }).click()
  await pagina.waitForURL(/\/admin$/, { timeout: 25_000 })
  anotar('La invitación se canjeó y entró directo al panel')

  // ---------- 4 · Salir ----------
  await pagina.getByRole('button', { name: /cerrar sesión|salir/i }).first().click()
  await pagina.waitForURL(/\/admin\/entrar/, { timeout: 15_000 })
  anotar('Cerrar sesión lleva a la entrada del panel')

  // ---------- 5 · Una contraseña equivocada no dice si el correo existe ----------
  await pagina.getByLabel('Correo').fill(CORREO)
  await pagina.getByRole('textbox', { name: 'Contraseña' }).fill('estaNoEsLaBuena123')
  await pagina.getByRole('button', { name: /entrar al panel/i }).click()
  await pagina.waitForTimeout(1500)
  const textoDelError = await pagina.locator('[role=alert]').first().textContent().catch(() => '')
  const esGenerico = !!textoDelError && !textoDelError.toLowerCase().includes(CORREO.toLowerCase())
  anotar(`El error no delata si el correo existe: «${(textoDelError ?? '').trim()}»`, esGenerico)

  // ---------- 6 · Entrar con la buena ----------
  await pagina.getByRole('textbox', { name: 'Contraseña' }).fill(CLAVE)
  await pagina.getByRole('button', { name: /entrar al panel/i }).click()
  await pagina.waitForURL(/\/admin$/, { timeout: 25_000 })
  anotar('Entra con correo y contraseña, sin RENASER OS')

  await pagina.screenshot({ path: 'capturas/e2e-panel-entrar.png', fullPage: true })

  // ---------- 7 · El enlace es de un solo uso ----------
  await pagina.goto(`${PORTAL}/admin/invitacion?token=${encodeURIComponent(tokenDeLaInvitacion)}`, {
    waitUntil: 'domcontentloaded',
  })
  await pagina.getByLabel('Nombre', { exact: true }).fill('Otra')
  await pagina.getByLabel('Apellidos').fill('Persona')
  await pagina.getByLabel('Contraseña', { exact: true }).fill(CLAVE)
  await pagina.getByLabel('Repite la contraseña').fill(CLAVE)
  await pagina.getByRole('button', { name: /crear mi acceso/i }).click()
  await pagina.waitForTimeout(2000)
  const rechazado = await pagina.locator('[role=alert]').first().isVisible().catch(() => false)
  anotar('El enlace ya usado no vale una segunda vez', rechazado)
} catch (causa) {
  anotar(`Se cortó: ${causa instanceof Error ? causa.message.split('\n')[0] : causa}`, false)
  await pagina.screenshot({ path: 'capturas/e2e-panel-entrar-fallo.png', fullPage: true }).catch(() => {})
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
