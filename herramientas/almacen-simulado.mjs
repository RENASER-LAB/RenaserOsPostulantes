/**
 * Un almacén de archivos que habla como Supabase Storage, para que el backend de
 * verdad corra en local sin tocar el bucket de producción.
 *
 * ⚠️ **Esto existe porque el jar NO tiene otra opción.** `app.archivos.tipo`
 * admite `memoria`, pero esa implementación vive en `src/test` del backend y no
 * viaja en el artefacto: cualquier copia del original —el jar o la imagen de
 * Docker— sale con un solo almacén, el de Supabase, apuntando por defecto al
 * proyecto real. Levantar el backend «tal cual» para probar significaría escribir
 * currículums en el bucket de producción con la clave `service_role`.
 *
 * La salida es no tocar el backend: se le cambia **la URL del proyecto** por la de
 * este proceso, y se le contesta lo que Supabase contestaría. El backend sigue
 * siendo byte a byte el original.
 *
 * ## Lo que imita
 *
 * Son cinco llamadas, que es toda la superficie que usa `AlmacenArchivosSupabase`:
 *
 *     POST   /storage/v1/object/:bucket/*        subir
 *     GET    /storage/v1/object/:bucket/*        bajar
 *     DELETE /storage/v1/object/:bucket/*        borrar
 *     POST   /storage/v1/object/sign/:bucket/*   → { signedURL }
 *     POST   /storage/v1/object/upload/sign/...  → { url }
 *
 * ⚠️ **Las dos firmas devuelven una ruta que empieza por `/`, no una URL entera.**
 * Es lo que hace Supabase, y el backend construye la absoluta pegándole delante
 * su propia base (`config.getUrl() + "/storage/v1" + firmada`). Si aquí se
 * devolviera una URL completa saldría duplicada y el enlace no abriría.
 *
 * ⚠️ **Y el token de la firma no se comprueba.** No es descuido: aquí no hay nada
 * que proteger —los archivos son de mentira y el proceso escucha en loopback—, y
 * fingir una verificación daría una falsa sensación de que esto vale para algo
 * más que probar en la máquina de uno.
 *
 * Los archivos viven en memoria y se van con el proceso, que es justo lo que se
 * quiere de un entorno de prueba.
 */

import { createServer } from 'node:http'

const PUERTO = Number(process.env.PUERTO ?? 8090)

/** ruta del objeto → { tipo, bytes } */
const archivos = new Map()

function leerCuerpo(req) {
  return new Promise((resolve) => {
    const trozos = []
    req.on('data', (t) => trozos.push(t))
    req.on('end', () => resolve(Buffer.concat(trozos)))
  })
}

function json(res, codigo, cuerpo) {
  const texto = JSON.stringify(cuerpo)
  res.writeHead(codigo, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(texto),
  })
  res.end(texto)
}

const servidor = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost')
  const ruta = pathname.replace(/^\/storage\/v1/, '')
  const metodo = req.method

  // Firmar la bajada: Supabase devuelve la ruta relativa con su token.
  const firma = ruta.match(/^\/object\/sign\/(.+)$/)
  if (firma && metodo === 'POST') {
    await leerCuerpo(req)
    console.log(`${metodo} ${ruta} → firma de bajada`)
    return json(res, 200, { signedURL: `/object/sign/${firma[1]}?token=de-mentira` })
  }

  // Firmar la subida.
  const firmaSubida = ruta.match(/^\/object\/upload\/sign\/(.+)$/)
  if (firmaSubida && metodo === 'POST') {
    await leerCuerpo(req)
    console.log(`${metodo} ${ruta} → firma de subida`)
    return json(res, 200, { url: `/object/upload/sign/${firmaSubida[1]}?token=de-mentira` })
  }

  const objeto = ruta.match(/^\/object\/(?:upload\/sign\/|sign\/)?(.+)$/)
  if (!objeto) return json(res, 404, { message: `El almacén simulado no tiene ${metodo} ${ruta}` })
  const clave = decodeURIComponent(objeto[1])

  if (metodo === 'POST' || metodo === 'PUT') {
    const bytes = await leerCuerpo(req)
    archivos.set(clave, { tipo: req.headers['content-type'] ?? 'application/octet-stream', bytes })
    console.log(`${metodo} ${ruta} → guardado (${bytes.length} bytes)`)
    return json(res, 200, { Key: clave })
  }

  if (metodo === 'GET') {
    const a = archivos.get(clave)
    if (!a) {
      console.log(`GET ${ruta} → 404`)
      return json(res, 404, { message: 'Object not found' })
    }
    res.writeHead(200, { 'Content-Type': a.tipo, 'Content-Length': a.bytes.length })
    return res.end(a.bytes)
  }

  if (metodo === 'DELETE') {
    archivos.delete(clave)
    console.log(`DELETE ${ruta}`)
    return json(res, 200, { message: 'Successfully deleted' })
  }

  return json(res, 405, { message: `Método ${metodo} no soportado` })
})

servidor.listen(PUERTO, () => {
  console.log(
    `Almacén simulado en http://localhost:${PUERTO} — habla como Supabase Storage y no toca ningún bucket`,
  )
})
