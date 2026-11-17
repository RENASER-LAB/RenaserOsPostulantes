/**
 * La presentación de una empresa (V85): qué enlace vale, qué video se puede
 * reproducir y cómo se reconstruye el reproductor.
 *
 * ⚠️ **Es la misma regla que el backend, con las mismas palabras**:
 * `organizacion/service/EnlacesDeLaEmpresa`, `VideoDePresentacion`, `RedSocial` y
 * `ReglasDeLaPresentacion`. No hay contrato que las amarre: cada lado tiene sus
 * pruebas (`presentacionEmpresa.test.ts` aquí, `EnlacesDeLaEmpresaTest` y
 * `VideoDePresentacionTest` allí). Cambiar una regla es cambiarla en los dos.
 *
 * Lo usan el módulo «Perfil de la empresa» y el «Video del puesto» del panel
 * —para marcar el error antes de enviar— y el portal, que vuelve a comprobar
 * cada enlace antes de pintarlo aunque el backend ya lo haya exigido.
 */

import type { CodigoDeRed, VideoPublico } from '@/api/tipos'

export const MAXIMO_ENLACE = 500
export const MAXIMO_TEXTO_LARGO = 1500
export const MAXIMO_SECTOR = 60
export const MAXIMO_BENEFICIOS = 12
export const MAXIMO_BENEFICIO = 40
export const ANIO_MINIMO = 1800

export const MENSAJE_ENLACE = 'Escribe una dirección web que empiece por https://'
export const MENSAJE_VIDEO = 'Pega el enlace de un video de YouTube o de Vimeo'
export const MENSAJE_PROPOSITO = 'El propósito admite hasta 1500 caracteres'

export function mensajeAnio(anioActual: number): string {
  return `Escribe un año entre ${ANIO_MINIMO} y ${anioActual}`
}

/** Las cinco redes, en el orden en que se enseñan, con los dominios que se les aceptan. */
export const REDES: ReadonlyArray<{ codigo: CodigoDeRed; nombre: string; dominios: string[] }> = [
  { codigo: 'FACEBOOK', nombre: 'Facebook', dominios: ['facebook.com', 'fb.com'] },
  { codigo: 'INSTAGRAM', nombre: 'Instagram', dominios: ['instagram.com'] },
  { codigo: 'LINKEDIN', nombre: 'LinkedIn', dominios: ['linkedin.com'] },
  { codigo: 'TIKTOK', nombre: 'TikTok', dominios: ['tiktok.com'] },
  { codigo: 'YOUTUBE', nombre: 'YouTube', dominios: ['youtube.com', 'youtu.be'] },
]

/** Los seis rangos de tamaño. El código es lo que se guarda; el texto, lo que se lee. */
export const TAMANOS: ReadonlyArray<{ codigo: string; texto: string }> = [
  { codigo: 'DE_1_A_10', texto: '1–10 colaboradores' },
  { codigo: 'DE_11_A_50', texto: '11–50 colaboradores' },
  { codigo: 'DE_51_A_200', texto: '51–200 colaboradores' },
  { codigo: 'DE_201_A_500', texto: '201–500 colaboradores' },
  { codigo: 'DE_501_A_1000', texto: '501–1000 colaboradores' },
  { codigo: 'MAS_DE_1000', texto: 'Más de 1000 colaboradores' },
]

export function nombreDeRed(codigo: string): string | null {
  return REDES.find((r) => r.codigo === codigo)?.nombre ?? null
}

/**
 * Si empieza por un esquema: letras, cifras, «+» o «-» antes de los primeros dos
 * puntos, empezando por letra. Sin punto: «renaser.pe:8080» es un dominio con
 * puerto, no un esquema.
 */
function tieneEsquema(texto: string): boolean {
  return /^[a-z][a-z0-9+-]*:/i.test(texto)
}

/**
 * Sin espacios en los bordes, y con `https://` delante si no dice ningún
 * esquema («renaser.pe» → «https://renaser.pe»). Vacío devuelve vacío. Otro
 * esquema (`javascript:`) se deja tal cual para que la comprobación lo rechace.
 */
export function normalizarEnlace(crudo: string | null | undefined): string {
  const limpio = (crudo ?? '').trim()
  if (limpio === '') return ''
  return tieneEsquema(limpio) ? limpio : `https://${limpio}`
}

/** Lo que una dirección web no puede llevar, ni el backend lo admite. */
const CARACTERES_PROHIBIDOS = /[\s<>"{}|\\^`]/

function tieneControles(texto: string): boolean {
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i)
    if (c < 32 || c === 127) return true
  }
  return false
}

/**
 * El enlace leído como dirección web, o `null` si no vale: ni http ni https,
 * sin dominio (o un dominio sin punto), con usuario delante del dominio, con
 * espacios o de más de 500 caracteres.
 */
export function comoDireccion(enlace: string): URL | null {
  if (enlace === '' || enlace.length > MAXIMO_ENLACE || CARACTERES_PROHIBIDOS.test(enlace) || tieneControles(enlace)) {
    return null
  }
  let url: URL
  try {
    url = new URL(enlace)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const host = url.hostname
  if (url.username || url.password || !host.includes('.') || host.startsWith('.') || host.endsWith('.')) {
    return null
  }
  return url
}

/** El error de la página web, o `null` si vale o está vacía. Recibe el enlace ya normalizado. */
export function errorDelEnlace(normalizado: string): string | null {
  if (normalizado === '') return null
  return comoDireccion(normalizado) ? null : MENSAJE_ENLACE
}

function esDeLaRed(host: string, dominios: string[]): boolean {
  const limpio = host.toLowerCase()
  return dominios.some((d) => limpio === d || limpio.endsWith(`.${d}`))
}

/** El error de una red: que no sea un enlace, o que no sea de su dominio. */
export function errorDeLaRed(codigo: CodigoDeRed, normalizado: string): string | null {
  if (normalizado === '') return null
  const url = comoDireccion(normalizado)
  if (!url) return MENSAJE_ENLACE
  const red = REDES.find((r) => r.codigo === codigo)
  if (!red) return MENSAJE_ENLACE
  return esDeLaRed(url.hostname, red.dominios) ? null : `Este enlace no es de ${red.nombre}`
}

/** El video, reducido a lo que hace falta para pintarlo. */
export interface VideoLeido {
  servicio: 'YOUTUBE' | 'VIMEO'
  identificador: string
  clave: string | null
}

const PIEZA_YOUTUBE = /^[A-Za-z0-9_-]{6,64}$/
const NUMERO_VIMEO = /^\d{1,15}$/
const CLAVE_VIMEO = /^[A-Za-z0-9]{1,64}$/

/**
 * El video de un enlace, o `null`. Valen, de YouTube: `watch?v=…`, `youtu.be/…`,
 * `shorts/…` y `embed/…`, con o sin `www.` o `m.`; de Vimeo: `vimeo.com/<número>`
 * y `vimeo.com/<número>/<clave>`, el de un video oculto.
 */
export function leerVideo(enlace: string): VideoLeido | null {
  const url = comoDireccion(enlace)
  if (!url) return null
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '')
  // La ruta tal como llegó, sin decodificar: un «%22» no es un identificador.
  const tramos = url.pathname.split('/').filter(Boolean)
  if (host === 'youtu.be') {
    return tramos.length === 1 ? deYoutube(tramos[0]!) : null
  }
  if (host === 'youtube.com') {
    if (tramos.length === 1 && tramos[0] === 'watch') {
      const crudo = /(?:^|&)v=([^&]*)/.exec(url.search.replace(/^\?/, ''))?.[1]
      return crudo ? deYoutube(crudo) : null
    }
    if (tramos.length === 2 && (tramos[0] === 'shorts' || tramos[0] === 'embed')) {
      return deYoutube(tramos[1]!)
    }
    return null
  }
  if (host === 'vimeo.com') {
    if (tramos.length < 1 || tramos.length > 2 || !NUMERO_VIMEO.test(tramos[0]!)) return null
    if (tramos.length === 1) return { servicio: 'VIMEO', identificador: tramos[0]!, clave: null }
    return CLAVE_VIMEO.test(tramos[1]!)
      ? { servicio: 'VIMEO', identificador: tramos[0]!, clave: tramos[1]! }
      : null
  }
  return null
}

function deYoutube(id: string): VideoLeido | null {
  return PIEZA_YOUTUBE.test(id) ? { servicio: 'YOUTUBE', identificador: id, clave: null } : null
}

/** El error de un video —el de la empresa o el de un puesto—, o `null`. */
export function errorDelVideo(normalizado: string): string | null {
  if (normalizado === '') return null
  if (!comoDireccion(normalizado)) return MENSAJE_ENLACE
  return leerVideo(normalizado) ? null : MENSAJE_VIDEO
}

// ---------- Al pintarlo ----------

/**
 * Un enlace que se puede pintar: http o https, y nada más. Se vuelve a mirar
 * al pintar aunque el backend ya lo haya exigido; si no lo es, no se pinta.
 */
export function enlaceSeguro(enlace: string | null | undefined): string | null {
  if (!enlace) return null
  try {
    const url = new URL(enlace)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

/** Las piezas de un video que llegaron del backend, comprobadas otra vez. */
function piezasSeguras(video: VideoPublico | VideoLeido | null | undefined): VideoLeido | null {
  if (!video) return null
  const clave = video.clave ?? null
  if (video.servicio === 'YOUTUBE' && PIEZA_YOUTUBE.test(video.identificador)) {
    return { servicio: 'YOUTUBE', identificador: video.identificador, clave: null }
  }
  if (
    video.servicio === 'VIMEO' &&
    NUMERO_VIMEO.test(video.identificador) &&
    (clave === null || CLAVE_VIMEO.test(clave))
  ) {
    return { servicio: 'VIMEO', identificador: video.identificador, clave }
  }
  return null
}

/**
 * El reproductor, reconstruido desde el servicio y el identificador —nunca
 * copiando el enlace guardado—, sin cookies de seguimiento: `youtube-nocookie`
 * y `dnt=1`. Empieza solo porque se pide al pulsar.
 */
export function direccionDelReproductor(video: VideoPublico | VideoLeido | null | undefined): string | null {
  const v = piezasSeguras(video)
  if (!v) return null
  if (v.servicio === 'YOUTUBE') {
    return `https://www.youtube-nocookie.com/embed/${v.identificador}?autoplay=1&rel=0`
  }
  const clave = v.clave ? `&h=${v.clave}` : ''
  return `https://player.vimeo.com/video/${v.identificador}?autoplay=1&dnt=1${clave}`
}

/** «Ver en YouTube»: el video en su sitio, también reconstruido. */
export function direccionParaVerFuera(video: VideoPublico | VideoLeido | null | undefined): string | null {
  const v = piezasSeguras(video)
  if (!v) return null
  if (v.servicio === 'YOUTUBE') return `https://www.youtube.com/watch?v=${v.identificador}`
  return `https://vimeo.com/${v.identificador}${v.clave ? `/${v.clave}` : ''}`
}

export function nombreDelServicio(video: VideoPublico | VideoLeido): string {
  return video.servicio === 'VIMEO' ? 'Vimeo' : 'YouTube'
}

/** Si el video llegó entero y se puede reproducir. */
export function esVideoReproducible(video: VideoPublico | VideoLeido | null | undefined): boolean {
  return piezasSeguras(video) !== null
}

/** «Industria alimentaria · 201–500 colaboradores · Fundada en 1987», solo con lo que haya. */
export function lineaDeDatos(p: {
  sector?: string | null
  tamanoTexto?: string | null
  anioFundacion?: number | null
}): string {
  return [
    (p.sector ?? '').trim() || null,
    (p.tamanoTexto ?? '').trim() || null,
    p.anioFundacion ? `Fundada en ${p.anioFundacion}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
