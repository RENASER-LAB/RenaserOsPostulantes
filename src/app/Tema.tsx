/**
 * El portal es claro, y solo claro.
 *
 * Hubo un interruptor de claro/oscuro y se quito. El oscuro no estaba terminado
 * —habia texto del color del fondo, como el boton de empezar la prueba— y un
 * candidato que se topa con eso no reporta un fallo: se va. Mientras no este
 * cuidado de verdad, es mejor no ofrecerlo.
 *
 * El atributo se sigue poniendo en <html> porque `variables.css` mira `data-theme`
 * para redefinir los colores: dejandolo fijo en «light», las reglas del oscuro no
 * llegan a aplicar. No hay ninguna `prefers-color-scheme` en la hoja, asi que el
 * sistema operativo del candidato tampoco lo cambia por su cuenta.
 */

import { useEffect, type ReactNode } from 'react'

export function ProveedorTema({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.theme = 'light'
    try {
      // Quien tuviera 'dark' guardado del portal anterior seguiria en oscuro sin
      // ninguna forma de salir, porque el interruptor ya no existe.
      localStorage.removeItem('ex_portal_tema')
    } catch {
      /* almacenamiento bloqueado */
    }
  }, [])

  return <>{children}</>
}
