/**
 * Los iconos de las acciones de cada fila de vacantes.
 *
 * Mismo trazo que el resto de iconos del panel —16 px, grosor 2, hereda el
 * color— para no traerse una libreria entera por dos dibujos. El nombre
 * accesible lo pone el boton que los envuelve: aqui el SVG se esconde, porque
 * un `<title>` dentro competiria con el `aria-label` de fuera y los lectores de
 * pantalla leerian los dos.
 *
 * Viven juntos y fuera de `Vacantes.tsx` porque los usan dos pantallas: la lista
 * habitual y la de archivadas.
 */

const TRAZO = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const

/** Corregir la vacante. */
export function IconoLapiz() {
  return (
    <svg {...TRAZO}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

/**
 * Guardar la vacante fuera de la lista: una caja con su tapa.
 *
 * Una caja y no una papelera, y no es un detalle: la papelera significa que algo
 * deja de existir, y archivar es justo lo contrario — el proceso entero se
 * conserva y la vacante puede volver. Confundir los dos dibujos haria que nadie
 * se atreviera a pulsarlo.
 */
export function IconoArchivo() {
  return (
    <svg {...TRAZO}>
      <path d="M3 5h18v4H3z" />
      <path d="M5 9v10h14V9" />
      <path d="M10 13h4" />
    </svg>
  )
}

/**
 * Retirar la vacante: una papelera, y aqui si.
 *
 * Es el dibujo que significa «esto deja de existir», que es exactamente lo que
 * pasa —la vacante se va del panel y del portal y no vuelve desde aqui—. La
 * caja y la papelera dicen cosas contrarias a proposito: quien duda entre
 * archivar y eliminar tiene que poder distinguirlas de un vistazo, sin leer.
 *
 * El caracter destructivo se sostiene tambien fuera del dibujo: va la ultima de
 * la fila, se pinta en rojo al acercarse y no hace nada al pulsarla —abre el
 * modal, que es donde se confirma—.
 */
export function IconoPapelera() {
  return (
    <svg {...TRAZO}>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}
