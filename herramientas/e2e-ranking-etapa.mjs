/**
 * El ranking, etapa por etapa, contra el backend de verdad.
 *
 *   PORTAL=http://localhost:5175 node herramientas/e2e-ranking-etapa.mjs
 *
 * ⚠️ **Solo lee.** Ni un POST: entra, mira las cinco pestañas y compara lo
 * pintado con lo que dice la API. Necesita el backend en el 8081 con
 * `dev-login-activo: true`.
 *
 *   OCULTO=1 …   sin ventana
 *   VACANTE=3 …  mirar una vacante concreta en vez de elegir la mejor
 *
 * **Que vigila, y por que hace falta mirarlo aqui.**
 *
 * La tabla la sirve una sola llamada —`?etapa=` cambia de que etapa es la
 * nota, **no a quien devuelve**— y quien filtra es el navegador, por el
 * prefijo del estado. Eso tiene dos consecuencias que ningun test de
 * componente ve, porque las dos dependen de datos reales:
 *
 *   1. **Si el backend empezara a filtrar**, el navegador filtraria encima de
 *      lo ya filtrado y nadie se enteraria: la pantalla seguiria pareciendo
 *      correcta. La comprobacion 1 lo detecta.
 *   2. **Los prefijos son un pacto no escrito.** El panel decide quien esta
 *      «aqui ahora» partiendo el codigo del estado por su etapa. Un estado
 *      nuevo que no empiece por ninguno —o una etapa renombrada en el
 *      backend— haria desaparecer gente de las cinco pestañas sin un solo
 *      error en consola. Por eso lo que se pinta se compara contra los estados
 *      que devuelve la API, no contra una lista escrita a mano.
 *
 * ⚠️ **Quien termino no esta en ninguna etapa**, y eso es correcto: CONTRATADO,
 * NO_CONTINUA y CERRADA no empiezan por el prefijo de ninguna. La unica forma
 * de llegar a ellos es «Ver la tanda entera», asi que ese escape se comprueba
 * entero, incluido que sobreviva al cambio de pestaña.
 */

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5175'
const API = process.env.API ?? 'http://localhost:8081/api/v1/panel'
const ID_DESARROLLO = process.env.ID_DESARROLLO ?? 'andy-dev'
const OCULTO = process.env.OCULTO === '1'
const SALIDA = 'capturas'

/**
 * Las cinco etapas y sus prefijos, copiados del panel A PROPOSITO.
 *
 * No se importan de `Vacante.tsx`: si esta prueba leyera la misma constante que
 * la pantalla, las dos se equivocarian juntas y en silencio. Aqui son la
 * segunda opinion.
 */
const ETAPAS = [
  { nombre: 'Perfil integral', prefijos: ['POSTULADA', 'PERFIL_'] },
  { nombre: 'Prueba del puesto', prefijos: ['PRUEBA_'] },
  { nombre: 'Simulación', prefijos: ['SIMULACION_'] },
  { nombre: 'Validación', prefijos: ['VALIDACION_'] },
  { nombre: 'Decisión', prefijos: ['DECISION_'] },
]

const CODIGOS = {
  'Perfil integral': 'PERFIL_INTEGRAL',
  'Prueba del puesto': 'PRUEBA_PUESTO',
  Simulación: 'SIMULACION',
  Validación: 'VALIDACION',
  Decisión: 'DECISION',
}

let pasos = 0
let fallos = 0
const bien = (que) => {
  pasos++
  console.log(`  ✓ ${que}`)
}
const mal = (que, detalle) => {
  fallos++
  console.log(`  ✗ ${que}`)
  if (detalle) console.log(`      ${detalle}`)
}
const comprobar = (condicion, que, detalle) => (condicion ? bien(que) : mal(que, detalle))

// ---------- La API, sin navegador ----------

let token = null

async function api(camino) {
  const r = await fetch(`${API}${camino}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  // Primero el estado y despues el cuerpo: un 500 vacio se colaba como exito
  // al mirarlo al reves.
  const texto = await r.text()
  let cuerpo = null
  try {
    cuerpo = texto ? JSON.parse(texto) : null
  } catch {
    cuerpo = texto
  }
  return { estado: r.status, cuerpo }
}

async function entrarPorApi() {
  const r = await fetch(`${API}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioRenaserOsId: ID_DESARROLLO }),
  })
  if (!r.ok) throw new Error(`El dev-login contesto ${r.status}. ¿Backend en el 8081?`)
  token = (await r.json()).token
}

const etapaDe = (estado) =>
  ETAPAS.find((e) => e.prefijos.some((p) => estado.startsWith(p)))?.nombre ?? null

/**
 * La vacante que mejor ejercita esto: la que reparte su gente entre mas
 * etapas. Elegir «la primera» dejaria la prueba a merced del orden del
 * backend, y una vacante con todo el mundo en el perfil pasaria en verde sin
 * haber mirado nada.
 */
async function elegirVacante() {
  if (process.env.VACANTE) return Number(process.env.VACANTE)
  const vacantes = await api('/vacantes')
  if (vacantes.estado !== 200) throw new Error(`GET /vacantes contesto ${vacantes.estado}`)
  const lista = Array.isArray(vacantes.cuerpo) ? vacantes.cuerpo : (vacantes.cuerpo?.contenido ?? [])
  let mejor = null
  for (const v of lista) {
    const r = await api(`/vacantes/${v.id}/ranking`)
    const filas = r.cuerpo?.filas ?? []
    if (filas.length === 0) continue
    const etapas = new Set(filas.map((f) => etapaDe(f.estado)).filter(Boolean))
    const puntos = etapas.size * 100 + filas.length
    if (!mejor || puntos > mejor.puntos) mejor = { id: v.id, puntos, etapas: etapas.size, filas: filas.length }
  }
  if (!mejor) throw new Error('Ninguna vacante tiene postulaciones en la base local.')
  console.log(
    `\nSe mira la vacante ${mejor.id}: ${mejor.filas} postulaciones repartidas en ${mejor.etapas} etapa(s).`,
  )
  if (mejor.etapas < 2)
    console.log(
      '  ⚠️ Toda la tanda está en la misma etapa: el filtro se ejercita a medias.\n' +
        '     Avanza a alguien de etapa en el panel y vuelve a correr esto.',
    )
  return mejor.id
}

// ---------- Lo que dice el contrato ----------

async function elContrato(vacanteId) {
  console.log('\nEl contrato del ranking')
  const base = await api(`/vacantes/${vacanteId}/ranking`)
  comprobar(
    base.estado === 200 && Array.isArray(base.cuerpo?.filas),
    'GET /vacantes/{id}/ranking devuelve la tanda',
    `estado ${base.estado}`,
  )
  const todas = base.cuerpo.filas
  /*
    ⚠️ El `?etapa=` cambia la NOTA, no la lista. Es lo que obliga a filtrar en
    el navegador; el dia que el backend filtre, esta comprobacion se pone roja
    y el filtro del panel sobra.
  */
  let mismasFilas = true
  for (const etapa of ETAPAS) {
    const r = await api(`/vacantes/${vacanteId}/ranking?etapa=${CODIGOS[etapa.nombre]}`)
    if (r.estado !== 200 || (r.cuerpo?.filas ?? []).length !== todas.length) mismasFilas = false
  }
  comprobar(
    mismasFilas,
    '«?etapa=» cambia la nota y NO la lista: el filtro por etapa es del panel',
    'alguna etapa devolvió otra cantidad de filas — si el backend ya filtra, el panel puede dejar de hacerlo',
  )
  return todas
}

// ---------- El panel ----------

async function entrarAlPanel(pagina) {
  await pagina.goto(`${PORTAL}/admin/entrar`, { waitUntil: 'domcontentloaded' })
  // La entrada de desarrollo esta plegada: sin abrir el <details>, el campo no
  // existe en el DOM accesible.
  await pagina.getByText('Entrar con un id de desarrollo').click()
  await pagina.getByLabel('Identificador de RENASER OS').fill(ID_DESARROLLO)
  await pagina.getByRole('button', { name: 'Entrar como desarrollo' }).click()
  await pagina.waitForURL(/\/admin(\/|$)/, { timeout: 15000 })
  // ⚠️ El token se guarda un instante DESPUES de la redireccion: navegar en ese
  // hueco recarga sin sesion y el panel rebota a la entrada.
  await pagina.waitForFunction(() => Boolean(localStorage.getItem('renaser_panel_token')), {
    timeout: 10000,
  })
  bien('se entra al panel con el id de desarrollo')
}

/** Los nombres de las filas con datos: la vacia y la ficha desplegada no cuentan. */
const nombresPintados = async (pagina) => {
  const casillas = pagina.getByRole('checkbox', { name: /^Avanza / })
  const cuantas = await casillas.count()
  const nombres = []
  for (let i = 0; i < cuantas; i++) {
    const etiqueta = await casillas.nth(i).getAttribute('aria-label')
    nombres.push((etiqueta ?? '').replace(/^Avanza /, ''))
  }
  return nombres
}

const casillaDeLaTanda = (pagina) => pagina.getByRole('checkbox', { name: 'Ver la tanda entera' })

async function laPantalla(pagina, vacanteId, todas) {
  await pagina.goto(`${PORTAL}/admin/vacantes/${vacanteId}`, { waitUntil: 'domcontentloaded' })
  await pagina.getByRole('heading', { name: 'El ranking, etapa por etapa' }).waitFor({ timeout: 20000 })
  await pagina.getByText(/Se ven /).waitFor({ timeout: 20000 })

  console.log('\nLas cinco pestañas, filtradas')
  comprobar(
    !(await casillaDeLaTanda(pagina).isChecked()),
    'abre filtrado por la etapa: «Ver la tanda entera» viene sin marcar',
  )

  const terminadas = todas.filter((f) => etapaDe(f.estado) === null)
  let vacia = null

  for (const etapa of ETAPAS) {
    await pagina.getByRole('tab', { name: etapa.nombre }).click()
    await pagina.getByText(/Se ven /).waitFor({ timeout: 15000 })
    await pagina.waitForTimeout(500)

    const deLaEtapa = todas.filter((f) => etapaDe(f.estado) === etapa.nombre)
    const pintados = await nombresPintados(pagina)
    comprobar(
      pintados.length === deLaEtapa.length,
      `${etapa.nombre}: se pintan ${deLaEtapa.length} de ${todas.length}, los que están ahí hoy`,
      `la API dice ${deLaEtapa.length} y la tabla enseña ${pintados.length}`,
    )

    // La linea de recuento sale de contar lo pintado; si mintiera, seria el
    // indicador que este producto ya pago dos veces.
    const linea = (await pagina.getByText(/Se ven /).first().textContent()) ?? ''
    comprobar(
      linea.includes(`Se ven ${deLaEtapa.length} de ${todas.length}`),
      `${etapa.nombre}: la línea dice «${deLaEtapa.length} de ${todas.length}» y coincide con la tabla`,
      `decía: ${linea.trim()}`,
    )

    const coladas = terminadas.filter((f) => pintados.includes(f.candidato))
    comprobar(
      coladas.length === 0,
      `${etapa.nombre}: quien ya terminó no se cuela`,
      coladas.map((f) => `${f.candidato} (${f.estado})`).join(', '),
    )

    if (deLaEtapa.length === 0 && !vacia) vacia = etapa.nombre
    if (deLaEtapa.length === 0) {
      const dice = (await pagina.locator('tbody').first().textContent()) ?? ''
      comprobar(
        dice.includes(`Nadie está en ${etapa.nombre} ahora mismo`) &&
          dice.includes('Ver la tanda entera'),
        `${etapa.nombre}: sin nadie, lo dice sin alarma y nombra el escape`,
        dice.trim().slice(0, 160),
      )
      comprobar(
        !dice.includes('Todavía no hay postulaciones'),
        `${etapa.nombre}: no lo confunde con «todavía no hay postulaciones»`,
      )
    }
  }

  await mkdir(SALIDA, { recursive: true })
  await pagina.screenshot({ path: `${SALIDA}/ranking-etapa-filtrado.png`, fullPage: true })

  console.log('\nEl escape a la tanda entera')
  await casillaDeLaTanda(pagina).check()
  await pagina.waitForTimeout(600)
  const conTodos = await nombresPintados(pagina)
  comprobar(
    conTodos.length === todas.length,
    `marcarlo trae las ${todas.length} de la tanda`,
    `se pintan ${conTodos.length}`,
  )
  if (terminadas.length > 0) {
    comprobar(
      terminadas.every((f) => conTodos.includes(f.candidato)),
      `y con ellas ${terminadas.length} que ya terminaron, que no están en ninguna etapa`,
    )
  } else {
    console.log('  · nadie ha terminado su proceso en esta vacante: esa mitad no se ejercita')
  }

  // Sobrevive al cambio de pestaña: la tabla se remonta entera al cambiar de
  // etapa, asi que el filtro tiene que vivir por encima de ella.
  await pagina.getByRole('tab', { name: 'Decisión' }).click()
  await pagina.waitForTimeout(600)
  comprobar(
    await casillaDeLaTanda(pagina).isChecked(),
    'y sigue puesto al cambiar de pestaña, sin volver a pedirlo',
  )
  const trasCambiar = await nombresPintados(pagina)
  comprobar(
    trasCambiar.length === todas.length,
    'con la tabla entera todavía delante',
    `se pintan ${trasCambiar.length} de ${todas.length}`,
  )
  await pagina.screenshot({ path: `${SALIDA}/ranking-etapa-tanda-entera.png`, fullPage: true })

  await casillaDeLaTanda(pagina).uncheck()
  await pagina.waitForTimeout(500)
  comprobar(
    (await nombresPintados(pagina)).length <= todas.length,
    'y se puede volver a la etapa sola',
  )

  if (!vacia) console.log('  · ninguna etapa quedó vacía: la copia del vacío no se ejercitó')
}

// ---------- La carrera ----------

await entrarPorApi()
const vacanteId = await elegirVacante()
const todas = await elContrato(vacanteId)

const navegador = await chromium.launch({ channel: 'chrome', headless: OCULTO, slowMo: OCULTO ? 0 : 120 })
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-PE' })
const pagina = await contexto.newPage()
const enConsola = []
pagina.on('pageerror', (e) => enConsola.push(String(e).slice(0, 200)))

try {
  await entrarAlPanel(pagina)
  await laPantalla(pagina, vacanteId, todas)
} finally {
  comprobar(enConsola.length === 0, 'sin errores de página', enConsola.join(' · '))
  console.log(`\n${fallos === 0 ? `✓ ${pasos} comprobaciones, ninguna falló` : `✗ ${fallos} de ${pasos + fallos} fallaron`}`)
  await navegador.close()
  process.exit(fallos === 0 ? 0 : 1)
}
