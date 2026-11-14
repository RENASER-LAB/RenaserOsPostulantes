/**
 * Cómo se abre la vista previa de «Pruebas» según el ancho, y si cabe la
 * columna de filtros. Cambian qué se pinta y no solo dónde, por eso se deciden
 * en el componente (como `/vacantes`) y no solo en la hoja:
 *
 *   - **lado** (desde 1280 px): una columna a la derecha de la lista, sin velo;
 *   - **hoja** (641 a 1279 px): sube desde abajo sobre el área de contenido, modal;
 *   - **completa** (hasta 640 px): ocupa la pantalla.
 *
 * La columna de filtros sale desde 1440 px. Sin `matchMedia` (las pruebas), se
 * da por escritorio ancho.
 */

import { useEffect, useState } from 'react'

export type ModoDeLectura = 'lado' | 'hoja' | 'completa'

export const DESDE_LADO = '(min-width: 1280px)'
export const HASTA_TELEFONO = '(max-width: 640px)'
export const DESDE_COLUMNA = '(min-width: 1440px)'

function cumple(consulta: string, sinMedir: boolean): boolean {
  return typeof window.matchMedia === 'function' ? window.matchMedia(consulta).matches : sinMedir
}

export function useConsulta(consulta: string, sinMedir: boolean): boolean {
  const [valor, setValor] = useState(() => cumple(consulta, sinMedir))
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const medida = window.matchMedia(consulta)
    const alCambiar = () => setValor(medida.matches)
    alCambiar()
    medida.addEventListener?.('change', alCambiar)
    return () => medida.removeEventListener?.('change', alCambiar)
  }, [consulta])
  return valor
}

export function useModoDeLectura(): { modo: ModoDeLectura; cabeLaColumna: boolean; esTelefono: boolean } {
  const lado = useConsulta(DESDE_LADO, true)
  const telefono = useConsulta(HASTA_TELEFONO, false)
  const columna = useConsulta(DESDE_COLUMNA, true)
  return { modo: lado ? 'lado' : telefono ? 'completa' : 'hoja', cabeLaColumna: columna, esTelefono: telefono }
}

/** Si quien mira pidió menos movimiento: entonces solo fundidos. */
export const useMenosMovimiento = () => useConsulta('(prefers-reduced-motion: reduce)', false)
