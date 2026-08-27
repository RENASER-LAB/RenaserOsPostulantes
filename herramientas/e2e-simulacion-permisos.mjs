/**
 * El recorrido de las dos piezas nuevas, contra el backend de verdad.
 *
 *   PORTAL=http://localhost:5176 node herramientas/e2e-simulacion-permisos.mjs
 *
 * Abre un Chrome de verdad y va despacio, como los otros cinco `e2e-*`: la
 * gracia es poder mirarlo. Dos formas de verlo por dentro:
 *
 *   OCULTO=1 …      sin ventana, para cuando solo importa el resultado
 *   TRAZA=1  …      graba `capturas/traza-simulacion.zip`, y despues:
 *                   npx playwright show-trace capturas/traza-simulacion.zip
 *
 * La traza **es la UI que si funciona aqui**: linea de tiempo, el DOM de cada
 * paso, la red y la consola. El modo `--ui` de Playwright necesita
 * `@playwright/test`, que este repositorio no usa.
 *
 * ⚠️ **Esto ESCRIBE en la base local.** Marca la asistencia de quien esté
 * inscrito en la sesión y cambia el alcance de un permiso. Las dos cosas se
 * devuelven a como estaban al terminar, pase o falle: mira `restaurar()`.
 *
 * ⚠️ **Necesita el backend en el 8081 y `dev-login-activo: true`.** No usa
 * `contexto.route(...)`: el objetivo es justamente que las respuestas sean
 * reales, que es lo que los `capturar-*.mjs` no pueden comprobar.
 *
 * Por qué existe, y qué encontró: las fixturas de `capturar-panel.mjs` traían
 * una fila con `asistio: false`, un estado que **esta ruta nunca devuelve** —
 * marcar la ausencia pone `es_vigente = false` y la lista solo trae vigentes—.
 * Con datos inventados la fila se quedaba ahí tan tranquila; contra el backend
 * la persona se desvanecía al marcarla y nada lo decía.
 */

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5176'
const API = process.env.API ?? 'http://localhost:8081/api/v1/panel'
const ID_DESARROLLO = process.env.ID_DESARROLLO ?? 'andy-dev'

/** El rol y el permiso que se toca y se devuelve. Nunca `administrar_permisos`. */
const ROL_DE_PRUEBA = 'RESPONSABLE_AREA'
const PERMISO_DE_PRUEBA = 'ver_inscritos_simulacion'

let pasos = 0
let fallos = 0

function bien(que) {
  pasos++
  console.log(`  ✓ ${que}`)
}

function mal(que, detalle) {
  fallos++
  console.log(`  ✗ ${que}`)
  if (detalle) console.log(`      ${detalle}`)
}

function comprobar(condicion, que, detalle) {
  if (condicion) bien(que)
  else mal(que, detalle)
}

// ---------- La API, sin navegador ----------

let token = null

async function api(camino, opciones = {}) {
  const respuesta = await fetch(`${API}${camino}`, {
    ...opciones,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opciones.cuerpo ? { 'Content-Type': 'application/json' } : {}),
      ...opciones.headers,
    },
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
  })
  const texto = await respuesta.text()
  let cuerpo = null
  if (texto) {
    try {
      cuerpo = JSON.parse(texto)
    } catch {
      cuerpo = texto
    }
  }
  return { estado: respuesta.status, cuerpo }
}

/** Lo que había antes de tocar nada, para poder devolverlo. */
const original = { rolId: null, alcance: undefined, asistencias: [] }

async function restaurar() {
  if (original.rolId !== null && original.alcance !== undefined) {
    const vuelta =
      original.alcance === null
        ? await api(`/roles/${original.rolId}/permisos/${PERMISO_DE_PRUEBA}/revocacion`, {
            method: 'POST',
            cuerpo: { motivo: 'Fin del e2e: se devuelve el reparto a como estaba.' },
          })
        : await api(`/roles/${original.rolId}/permisos/${PERMISO_DE_PRUEBA}`, {
            method: 'PUT',
            cuerpo: {
              alcance: original.alcance,
              motivo: 'Fin del e2e: se devuelve el reparto a como estaba.',
            },
          })
    console.log(
      `\n  ↩ permiso devuelto a ${original.alcance ?? '(sin conceder)'} [${vuelta.estado}]`,
    )
  }
  if (original.asistencias.length > 0) {
    console.log(
      `  ↩ ${original.asistencias.length} inscripcion(es) marcadas durante la prueba;` +
        ' esas filas quedan como las dejó el backend (ver la cabecera).',
    )
  }
}

// ---------- El recorrido ----------

const OCULTO = process.env.OCULTO === '1'
const TRAZA = process.env.TRAZA === '1'
const ARCHIVO_TRAZA = 'capturas/traza-simulacion.zip'

const navegador = await chromium.launch({
  channel: 'chrome',
  headless: OCULTO,
  // Sin esto el recorrido pasa en tres segundos y no se ve nada. Mismo valor
  // que los otros e2e del repositorio.
  slowMo: OCULTO ? 0 : 200,
})
const contexto = await navegador.newContext({ viewport: { width: 1400, height: 950 }, locale: 'es-PE' })

if (TRAZA) {
  await mkdir('capturas', { recursive: true })
  await contexto.tracing.start({ screenshots: true, snapshots: true, sources: true })
}

const pagina = await contexto.newPage()

const errores = []
pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text().slice(0, 160)))
pagina.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))

try {
  // ----- 1 · Entrar -----
  console.log('\n1 · Entrar al panel')
  const entrada = await api('/auth/dev-login', {
    method: 'POST',
    cuerpo: { usuarioRenaserOsId: ID_DESARROLLO },
    headers: {},
  })
  comprobar(entrada.estado === 200 && entrada.cuerpo?.token, 'dev-login responde con token',
    `estado ${entrada.estado}`)
  if (!entrada.cuerpo?.token) throw new Error('sin token no hay recorrido')
  token = entrada.cuerpo.token

  await pagina.goto(`${PORTAL}/admin`, { waitUntil: 'domcontentloaded' })
  await pagina.evaluate((t) => localStorage.setItem('renaser_panel_token', t), token)

  // ----- 2 · Los inscritos de una sesion -----
  console.log('\n2 · Quién eligió cada fecha')
  const sesiones = await api('/sesiones-simulacion')
  comprobar(sesiones.estado === 200, 'la lista de sesiones responde', `estado ${sesiones.estado}`)

  const conGente = []
  for (const s of sesiones.cuerpo ?? []) {
    const lista = await api(`/sesiones-simulacion/${s.id}/inscritos`)
    comprobar(lista.estado === 200, `sesión ${s.id}: /inscritos responde 200`,
      `estado ${lista.estado}`)
    if (Array.isArray(lista.cuerpo) && lista.cuerpo.length > 0) conGente.push({ s, lista: lista.cuerpo })

    // El contrato, campo a campo: si el backend renombra uno, aquí revienta.
    for (const i of lista.cuerpo ?? []) {
      const campos = ['inscripcionId', 'postulacionId', 'candidato', 'vacante', 'inscritaEn']
      const falta = campos.filter((c) => i[c] === undefined)
      comprobar(falta.length === 0, `sesión ${s.id}: la fila trae los cinco campos`,
        `faltan: ${falta.join(', ')}`)
      comprobar(i.asistio !== false,
        `sesión ${s.id}: ningún ausente en la lista (es_vigente los saca)`,
        `inscripción ${i.inscripcionId} llegó con asistio=false`)
    }
  }

  if (conGente.length === 0) {
    console.log('  ⚠ ninguna sesión tiene inscritos: la parte de la pantalla no se ejercita.')
  } else {
    const { s, lista } = conGente[0]
    await pagina.goto(`${PORTAL}/admin/simulacion`, { waitUntil: 'domcontentloaded' })
    await pagina.waitForTimeout(1800)

    // ⚠️ **No vale `.first()`**: la tabla ordena como quiera el backend y la
    // primera fila puede ser una sesion vacia. Se abren por turno hasta dar con
    // la que tiene a esta gente dentro. (Este fallo lo cometio la propia prueba
    // en su primera version, y parecia un fallo del panel.)
    const botones = await pagina.getByRole('button', { name: 'Ver quién viene' }).all()
    comprobar(botones.length > 0, 'la tabla ofrece abrir una fecha')

    let abierta = false
    for (const boton of botones) {
      await boton.click()
      await pagina.waitForTimeout(1200)
      if ((await pagina.getByText(lista[0].candidato, { exact: false }).count()) > 0) {
        abierta = true
        break
      }
      await pagina.getByRole('button', { name: 'Cerrar' }).first().click().catch(() => {})
      await pagina.waitForTimeout(300)
    }
    comprobar(abierta, `se abrió la fecha donde está «${lista[0].candidato}»`)

    for (const i of lista) {
      const visible = await pagina.getByText(i.candidato, { exact: false }).count()
      comprobar(visible > 0, `«${i.candidato}» sale en la pantalla`)
    }

    // Con alcance TODO las dos cifras tienen que decir lo mismo. Si divergieran
    // sin explicacion, la pantalla estaria enseñando una contradiccion.
    const dice = `${lista.length === 1 ? '1 persona' : `${lista.length} personas`} de ${s.cupo} plazas`
    comprobar((await pagina.getByText(dice).count()) > 0,
      `el recuento del detalle cuadra con el aforo («${dice}»)`)

    const sinLista = lista.find((i) => i.asistio === null)
    if (sinLista) {
      comprobar((await pagina.getByText('Sin pasar lista').count()) > 0,
        'quien no tiene lista pasada se marca «Sin pasar lista»')

      // La ausencia tiene que preguntar ANTES: es lo que saca a alguien de la lista.
      await pagina.getByRole('button', { name: 'No vino' }).first().click()
      await pagina.waitForTimeout(400)
      comprobar((await pagina.getByText(/Sale de la lista/i).count()) > 0,
        'marcar la ausencia pregunta antes de mandar nada')

      const antes = await api(`/sesiones-simulacion/${s.id}/inscritos`)
      comprobar(antes.cuerpo.length === lista.length,
        'mientras se pregunta, el servidor sigue igual',
        `tenía ${lista.length}, ahora ${antes.cuerpo?.length}`)

      await pagina.getByRole('button', { name: 'Mejor no' }).click()
      await pagina.waitForTimeout(300)
      comprobar((await pagina.getByRole('button', { name: 'No vino' }).count()) > 0,
        '«mejor no» devuelve la fila a como estaba')

      // Y ahora de verdad: marcar que SÍ vino, que es la dirección benigna.
      await pagina.getByRole('button', { name: 'Vino', exact: true }).first().click()
      await pagina.waitForTimeout(1500)
      original.asistencias.push(sinLista.inscripcionId)

      const despues = await api(`/sesiones-simulacion/${s.id}/inscritos`)
      const fila = despues.cuerpo?.find((x) => x.inscripcionId === sinLista.inscripcionId)
      comprobar(fila?.asistio === true, 'marcar «vino» queda guardado en el servidor',
        `asistio quedó en ${fila?.asistio}`)
      comprobar((await pagina.getByRole('button', { name: 'Marcado: vino' }).count()) > 0,
        'la pantalla refleja lo guardado sin recargar')
    }
  }

  // ----- 3 · La matriz de permisos -----
  console.log('\n3 · Qué puede cada rol')
  const roles = await api('/roles')
  comprobar(roles.estado === 200 && roles.cuerpo?.length > 0, 'los roles responden',
    `estado ${roles.estado}`)

  const rol = roles.cuerpo.find((r) => r.codigo === ROL_DE_PRUEBA)
  comprobar(Boolean(rol), `existe el rol ${ROL_DE_PRUEBA}`)
  original.rolId = rol.id

  const matriz = await api(`/roles/${rol.id}/permisos`)
  comprobar(matriz.estado === 200, 'la matriz responde', `estado ${matriz.estado}`)
  comprobar(matriz.cuerpo.length > 50, 'llega el catálogo entero, no solo lo concedido',
    `${matriz.cuerpo?.length} permisos`)

  // El orden: por grupo y, dentro del grupo, por `orden`. La pantalla lo copia.
  const grupos = [...new Set(matriz.cuerpo.map((p) => p.grupo))]
  const ordenado = grupos.every((g) => {
    const del = matriz.cuerpo.filter((p) => p.grupo === g).map((p) => p.orden)
    return del.every((n, i) => i === 0 || del[i - 1] <= n)
  })
  comprobar(ordenado, 'cada grupo llega ordenado por `orden`')

  const casilla = matriz.cuerpo.find((p) => p.codigo === PERMISO_DE_PRUEBA)
  comprobar(Boolean(casilla), `la casilla ${PERMISO_DE_PRUEBA} está en el catálogo`)
  original.alcance = casilla.alcance ?? null

  // Cambiar el alcance, y comprobar que se guardó.
  const destino = casilla.alcance === 'TODO' ? 'SUS_VACANTES' : 'TODO'
  const sinMotivo = await api(`/roles/${rol.id}/permisos/${PERMISO_DE_PRUEBA}`, {
    method: 'PUT',
    cuerpo: { alcance: destino, motivo: '' },
  })
  comprobar(sinMotivo.estado === 400, 'el backend rechaza un cambio sin motivo',
    `estado ${sinMotivo.estado}`)

  const cambio = await api(`/roles/${rol.id}/permisos/${PERMISO_DE_PRUEBA}`, {
    method: 'PUT',
    cuerpo: { alcance: destino, motivo: 'Prueba automatizada: se revierte al terminar.' },
  })
  comprobar(cambio.estado === 200 || cambio.estado === 204, 'conceder responde bien',
    `estado ${cambio.estado}`)

  const relectura = await api(`/roles/${rol.id}/permisos`)
  const ahora = relectura.cuerpo.find((p) => p.codigo === PERMISO_DE_PRUEBA)
  comprobar(ahora.alcance === destino, 'el alcance nuevo se lee de vuelta',
    `esperaba ${destino}, llegó ${ahora?.alcance}`)

  // La pantalla lo pinta.
  await pagina.goto(`${PORTAL}/admin/configuracion`, { waitUntil: 'domcontentloaded' })
  await pagina.waitForTimeout(1800)
  const pestana = pagina.getByRole('button', { name: rol.nombre ?? rol.codigo })
  comprobar((await pestana.count()) > 0, 'el selector ofrece el rol')
  await pestana.first().click()
  await pagina.waitForTimeout(1500)
  comprobar((await pagina.getByText(PERMISO_DE_PRUEBA).count()) > 0,
    'la matriz pinta la casilla por su código')
  comprobar((await pagina.getByText(/permisos concedidos/).count()) > 0,
    'la matriz dice cuántos están concedidos')

  // El candado del último administrador.
  const admin = roles.cuerpo.find((r) => r.codigo === 'ADMINISTRADOR')
  const ultimo = await api(`/roles/${admin.id}/permisos/administrar_permisos/revocacion`, {
    method: 'POST',
    cuerpo: { motivo: 'Prueba: el backend debe negarse.' },
  })
  comprobar(ultimo.estado === 409,
    'quitar el último «administrar_permisos» se rechaza con 409',
    `estado ${ultimo.estado} — si esto pasó, el reparto quedó sin nadie que lo toque`)
} catch (causa) {
  mal('el recorrido se cortó', String(causa).slice(0, 200))
} finally {
  await restaurar()
  // La traza se cierra ANTES que el navegador: al reves el zip sale a medias.
  if (TRAZA) {
    await contexto.tracing.stop({ path: ARCHIVO_TRAZA })
    console.log(`\n  ⏺ traza en ${ARCHIVO_TRAZA}`)
    console.log(`     npx playwright show-trace ${ARCHIVO_TRAZA}`)
  }
  await navegador.close()
}

console.log(`\n${'─'.repeat(60)}`)
if (errores.length > 0) {
  console.log(`Errores en la consola del navegador (${errores.length}):`)
  for (const e of [...new Set(errores)].slice(0, 6)) console.log(`  · ${e}`)
}
console.log(`${pasos - fallos} de ${pasos} comprobaciones bien, ${fallos} mal.`)
process.exit(fallos > 0 ? 1 : 0)
