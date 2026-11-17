import { useEffect, useState } from 'react'

/**
 * Si la ventana cumple una consulta de medios (`(min-width: 900px)`), y se
 * actualiza al cambiar de tamaño.
 *
 * ⚠️ **La forma la decide el CSS; esto decide solo lo que el CSS no puede**:
 * dónde se MONTA una pieza que no debe existir dos veces —el reproductor de un
 * video, por ejemplo—. Sin `matchMedia` —jsdom, o un WebView muy viejo— dice que
 * no, que es la disposición de una columna y funciona a cualquier ancho.
 */
export function useCorte(consulta: string): boolean {
  const [cumple, setCumple] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(consulta).matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const medida = window.matchMedia(consulta)
    const alCambiar = () => setCumple(medida.matches)
    alCambiar()
    medida.addEventListener?.('change', alCambiar)
    return () => medida.removeEventListener?.('change', alCambiar)
  }, [consulta])
  return cumple
}
