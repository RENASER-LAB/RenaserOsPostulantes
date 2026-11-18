/**
 * El brochure en PDF de la empresa (V86): las tres plantillas, los seis colores y
 * cómo se abre desde el panel.
 *
 * ⚠️ **Es el mismo catálogo que el backend**, con los mismos códigos:
 * `PlantillaDelBrochure` y `ColorDelBrochure` (que además dice los acompañantes
 * de cada color en el PDF). No hay contrato que los amarre: añadir una plantilla
 * o un color es añadirlo en los dos, y en el CHECK de la V86.
 *
 * El PDF se arma en el backend con lo **guardado**: lo que se está escribiendo
 * en la pestaña «Perfil» sin guardar no sale, y por eso la pestaña «Brochure» lo
 * avisa con «Usa lo último guardado». La plantilla y el color, en cambio, se
 * guardan solos al elegirlos.
 */

import { direccionPublica } from '@/api/puerta'
import { descargarBrochure } from '../api/presentacion'

export type CodigoDePlantilla = 'CLASICA' | 'PORTADA' | 'COLUMNAS'
export type CodigoDeColor = 'AZUL' | 'VERDE' | 'ROJO' | 'NOCHE' | 'PETROLEO' | 'CIRUELA'

export const PLANTILLAS: ReadonlyArray<{ codigo: CodigoDePlantilla; nombre: string }> = [
  { codigo: 'CLASICA', nombre: 'Clásica' },
  { codigo: 'PORTADA', nombre: 'Portada' },
  { codigo: 'COLUMNAS', nombre: 'Columnas' },
]

/** Todos llevan texto blanco encima con un contraste de al menos 4,5:1. */
export const COLORES: ReadonlyArray<{ codigo: CodigoDeColor; nombre: string; hex: string }> = [
  { codigo: 'AZUL', nombre: 'Azul', hex: '#1E3A8A' },
  { codigo: 'VERDE', nombre: 'Verde', hex: '#0B7A63' },
  { codigo: 'ROJO', nombre: 'Rojo', hex: '#C22A3F' },
  { codigo: 'NOCHE', nombre: 'Noche', hex: '#111312' },
  { codigo: 'PETROLEO', nombre: 'Petróleo', hex: '#155E75' },
  { codigo: 'CIRUELA', nombre: 'Ciruela', hex: '#6B2D5C' },
]

export const PLANTILLA_POR_DEFECTO: CodigoDePlantilla = 'CLASICA'
export const COLOR_POR_DEFECTO: CodigoDeColor = 'AZUL'

export const MENSAJE_FALTA_QUIENES = 'Falta «Quiénes somos»'
export const MENSAJE_USA_LO_GUARDADO = 'Usa lo último guardado'
export const MENSAJE_FALLO_BROCHURE = 'No se pudo armar el brochure.'
export const MENSAJE_ELECCION_NO_GUARDADA = 'No se guardó la elección.'

/** Lo que se elige en la pestaña «Brochure» y se guarda solo. */
export interface Eleccion {
  plantilla: CodigoDePlantilla
  color: CodigoDeColor
}

/** La elección guardada, con «Clásica» y «Azul» si no hay o no se reconoce. */
export function eleccionDe(
  guardado: { plantillaBrochure?: string | null; colorBrochure?: string | null } | null | undefined,
): Eleccion {
  return { plantilla: plantillaDe(guardado?.plantillaBrochure), color: colorDe(guardado?.colorBrochure) }
}

export const mismaEleccion = (a: Eleccion, b: Eleccion) => a.plantilla === b.plantilla && a.color === b.color

/** La plantilla guardada, o «Clásica» si no hay o no se reconoce (un backend anterior). */
export function plantillaDe(codigo: string | null | undefined): CodigoDePlantilla {
  return PLANTILLAS.find((p) => p.codigo === codigo)?.codigo ?? PLANTILLA_POR_DEFECTO
}

/** El color guardado, o «Azul» si no hay o no se reconoce. */
export function colorDe(codigo: string | null | undefined): CodigoDeColor {
  return COLORES.find((c) => c.codigo === codigo)?.codigo ?? COLOR_POR_DEFECTO
}

export function hexDe(codigo: CodigoDeColor): string {
  return COLORES.find((c) => c.codigo === codigo)?.hex ?? COLORES[0]!.hex
}

/**
 * La dirección pública del brochure de una empresa, la misma que pone su perfil
 * en `/empresas/<código>`: el backend la sirve sin cuenta, con
 * `Content-Disposition: inline; filename="Brochure - {empresa}.pdf"`.
 * Nada si no hay código.
 */
export function direccionDelBrochure(codigo: string | null | undefined): string | null {
  const limpio = codigo?.trim()
  if (!limpio) return null
  return direccionPublica(`/api/v1/portal/empresas/${encodeURIComponent(limpio.toLowerCase())}/brochure`)
}

/**
 * Abre el brochure guardado en otra pestaña, donde el navegador deja verlo,
 * guardarlo o imprimirlo. Lanza si no se pudo armar, para que quien llama lo diga.
 *
 * Con `antes` —la plantilla o el color que se están guardando en ese momento—,
 * espera a que terminen antes de pedirlo, para que salga con lo recién elegido.
 * La pestaña se abre igual al momento.
 *
 * Primero lo pide al panel: es lo que comprueba el permiso (403) y que haya
 * «Quiénes somos» (409), dura lo que dice «Generando…» y deja el PDF recordado
 * en el backend. Luego la pestaña va a la **dirección pública** de la propia
 * empresa —el mismo PDF, servido ya del recuerdo—, no a un `blob:`: con un
 * `blob:` el visor proponía guardarlo con un nombre aleatorio, y en cuanto la
 * dirección se soltaba ya no dejaba guardarlo ni volver a él tras pulsar un
 * enlace del PDF. Una dirección de verdad, con su `Content-Disposition`, lleva
 * el nombre «Brochure - {empresa}.pdf» y el visor la vuelve a pedir cuando quiera.
 *
 * ⚠️ **La pestaña se pide ANTES del `await`.** Después el navegador ya no la
 * considera parte del clic y la bloquea. Se pide **sin** `noopener` —con él
 * `window.open` devuelve `null` y no habría forma de llevarla al PDF— y el
 * `opener` se corta a mano. Si el navegador la bloquea igual, o no hay código
 * con el que formar la dirección, el PDF que trajo el panel se guarda con su
 * nombre.
 */
export async function abrirBrochure(
  empresa: string,
  codigo: string | null | undefined,
  antes?: Promise<unknown> | null,
): Promise<void> {
  const ventana = window.open('', '_blank')
  if (ventana) ventana.opener = null
  try {
    // Si guardar la elección falla, el brochure sale con la anterior, que es la que se ve.
    if (antes) await antes.catch(() => undefined)
    const archivo = await descargarBrochure()
    const direccion = direccionDelBrochure(codigo)
    if (ventana && direccion) {
      ventana.location.href = direccion
      return
    }
    ventana?.close()
    guardarConSuNombre(archivo.contenido, archivo.nombre ?? `Brochure - ${empresa}.pdf`)
  } catch (causa) {
    ventana?.close()
    throw causa
  }
}

/** Lo guarda como archivo, con su nombre: la salida cuando no hay pestaña a la que llevarlo. */
function guardarConSuNombre(contenido: Blob, nombre: string): void {
  const url = URL.createObjectURL(new File([contenido], nombre, { type: 'application/pdf' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  // Se suelta después: revocarla ya cortaría la descarga recién empezada.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
