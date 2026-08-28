/**
 * Las cuatro piezas de esta rama, contra el backend de verdad.
 *
 *   PORTAL=http://localhost:5177 node herramientas/e2e-prueba-y-empresas.mjs
 *
 * Abre un Chrome de verdad y va despacio, como los otros `e2e-*`: la gracia es
 * poder mirarlo. Dos formas de verlo por dentro:
 *
 *   OCULTO=1 …      sin ventana, para cuando solo importa el resultado
 *   TRAZA=1  …      graba `capturas/traza-prueba.zip`, y despues:
 *                   npx playwright show-trace capturas/traza-prueba.zip
 *
 * ⚠️ **Escribe en la base local**, y poco: quita el cierre de prueba de una
 * vacante —que ya estaba quitado— y pide una calificacion a la IA. Las dos son
 * idempotentes; lo que no se deshace son las filas de auditoria, y es correcto
 * que asi sea.
 *
 * ⚠️ **Necesita el backend en el 8081 y `dev-login-activo: true`.** No usa
 * `contexto.route(...)`: el objetivo es justamente que las respuestas sean
 * reales, que es lo que los `capturar-*.mjs` no pueden comprobar.
 *
 * Lo que esta prueba encontro, y no se veia leyendo el codigo:
 *
 *   1. `CierrePruebaResponse` llama al campo **`intentosConPlazoPropio`**, no
 *      `conPlazoPropio` —ese es el nombre de una variable local dentro de su
 *      implementacion—. Con el nombre corto llegaba `undefined` y el unico
 *      numero que ese bloque existe para no callar se perdia en silencio.
 *   2. Con la vacante **sin version de prueba elegida**, el backend contesta
 *      400 con «The given id must not be null»: un `findById(null)` de Spring
 *      Data saliendo en ingles a la cara del equipo. Por eso el panel no ofrece
 *      el control ahi y explica que falta elegir la prueba.
 *   3. Una prueba **CRONOMETRADA no admite fecha de cierre**, y el backend lo
 *      explica bien. Es el caso que ejercita esta prueba.
 */

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5177'
const API = process.env.API ?? 'http://localhost:8081/api/v1/panel'
const ID_DESARROLLO = process.env.ID_DESARROLLO ?? 'andy-dev'
const OCULTO = process.env.OCULTO === '1'
const TRAZA = process.env.TRAZA === '1'

/**
 * Las vacantes que se miran, y por que cada una.
 *
 * ⚠️ **No valen intercambiadas.** La 3 esta PUBLICADA y su prueba es
 * cronometrada, que es lo que hace que el cierre se rechace con explicacion;
 * la 4 esta cerrada pero es la unica con pruebas rendidas de verdad, que es lo
 * que hace falta para mirar las respuestas.
 */
const VACANTE_ABIERTA = Number(process.env.VACANTE_ABIERTA ?? 3)
const VACANTE_CON_PRUEBAS = Number(process.env.VACANTE_CON_PRUEBAS ?? 4)

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

async function api(camino, opciones = {}) {
  const respuesta = await fetch(`${API}${camino}`, {
    ...opciones,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opciones.cuerpo ? { 'Content-Type': 'application/json' } : {}),
      ...(opciones.headers ?? {}),
    },
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
  })
  // Primero el estado y despues el cuerpo, como manda la casa: un 500 vacio se
  // colaba como exito al mirarlo al reves.
  const texto = await respuesta.text()
  let cuerpo = null
  try {
    cuerpo = texto ? JSON.parse(texto) : null
  } catch {
    cuerpo = texto
  }
  return { estado: respuesta.status, cuerpo }
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

// ---------- El contrato, antes de mirar ninguna pantalla ----------

async function elContrato() {
  console.log('\nEl contrato del backend')

  const respuestas = await api(`/postulaciones/16/prueba/respuestas`)
  comprobar(
    respuestas.estado === 200 && Array.isArray(respuestas.cuerpo),
    'GET /prueba/respuestas devuelve una lista',
    `estado ${respuestas.estado}`,
  )
  const campos = respuestas.cuerpo?.[0] ?? {}
  comprobar(
    'preguntaId' in campos && 'enunciado' in campos && 'respuesta' in campos,
    'y cada fila trae preguntaId, enunciado y respuesta',
    `llego ${JSON.stringify(Object.keys(campos))}`,
  )

  // El campo que costo el hallazgo: `cierraEn: null` no toca la version, asi
  // que este es el unico camino que devuelve la forma completa sin escribir.
  const quitado = await api(`/vacantes/${VACANTE_ABIERTA}/cierre-prueba`, {
    method: 'POST',
    cuerpo: { cierraEn: null, motivo: 'e2e: comprobar la forma de la respuesta' },
  })
  comprobar(
    quitado.estado === 200 && 'intentosConPlazoPropio' in (quitado.cuerpo ?? {}),
    'CierrePruebaResponse trae «intentosConPlazoPropio», no «conPlazoPropio»',
    `llego ${JSON.stringify(quitado.cuerpo)}`,
  )

  // Sin version elegida el backend revienta en ingles. Se comprueba para que el
  // dia que lo arreglen, esta prueba lo diga y el panel pueda ofrecer el control.
  const sinVersion = await api('/vacantes/1/cierre-prueba', {
    method: 'POST',
    cuerpo: { cierraEn: '2036-01-15T05:00:00Z', motivo: 'e2e: hueco conocido del backend' },
  })
  comprobar(
    sinVersion.estado === 400 && String(sinVersion.cuerpo?.detail).includes('must not be null'),
    'sigue reventando en ingles si la vacante no tiene version de prueba (hueco del backend)',
    `estado ${sinVersion.estado}: ${JSON.stringify(sinVersion.cuerpo?.detail)}`,
  )

  const encolada = await api('/postulaciones/16/prueba/calificacion-ia', { method: 'POST' })
  comprobar(
    encolada.estado === 200 && typeof encolada.cuerpo?.estado === 'string',
    'POST /prueba/calificacion-ia encola y contesta al momento',
    `estado ${encolada.estado}`,
  )
  // ⚠️ **`estado` no siempre es ENCOLADA**, y esto es lo que encontro esta
  // prueba. `SIN_CAMBIOS` significa que NO se encolo nada —la rubrica no le
  // reserva criterios al agente, o ya hay un trabajo en marcha— y el panel
  // llego a decir «se pidio» sobre eso. Se comprueba que el contrato sigue
  // teniendo los dos valores: el dia que el backend deje de mandar uno, esta
  // pantalla puede simplificarse.
  comprobar(
    ['ENCOLADA', 'SIN_CAMBIOS'].includes(encolada.cuerpo?.estado),
    'y su «estado» es ENCOLADA o SIN_CAMBIOS, que no significan lo mismo',
    JSON.stringify(encolada.cuerpo),
  )
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
  /*
    ⚠️ **Esperar a la URL no basta.** El token se guarda un instante DESPUES de
    la redireccion, asi que navegar en ese hueco recarga la pagina sin sesion y
    el panel rebota a la entrada. Costo un fallo que parecia del detalle de la
    vacante y era de esta prueba.
  */
  await pagina.waitForFunction(() => Boolean(localStorage.getItem('renaser_panel_token')), {
    timeout: 10000,
  })
  bien('se entra al panel con el id de desarrollo')
}

/**
 * Abre una vacante y **espera a que la tabla este**.
 *
 * ⚠️ Un `waitForTimeout` fijo no vale aqui. Contra las fixturas de
 * `capturar-panel.mjs` dos segundos sobran; contra el backend de verdad el
 * ranking tarda mas, y la prueba fallaba con una lista de cabeceras vacia — un
 * fallo que parecia del panel y era de la prueba.
 */
async function abrirLaVacante(pagina, id) {
  await pagina.goto(`${PORTAL}/admin/vacantes/${id}`, { waitUntil: 'domcontentloaded' })
  await pagina.getByRole('tab', { name: 'Perfil integral' }).waitFor({ timeout: 20000 })
  await pagina.locator('table thead th').first().waitFor({ timeout: 20000 })
}

async function elRankingPorEtapa(pagina) {
  console.log('\nEl ranking, etapa por etapa')
  await abrirLaVacante(pagina, VACANTE_CON_PRUEBAS)

  const cabeceras = () => pagina.locator('table thead th').allTextContents()

  const enPerfil = await cabeceras()
  comprobar(
    enPerfil.includes('Nota del perfil'),
    'la nota se llama por su etapa y no «Nota de etapa»',
    JSON.stringify(enPerfil),
  )
  comprobar(
    enPerfil.includes('Adecuación') && enPerfil.includes('Potencial'),
    'en Perfil integral salen las dos dimensiones del currículum',
  )

  await pagina.getByRole('tab', { name: 'Prueba del puesto' }).click()
  await pagina
    .locator('table thead th', { hasText: 'Nota de la prueba' })
    .waitFor({ timeout: 20000 })
  const enPrueba = await cabeceras()
  comprobar(
    enPrueba.includes('Nota de la prueba'),
    'al cambiar de pestaña la nota se renombra',
    JSON.stringify(enPrueba),
  )
  comprobar(
    !enPrueba.includes('Adecuación') && !enPrueba.includes('Potencial'),
    'y las del currículum desaparecen, que era lo que hacía leer la tabla como si hablara del CV',
    JSON.stringify(enPrueba),
  )
}

async function loQueEscribio(pagina) {
  console.log('\nLo que escribió en la prueba')

  // ⚠️ No vale abrir la primera fila: el ranking ordena como quiera el backend
  // y la de arriba puede no haber rendido. Se abren por turno hasta dar con una
  // que traiga respuestas.
  const filas = pagina.locator('table tbody tr').filter({ hasNot: pagina.locator('[colspan]') })
  const cuantas = Math.min(await filas.count(), 8)
  let encontrada = false

  for (let i = 0; i < cuantas && !encontrada; i++) {
    await filas.nth(i).click()
    await pagina.waitForTimeout(1600)
    const bloque = pagina.getByRole('heading', { name: 'Lo que escribió en la prueba' })
    if (await bloque.count()) {
      const preguntas = pagina.locator('ol li, ul li').filter({ hasText: /·/ })
      if ((await preguntas.count()) > 0) encontrada = true
    }
    if (!encontrada) await filas.nth(i).click()
  }

  comprobar(encontrada, 'la ficha enseña lo que la persona escribió, pregunta a pregunta')

  if (encontrada) {
    const boton = pagina.getByRole('button', { name: /Pedirle a la IA que califique la prueba/ })
    comprobar(await boton.count(), 'y ofrece pedirle a la IA que la califique')

    await boton.first().click()
    await pagina.waitForTimeout(3000)
    const texto = await pagina.locator('main').innerText()

    /*
      ⚠️ **Las dos respuestas valen, y son opuestas.** `ENCOLADA` es que se
      pidio; `SIN_CAMBIOS` es que no se pidio nada —la rubrica no le reserva
      criterios al agente, o ya hay un trabajo en marcha—. Lo que no vale es la
      tercera: quedarse callado, o decir que se pidio sobre un SIN_CAMBIOS, que
      es lo que hacia esta pantalla antes de que esta prueba lo encontrara.
    */
    /*
      ⚠️ No buscar «se pidió» a secas: el mensaje del backend para SIN_CAMBIOS
      empieza por «No se pidió nada», asi que esa cadena esta en las DOS ramas y
      encendia las dos banderas a la vez. La senal de que si se encolo es que
      esta calificando ahora.
    */
    const dicePedido = /está calificando|quedó en cola/i.test(texto)
    const diceQueNo = /no se encoló nada|no había nada que/i.test(texto)
    comprobar(
      dicePedido !== diceQueNo,
      'contesta una de las dos cosas —se pidió, o no se encoló nada— y nunca las dos',
      texto.slice(texto.indexOf('Pedirle a la IA'), texto.indexOf('Pedirle a la IA') + 260),
    )
    comprobar(
      !/(nota|prueba) (ya )?(está|quedó) calificad[ao]|listo|terminó/i.test(texto),
      'y en ningún caso afirma que la nota ya llegó',
    )

    // `waitFor` y no `count()`: la peticion remonta parte de la ficha y el
    // bloque puede tardar un instante en volver.
    await pagina
      .getByRole('heading', { name: 'El plazo de esta persona' })
      .waitFor({ timeout: 10000 })
    bien('y deja fijarle a esta persona su propia fecha')
  }
}

async function elCierreDeLaPrueba(pagina) {
  console.log('\nCuándo cierra la prueba')
  await abrirLaVacante(pagina, VACANTE_ABIERTA)

  comprobar(
    await pagina.getByText('Cuándo cierra la prueba').count(),
    'el control aparece en una vacante abierta con su prueba elegida',
  )

  await pagina.getByLabel('Se cierra el').fill('2036-01-15T23:59')
  await pagina
    .getByLabel('Por qué se fija esta fecha')
    .fill('e2e: comprobar que una cronometrada lo rechaza con explicación')
  await pagina.getByRole('button', { name: 'Guardar la fecha de cierre' }).click()
  await pagina.waitForTimeout(2500)

  const texto = await pagina.locator('main').innerText()
  comprobar(
    /cronometrada/i.test(texto),
    'una prueba cronometrada rechaza la fecha y el panel enseña el porqué del backend',
    texto.slice(0, 200),
  )
  comprobar(
    !/must not be null|null|undefined/i.test(texto),
    'y no se cuela ningún texto interno ni un «undefined»',
  )

  // Quitar el cierre: la operacion que si funciona aqui, y la que devuelve los
  // dos numeros. Es idempotente — ya estaba quitado — asi que no deja rastro.
  await pagina.getByRole('button', { name: 'Quitar el cierre de la vacante' }).click()
  await pagina.waitForTimeout(600)
  await pagina.getByRole('button', { name: 'Sí, quitar el cierre' }).click()
  await pagina.waitForTimeout(2500)

  const despues = await pagina.locator('main').innerText()
  comprobar(
    !/undefined|NaN/.test(despues),
    'quitar el cierre no pinta undefined en ninguna de sus dos cifras',
    despues.slice(0, 300),
  )
}

/**
 * El paso que faltaba entre calificar la prueba y verla en el ranking.
 *
 * ⚠️ **Calificar con IA no deja nota en la columna.** El agente pone la nota de
 * cada criterio; la de la etapa nace solo de `POST .../prueba/calificacion`, y
 * ese endpoint no estaba cableado. En la base local hay una postulacion con sus
 * SIETE criterios calificados y la columna en blanco por esto exactamente.
 *
 * ⚠️ **No se pulsa el boton, a proposito.** Calcular la nota escribe, y se
 * comeria el unico caso de la base local que reproduce el fallo: sin el, la
 * siguiente vez que alguien corra esta prueba no tendra nada que mirar. Lo que
 * se ejercita es que la pantalla DIGA en cual de las tres situaciones esta cada
 * persona, y el 409 de la rama que si se puede provocar sin escribir.
 */
/**
 * Abre la vacante en la pestaña de la prueba, con la tanda entera, y despliega
 * la ficha de un correo.
 *
 * ⚠️ Con la tanda entera y no con el corte por defecto: quien tiene la rúbrica
 * calificada y ninguna nota de etapa es justamente quien NO sale en «con nota
 * de la prueba», que es el corte con el que abre la pantalla.
 */
async function abrirLaFichaDe(pagina, correo) {
  await abrirLaVacante(pagina, VACANTE_CON_PRUEBAS)
  await pagina.getByRole('tab', { name: 'Prueba del puesto' }).click()
  await pagina.waitForTimeout(900)
  await pagina.getByRole('button', { name: /^Toda la tanda/ }).click()
  await pagina.waitForTimeout(900)
  await pagina.getByText(correo, { exact: true }).first().click()
  await pagina.waitForTimeout(2000)
}

async function elPasoQueProduceLaNota(pagina) {
  console.log('\nLa nota de la prueba, que no nace de calificar')

  const filas = (await api(`/vacantes/${VACANTE_CON_PRUEBAS}/ranking?etapa=PRUEBA_PUESTO`)).cuerpo
    ?.filas ?? []

  // De cada fila, cuantos criterios de la prueba tienen nota y si hay nota de etapa.
  const conRubrica = []
  for (const f of filas) {
    const notas = (await api(`/postulaciones/${f.postulacionId}/prueba/notas`)).cuerpo
    if (!Array.isArray(notas) || notas.length === 0) continue
    const puestas = notas.filter((n) => n.puntaje !== null).length
    conRubrica.push({ ...f, criterios: notas.length, puestas })
  }
  comprobar(conRubrica.length > 0, 'hay postulaciones con rúbrica de prueba que mirar')

  const enteraSinNota = conRubrica.find(
    (f) => f.puestas === f.criterios && f.notaEtapa === null,
  )
  const sinCalificar = conRubrica.find((f) => f.puestas === 0 && f.notaEtapa === null)

  if (!enteraSinNota) {
    // No se pasa en verde callando: es el caso que esta pieza existe para cubrir.
    mal(
      'no hay ninguna con la rúbrica entera y sin nota de etapa',
      'ese es el caso que dejaba la columna en blanco; sin él no se ejercita el botón',
    )
  } else {
    await abrirLaFichaDe(pagina, enteraSinNota.correo)
    const bloque = pagina.locator('section').filter({ hasText: 'La nota de la prueba' }).first()
    await bloque.waitFor({ timeout: 20000 })
    const dice = await bloque.innerText()
    comprobar(
      /todavía no tiene nota de la prueba/i.test(dice),
      `la ${enteraSinNota.postulacionId} tiene sus ${enteraSinNota.criterios} criterios y ninguna nota: la pantalla lo dice`,
      dice.slice(0, 160),
    )
    comprobar(
      await bloque.getByRole('button', { name: 'Calcular la nota de la prueba' }).count(),
      'y ofrece el paso que la produce, que es lo que no existía',
    )
    comprobar(
      /se calcula ponderándolas/i.test(dice),
      'explicando que calificar y ponderar son dos cosas',
    )
  }

  if (sinCalificar) {
    await abrirLaFichaDe(pagina, sinCalificar.correo)
    const bloque = pagina.locator('section').filter({ hasText: 'La nota de la prueba' }).first()
    await bloque.waitFor({ timeout: 20000 })
    const dice = await bloque.innerText()
    comprobar(
      /Ninguno de sus criterios tiene nota/i.test(dice),
      'con la rúbrica vacía manda a pedirle la calificación a la IA',
      dice.slice(0, 140),
    )
    comprobar(
      (await bloque.getByRole('button', { name: 'Calcular la nota de la prueba' }).count()) === 0,
      'y NO ofrece calcular: el backend lo rechazaría con 409',
    )

    // El 409, por la API: nombra los criterios que faltan uno a uno y no escribe.
    const rechazo = await api(`/postulaciones/${sinCalificar.postulacionId}/prueba/calificacion`, {
      method: 'POST',
    })
    comprobar(
      rechazo.estado === 409 && /faltan notas por poner/i.test(String(rechazo.cuerpo?.detail)),
      'y el 409 nombra los criterios que faltan, uno a uno',
      `estado ${rechazo.estado}: ${JSON.stringify(rechazo.cuerpo?.detail ?? rechazo.cuerpo)}`,
    )
  } else {
    console.log('  · no hay ninguna con la rúbrica vacía: esa rama no se ejercita')
  }

  console.log(
    '      ⚠ el botón NO se pulsa: calcular escribe, y se comería el único caso\n' +
      '        de la base local que reproduce el fallo.',
  )
}

async function laCribaDeLaTanda(pagina) {
  console.log('\nCalificar la tanda')
  await abrirLaVacante(pagina, VACANTE_CON_PRUEBAS)

  const rapida = pagina.getByRole('button', { name: 'Criba rápida' })
  comprobar(await rapida.count(), 'la criba rápida se ofrece sobre la tanda')

  await rapida.first().click()
  await pagina.waitForTimeout(700)
  const pregunta = await pagina.locator('main').innerText()
  comprobar(
    /Alcanza a/i.test(pregunta) && /¿Seguimos\?/.test(pregunta),
    'y pregunta antes, diciendo a quién alcanza',
    pregunta.slice(0, 200),
  )
  comprobar(
    /\d+ personas de la tanda|toda la tanda/.test(pregunta),
    'nombrando cuánta gente es',
  )

  // No se confirma: pedir la criba de una tanda entera dispara llamadas al
  // modelo para todo el mundo, y esta prueba no tiene por que costar eso.
  await pagina.getByRole('button', { name: /Mejor no|Cancelar/ }).first().click()
  await pagina.waitForTimeout(500)
  comprobar(
    await pagina.getByRole('button', { name: 'Criba rápida' }).count(),
    'y se puede echar atrás sin llamar a nadie',
  )
}

async function laEntradaDeLasEmpresas(pagina) {
  console.log('\nLa entrada de las empresas')
  await pagina.goto(PORTAL, { waitUntil: 'domcontentloaded' })
  await pagina.waitForTimeout(1500)

  const enlace = pagina.locator('footer').getByRole('link', { name: /panel de empresas/i })
  comprobar(await enlace.count(), 'el portal ofrece la entrada del panel en su pie')

  const arriba = await pagina.locator('header').innerText()
  comprobar(
    !/empresa/i.test(arriba),
    'y no en la barra de arriba, que es el camino de quien postula',
    arriba,
  )

  await enlace.click()
  await pagina.waitForURL(/\/admin\/entrar/, { timeout: 10000 })
  bien('y lleva a la entrada del panel')

  const texto = await pagina.locator('main, body').first().innerText()
  comprobar(
    !/crear cuenta|regístrate|registrate/i.test(texto),
    'que no ofrece registrarse: las cuentas del panel nacen solo por invitación',
  )
}

// ---------- El recorrido ----------

const navegador = await chromium.launch({
  channel: 'chrome',
  headless: OCULTO,
  slowMo: OCULTO ? 0 : 180,
})
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } })
if (TRAZA) await contexto.tracing.start({ screenshots: true, snapshots: true })
const pagina = await contexto.newPage()

try {
  await entrarPorApi()
  await elContrato()

  console.log('\nEl panel')
  await entrarAlPanel(pagina)
  await elRankingPorEtapa(pagina)
  await loQueEscribio(pagina)
  await elCierreDeLaPrueba(pagina)
  await elPasoQueProduceLaNota(pagina)
  await laCribaDeLaTanda(pagina)
  await laEntradaDeLasEmpresas(pagina)
} catch (causa) {
  mal('el recorrido se rompió a mitad', String(causa).slice(0, 300))
} finally {
  if (TRAZA) {
    await mkdir('capturas', { recursive: true })
    await contexto.tracing.stop({ path: 'capturas/traza-prueba.zip' })
    console.log('\n  traza en capturas/traza-prueba.zip')
  }
  await navegador.close()
}

console.log(`\n${pasos} comprobaciones bien, ${fallos} mal`)
process.exit(fallos === 0 ? 0 : 1)
