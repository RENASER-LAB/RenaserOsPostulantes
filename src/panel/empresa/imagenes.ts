/**
 * El logo y la portada de la empresa (V85), antes de subirlos.
 *
 * Copia la subida del perfil del candidato (`paginas/perfil/archivos`), con dos
 * diferencias: aquí solo se admiten JPG y PNG, y el logo es cuadrado con radio 8
 * en vez de círculo. Las frases son las mismas que devuelve el backend, que
 * además vuelve a codificar la imagen sin metadatos.
 */

import { MAXIMO_IMAGEN, recortarAlCentro } from '@/paginas/perfil/archivos'
import type { CualImagen } from '../api/presentacion'

export const FORMATOS_IMAGEN_EMPRESA = ['image/jpeg', 'image/png']

interface Regla {
  como: string
  masculino: boolean
  anchoMinimo: number
  altoMinimo: number
  /** El tamaño al que se recorta al centro antes de subirla. */
  ancho: number
  alto: number
}

const REGLAS: Record<CualImagen, Regla> = {
  logo: { como: 'El logo', masculino: true, anchoMinimo: 200, altoMinimo: 200, ancho: 512, alto: 512 },
  portada: { como: 'La portada', masculino: false, anchoMinimo: 1200, altoMinimo: 300, ancho: 1600, alto: 400 },
}

/** El formato y el peso: lo que se sabe sin abrir la imagen. */
export function revisarImagenDeLaEmpresa(archivo: File, cual: CualImagen): string | null {
  const r = REGLAS[cual]
  if (!FORMATOS_IMAGEN_EMPRESA.includes(archivo.type)) {
    return `${r.como} tiene que ser JPG o PNG.`
  }
  if (archivo.size > MAXIMO_IMAGEN) {
    const o = r.masculino ? 'o' : 'a'
    return `${r.como} no puede pesar más de 2 MB. Prueba a guardarl${o} más pequeñ${o}.`
  }
  return null
}

/** El tamaño mínimo, con las medidas ya leídas. */
export function revisarMedidas(ancho: number, alto: number, cual: CualImagen): string | null {
  const r = REGLAS[cual]
  return ancho < r.anchoMinimo || alto < r.altoMinimo
    ? `${r.como} tiene que medir al menos ${r.anchoMinimo} × ${r.altoMinimo} píxeles.`
    : null
}

/**
 * Comprueba la imagen y la recorta al centro: 512 × 512 el logo y una banda de
 * 1600 × 400 la portada. Un PNG sigue siendo PNG (un logo con fondo
 * transparente no se pinta de negro). Devuelve el archivo listo o el motivo.
 */
export async function prepararImagen(
  archivo: File,
  cual: CualImagen,
): Promise<{ archivo: File } | { error: string }> {
  const reparo = revisarImagenDeLaEmpresa(archivo, cual)
  if (reparo) return { error: reparo }
  const r = REGLAS[cual]
  let medidas: { ancho: number; alto: number }
  try {
    const mapa = await createImageBitmap(archivo)
    medidas = { ancho: mapa.width, alto: mapa.height }
    mapa.close()
  } catch {
    return { error: `${r.como} no es una imagen que podamos leer.` }
  }
  const pequena = revisarMedidas(medidas.ancho, medidas.alto, cual)
  if (pequena) return { error: pequena }
  const tipo = archivo.type === 'image/png' ? 'image/png' : 'image/jpeg'
  try {
    const recortada = await recortarAlCentro(archivo, r.ancho, r.alto, tipo)
    const extension = tipo === 'image/png' ? 'png' : 'jpg'
    return { archivo: new File([recortada], `${cual}.${extension}`, { type: tipo }) }
  } catch {
    return { error: `${r.como} no es una imagen que podamos leer.` }
  }
}
