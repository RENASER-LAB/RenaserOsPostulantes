/**
 * «Perfil de la empresa» (V85): `/panel/organizacion/presentacion`, siempre de
 * la empresa de quien ha entrado. Sin `editar_presentacion_empresa`, 403.
 *
 * En su propio módulo y no en `panel.ts`: las pruebas que doblan ese módulo
 * entero no tienen por qué saber que existe.
 */

import type { Archivo } from '@/api/puerta'
import { pedir, pedirArchivo } from './cliente'

export interface SedeDeLaPresentacion {
  nombre: string
  provincia: string | null
}

/** Lo guardado, con el nombre y las sedes de solo lectura. */
export interface PresentacionPanel {
  codigo: string
  nombre: string
  sector?: string | null
  tamano?: string | null
  tamanoTexto?: string | null
  anioFundacion?: number | null
  quienesSomos?: string | null
  propositoEmpresa?: string | null
  beneficios?: string[] | null
  videoPresentacion?: string | null
  paginaWeb?: string | null
  /** El enlace de cada red que tiene, por su código. */
  redes?: Record<string, string> | null
  /** La dirección pública del logo (`/api/v1/portal/empresas/…`), o nada. */
  logo?: string | null
  portada?: string | null
  sedes?: SedeDeLaPresentacion[] | null
  /** La provincia de la primera sede activa, como la dice el perfil público. */
  ciudad?: string | null
  /** Misión y visión (V86). Opcionales: un backend anterior no las manda. */
  mision?: string | null
  vision?: string | null
  /** La plantilla y el color del brochure (V86): `CLASICA`, `AZUL`… */
  plantillaBrochure?: string | null
  colorBrochure?: string | null
}

/**
 * Lo que manda «Guardar» de la pestaña «Perfil»: todo junto. Vacío es «sin dato».
 *
 * ⚠️ **Sin la plantilla ni el color del brochure.** Se guardan solos al elegirlos en la pestaña
 * «Brochure» (`guardarBrochure`); sin ellos en el cuerpo, el backend deja los que había, y así un
 * «Guardar» del perfil nunca pisa con lo de antes una elección recién guardada.
 */
export interface GuardarPresentacion {
  sector: string | null
  tamano: string | null
  anioFundacion: number | null
  quienesSomos: string | null
  propositoEmpresa: string | null
  beneficios: string[]
  videoPresentacion: string | null
  paginaWeb: string | null
  redes: Record<string, string>
  mision: string | null
  vision: string | null
}

/** Lo que guarda la pestaña «Brochure» al elegir: los dos, siempre del catálogo. */
export interface GuardarBrochure {
  plantillaBrochure: string
  colorBrochure: string
}

const BASE = '/organizacion/presentacion'

export const verPresentacion = () => pedir<PresentacionPanel>(BASE)

export const guardarPresentacion = (datos: GuardarPresentacion) =>
  pedir<PresentacionPanel>(BASE, { metodo: 'PUT', cuerpo: datos })

/** La plantilla y el color del brochure, sin tocar lo demás. Fuera del catálogo, 400. */
export const guardarBrochure = (eleccion: GuardarBrochure) =>
  pedir<PresentacionPanel>(`${BASE}/brochure`, { metodo: 'PUT', cuerpo: eleccion })

export type CualImagen = 'logo' | 'portada'

export function subirImagenDeLaEmpresa(cual: CualImagen, archivo: File) {
  const formulario = new FormData()
  formulario.append('archivo', archivo)
  return pedir<PresentacionPanel>(`${BASE}/imagenes/${cual}`, { metodo: 'POST', formulario })
}

export const quitarImagenDeLaEmpresa = (cual: CualImagen) =>
  pedir<PresentacionPanel>(`${BASE}/imagenes/${cual}`, { metodo: 'DELETE' })

/**
 * El brochure en PDF (V86), armado con lo guardado —no con lo escrito sin guardar—.
 * Sin «Quiénes somos» guardado, 409.
 */
export const descargarBrochure = (): Promise<Archivo> => pedirArchivo(`${BASE}/brochure`)

/** Si la empresa tiene video: el chip «Se usará el video de la empresa» de la vacante. */
export const verVideoDeLaEmpresa = () => pedir<{ tieneVideo: boolean }>(`${BASE}/video`)

/**
 * Los errores por campo de un 400 del guardado (`errores`: campo → frase), o
 * vacío si el fallo fue otro.
 */
export function erroresDelGuardado(causa: unknown): Record<string, string> {
  const cuerpo = (causa as { cuerpo?: unknown } | null)?.cuerpo as { errores?: unknown } | null | undefined
  const errores = cuerpo?.errores
  if (!errores || typeof errores !== 'object') return {}
  return Object.fromEntries(
    Object.entries(errores as Record<string, unknown>).filter(
      (par): par is [string, string] => typeof par[1] === 'string',
    ),
  )
}
