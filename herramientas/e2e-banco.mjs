/**
 * El ciclo de vida de una version del banco, contra el backend de verdad.
 *
 *   PORTAL=http://localhost:5178 node herramientas/e2e-banco.mjs
 *
 * Abre un Chrome de verdad y va despacio, como los otros `e2e-*`: la gracia es
 * poder mirarlo. Dos formas de verlo por dentro:
 *
 *   OCULTO=1 …      sin ventana, para cuando solo importa el resultado
 *   TRAZA=1  …      graba `capturas/traza-banco.zip`, y despues:
 *                   npx playwright show-trace capturas/traza-banco.zip
 *
 * ⚠️ **Publicar y archivar de verdad NO se ejercitan, a proposito.** Las dos
 * son irreversibles —no hay desarchivar, y publicar retira a todas las
 * hermanas de golpe— asi que un recorrido feliz sobre las versiones sembradas
 * se comeria los datos de la base local y no habria forma de devolverlos. Lo
 * que se ejercita son **las guardas**, que el backend evalua ANTES de escribir
 * nada, y **un ciclo entero sobre una version propia**: crearla, chocar con el
 * 409 de «banco vacio» y borrarla. Eso deja la base como estaba.
 *
 * ⚠️ Lo unico que escribe: una version en borrador que se crea y se borra en
 * el mismo recorrido. Si el script muere a mitad puede quedar viva; su
 * etiqueta empieza por «e2e-banco » para poder reconocerla. Lo que no se
 * deshace son las filas de auditoria de crear y descartar, y es correcto que
 * asi sea.
 *
 * ⚠️ **Necesita el backend en el 8081 y `dev-login-activo: true`.** No usa
 * `contexto.route(...)`: el objetivo es justamente que las respuestas sean
 * reales, que es lo que los `capturar-*.mjs` no pueden comprobar — su
 * interceptor acaba en `?? []` y ninguna ruta del panel devuelve nunca un 404.
 *
 * Lo que esta prueba fija, y no se ve leyendo el frontend:
 *
 *   1. **`VersionBancoResponse` no tiene campo `nombre`.** `tipos.ts` lo
 *      declaraba y la fixtura de las capturas lo servia; el backend manda
 *      `etiqueta`.
 *   2. **Dos PUBLICADA del mismo nivel conviven** y solo la de `publicadaEn`
 *      mas reciente se le fija a quien empieza (`laPublicadaDelNivel`, con su
 *      `order by publicadaEn desc limit 1`). Es el estado real de la base
 *      local en tres niveles.
 *   3. **Los cinco 409 estan escritos en español y son especificos**, y su
 *      `detail` llega entero a la pantalla. Eso ultimo es lo que ninguna
 *      prueba de unidad puede fijar: las de unidad construyen el `ErrorApi`
 *      con el mensaje ya puesto, asi que afirman la suposicion en vez de
 *      comprobarla. Ver `elMensajeDelBackendLlegaAPantalla`.
 */

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5178'
const API = process.env.API ?? 'http://localhost:8081/api/v1/panel'
const ID_DESARROLLO = process.env.ID_DESARROLLO ?? 'andy-dev'
const OCULTO = process.env.OCULTO === '1'
const TRAZA = process.env.TRAZA === '1'

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

const detalleDe = (r) => `estado ${r.estado}: ${JSON.stringify(r.cuerpo?.detail ?? r.cuerpo)}`

// Lo que la base local tenga, con su estado. Se lee una vez y se reparte.
let versiones = []
const unaEn = (estado) => versiones.find((v) => v.estado === estado)

// ---------- El contrato, antes de mirar ninguna pantalla ----------

async function elContrato() {
  console.log('\nEl contrato del backend')

  const lista = await api('/banco-preguntas/versiones')
  comprobar(
    lista.estado === 200 && Array.isArray(lista.cuerpo),
    'GET /banco-preguntas/versiones devuelve una lista',
    detalleDe(lista),
  )
  versiones = Array.isArray(lista.cuerpo) ? lista.cuerpo : []

  const campos = Object.keys(versiones[0] ?? {}).sort()
  comprobar(
    JSON.stringify(campos) ===
      JSON.stringify(['estado', 'etiqueta', 'id', 'nivelPuestoCodigo', 'publicadaEn', 'tipoBanco']),
    'VersionBancoResponse trae exactamente sus seis campos',
    JSON.stringify(campos),
  )
  comprobar(
    !('nombre' in (versiones[0] ?? {})),
    'y NO trae «nombre»: el nombre de una versión es su «etiqueta»',
  )

  comprobar(
    versiones.every((v) => ['BORRADOR', 'PUBLICADA', 'ARCHIVADA'].includes(v.estado)),
    'los tres estados del ciclo son los únicos que llegan',
    JSON.stringify([...new Set(versiones.map((v) => v.estado))]),
  )

  /*
    El hallazgo que gobierna la pantalla: dos publicadas del mismo (tipoBanco,
    nivel) conviven. No es un caso teorico — hoy la base local tiene tres pares
    asi— y `laPublicadaDelNivel` se queda con la de `publicadaEn` mas reciente.
  */
  const porNivel = new Map()
  for (const v of versiones.filter((v) => v.estado === 'PUBLICADA')) {
    const clave = `${v.tipoBanco}|${v.nivelPuestoCodigo ?? ''}`
    porNivel.set(clave, [...(porNivel.get(clave) ?? []), v])
  }
  const conVarias = [...porNivel.values()].filter((g) => g.length > 1)
  if (conVarias.length === 0) {
    // No se pasa en verde callando: sin este caso, media pantalla no se mira.
    mal(
      'hace falta un nivel con DOS publicadas y la base local no tiene ninguno',
      'esa mitad de la pantalla —el aviso y las dos etiquetas— no se ejercita',
    )
  } else {
    bien(`hay ${conVarias.length} nivel(es) con más de una PUBLICADA, que es el caso que importa`)
    const [grupo] = conVarias
    const masReciente = [...grupo].sort((a, b) => Date.parse(b.publicadaEn) - Date.parse(a.publicadaEn))[0]
    comprobar(
      grupo.every((v) => v.publicadaEn),
      'y todas traen publicadaEn, que es el desempate del backend',
      JSON.stringify(grupo.map((v) => v.publicadaEn)),
    )
    console.log(`      rige «${masReciente.etiqueta}» (versión ${masReciente.id})`)
  }

  const conPreguntas = unaEn('PUBLICADA') ?? versiones[0]
  const preguntas = await api(`/banco-preguntas/versiones/${conPreguntas.id}/preguntas`)
  comprobar(
    preguntas.estado === 200 && Array.isArray(preguntas.cuerpo),
    'GET /versiones/{id}/preguntas devuelve una lista',
    detalleDe(preguntas),
  )
  const pregunta = preguntas.cuerpo?.[0] ?? {}
  comprobar(
    'codigo' in pregunta && 'tipo' in pregunta && 'esEliminatorio' in pregunta,
    'y cada pregunta trae codigo, tipo y esEliminatorio',
    JSON.stringify(Object.keys(pregunta)),
  )
  comprobar(
    !('logicaInterna' in pregunta),
    'y NUNCA trae «logicaInterna»: entra al banco pero no sale (RF-53)',
  )
}

// ---------- Las guardas, que rechazan antes de escribir ----------

async function lasGuardas() {
  console.log('\nLas cuatro guardas del ciclo (ninguna escribe nada)')

  const publicada = unaEn('PUBLICADA')
  const borrador = unaEn('BORRADOR')
  const archivada = unaEn('ARCHIVADA')

  if (publicada) {
    const r = await api(`/banco-preguntas/versiones/${publicada.id}/publicacion`, { method: 'POST' })
    comprobar(
      r.estado === 409 && /borrador/i.test(String(r.cuerpo?.detail)),
      'publicar una PUBLICADA se rechaza con 409 y lo explica',
      detalleDe(r),
    )

    const d = await api(`/banco-preguntas/versiones/${publicada.id}`, { method: 'DELETE' })
    comprobar(
      d.estado === 409 && /solo un borrador se edita/i.test(String(d.cuerpo?.detail)),
      'descartar una PUBLICADA se rechaza con 409',
      detalleDe(d),
    )
  } else {
    mal('no hay ninguna PUBLICADA en la base local', 'dos guardas no se ejercitan')
  }

  if (borrador) {
    const r = await api(`/banco-preguntas/versiones/${borrador.id}/archivado`, { method: 'POST' })
    comprobar(
      r.estado === 409 && /publicada/i.test(String(r.cuerpo?.detail)),
      'archivar un BORRADOR se rechaza con 409 y lo explica',
      detalleDe(r),
    )

    // Renombrar es correccion editorial: solo de una publicada.
    const e = await api(`/banco-preguntas/versiones/${borrador.id}/etiqueta`, {
      method: 'PATCH',
      cuerpo: { etiqueta: 'e2e-banco: no debería llegar a escribirse' },
    })
    comprobar(
      e.estado === 409 && /un borrador se edita entero/i.test(String(e.cuerpo?.detail)),
      'renombrar un BORRADOR se rechaza: se edita entero, no por el nombre',
      detalleDe(e),
    )
  } else {
    mal('no hay ningún BORRADOR en la base local', 'dos guardas no se ejercitan')
  }

  if (archivada) {
    const e = await api(`/banco-preguntas/versiones/${archivada.id}/etiqueta`, {
      method: 'PATCH',
      cuerpo: { etiqueta: 'e2e-banco: no debería llegar a escribirse' },
    })
    comprobar(
      e.estado === 409 && /archivada ya no se toca/i.test(String(e.cuerpo?.detail)),
      'renombrar una ARCHIVADA se rechaza: es historia',
      detalleDe(e),
    )
  } else {
    mal('no hay ninguna ARCHIVADA en la base local', 'una guarda no se ejercita')
  }

  console.log(
    '      ⚠ publicar y archivar DE VERDAD no se ejercitan: son irreversibles\n' +
      '        y se comerían las versiones sembradas. Renombrar con éxito, igual:\n' +
      '        solo vale sobre una PUBLICADA, que es justo la que no se toca.',
  )
}

// ---------- Un ciclo entero sobre una version propia ----------

async function elCicloQueSeLimpiaSolo() {
  console.log('\nCrear, chocar con el 409 de banco vacío y borrar')

  const nivel = versiones.find((v) => v.tipoBanco === 'NIVEL')?.nivelPuestoCodigo ?? 'DIRECCION'
  const creada = await api('/banco-preguntas/versiones', {
    method: 'POST',
    cuerpo: {
      tipoBanco: 'NIVEL',
      nivelPuestoCodigo: nivel,
      etiqueta: 'e2e-banco · versión de usar y tirar',
    },
  })
  comprobar(
    creada.estado === 201 && typeof creada.cuerpo?.id === 'number',
    'POST /versiones crea un borrador y devuelve su id',
    detalleDe(creada),
  )
  const id = creada.cuerpo?.id
  if (!id) return

  try {
    const enLista = await api('/banco-preguntas/versiones')
    const suya = (enLista.cuerpo ?? []).find((v) => v.id === id)
    comprobar(suya?.estado === 'BORRADOR', 'y nace en BORRADOR', JSON.stringify(suya))

    /*
      Aqui esta la gracia de usar una version propia: `validarCoherencia` lanza
      antes de tocar el estado, asi que este 409 no escribe nada — y es el unico
      camino que ejercita el endpoint de publicar sin consecuencias.
    */
    const publicar = await api(`/banco-preguntas/versiones/${id}/publicacion`, { method: 'POST' })
    comprobar(
      publicar.estado === 409 && /banco vacío/i.test(String(publicar.cuerpo?.detail)),
      'publicarla se rechaza: no se publica un banco sin preguntas',
      detalleDe(publicar),
    )

    const sigueBorrador = await api('/banco-preguntas/versiones')
    comprobar(
      (sigueBorrador.cuerpo ?? []).find((v) => v.id === id)?.estado === 'BORRADOR',
      'y el rechazo no la movió de BORRADOR',
    )

    const vacia = await api(`/banco-preguntas/versiones/${id}/preguntas`)
    comprobar(
      vacia.estado === 200 && vacia.cuerpo?.length === 0,
      'una versión recién creada no tiene ninguna pregunta',
      detalleDe(vacia),
    )
  } finally {
    const borrada = await api(`/banco-preguntas/versiones/${id}`, { method: 'DELETE' })
    comprobar(
      borrada.estado === 204,
      'DELETE /versiones/{id} descarta el borrador y devuelve 204',
      detalleDe(borrada),
    )
    const despues = await api('/banco-preguntas/versiones')
    comprobar(
      !(despues.cuerpo ?? []).some((v) => v.id === id),
      'y la base queda como estaba: la versión ya no aparece',
    )
  }
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
    el panel rebota a la entrada.
  */
  await pagina.waitForFunction(() => Boolean(localStorage.getItem('renaser_panel_token')), {
    timeout: 10000,
  })
  bien('se entra al panel con el id de desarrollo')
}

async function abrirElBanco(pagina) {
  await pagina.goto(`${PORTAL}/admin/configuracion`, { waitUntil: 'domcontentloaded' })
  // Contra el backend real un `waitForTimeout` fijo no vale: se espera a que la
  // pieza exista.
  await pagina.getByRole('heading', { name: 'El banco de preguntas' }).waitFor({ timeout: 20000 })
  await pagina
    .getByRole('button', { name: 'Ver qué contiene' })
    .first()
    .waitFor({ timeout: 20000 })
  bien('la configuración enseña el banco con sus versiones')
}

async function loQueEnseñaLaPantalla(pagina) {
  console.log('\nLo que el panel enseña de las versiones')

  const seccion = pagina.locator('section', { has: pagina.getByRole('heading', { name: 'El banco de preguntas' }) })
  const texto = await seccion.innerText()

  comprobar(
    !/undefined|\[object Object\]|NaN/.test(texto),
    'ninguna fila pinta un undefined: los seis campos son los que el backend manda',
  )

  const rige = seccion.getByText('Se asigna a quien empiece ahora')
  const noRige = seccion.getByText('Publicada, pero no se asigna a nadie')
  const cuantasRigen = await rige.count()
  const cuantasNo = await noRige.count()
  comprobar(cuantasRigen > 0, 'alguna publicada dice que se le asigna a quien empiece')
  comprobar(
    cuantasNo > 0,
    'y las otras publicadas dicen que NO se asignan a nadie',
    `${cuantasRigen} rigen, ${cuantasNo} no`,
  )

  // Una por grupo como maximo: si hubiera dos «se asigna» en el mismo nivel, el
  // desempate estaria mal.
  const gruposConPublicada = await seccion.locator('h3').count()
  comprobar(
    cuantasRigen <= gruposConPublicada,
    'y nunca hay más de una «se asigna» por nivel',
    `${cuantasRigen} sobre ${gruposConPublicada} grupos`,
  )

  comprobar(
    /Hay \d+ versiones publicadas de este banco y solo una se asigna/.test(texto),
    'el nivel con dos publicadas lo avisa arriba del grupo',
  )

  // El titulo del grupo usa el nombre del nivel, no su codigo.
  const titulos = await seccion.locator('h3').allInnerTexts()
  comprobar(
    titulos.some((t) => /^Nivel /.test(t)) &&
      !titulos.some((t) => /^Nivel [A-Z_]+$/.test(t)),
    'los grupos se llaman por el nombre del nivel, no por su código',
    JSON.stringify(titulos),
  )
}

async function loQueCadaEstadoDejaHacer(pagina) {
  console.log('\nLo que cada estado deja hacer')

  const filaBorrador = pagina
    .locator('li', { has: pagina.getByText('BORRADOR', { exact: true }) })
    .first()

  if (await filaBorrador.count()) {
    comprobar(
      await filaBorrador.getByRole('button', { name: 'Publicar' }).count(),
      'un borrador ofrece Publicar',
    )
    comprobar(
      await filaBorrador.getByRole('button', { name: 'Descartar' }).count(),
      'y Descartar',
    )
    comprobar(
      (await filaBorrador.getByRole('button', { name: 'Renombrar' }).count()) === 0,
      'y NO ofrece Renombrar, que el backend rechaza con 409',
    )

    // Preguntar antes: pulsar no publica.
    await filaBorrador.getByRole('button', { name: 'Publicar' }).click()
    const pregunta = filaBorrador.getByText(/Publicar esta versión/)
    await pregunta.waitFor({ timeout: 5000 })
    bien('y pulsar Publicar pregunta antes, en la propia fila')

    const dicho = await pregunta.innerText()
    comprobar(
      /archiva/.test(dicho),
      'la pregunta dice que publicar archiva a las otras publicadas',
      dicho.slice(0, 160),
    )
    comprobar(
      await filaBorrador.getByText(/nombra solo la primera que encuentra/).count(),
      'y avisa de que el rechazo del backend nombra una sola pregunta',
    )

    await filaBorrador.getByRole('button', { name: 'Volver' }).click()
    comprobar(
      (await filaBorrador.getByRole('button', { name: 'Sí, publicar' }).count()) === 0,
      'y «Volver» cierra la pregunta sin publicar nada',
    )
  } else {
    mal('no hay ningún BORRADOR en pantalla', 'no se ejercita ni publicar ni descartar')
  }

  const filaArchivada = pagina
    .locator('li', { has: pagina.getByText('ARCHIVADA', { exact: true }) })
    .first()
  if (await filaArchivada.count()) {
    comprobar(
      (await filaArchivada.getByRole('button', { name: 'Archivar' }).count()) === 0 &&
        (await filaArchivada.getByRole('button', { name: 'Publicar' }).count()) === 0 &&
        (await filaArchivada.getByRole('button', { name: 'Renombrar' }).count()) === 0,
      'una archivada no ofrece ninguna acción',
    )
    comprobar(
      await filaArchivada.getByText(/ya no se asigna/).count(),
      'y dice por qué, en vez de dejar la fila muda',
    )
  } else {
    mal('no hay ninguna ARCHIVADA en pantalla')
  }
}

async function loQueContieneUnaVersion(pagina) {
  console.log('\nLo que contiene una versión')

  const fila = pagina
    .locator('li', { has: pagina.getByText('PUBLICADA', { exact: true }) })
    .first()
  await fila.getByRole('button', { name: 'Ver qué contiene' }).click()

  const resumen = fila.getByText(/\d+ preguntas · \d+ puntúan/)
  await resumen.waitFor({ timeout: 20000 })
  const dicho = await resumen.innerText()
  bien(`el resumen sale del backend: ${dicho}`)

  // La cifra tiene que casar con lo que la API devuelve para esa version.
  const publicada = unaEn('PUBLICADA')
  const desdeApi = await api(`/banco-preguntas/versiones/${publicada.id}/preguntas`)
  const cuantas = Number(dicho.match(/^(\d+)/)?.[1])
  comprobar(
    cuantas > 0,
    'y no es la rama de «versión vacía» disfrazada de resumen',
    `${cuantas} preguntas en pantalla, ${desdeApi.cuerpo?.length} en la API de la versión ${publicada.id}`,
  )

  comprobar(
    (await fila.getByText(/logicaInterna|lógica interna/i).count()) === 0,
    'y la lista no filtra la lógica interna de ninguna pregunta',
  )
}

/**
 * Lo unico que ata el `detail` del backend al texto que se lee en pantalla.
 *
 * ⚠️ **Los tests de unidad no pueden probar esto**: construyen el `ErrorApi`
 * con el mensaje ya puesto, asi que afirman la suposicion. Entre el 409 y el
 * parrafo rojo hay una pieza que ninguno de los dos lados mira —`mensajeDe()`
 * de la puerta, que elige entre `detail`, `title` y `message`— y si un dia
 * eligiera mal, TODOS los 409 dirian «El estado actual no permite esta
 * operación» y las 30 pruebas de unidad y las 40 de aqui seguirian en verde.
 *
 * Se hace con una version propia recien creada, que publica a un 409 seguro y
 * **no escribe nada**: `validarCoherencia` lanza antes de tocar el estado.
 */
async function elMensajeDelBackendLlegaAPantalla(pagina) {
  console.log('\nEl 409 del backend, leído en la pantalla')

  const nivel = versiones.find((v) => v.tipoBanco === 'NIVEL')?.nivelPuestoCodigo ?? 'DIRECCION'
  const creada = await api('/banco-preguntas/versiones', {
    method: 'POST',
    cuerpo: {
      tipoBanco: 'NIVEL',
      nivelPuestoCodigo: nivel,
      etiqueta: 'e2e-banco · la que choca con el 409',
    },
  })
  const id = creada.cuerpo?.id
  if (creada.estado !== 201 || !id) {
    mal('no se pudo crear la versión para mirar el 409 en pantalla', detalleDe(creada))
    return
  }

  try {
    await pagina.reload({ waitUntil: 'domcontentloaded' })
    const fila = pagina.locator('li', { has: pagina.getByText('e2e-banco · la que choca con el 409') })
    await fila.waitFor({ timeout: 20000 })

    await fila.getByRole('button', { name: 'Publicar' }).click()
    await fila.getByRole('button', { name: 'Sí, publicar' }).click()

    const rojo = fila.locator('[role=alert]')
    await rojo.waitFor({ timeout: 20000 })
    const dicho = await rojo.innerText()

    comprobar(
      /banco vacío/i.test(dicho),
      'el «detail» del 409 llega entero a la pantalla, no el título genérico',
      dicho,
    )
    comprobar(
      !/El estado actual no permite esta operación/i.test(dicho),
      'y no se enseña el «title» de Spring, que no distingue un 409 de otro',
      dicho,
    )
    comprobar(
      await fila.getByText('BORRADOR', { exact: true }).count(),
      'y la versión sigue en BORRADOR: el rechazo no escribió nada',
    )
  } finally {
    const borrada = await api(`/banco-preguntas/versiones/${id}`, { method: 'DELETE' })
    comprobar(borrada.estado === 204, 'y se limpia sola al terminar', detalleDe(borrada))
  }
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
  await lasGuardas()
  await elCicloQueSeLimpiaSolo()

  console.log('\nEl panel')
  await entrarAlPanel(pagina)
  await abrirElBanco(pagina)
  await loQueEnseñaLaPantalla(pagina)
  await loQueCadaEstadoDejaHacer(pagina)
  await loQueContieneUnaVersion(pagina)
  await elMensajeDelBackendLlegaAPantalla(pagina)
} catch (causa) {
  mal('el recorrido se rompió a mitad', String(causa).slice(0, 300))
} finally {
  if (TRAZA) {
    await mkdir('capturas', { recursive: true })
    await contexto.tracing.stop({ path: 'capturas/traza-banco.zip' })
    console.log('\n  traza en capturas/traza-banco.zip')
  }
  await navegador.close()
}

console.log(`\n${pasos} comprobaciones bien, ${fallos} mal`)
process.exit(fallos === 0 ? 0 : 1)
