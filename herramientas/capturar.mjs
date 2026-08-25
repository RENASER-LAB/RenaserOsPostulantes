/**
 * Capturas del portal, para poder mirar una pantalla de verdad.
 *
 * Existe porque el portal necesita una sesion y datos del backend para enseñar
 * algo, y el backend real es **la base de produccion**: pedirle postulaciones
 * de verdad para revisar un diseño seria mirar datos de candidatos reales. Aqui
 * la respuesta se intercepta y se sirve un escenario de prueba, asi que el
 * backend no llega a tocarse.
 *
 * Usa el Chrome que ya esta instalado en el equipo, no descarga ninguno.
 *
 *   node herramientas/capturar.mjs                 # el escenario normal
 *   node herramientas/capturar.mjs --caso vacio    # sin ninguna postulacion
 *   node herramientas/capturar.mjs --caso fallo    # el backend responde mal
 *   node herramientas/capturar.mjs --caso terminado  # ya no continua
 *
 * Las imagenes quedan en `capturas/`, que no se versiona.
 */

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const SALIDA = 'capturas'

const TAMANOS = [
  { nombre: 'ancho', width: 1920, height: 1000 },
  { nombre: 'escritorio', width: 1280, height: 900 },
  { nombre: 'movil', width: 375, height: 812 },
]

/** Escenarios de prueba. Ninguno sale de aqui ni toca la base real. */
const CASOS = {
  normal: [
    {
      uuid: 'a1', vacante: 'Analista de Datos',
      estado: 'PERFIL_TURNO_CANDIDATO', estadoNombre: 'Evaluación pendiente',
      grupoPrioridad: 'PRIORIDAD_ALTA', diasSinCambio: 2, creadoEn: '2026-08-04T14:12:00Z',
    },
    {
      uuid: 'a2', vacante: 'Coordinador de Proyectos',
      estado: 'PRUEBA_POR_CONFIRMAR', estadoNombre: 'Prueba en revisión',
      grupoPrioridad: 'PRIORIDAD_MEDIA', diasSinCambio: 1, creadoEn: '2026-07-28T09:00:00Z',
    },
    {
      uuid: 'a3', vacante: 'Administrador',
      estado: 'PERFIL_POR_CONFIRMAR', estadoNombre: 'Revisando currículum',
      grupoPrioridad: 'PRIORIDAD_MEDIA', diasSinCambio: 3, creadoEn: '2026-08-20T11:30:00Z',
    },
    {
      uuid: 'a4', vacante: 'Ingeniero/a de Infraestructura',
      estado: 'NO_CONTINUA', estadoNombre: 'No continúa',
      grupoPrioridad: null, diasSinCambio: 12, creadoEn: '2026-06-15T08:00:00Z',
    },
  ],
  vacio: [],
  // El escenario del peor momento del producto: ya no continua en ninguna.
  terminado: [
    {
      uuid: 'b1', vacante: 'Ingeniero/a de Infraestructura',
      estado: 'NO_CONTINUA', estadoNombre: 'No continúa',
      grupoPrioridad: null, diasSinCambio: 12, creadoEn: '2026-06-15T08:00:00Z',
    },
  ],
  // Un cuerpo que no es una lista: lo que llega cuando algo va mal de verdad.
  fallo: { title: 'Error interno', status: 500, detail: 'Algo falló en el servidor' },
}

const caso = process.argv.includes('--caso')
  ? process.argv[process.argv.indexOf('--caso') + 1]
  : 'normal'

if (!(caso in CASOS)) {
  console.error(`Caso desconocido: ${caso}. Hay: ${Object.keys(CASOS).join(', ')}`)
  process.exit(1)
}

await mkdir(SALIDA, { recursive: true })

const navegador = await chromium.launch({ channel: 'chrome' })

for (const tamano of TAMANOS) {
  const contexto = await navegador.newContext({
    viewport: { width: tamano.width, height: tamano.height },
    locale: 'es-PE',
    // El portal guarda el token aqui; sin el, la pantalla pide ingresar.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: PORTAL,
          localStorage: [{ name: 'renaser_portal_token', value: 'captura' }],
        },
      ],
    },
  })

  await contexto.route('**/api/v1/portal/postulaciones', (ruta) =>
    ruta.fulfill({
      status: caso === 'fallo' ? 500 : 200,
      contentType: 'application/json',
      body: JSON.stringify(CASOS[caso]),
    }),
  )

  const pagina = await contexto.newPage()
  const fallos = []
  pagina.on('console', (m) => m.type() === 'error' && fallos.push(m.text()))
  pagina.on('pageerror', (e) => fallos.push(String(e)))

  await pagina.goto(`${PORTAL}/procesos`, { waitUntil: 'networkidle' })
  // El unico movimiento del portal es la marca al cerrarse una etapa: se le
  // deja terminar para que la captura no la coja a medias.
  await pagina.waitForTimeout(700)

  const archivo = `${SALIDA}/procesos-${caso}-${tamano.nombre}.png`
  await pagina.screenshot({ path: archivo, fullPage: true })
  console.log(`${archivo}${fallos.length ? `  ⚠ ${fallos.length} error(es) en consola` : ''}`)
  for (const f of fallos) console.log(`    ${f.slice(0, 160)}`)

  await contexto.close()
}

await navegador.close()
