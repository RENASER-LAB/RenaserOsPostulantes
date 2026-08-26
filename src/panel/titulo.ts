/**
 * El titulo de la pestaña para las pantallas del panel que viven FUERA de su
 * armazon.
 *
 * `ArmazonPanel` pone el titulo de las cuatro pestañas, pero entrar y aceptar
 * una invitacion no pasan por el —el armazon manda a entrar a quien no tiene
 * sesion, y en esas dos no la hay todavia—. Sin esto heredarian el titulo de la
 * pantalla anterior, que es el incumplimiento de WCAG 2.4.2 que ya se corrigio
 * una vez en el portal.
 */

import { useEffect } from 'react'

export function useTituloDelPanel(titulo: string): void {
  useEffect(() => {
    document.title = `${titulo} · EX`
  }, [titulo])
}
