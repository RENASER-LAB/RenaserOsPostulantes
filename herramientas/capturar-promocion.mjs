/**
 * Las capturas de promocion: el sistema entero, en orden, con datos inventados.
 *
 * ⚠️ **No habla con ningun backend, y eso esta garantizado por construccion.**
 * Toda peticion a `/api/v1/**` la contesta este script; ninguna se deja pasar, asi
 * que es imposible que llegue al backend de produccion, al Spring local o a
 * cualquier copia de la base en Docker. Lo unico que sale a la red son las
 * fuentes de Google, que es lo que hace que el titular salga en Mulish y no en
 * la tipografia de respaldo.
 *
 * Y por si acaso, antes de arrancar comprueba que `.env.local` apunta a
 * localhost: apuntando a AWS el portal habla con la base real, y aunque aqui no
 * llegaria a hacerlo, correr esto contra esa configuracion no deberia ni
 * intentarse.
 *
 *   npm run dev                                  # en otra terminal, en el 5174
 *   node herramientas/capturar-promocion.mjs
 *
 *   node herramientas/capturar-promocion.mjs --solo candidato   # sin el panel
 *   node herramientas/capturar-promocion.mjs --solo panel
 *   node herramientas/capturar-promocion.mjs --solo 07,08,25    # unas pocas
 *   node herramientas/capturar-promocion.mjs --escritorio       # sin el movil
 *
 * Las imagenes quedan numeradas en `capturas-promocion/`, asi que el orden
 * alfabetico del explorador de archivos es el orden del recorrido.
 */

import { chromium } from 'playwright'
import { mkdir, readFile } from 'node:fs/promises'
import * as M from './datos-promocion.mjs'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const SALIDA = 'capturas-promocion'
const argumento = (nombre) => {
  const i = process.argv.indexOf(nombre)
  return i === -1 ? null : process.argv[i + 1]
}
const SOLO = argumento('--solo')
const SIN_MOVIL = process.argv.includes('--escritorio')

// ---------------------------------------------------------------- la guarda

try {
  const env = await readFile('.env.local', 'utf8')
  const destino = env.match(/^API_URL=(.+)$/m)?.[1]?.trim()
  if (destino && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(destino)) {
    console.error(
      `\n  .env.local apunta a ${destino}, que no es local.\n`
      + '  Este script no le pide nada a ningun backend, pero no se corre con esa\n'
      + '  configuracion puesta: apuntala a http://localhost:8081 y vuelve a intentarlo.\n',
    )
    process.exit(1)
  }
} catch {
  // Sin `.env.local` no hay a donde apuntar, asi que no hay nada que comprobar.
}

// ---------------------------------------------------------------- los tamaños

/*
 * Dos anchos, y los dos a densidad 2.
 *
 * ⚠️ **Los `capturar-*.mjs` de QA capturan a densidad 1 y aqui eso no vale.**
 * Una captura de promocion se mira ampliada en una pantalla de retina y a
 * densidad 1 el texto se ve blando. El ancho es 1440 y no 1920 porque a 1920 el
 * portal deja aire de sobra a los lados: llena mejor a la medida de un portatil.
 */
const TAMANOS = [
  { nombre: 'escritorio', width: 1440, height: 900, deviceScaleFactor: 2 },
  { nombre: 'movil', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
]

// ---------------------------------------------------------------- el recorrido

/*
 * Cada pantalla dice:
 *   ruta      · a donde va el navegador
 *   espera    · un texto que TIENE que estar. Es lo que impide que una captura
 *               salga del muro de «Ingresa para ver tu proceso» o de una
 *               pantalla vacia sin que nadie se entere.
 *   datos     · lo que responden las rutas que cambian de una pantalla a otra
 *   antes     · lo que hay que pulsar para llegar al momento que se quiere
 *   completa  · pagina entera. Solo donde lo de abajo del pliegue es la mitad
 *               de lo que hay que enseñar.
 *   desplazarA · lleva ese texto arriba del todo y captura lo que se ve. Para
 *               las pantallas largas con cabecera pegajosa, donde `completa`
 *               dejaria la cabecera flotando a media imagen.
 *
 * ⚠️ **`completa` NO se pone en las pantallas con barra pegajosa** —el examen,
 * la prueba, el cuestionario—. `fullPage` cose una imagen que nadie ve nunca:
 * la cabecera fija aparece flotando a media pagina, encima del enunciado. En
 * esas, lo que se captura es lo que se ve, que ademas es la parte que vende.
 */
const RECORRIDO = [
  // ---------- Lo que ve quien busca trabajo ----------
  {
    id: '01', nombre: 'portada', ruta: '/', espera: 'Analista de Datos', completa: true,
    grupo: 'candidato',
  },
  {
    id: '02', nombre: 'vacante', ruta: '/vacantes/1', espera: 'Lo que harás', completa: true,
    grupo: 'candidato',
  },
  {
    id: '03', nombre: 'crear-cuenta', ruta: '/registro?vacante=1', espera: 'Crear cuenta',
    grupo: 'candidato',
  },
  {
    id: '04', nombre: 'ingresar', ruta: '/ingresar', espera: 'Contraseña', grupo: 'candidato',
  },
  {
    id: '05', nombre: 'postular', ruta: '/vacantes/1/postular', espera: 'Analista de Datos',
    completa: true, conSesion: true, grupo: 'candidato',
  },
  {
    id: '06', nombre: 'mis-procesos', ruta: '/procesos', espera: 'Analista de Datos',
    completa: true, conSesion: true, grupo: 'candidato',
    // La banda del tramo vivo tarda 900 ms en formarse: sin esperarla, la
    // captura la coge a medio dibujar y parece que falte el recorrido.
    reposo: 1400,
  },
  {
    id: '07', nombre: 'un-proceso', ruta: `/procesos/${M.UUID}`, espera: 'Analista de Datos',
    completa: true, conSesion: true, reposo: 1400, grupo: 'candidato',
    datos: { proceso: M.DETALLE_DEL_PROCESO },
  },
  {
    id: '08', nombre: 'mi-perfil', ruta: '/perfil', espera: 'Lucía', completa: true,
    conSesion: true, grupo: 'candidato',
  },
  {
    id: '09', nombre: 'evaluacion-antes', ruta: `/procesos/${M.UUID}/evaluacion`,
    espera: 'evaluación', conSesion: true, grupo: 'candidato',
    datos: { evaluacion: M.EVALUACION_PORTADA },
  },
  {
    id: '10', nombre: 'evaluacion-pregunta', ruta: `/procesos/${M.UUID}/evaluacion`,
    espera: 'Pregunta 1', conSesion: true, grupo: 'candidato',
    datos: { evaluacion: M.EVALUACION_EN_CURSO },
  },
  {
    id: '11', nombre: 'evaluacion-escala', ruta: `/procesos/${M.UUID}/evaluacion`,
    espera: 'Pregunta 1', conSesion: true, grupo: 'candidato',
    datos: { evaluacion: M.EVALUACION_EN_CURSO }, siguientes: 1,
  },
  {
    id: '12', nombre: 'evaluacion-ordenar', ruta: `/procesos/${M.UUID}/evaluacion`,
    espera: 'Pregunta 1', conSesion: true, grupo: 'candidato',
    datos: { evaluacion: M.EVALUACION_EN_CURSO }, siguientes: 2,
  },
  {
    id: '13', nombre: 'evaluacion-mapa', ruta: `/procesos/${M.UUID}/evaluacion`,
    espera: 'Pregunta 1', conSesion: true, grupo: 'candidato',
    datos: { evaluacion: M.EVALUACION_EN_CURSO }, abrirMapa: true,
  },
  {
    id: '14', nombre: 'prueba-antes', ruta: `/procesos/${M.UUID}/prueba`,
    espera: 'prueba', completa: true, conSesion: true, grupo: 'candidato',
    datos: { prueba: M.PRUEBA_ANTES },
  },
  {
    id: '15', nombre: 'prueba-en-curso', ruta: `/procesos/${M.UUID}/prueba`,
    espera: 'Entregar', conSesion: true, grupo: 'candidato',
    datos: { prueba: M.PRUEBA_EN_CURSO },
  },
  {
    id: '16', nombre: 'cuestionario-tecnico', ruta: `/procesos/${M.UUID}/prueba-tecnica`,
    espera: 'Pregunta 1', conSesion: true, grupo: 'candidato',
    datos: { cuestionario: M.CUESTIONARIO_TECNICO },
  },
  {
    id: '17', nombre: 'simulacion-elegir', ruta: `/procesos/${M.UUID}/simulacion`,
    espera: 'fecha', completa: true, conSesion: true, grupo: 'candidato',
    datos: { sesiones: M.SESIONES_DISPONIBLES, miSesion: null }, marcarFecha: true,
  },
  {
    id: '18', nombre: 'simulacion-reservada', ruta: `/procesos/${M.UUID}/simulacion`,
    espera: 'Bienvenida', completa: true, conSesion: true, grupo: 'candidato',
    datos: { sesiones: M.SESIONES_DISPONIBLES, miSesion: M.MI_SESION },
  },
  {
    id: '19', nombre: 'validacion', ruta: `/procesos/${M.UUID}/validacion`,
    espera: 'Analista de Datos', completa: true, conSesion: true, grupo: 'candidato',
    datos: { proceso: M.PROCESO_EN_VALIDACION },
  },
  {
    id: '20', nombre: 'decision', ruta: `/procesos/${M.UUID}/decision`,
    espera: 'Analista de Datos', completa: true, conSesion: true, grupo: 'candidato',
    datos: { proceso: M.PROCESO_EN_DECISION },
  },
  {
    id: '21', nombre: 'privacidad', ruta: '/privacidad', espera: 'Privacidad',
    completa: true, conSesion: true, grupo: 'candidato',
  },
  {
    id: '22', nombre: 'politica-de-privacidad', ruta: '/politica-de-privacidad',
    espera: 'privacidad', completa: true, grupo: 'candidato',
  },

  // ---------- Lo que ve el equipo que contrata ----------
  {
    id: '23', nombre: 'panel-entrar', ruta: '/admin/entrar', espera: 'Contraseña', grupo: 'panel',
  },
  {
    id: '24', nombre: 'panel-vacantes', ruta: '/admin', espera: 'Analista de Datos',
    completa: true, conPanel: true, grupo: 'panel',
  },
  {
    id: '25', nombre: 'panel-vacante', ruta: '/admin/vacantes/1', espera: 'ranking',
    completa: true, conPanel: true, grupo: 'panel',
  },
  {
    id: '26', nombre: 'panel-ficha-perfil', ruta: '/admin/vacantes/1', espera: 'ranking',
    completa: true, conPanel: true, grupo: 'panel', abrirFicha: 'Rodrigo Ayala Pinto',
  },
  {
    id: '27', nombre: 'panel-ficha-prueba', ruta: '/admin/vacantes/1', espera: 'ranking',
    completa: true, conPanel: true, grupo: 'panel',
    etapa: 'Prueba del puesto', abrirFicha: 'Lucía Mendoza Ríos',
  },
  {
    id: '28', nombre: 'panel-simulacion', ruta: '/admin/simulacion', espera: 'simulación',
    completa: true, conPanel: true, grupo: 'panel',
  },
  {
    id: '29', nombre: 'panel-inscritos', ruta: '/admin/simulacion', espera: 'simulación',
    completa: true, conPanel: true, grupo: 'panel', pulsar: 'Ver quién viene',
  },
  {
    id: '30', nombre: 'panel-pruebas', ruta: '/admin/pruebas', espera: 'prueba',
    completa: true, conPanel: true, grupo: 'panel',
  },
  {
    id: '31', nombre: 'panel-configuracion', ruta: '/admin/configuracion', espera: 'Configuración',
    conPanel: true, grupo: 'panel',
  },
  {
    id: '32', nombre: 'panel-banco', ruta: '/admin/configuracion', espera: 'Configuración',
    conPanel: true, grupo: 'panel', pulsar: 'Ver qué contiene',
    desplazarA: 'Nivel Dirección',
  },
  {
    id: '33', nombre: 'panel-permisos', ruta: '/admin/configuracion', espera: 'Configuración',
    conPanel: true, grupo: 'panel', pulsar: 'Talento',
    desplazarA: 'El reparto de permisos',
  },
]

// ---------------------------------------------------------------- el interceptor

/** Lo que pidio el portal y este script no supo contestar. Se dice al final. */
const sinRespuesta = new Set()

/** Lo que el backend contesta con un 404 que la pantalla sabe leer. */
const SIN_CONTENIDO = Symbol('404')

/**
 * Que contesta cada ruta del portal.
 *
 * Un solo enrutador, y no una `route()` por patron, para que **no dependa del
 * orden de registro**: aqui se lee el camino y se decide, que es lo unico que
 * no puede equivocarse cuando `/vacantes/1` y `/vacantes/1/consentimiento`
 * casan con el mismo comodin.
 */
function delPortal(camino, pantalla) {
  const d = pantalla.datos ?? {}

  if (camino === '/auth/sesion') return M.SESION
  if (camino === '/vacantes') return M.VACANTES
  if (/^\/vacantes\/[^/]+\/consentimiento$/.test(camino)) return M.CONSENTIMIENTO_DE_LA_VACANTE
  if (/^\/vacantes\/[^/]+$/.test(camino)) return M.VACANTE
  if (camino === '/consentimientos/textos') return M.TEXTOS_DE_CONSENTIMIENTO
  if (camino === '/catalogos/niveles-educativos') return M.NIVELES_EDUCATIVOS
  if (camino === '/catalogos/niveles-idioma') return M.NIVELES_IDIOMA
  // Lo pide crear cuenta, y sin token: quien esta creandola todavia no tiene.
  if (camino === '/catalogos/ubigeo') return M.UBIGEO
  if (camino === '/perfil') return M.PERFIL
  if (camino === '/postulaciones') return M.PROCESOS
  if (/^\/postulaciones\/[^/]+$/.test(camino)) return d.proceso ?? M.DETALLE_DEL_PROCESO
  if (/^\/evaluacion\/[^/]+$/.test(camino)) return d.evaluacion ?? M.EVALUACION_EN_CURSO
  if (/^\/prueba\/[^/]+$/.test(camino)) return d.prueba ?? M.PRUEBA_EN_CURSO
  if (/^\/cuestionario-tecnico\/[^/]+$/.test(camino)) return d.cuestionario ?? M.CUESTIONARIO_TECNICO
  if (/^\/simulacion\/[^/]+\/sesiones$/.test(camino)) return d.sesiones ?? M.SESIONES_DISPONIBLES
  if (/^\/simulacion\/[^/]+$/.test(camino)) {
    // ⚠️ `miSesion: null` significa «todavia no ha elegido», y el backend
    // contesta 404. Con un `??` al respaldo, la captura de elegir fecha salia
    // con la fecha ya reservada: la pantalla equivocada bajo el nombre correcto.
    if ('miSesion' in d) return d.miSesion === null ? SIN_CONTENIDO : d.miSesion
    return M.MI_SESION
  }

  return undefined
}

/** Lo que contesta el panel. Hereda de la fixtura de QA lo que no se sobrescribe. */
function delPanel(camino, busqueda) {
  if (camino.endsWith('/ranking')) {
    return M.rankingDePromocion(busqueda.get('etapa') ?? undefined)
  }
  return M.RESPUESTAS_DEL_PANEL[camino]
    ?? M.RESPUESTAS_DEL_PANEL[`/${camino.split('/')[1]}`]
}

await mkdir(SALIDA, { recursive: true })

const elegidas = RECORRIDO.filter((p) => {
  if (!SOLO) return true
  if (SOLO === 'candidato' || SOLO === 'panel') return p.grupo === SOLO
  return SOLO.split(',').map((s) => s.trim()).includes(p.id)
})

if (elegidas.length === 0) {
  console.error(`Nada que capturar con --solo ${SOLO}.`)
  process.exit(1)
}

const navegador = await chromium.launch({ channel: 'chrome' })
let escritas = 0

for (const pantalla of elegidas) {
  for (const tamano of TAMANOS) {
    if (SIN_MOVIL && tamano.nombre === 'movil') continue

    const contexto = await navegador.newContext({
      viewport: { width: tamano.width, height: tamano.height },
      deviceScaleFactor: tamano.deviceScaleFactor,
      isMobile: tamano.isMobile ?? false,
      hasTouch: tamano.hasTouch ?? false,
      locale: 'es-PE',
      timezoneId: 'America/Lima',
      storageState: {
        cookies: [],
        origins:
          pantalla.conSesion || pantalla.conPanel
            ? [{
                origin: PORTAL,
                localStorage: [{
                  name: pantalla.conPanel ? 'renaser_panel_token' : 'renaser_portal_token',
                  value: 'promocion',
                }],
              }]
            : [],
      },
    })

    /*
     * ⚠️ **Ni una peticion de API se deja pasar.** Lo que no se sabe contestar
     * se contesta con una lista vacia y se apunta para decirlo al final; lo que
     * NUNCA se hace es `route.continue()`, que la mandaria a Vite y de ahi al
     * backend que tenga configurado.
     */
    await contexto.route('**/api/v1/**', (ruta) => {
      const url = new URL(ruta.request().url())
      const camino = url.pathname

      // Guardar una respuesta, entregar, marcar: nada de esto devuelve cuerpo.
      if (ruta.request().method() !== 'GET') {
        return ruta.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      }

      if (camino.startsWith('/api/v1/panel')) {
        const cuerpo = delPanel(camino.replace('/api/v1/panel', ''), url.searchParams)
        if (cuerpo === undefined) sinRespuesta.add(camino)
        return ruta.fulfill({
          status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo ?? []),
        })
      }

      const dentroDelPortal = camino.replace('/api/v1/portal', '')
      // La foto y la portada se piden siempre, y el 404 es la respuesta correcta
      // cuando no las hay: la cabecera dibuja el disco de iniciales.
      if (dentroDelPortal === '/perfil/foto' || dentroDelPortal === '/perfil/portada') {
        return ruta.fulfill({ status: 404, body: '' })
      }

      const cuerpo = delPortal(dentroDelPortal, pantalla)
      if (cuerpo === SIN_CONTENIDO) {
        return ruta.fulfill({
          status: 404,
          contentType: 'application/problem+json',
          body: JSON.stringify({ detail: 'Todavía no elegiste fecha' }),
        })
      }
      if (cuerpo === undefined) {
        sinRespuesta.add(camino)
        return ruta.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
      return ruta.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo),
      })
    })

    const pagina = await contexto.newPage()
    const fallos = []
    pagina.on('console', (m) => m.type() === 'error' && fallos.push(m.text().slice(0, 140)))
    pagina.on('pageerror', (e) => fallos.push(String(e).slice(0, 140)))

    await pagina.goto(PORTAL + pantalla.ruta, { waitUntil: 'domcontentloaded' })

    // Sin esperar a las fuentes, la captura sale con la tipografia de respaldo:
    // otro ancho de letra, otra altura de linea y otra composicion.
    await pagina.evaluate(() => document.fonts.ready)
    await pagina.waitForTimeout(pantalla.reposo ?? 900)

    let aviso = ''

    if (pantalla.espera) {
      const visible = pagina.getByText(pantalla.espera, { exact: false }).first()
      try {
        await visible.waitFor({ state: 'visible', timeout: 8000 })
      } catch {
        aviso = `  ⚠ no aparecio «${pantalla.espera}»`
      }
    }

    for (let i = 0; i < (pantalla.siguientes ?? 0); i++) {
      const boton = pagina.getByRole('button', { name: 'Siguiente', exact: true })
      if (await boton.count()) {
        await boton.click()
        await pagina.waitForTimeout(250)
      }
    }

    if (pantalla.abrirMapa) {
      const boton = pagina.getByRole('button', { name: /^Ver las/ })
      if (await boton.count()) {
        await boton.click()
        await pagina.waitForTimeout(350)
      }
    }

    if (pantalla.marcarFecha) {
      const fecha = pagina.locator('label:has(input[name=fecha])').first()
      if (await fecha.count()) {
        await fecha.click()
        await pagina.waitForTimeout(250)
      }
    }

    if (pantalla.pulsar) {
      const boton = pagina.getByRole('button', { name: pantalla.pulsar }).first()
      if (await boton.count()) {
        await boton.click()
        await pagina.waitForTimeout(900)
      } else {
        aviso += `  ⚠ no aparecio el boton «${pantalla.pulsar}»`
      }
    }

    // La etapa se elige ANTES de abrir la ficha: cambiar de pestaña remonta la
    // tabla y cerraria la fila que se acaba de desplegar.
    if (pantalla.etapa) {
      const pestana = pagina.getByRole('tab', { name: pantalla.etapa })
      if (await pestana.count()) {
        await pestana.click()
        await pagina.waitForTimeout(800)
      } else {
        aviso += `  ⚠ no aparecio la pestaña «${pantalla.etapa}»`
      }
    }

    if (pantalla.abrirFicha) {
      const fila = pagina.getByText(pantalla.abrirFicha).first()
      if (await fila.count()) {
        await fila.click()
        await pagina.waitForTimeout(1000)
      } else {
        aviso += `  ⚠ no aparecio «${pantalla.abrirFicha}» en la tabla`
      }
    }

    if (pantalla.desplazarA) {
      const bloque = pagina.getByText(pantalla.desplazarA, { exact: false }).first()
      if (await bloque.count()) {
        // `block: 'start'` y no `scrollIntoViewIfNeeded()`: hace falta que quede
        // ARRIBA del todo, no solo dentro de la ventana.
        await bloque.evaluate((el) => el.scrollIntoView({ block: 'start' }))
        await pagina.waitForTimeout(500)
      } else {
        aviso += `  ⚠ no aparecio «${pantalla.desplazarA}» para desplazarse`
      }
    }

    const archivo = `${SALIDA}/${pantalla.id}-${pantalla.nombre}-${tamano.nombre}.png`
    await pagina.screenshot({ path: archivo, fullPage: pantalla.completa ?? false })
    escritas++
    console.log(`${archivo}${aviso}${fallos.length ? `  · ${fallos.length} error(es) en consola` : ''}`)
    for (const f of fallos.slice(0, 2)) console.log(`      ${f}`)

    await contexto.close()
  }
}

await navegador.close()

console.log(`\n${escritas} imagenes en ${SALIDA}/`)
if (sinRespuesta.size) {
  console.log('\n⚠ Rutas que este script no supo contestar (se sirvio una lista vacia):')
  for (const r of [...sinRespuesta].sort()) console.log(`    ${r}`)
  console.log('  Si alguna pantalla salio a medias, es por aqui.')
}
