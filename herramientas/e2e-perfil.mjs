/**
 * «Mi perfil» de punta a punta, contra el backend de verdad y en Chrome visible.
 *
 * Recorre las cinco listas con sus operaciones reales —que **no son las mismas
 * en las cinco**— y la trampa que más importa:
 *
 *   ⚠️ **La cabecera es un PUT que reemplaza los siete campos.** Aquí se
 *   comprueba de la única forma que vale: se llena entera, se guarda, se cambia
 *   UN solo campo, se vuelve a guardar, y se pide el perfil al servidor. Si
 *   volvió con los otros seis vacíos, el guardado los borró.
 *
 * ⚠️ **ESCRIBE EN LA BASE LOCAL**: crea una cuenta y llena su perfil.
 *
 *   PORTAL=http://localhost:5199 node herramientas/e2e-perfil.mjs
 */
import { chromium } from 'playwright'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const API = process.env.API ?? 'http://localhost:8081'

const SELLO = Date.now()
const CORREO = `e2e.perfil.${SELLO}@example.com`
const CLAVE = 'unaClaveDePrueba123'

const pasos = []
const anotar = (texto, bien = true) => {
  pasos.push(`${bien ? '✓' : '✗'} ${texto}`)
  console.log(`${bien ? '✓' : '✗'} ${texto}`)
}

// La cuenta se crea por la API: lo que se prueba aquí es el perfil, no el alta.
const textos = await (await fetch(`${API}/api/v1/portal/consentimientos/textos`)).json()
const alta = await fetch(`${API}/api/v1/portal/cuentas`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nombre: 'Prueba',
    apellidos: 'Del Perfil',
    correo: CORREO,
    contrasena: CLAVE,
    aceptaProceso: true,
    aceptaFuturosContactos: false,
  }),
})
if (!alta.ok) {
  console.error(`No se pudo crear la cuenta (${alta.status}): ${await alta.text()}`)
  console.error(`Textos de consentimiento disponibles: ${textos.length}`)
  process.exit(1)
}
const { token } = await (
  await fetch(`${API}/api/v1/portal/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: CORREO, contrasena: CLAVE }),
  })
).json()
anotar(`Cuenta de prueba creada (${CORREO})`)

const conToken = { headers: { Authorization: `Bearer ${token}` } }
const pedirPerfil = async () =>
  await (await fetch(`${API}/api/v1/portal/perfil`, conToken)).json()

const navegador = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 180 })
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 950 },
  locale: 'es-PE',
  storageState: {
    cookies: [],
    origins: [{ origin: PORTAL, localStorage: [{ name: 'renaser_portal_token', value: token }] }],
  },
})
const pagina = await contexto.newPage()

const errores = []
pagina.on('pageerror', (e) => errores.push(String(e)))

const guardar = async () => {
  await pagina.getByRole('button', { name: 'Guardar' }).click()
  await pagina.waitForTimeout(1200)
}

try {
  await pagina.goto(`${PORTAL}/perfil`, { waitUntil: 'domcontentloaded' })
  await pagina.getByRole('heading', { name: 'Tu perfil.' }).waitFor({ timeout: 20_000 })

  // Un perfil recién creado responde 200 con todo vacío, no 404.
  const vacio = await pagina.getByRole('button', { name: 'Escribir quién eres' }).isVisible()
  anotar('Un perfil vacío se abre sin romperse y ofrece empezar', vacio)

  // ---------- 1 · La cabecera, entera ----------
  await pagina.getByRole('button', { name: 'Escribir quién eres' }).click()
  await pagina.getByLabel('Titular').fill('Analista de procesos')
  await pagina.getByLabel('En pocas palabras').fill('Ocho años ordenando operaciones.')
  await pagina.getByLabel('Lo que sabes hacer').fill('Excel avanzado, Power BI, SQL')
  await pagina.getByLabel('Experiencia, en meses').fill('96')
  await pagina.getByLabel('Dónde estás').fill('Arequipa, Perú')
  await pagina.getByLabel('Desde cuándo puedes empezar').fill('Inmediata')
  await pagina.getByLabel('Desde', { exact: true }).fill('3500')
  await pagina.getByLabel('Hasta', { exact: true }).fill('4200')
  await guardar()

  const conCabecera = await pedirPerfil()
  anotar(
    'La cabecera se guardó entera',
    conCabecera.titular === 'Analista de procesos'
      && conCabecera.experienciaMeses === 96
      && conCabecera.habilidades.length === 3
      && conCabecera.pretension !== null,
  )

  // ---------- 2 · LA TRAMPA: cambiar un campo no puede borrar los otros seis ----------
  await pagina.getByRole('button', { name: 'Editar quién eres' }).click()
  await pagina.getByLabel('Titular').fill('Jefa de operaciones')
  await guardar()

  const trasElCambio = await pedirPerfil()
  const seConservoTodo =
    trasElCambio.titular === 'Jefa de operaciones'
    && trasElCambio.resumen === 'Ocho años ordenando operaciones.'
    && trasElCambio.habilidades.length === 3
    && trasElCambio.experienciaMeses === 96
    && trasElCambio.ubicacion === 'Arequipa, Perú'
    && trasElCambio.disponibilidad === 'Inmediata'
    && trasElCambio.pretension?.min === 3500
  anotar('Cambiar SOLO el titular no borró los otros seis campos', seConservoTodo)

  // ---------- 3 · La pretensión es todo o nada ----------
  await pagina.getByRole('button', { name: 'Editar quién eres' }).click()
  await pagina.getByLabel('Hasta', { exact: true }).fill('')
  await pagina.getByRole('button', { name: 'Guardar' }).click()
  await pagina.waitForTimeout(800)
  const paroLaPretension = await pagina.getByText(/pon también el máximo/i).isVisible()
  anotar('Un solo número de la pretensión se para en la pantalla', paroLaPretension)
  await pagina.getByLabel('Hasta', { exact: true }).fill('4200')
  await guardar()

  // ---------- 4 · Experiencia: crear, reordenar y borrar ----------
  for (const [puesto, empresa, desde] of [
    ['Analista senior', 'Clínica San Juan', '2022-03-01'],
    ['Asistente de operaciones', 'Transportes del Sur', '2019-01-01'],
  ]) {
    await pagina.getByRole('button', { name: 'Añadir experiencia' }).click()
    await pagina.getByLabel('Puesto').fill(puesto)
    await pagina.getByLabel('Empresa').fill(empresa)
    await pagina.getByLabel('Desde', { exact: true }).last().fill(desde)
    await guardar()
  }
  const conExperiencia = await pedirPerfil()
  anotar('Se crearon dos experiencias', conExperiencia.experiencia.length === 2)
  anotar(
    'Lo que escribe la persona nace como suyo y confirmado',
    conExperiencia.experiencia.every((e) => e.origen === 'PERSONA' && e.confirmado),
  )

  const antesDeMover = conExperiencia.experiencia.map((e) => e.id)
  await pagina.getByRole('button', { name: `Bajar ${conExperiencia.experiencia[0].puesto}` }).click()
  await pagina.waitForTimeout(1200)
  const trasMover = (await pedirPerfil()).experiencia.map((e) => e.id)
  anotar(
    'Las flechas reordenan de verdad',
    trasMover.length === 2 && trasMover[0] === antesDeMover[1],
  )

  // ---------- 5 · Educación con su catálogo ----------
  await pagina.getByRole('button', { name: 'Añadir estudios' }).click()
  await pagina.getByLabel('Qué estudiaste').fill('Ingeniería Industrial')
  await pagina.getByLabel('Dónde', { exact: true }).fill('UNSA')
  await pagina.locator('#nivel-educativo').selectOption('TITULADO')
  await guardar()
  const conEstudios = await pedirPerfil()
  anotar(
    'Los estudios se guardan con el nivel del catálogo',
    conEstudios.educacion.length === 1 && conEstudios.educacion[0].nivelCodigo === 'TITULADO',
  )

  // ---------- 6 · Idiomas ----------
  await pagina.getByRole('button', { name: 'Añadir idioma' }).click()
  await pagina.getByLabel('Idioma').fill('Inglés')
  await pagina.locator('#nivel-idioma').selectOption('B2')
  const hayExplicacion = await pagina.getByText(/me manejo en una reunión de trabajo/i).isVisible()
  anotar('Al elegir el nivel se explica qué significa, ahí mismo', hayExplicacion)
  await guardar()

  // ---------- 7 · Certificaciones, con una vencida ----------
  await pagina.getByRole('button', { name: 'Añadir certificación' }).click()
  await pagina.getByLabel('Nombre').fill('Soporte Vital Básico (BLS)')
  await pagina.getByLabel('Quién la emitió').fill('American Heart Association')
  await pagina.getByLabel('Emitida en').fill('2022-05-01')
  await pagina.getByLabel('Vence en').fill('2024-05-01')
  await guardar()
  const avisaVencida = await pagina.getByText('Vencida', { exact: true }).isVisible()
  anotar('Una certificación caducada se avisa en la pantalla', avisaVencida)

  // ---------- 8 · Enlaces: solo crear y quitar ----------
  await pagina.getByRole('button', { name: 'Añadir enlace' }).click()
  await pagina.locator('#tipo-enlace').selectOption('LINKEDIN')
  await pagina.getByLabel('Dirección').fill('https://linkedin.com/in/prueba-e2e')
  await guardar()
  const conEnlace = await pedirPerfil()
  anotar('El enlace se guardó', conEnlace.enlaces.length === 1)
  // Los enlaces no llevan editar ni confirmar: el backend no los tiene.
  const sinEditarEnlace =
    (await pagina.getByRole('button', { name: /^Editar el enlace/ }).count()) === 0
  anotar('Un enlace no ofrece editar ni confirmar, que es lo que existe', sinEditarEnlace)

  await pagina.screenshot({ path: 'capturas/e2e-perfil.png', fullPage: true })

  // ---------- 9 · Quitar ----------
  await pagina.getByRole('button', { name: /^Quitar el enlace de LinkedIn/ }).click()
  await pagina.waitForTimeout(1200)
  anotar('El enlace se quitó', (await pedirPerfil()).enlaces.length === 0)
} catch (causa) {
  anotar(`Se cortó: ${causa instanceof Error ? causa.message.split('\n')[0] : causa}`, false)
  await pagina.screenshot({ path: 'capturas/e2e-perfil-fallo.png', fullPage: true }).catch(() => {})
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
