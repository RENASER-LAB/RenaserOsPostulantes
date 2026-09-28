/**
 * Qué sección marca el índice lateral del perfil («En esta página»).
 *
 * Va aparte del componente para poder probarla sin navegador: el componente
 * mide —qué secciones están en la banda, cuáles se ven, si la página está en su
 * fondo— y esto decide.
 */

export interface LoQueSeVe {
  /** Las anclas de las secciones, en orden de página. */
  enOrden: readonly string[]
  /** Las que cruzan la banda activa: la franja de arriba de la ventana. */
  enBanda: ReadonlySet<string>
  /** Las que se ven, aunque sea en parte, por debajo de la cabecera. */
  visibles: ReadonlySet<string>
  /** La que se acaba de pulsar en el índice, si sigue contando. */
  pulsada: string | null
  /** La página se desplaza y está en su desplazamiento máximo. */
  alFondo: boolean
  /** La página cabe entera en la ventana: no se desplaza. */
  cabeEntera: boolean
}

/**
 * La sección a marcar, o `null` para dejar la que estaba.
 *
 * ⚠️ **En el fondo de la página no manda la banda.** Las últimas secciones no
 * pueden subir hasta arriba porque la página se acaba, y en una ventana alta
 * —1440×1300, 2560×1440— una sección final corta se queda entera por debajo de
 * la banda: nunca entra en ella. Mirando solo la banda, pulsar «Reseñas» dejaba
 * marcada «Enlaces», y bajar con la rueda hasta el final marcaba «Idiomas». En el
 * fondo cuenta lo que se ve: la pulsada si se ve, y si no, la última que se ve.
 */
export function seccionAMarcar(v: LoQueSeVe): string | null {
  if ((v.alFondo || v.cabeEntera) && v.pulsada !== null && v.visibles.has(v.pulsada)) {
    return v.pulsada
  }
  if (v.alFondo) {
    const vistas = v.enOrden.filter((id) => v.visibles.has(id))
    return vistas[vistas.length - 1] ?? null
  }
  if (v.pulsada !== null && v.enBanda.has(v.pulsada)) return v.pulsada
  // Sin ninguna en la banda —entre dos secciones largas— se queda la última
  // marcada: apagarlo todo parpadea y no dice nada mejor.
  return v.enOrden.find((id) => v.enBanda.has(id)) ?? null
}
