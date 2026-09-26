/**
 * Pinta las nubes de la portada UNA vez y las guarda como imagen.
 *
 *   node herramientas/cielo/pintar-nubes.mjs
 *
 * La fuente es `cielo-nubes.svg`, al lado: ruido fractal (`feTurbulence`) que da
 * los bordes deshilachados de una nube de verdad. Servido tal cual, el navegador
 * tenia que calcular ese ruido en cada carga. Medido el 25/09/2026 —mediana de
 * cinco cargas, porque una sola variaba hasta 100 ms de una vez a otra—:
 *
 *   |                    | sin nubes | SVG     | este WebP |
 *   | escritorio 1440    | 487 ms    | +103 ms | ≈ 0       |
 *   | telefono 390 a 3x  | 486 ms    | +32 ms  | +33 ms    |
 *
 * En escritorio la imagen quita los ~100 ms de hilo principal que costaba el
 * ruido; en telefono cuestan lo mismo. A cambio son 40 KB de descarga.
 *
 * Asi que el ruido se calcula aqui, en Chrome, y se guarda como WebP con
 * transparencia en `public/cielo-nubes.webp`. El navegador del candidato solo
 * decodifica una imagen.
 *
 * ⚠️ **Si tocas el SVG, vuelve a correr esto**, o la portada seguira ensenando
 * las nubes de antes. El SVG no se sirve: es la fuente, no el recurso.
 *
 * ⚠️ **Chrome pinta, pero NO codifica.** Su `toDataURL('image/webp')` guarda la
 * transparencia sin perdida, y aqui el ruido vive justo en la transparencia: el
 * primer intento salio en 233 KB. Pillow comprime tambien el alfa
 * (`alpha_quality`), y la misma imagen baja a unos 40 KB sin que se note — las
 * nubes son blandas. Hace falta Python 3 con Pillow compilado con WebP
 * (`python3 -c "from PIL import features; print(features.check('webp'))"`).
 */

import { execFileSync } from 'node:child_process'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const AQUI = new URL('.', import.meta.url)
const FUENTE = fileURLToPath(new URL('cielo-nubes.svg', AQUI))
const DESTINO = fileURLToPath(new URL('../../public/cielo-nubes.webp', AQUI))

// El tamaño del `viewBox`, a 1x. Las nubes son blandas: a `cover` sobre una
// pantalla grande no se nota la diferencia con 1920 de ancho, y pesa un 25 %
// menos. Calidad y calidad del alfa, medidas contra el tamaño del archivo.
const ANCHO = 1600
const ALTO = 1100
const CALIDAD = 72
const CALIDAD_ALFA = 45

const svg = await readFile(FUENTE, 'utf8')

const navegador = await chromium.launch()
const pagina = await navegador.newPage()
const datos = await pagina.evaluate(
  async ({ svg, ancho, alto }) => {
    const imagen = new Image()
    imagen.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    await imagen.decode()
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    lienzo.getContext('2d').drawImage(imagen, 0, 0, ancho, alto)
    return lienzo.toDataURL('image/png')
  },
  { svg, ancho: ANCHO, alto: ALTO },
)
await navegador.close()

// El PNG intermedio va a la carpeta temporal del sistema y se borra al acabar.
const intermedio = join(tmpdir(), `cielo-nubes-${process.pid}.png`)
await writeFile(intermedio, Buffer.from(datos.split(',')[1], 'base64'))
try {
  const salida = execFileSync('python3', [
    '-c',
    [
      'import sys, os',
      'from PIL import Image',
      'origen, destino, q, qa = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])',
      "Image.open(origen).convert('RGBA').save(destino, 'WEBP', quality=q, alpha_quality=qa, method=6)",
      "print(f'{os.path.getsize(destino) / 1024:.1f}')",
    ].join('\n'),
    intermedio,
    DESTINO,
    String(CALIDAD),
    String(CALIDAD_ALFA),
  ]).toString().trim()
  console.log(`public/cielo-nubes.webp · ${ANCHO}×${ALTO} · ${salida} KB`)
} finally {
  await rm(intermedio, { force: true })
}
