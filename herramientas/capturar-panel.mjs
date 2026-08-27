/**
 * Capturas del panel del equipo, para poder mirarlo de verdad.
 *
 * `verificar-panel.mjs` recorre el panel contra el backend local y **escribe en
 * la base**; esto no. Aqui las respuestas se interceptan y se sirve un
 * escenario de prueba, asi que mirar una pantalla es gratis y no deja rastro.
 *
 *   node herramientas/capturar-panel.mjs
 *   node herramientas/capturar-panel.mjs --gris    las mismas, sin color
 *
 * ⚠️ **`--gris` es la comprobacion de la regla de la forma primero.** Este
 * panel tiene dos familias de etiquetas nuevas —los tres estados de la
 * asistencia y los cuatro alcances de un permiso— y en color se distinguen
 * solas. Si al quitarselo dejan de distinguirse, estan mal: quien no separa
 * colores lee la misma pantalla.
 *
 * Las imagenes quedan en `capturas/`, que no se versiona.
 */

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const SALIDA = 'capturas'
const GRIS = process.argv.includes('--gris')

import { RESPUESTAS } from './datos-panel.mjs'

const PANTALLAS = [
  { nombre: 'vacantes', ruta: '/admin' },
  { nombre: 'simulacion', ruta: '/admin/simulacion' },
  // La misma pantalla con una fecha abierta: los tres estados de la asistencia
  // a la vez, que es lo que hay que mirar en gris antes de darlo por bueno.
  { nombre: 'inscritos', ruta: '/admin/simulacion', pulsar: 'Ver quién viene' },
  { nombre: 'configuracion', ruta: '/admin/configuracion' },
  // La matriz solo aparece con un rol elegido: sin el clic, la captura no
  // enseñaria nada de lo que hay que juzgar.
  { nombre: 'permisos', ruta: '/admin/configuracion', pulsar: 'Talento' },
  { nombre: 'vacante', ruta: '/admin/vacantes/1' },
  /*
   * ⚠️ A quien se le abre la ficha depende de la pestaña, y no es un capricho:
   * el ranking enseña solo a quien esta parado en esa etapa, asi que Camila
   * —que esta en la prueba— no existe en la tabla del perfil integral.
   */
  { nombre: 'ficha', ruta: '/admin/vacantes/1', abrirFicha: 'Rodrigo Ayala Pinto' },
  // La misma ficha en la pestaña de Prueba, que enseña otra cosa: la rubrica y
  // debajo lo que la persona escribio, con sus tres estados —contestada, en
  // blanco y sin tocar—. Sin esta pantalla el bloque de respuestas no se mira
  // nunca, porque la ficha abre siempre en Perfil integral.
  {
    nombre: 'ficha-prueba',
    ruta: '/admin/vacantes/1',
    etapa: 'Prueba del puesto',
    abrirFicha: 'Camila Reyes Ortiz',
  },
  // La etapa por la que hoy no pasa nadie. Es el estado NORMAL de Validación y
  // Decisión en casi toda vacante, asi que su tabla vacia hay que mirarla: no
  // puede leerse como un fallo, y tiene que nombrar el escape a la tanda entera.
  { nombre: 'ranking-vacio', ruta: '/admin/vacantes/1', etapa: 'Validación' },
  { nombre: 'entrar', ruta: '/admin/entrar', sinSesion: true },
]

// Los tres anchos de la casa. El movil importa aqui aunque el panel se habite
// en un escritorio: pasar lista se hace de pie en la sala, con el telefono.
const TAMANOS = [
  { nombre: 'ancho', width: 1920, height: 1000 },
  { nombre: 'escritorio', width: 1280, height: 900 },
  { nombre: 'movil', width: 375, height: 900 },
]

await mkdir(SALIDA, { recursive: true })
const navegador = await chromium.launch({ channel: 'chrome' })

for (const tamano of TAMANOS) {
  for (const pantalla of PANTALLAS) {
    const contexto = await navegador.newContext({
      viewport: { width: tamano.width, height: tamano.height },
      locale: 'es-PE',
      storageState: {
        cookies: [],
        origins: pantalla.sinSesion
          ? []
          : [{ origin: PORTAL, localStorage: [{ name: 'renaser_panel_token', value: 'captura' }] }],
      },
    })

    await contexto.route('**/api/v1/panel/**', (ruta) => {
      const camino = new URL(ruta.request().url()).pathname.replace('/api/v1/panel', '')
      const cuerpo = RESPUESTAS[camino] ?? RESPUESTAS[`/${camino.split('/')[1]}`] ?? []
      return ruta.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(cuerpo),
      })
    })

    const pagina = await contexto.newPage()
    const fallos = []
    pagina.on('console', (m) => m.type() === 'error' && fallos.push(m.text().slice(0, 140)))
    pagina.on('pageerror', (e) => fallos.push(String(e).slice(0, 140)))

    await pagina.goto(`${PORTAL}${pantalla.ruta}`, { waitUntil: 'domcontentloaded' })
    await pagina.waitForTimeout(2200)

    if (pantalla.pulsar) {
      const boton = pagina.getByRole('button', { name: pantalla.pulsar }).first()
      if (await boton.count()) {
        await boton.click()
        await pagina.waitForTimeout(900)
      } else {
        console.log(`    ⚠ no aparecio el boton «${pantalla.pulsar}»`)
      }
    }

    // La etapa se elige ANTES de abrir la ficha: cambiar de pestaña remonta la
    // tabla y cerraria la fila que se acaba de desplegar.
    if (pantalla.etapa) {
      const pestana = pagina.getByRole('tab', { name: pantalla.etapa })
      if (await pestana.count()) {
        await pestana.click()
        await pagina.waitForTimeout(700)
      } else {
        console.log(`    ⚠ no aparecio la pestaña «${pantalla.etapa}»`)
      }
    }

    if (pantalla.abrirFicha) {
      const fila = pagina.getByText(pantalla.abrirFicha).first()
      if (await fila.count()) {
        await fila.click()
        await pagina.waitForTimeout(900)
      }
    }

    if (GRIS) {
      await pagina.addStyleTag({ content: 'html { filter: grayscale(1); }' })
      await pagina.waitForTimeout(200)
    }

    const archivo = `${SALIDA}/panel-${pantalla.nombre}-${tamano.nombre}${GRIS ? '-gris' : ''}.png`
    await pagina.screenshot({ path: archivo, fullPage: true })
    console.log(`${archivo}${fallos.length ? `  ⚠ ${fallos.length} error(es)` : ''}`)
    for (const f of fallos.slice(0, 3)) console.log(`    ${f}`)

    await contexto.close()
  }
}

await navegador.close()
