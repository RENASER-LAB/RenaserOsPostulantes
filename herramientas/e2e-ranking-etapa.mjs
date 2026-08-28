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

/*
 * Los tres cortes. El de «con nota» lleva el nombre de la etapa dentro
 * —«Con nota de la prueba»— asi que se busca por lo que empieza.
 */
const losCortes = (pagina) => pagina.getByRole('group', { name: 'Qué filas se ven' })
const elCorte = (pagina, empiezaPor) =>
  losCortes(pagina)
    .getByRole('button')
    .filter({ hasText: new RegExp(`^${empiezaPor}`) })
    .first()

const cuantasEn = async (pagina, empiezaPor) => {
  const texto = (await elCorte(pagina, empiezaPor).textContent()) ?? ''
  return Number(texto.match(/(\d+)\s*$/)?.[1])
}

async function laPantalla(pagina, vacanteId, todas) {
  await pagina.goto(`${PORTAL}/admin/vacantes/${vacanteId}`, { waitUntil: 'domcontentloaded' })
  await pagina.getByRole('heading', { name: 'El ranking, etapa por etapa' }).waitFor({ timeout: 20000 })
  await losCortes(pagina).waitFor({ timeout: 20000 })

  console.log('\nLas cinco pestañas, con el corte por defecto')
  comprobar(
    (await elCorte(pagina, 'Con nota').getAttribute('aria-pressed')) === 'true',
    'abre por quien ya tiene nota de la etapa, que es con lo que se decide',
  )

  const terminadas = todas.filter((f) => etapaDe(f.estado) === null)
  let vacia = null

  for (const etapa of ETAPAS) {
    await pagina.getByRole('tab', { name: etapa.nombre }).click()
    await losCortes(pagina).waitFor({ timeout: 15000 })
    await pagina.waitForTimeout(600)

    /*
      ⚠️ **Cada pestaña pide su propio ranking**, y `notaEtapa` es lo unico que
      cambia: hay que traer el de ESTA etapa para saber quien tiene nota aqui.
      Comparar contra el del perfil daria el fallo que esta pantalla arregla.
    */
    const suyas = (await api(`/vacantes/${vacanteId}/ranking?etapa=${CODIGOS[etapa.nombre]}`)).cuerpo.filas
    const conNota = suyas.filter((f) => f.notaEtapa !== null)
    const deLaEtapa = todas.filter((f) => etapaDe(f.estado) === etapa.nombre)

    comprobar(
      (await cuantasEn(pagina, 'Con nota')) === conNota.length,
      `${etapa.nombre}: el corte «con nota» dice ${conNota.length}, como la API`,
      `la pantalla dice ${await cuantasEn(pagina, 'Con nota')}`,
    )
    comprobar(
      (await cuantasEn(pagina, 'Está aquí ahora')) === deLaEtapa.length,
      `${etapa.nombre}: «está aquí ahora» dice ${deLaEtapa.length}, como la API`,
    )
    comprobar(
      (await cuantasEn(pagina, 'Toda la tanda')) === todas.length,
      `${etapa.nombre}: «toda la tanda» dice ${todas.length}`,
    )

    const pintados = await nombresPintados(pagina)
    comprobar(
      pintados.length === conNota.length,
      `${etapa.nombre}: se pintan ${conNota.length}, los que tienen nota de esta etapa`,
      `la API dice ${conNota.length} y la tabla enseña ${pintados.length}`,
    )

    /*
      Las tres categorias de la cabecera tienen que sumar las que no tienen
      nota. Con dos —«esperando a la persona» y «esperando al equipo»— los
      `CALIFICANDO` no salian en ninguna: en una vacante real de 78 se perdian
      15 personas, y eran las que rindieron la prueba y siguen sin nota.
    */
    const sinNota = suyas.length - conNota.length
    if (sinNota > 0) {
      const linea = (await pagina.locator('p').filter({ hasText: /con nota de/ }).first().innerText()) ?? ''
      const cifras = [...linea.matchAll(/(\d+) (?:ya la hicieron|sin hacerla|en otra etapa)/g)]
      const suman = cifras.reduce((a, m) => a + Number(m[1]), 0)
      comprobar(
        suman === sinNota,
        `${etapa.nombre}: las categorías suman las ${sinNota} sin nota`,
        `suman ${suman} en «${linea.trim()}»`,
      )
    }

    // La cifra de la etapa NO puede ser la de la cola del curriculum, que es de
    // donde salia «76 calificados» encima de una columna de guiones.
    const cabecera = (await pagina.locator('p').filter({ hasText: /con nota de/ }).first().textContent()) ?? ''
    comprobar(
      cabecera.includes(`${conNota.length} de ${todas.length}`),
      `${etapa.nombre}: la cifra de arriba es de la etapa, no de la criba del CV`,
      `decía: ${cabecera.trim()}`,
    )

    if (etapa.nombre !== 'Perfil integral' && etapa.nombre !== 'Decisión') {
      const delCv = (await pagina.locator('p').filter({ hasText: /La criba del currículum/ }).first().textContent()) ?? ''
      comprobar(
        delCv.includes('no de esta etapa'),
        `${etapa.nombre}: la línea del currículum dice que no habla de esta etapa`,
        delCv.trim().slice(0, 140),
      )
    }

    if (conNota.length === 0 && !vacia) vacia = etapa.nombre
    if (conNota.length === 0) {
      const dice = (await pagina.locator('tbody').first().textContent()) ?? ''
      comprobar(
        dice.includes('Nadie tiene todavía') && dice.includes('Toda la tanda'),
        `${etapa.nombre}: sin ninguna nota, dice qué falta y nombra el escape`,
        dice.trim().slice(0, 160),
      )
      comprobar(
        !dice.includes('Todavía no hay postulaciones'),
        `${etapa.nombre}: no lo confunde con «todavía no hay postulaciones»`,
      )
    }
  }

  await mkdir(SALIDA, { recursive: true })
  await pagina.screenshot({ path: `${SALIDA}/ranking-etapa-con-nota.png`, fullPage: true })

  console.log('\nEl corte de «está aquí ahora» sigue existiendo')
  await elCorte(pagina, 'Está aquí ahora').click()
  await pagina.waitForTimeout(700)
  const aqui = await nombresPintados(pagina)
  const enDecision = todas.filter((f) => etapaDe(f.estado) === 'Decisión')
  comprobar(
    aqui.length === enDecision.length,
    `en Decisión enseña a los ${enDecision.length} que están ahí ahora`,
    `se pintan ${aqui.length}`,
  )
  const coladas = terminadas.filter((f) => aqui.includes(f.candidato))
  comprobar(coladas.length === 0, 'y quien ya terminó no se cuela', coladas.map((f) => f.candidato).join(', '))

  console.log('\nEl escape a la tanda entera')
  await elCorte(pagina, 'Toda la tanda').click()
  await pagina.waitForTimeout(700)
  const conTodos = await nombresPintados(pagina)
  comprobar(
    conTodos.length === todas.length,
    `pulsarlo trae las ${todas.length} de la tanda`,
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

  /*
    El porque de cada guion. Es lo que faltaba: un guion significaba cinco cosas
    y la mas confusa era «el curriculum esta calificado y esta etapa no».
  */
  const cuerpo = (await pagina.locator('tbody').first().textContent()) ?? ''
  const motivos = [
    'Todavía no llega a esta etapa',
    'Pasó de esta etapa sin que quedara nota',
    'Terminó su proceso sin nota de esta etapa',
    'Le toca a la persona',
    'Calificándose ahora mismo',
    'pendiente de que el equipo la cierre',
    'El equipo no la ha habilitado',
  ].filter((m) => cuerpo.includes(m))
  comprobar(
    motivos.length > 0,
    `cada nota vacía dice por qué lo está (${motivos.length} motivo(s) distintos en pantalla)`,
    'ninguna fila sin nota explicaba su guion',
  )

  // Sobrevive al cambio de pestaña: la tabla se remonta entera al cambiar de
  // etapa, asi que el corte tiene que vivir por encima de ella.
  await pagina.getByRole('tab', { name: 'Prueba del puesto' }).click()
  await pagina.waitForTimeout(700)
  comprobar(
    (await elCorte(pagina, 'Toda la tanda').getAttribute('aria-pressed')) === 'true',
    'y el corte elegido sigue puesto al cambiar de pestaña, sin volver a pedirlo',
  )
  comprobar(
    (await nombresPintados(pagina)).length === todas.length,
    'con la tabla entera todavía delante',
  )
  await pagina.screenshot({ path: `${SALIDA}/ranking-etapa-tanda-entera.png`, fullPage: true })

  if (!vacia) console.log('  · ninguna etapa quedó sin notas: esa copia no se ejercitó')
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
