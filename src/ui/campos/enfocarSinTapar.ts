/**
 * Llevar el foco a un campo con error y dejarlo a la vista ENTERO —su etiqueta
 * encima, el campo y su mensaje debajo—, por debajo de la cabecera pegada arriba.
 *
 * ⚠️ **`campo.focus()` a secas lo dejaba tapado (desde agosto).** El navegador
 * desplaza el campo hasta el borde de arriba de la ventana, y ahí está la
 * cabecera fija: la píldora del portal (84 px) o la barra del panel (58 px). La
 * etiqueta, que va encima del campo, quedaba siempre debajo de ella, y a menudo
 * medio campo también.
 *
 * ⚠️ **No es `scroll-padding-top` en `html`, y es a propósito.** Esa regla
 * resolvería el foco con una línea, pero se suma al `scroll-margin-top` que ya
 * llevan los anclajes que se apartan solos de la cabecera —`/perfil#celular`,
 * las vacantes, el editor de preguntas—, y todos bajarían el doble. Además solo
 * apartaría el CAMPO: la etiqueta seguiría tapada, porque está fuera de él.
 *
 * Así que esto enfoca sin desplazar y luego desplaza lo justo, midiendo:
 *
 * 1. **Qué se tiene que ver**: el campo, sus `<label>` y lo que nombran su
 *    `aria-labelledby` y su `aria-describedby` —la ayuda y el error—; en un
 *    grupo de opciones, la `<legend>` del `fieldset`; y si quien pinta el
 *    formulario lo marcó, el bloque entero (`data-bloque-del-campo`).
 * 2. **Dónde cabe**: en cada contenedor que rueda —el cuerpo de un modal—, su
 *    hueco; en la ventana, lo que queda por debajo de lo que lleve
 *    `data-pegada-arriba`, medido en ese momento y no copiado de un token, que ya
 *    se quedó viejo una vez.
 * 3. **Cuánto mover**: nada si ya se ve entero; si no, lo justo para que lo de
 *    arriba —la etiqueta— quede `AIRE` px por debajo de la cabecera. Si lo grande
 *    no cabe, se prueba con menos —sin el bloque, sin la leyenda— y, como último
 *    recurso, la etiqueta arriba aunque el final se corte.
 */

/** El respiro entre la cabecera y la etiqueta: el `--e4` del mundo. */
const AIRE = 16

/** El primer campo con error de `zona`, enfocado y a la vista. */
export function enfocarPrimerCampoConError(zona: ParentNode | null | undefined = document): void {
  enfocarSinTapar(zona?.querySelector<HTMLElement>('[aria-invalid="true"]'))
}

/**
 * Enfoca `campo` sin el salto del navegador y lo deja a la vista con su etiqueta
 * y su mensaje. Hay que llamarlo cuando el error YA está pintado —dentro del
 * `requestAnimationFrame` de siempre—: lo que no existe todavía no se mide.
 */
export function enfocarSinTapar(campo: HTMLElement | null | undefined): void {
  if (!campo || !campo.isConnected) return
  campo.focus({ preventScroll: true })
  dejarALaVista(campo)
}

function dejarALaVista(campo: HTMLElement): void {
  const grupos = gruposQueVer(campo)
  const { contenedores, dentroDeAlgoFijo } = contenedoresQueRuedan(campo)

  // De dentro afuera: primero el cuerpo del modal, luego la ventana. Cada paso
  // vuelve a medir, porque el anterior lo movió todo.
  for (const contenedor of contenedores) {
    const caja = contenedor.getBoundingClientRect()
    const arriba = caja.top + contenedor.clientTop
    const delta = cuantoMover(grupos, arriba + AIRE, arriba + contenedor.clientHeight - AIRE)
    if (delta !== 0) contenedor.scrollTop += delta
  }

  // Lo que va dentro de algo `fixed` —un modal— no se mueve con la ventana.
  if (dentroDeAlgoFijo) return
  const delta = cuantoMover(grupos, loQueTapaArriba(campo) + AIRE, window.innerHeight - AIRE)
  if (delta !== 0) window.scrollBy(0, delta)
}

/**
 * Lo que se tiene que ver, de lo más completo a lo imprescindible. El último
 * grupo es siempre el campo con su etiqueta, su ayuda y su error.
 */
function gruposQueVer(campo: HTMLElement): HTMLElement[][] {
  const nucleo = [
    campo,
    ...etiquetasDe(campo),
    ...nombrados(campo, 'aria-labelledby'),
    ...nombrados(campo, 'aria-describedby'),
  ]

  // En un grupo de opciones la pregunta es la leyenda, no el rótulo de la
  // opción («Sí», «3 estrellas»); y el error suele colgar del `fieldset`.
  const grupo = campo.closest('fieldset')
  const conGrupo =
    grupo && (esOpcion(campo) || etiquetasDe(campo).length === 0)
      ? [...nucleo, ...leyendaDe(grupo), ...nombrados(grupo, 'aria-describedby')]
      : nucleo

  const bloque = campo.closest<HTMLElement>('[data-bloque-del-campo]')
  return [bloque ? [...conGrupo, bloque] : conGrupo, conGrupo, nucleo]
}

function esOpcion(campo: HTMLElement): boolean {
  return campo instanceof HTMLInputElement && (campo.type === 'radio' || campo.type === 'checkbox')
}

function etiquetasDe(campo: HTMLElement): HTMLElement[] {
  const etiquetas = (campo as Partial<HTMLInputElement>).labels
  return etiquetas ? Array.from(etiquetas) : []
}

function leyendaDe(grupo: HTMLFieldSetElement): HTMLElement[] {
  const leyenda = grupo.querySelector<HTMLElement>(':scope > legend')
  return leyenda ? [leyenda] : []
}

function nombrados(elemento: Element, atributo: string): HTMLElement[] {
  return (elemento.getAttribute(atributo) ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id))
    .filter((pieza): pieza is HTMLElement => pieza !== null)
}

interface Franja {
  arriba: number
  abajo: number
}

/**
 * Lo que ocupan las piezas que se ven. Lo de `.solo-lectores` (1 × 1 px) y lo que
 * no se pinta no cuenta: no hay nada que enseñar y descolocaría la cuenta.
 */
function franjaDe(piezas: HTMLElement[]): Franja | null {
  let franja: Franja | null = null
  for (const pieza of piezas) {
    const caja = pieza.getBoundingClientRect()
    if (caja.width <= 1 || caja.height <= 1) continue
    franja = franja
      ? { arriba: Math.min(franja.arriba, caja.top), abajo: Math.max(franja.abajo, caja.bottom) }
      : { arriba: caja.top, abajo: caja.bottom }
  }
  return franja
}

/** Cuánto hay que rodar para que el grupo más completo que quepa se vea entero. */
function cuantoMover(grupos: HTMLElement[][], arriba: number, abajo: number): number {
  let elegida: Franja | null = null
  for (const grupo of grupos) {
    const franja = franjaDe(grupo)
    if (!franja) continue
    elegida = franja
    if (franja.abajo - franja.arriba <= abajo - arriba) break
  }
  if (!elegida) return 0
  if (elegida.arriba >= arriba && elegida.abajo <= abajo) return 0
  return Math.round(elegida.arriba - arriba)
}

function contenedoresQueRuedan(campo: HTMLElement): {
  contenedores: HTMLElement[]
  dentroDeAlgoFijo: boolean
} {
  const contenedores: HTMLElement[] = []
  for (let el = campo.parentElement; el && el !== document.body; el = el.parentElement) {
    const estilo = getComputedStyle(el)
    if (/auto|scroll|overlay/.test(estilo.overflowY) && el.scrollHeight > el.clientHeight) {
      contenedores.push(el)
    }
    if (estilo.position === 'fixed') return { contenedores, dentroDeAlgoFijo: true }
  }
  return { contenedores, dentroDeAlgoFijo: false }
}

/**
 * Hasta dónde tapa lo que va pegado arriba: el alto de cada pieza marcada con
 * `data-pegada-arriba` más su `top`. Se mide su alto y no su posición de ahora,
 * porque después de rodar estará pegada arriba aunque ahora no lo esté.
 */
function loQueTapaArriba(campo: HTMLElement): number {
  let tope = 0
  for (const pieza of document.querySelectorAll<HTMLElement>('[data-pegada-arriba]')) {
    if (pieza.contains(campo)) continue
    const estilo = getComputedStyle(pieza)
    if (estilo.position !== 'sticky' && estilo.position !== 'fixed') continue
    const alto = pieza.getBoundingClientRect().height
    if (alto <= 0) continue
    tope = Math.max(tope, (Number.parseFloat(estilo.top) || 0) + alto)
  }
  return tope
}
