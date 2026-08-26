/**
 * La misma pantalla a una y a dos veces la densidad de pixel.
 *
 * Existe por un fallo que costo tres rondas: el canto irisado se veia pixelado
 * en la maquina del cliente y perfecto en todas las capturas. La causa era que
 * los demas scripts capturan a densidad 1, y el problema —Chrome rasterizando
 * un filtro SVG a resolucion CSS y ampliando el resultado— **solo se ve en una
 * pantalla de alta densidad**.
 *
 * Como se lee: si la zona sospechosa capturada a 2x no tiene mas detalle que la
 * de 1x ampliada al doble, hay un mapa de bits intermedio en medio. Texto
 * nitido junto a un fondo blando es la firma.
 *
 *   node herramientas/capturar-densidad.mjs
 *   RUTA=/procesos/a1 node herramientas/capturar-densidad.mjs
 *
 * Las imagenes quedan en `capturas/`, que no se versiona.
 */

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = process.env.PORTAL ?? 'http://localhost:5174'
const RUTA = process.env.RUTA ?? '/procesos'
const SALIDA = process.env.SALIDA ?? 'capturas'

await mkdir(SALIDA, { recursive: true })

const navegador = await chromium.launch({ channel: 'chrome' })

for (const densidad of [1, 2]) {
  const contexto = await navegador.newContext({
    viewport: { width: 1440, height: 700 },
    deviceScaleFactor: densidad,
    locale: 'es-PE',
    // El portal guarda el token aqui; sin el, la pantalla pide ingresar.
    storageState: {
      cookies: [],
      origins: [
        { origin: PORTAL, localStorage: [{ name: 'renaser_portal_token', value: 'captura' }] },
      ],
    },
  })

  const pagina = await contexto.newPage()
  await pagina.goto(`${PORTAL}${RUTA}`, { waitUntil: 'networkidle' })
  // La banda del tramo vivo tarda 900 ms en formarse.
  await pagina.waitForTimeout(1300)

  const archivo = `${SALIDA}/densidad-${densidad}x.png`
  await pagina.screenshot({ path: archivo, clip: { x: 0, y: 60, width: 1440, height: 320 } })
  console.log(archivo)

  await contexto.close()
}

await navegador.close()
