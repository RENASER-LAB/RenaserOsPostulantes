/**
 * Qué se pinta de la presentación de la empresa en una vacante (V85), y dónde.
 *
 * Una sola regla para la página de la vacante y la pantalla partida:
 *
 * - **En PC (900 px o más)** el video va arriba en la tarjeta lateral, la del
 *   botón «Postular»: el del puesto («Conoce el puesto») si lo tiene, si no el
 *   de la empresa («Conoce a {empresa}»). El bloque «Sobre…» solo repite el de
 *   la empresa cuando la tarjeta lleva el del puesto.
 * - **En el teléfono** el del puesto va arriba de la ficha, antes de la
 *   información, y el de la empresa en el bloque «Sobre…».
 * - **Sin datos no se pinta nada**: el bloque sale solo con lo que haya, y sin
 *   nada no sale.
 */

import type { VacantePublica, VideoPublico } from '@/api/tipos'
import { esVideoReproducible } from '@/dominio/presentacionEmpresa'
import { rutas } from '@/rutas'
import { enlacesDeLaEmpresa, type EnlaceDeLaEmpresa } from '@/ui/presentacion/EnlacesDeLaEmpresa'
import { recortado } from './busqueda'

export interface VideoConTitulo {
  video: VideoPublico
  titulo: string
}

export interface PresentacionDeLaVacante {
  empresa: string
  /** El video de la tarjeta lateral (solo en PC). */
  enLaTarjeta: VideoConTitulo | null
  /** El video del puesto arriba de la ficha (solo en el teléfono). */
  arriba: VideoConTitulo | null
  /** El bloque «Sobre {empresa}», o `null` si no tiene nada que decir. */
  sobre: {
    proposito: string | null
    video: VideoConTitulo | null
    enlaces: EnlaceDeLaEmpresa[]
  } | null
  /** «/empresas/<código>», o `null` con un backend que no manda el código. */
  perfil: string | null
  /** La dirección del logo pequeño, tal como llegó. */
  logo: string | null
}

export function presentacionDeLaVacante(v: VacantePublica, enPc: boolean): PresentacionDeLaVacante {
  const empresa = recortado(v.nombreEmpresa) ?? ''
  const datos = v.empresa ?? null
  const delPuesto = esVideoReproducible(v.videoPuesto) ? v.videoPuesto! : null
  const deLaEmpresa = esVideoReproducible(datos?.video) ? datos!.video! : null
  const conoceElPuesto = delPuesto ? { video: delPuesto, titulo: 'Conoce el puesto' } : null
  const conoceALaEmpresa = deLaEmpresa ? { video: deLaEmpresa, titulo: `Conoce a ${empresa}` } : null

  const enLaTarjeta = enPc ? (conoceElPuesto ?? conoceALaEmpresa) : null
  const arriba = enPc ? null : conoceElPuesto
  const videoDelSobre = enPc ? (delPuesto ? conoceALaEmpresa : null) : conoceALaEmpresa

  const proposito = recortado(datos?.proposito)
  const enlaces = enlacesDeLaEmpresa(datos?.paginaWeb, datos?.redes)
  const haySobre = proposito !== null || videoDelSobre !== null || enlaces.length > 0

  return {
    empresa,
    enLaTarjeta,
    arriba,
    sobre: haySobre ? { proposito, video: videoDelSobre, enlaces } : null,
    perfil: v.codigoEmpresa ? rutas.empresa(v.codigoEmpresa) : null,
    logo: datos?.logo ?? null,
  }
}
