/**
 * Lo que jsdom no trae y el navegador sí.
 *
 * ⚠️ **No es un apaño para que pase una prueba.** `scrollIntoView` no está
 * implementado en jsdom —lo declara en su tipo y revienta al llamarlo—, así que
 * cualquier componente que traiga a la vista lo que acaba de abrir explota en
 * las pruebas y funciona en el navegador. Guardarlo con un `if` dentro del
 * componente sería escribir código de producción para tapar un hueco del
 * entorno de pruebas, que es justo al revés.
 *
 * Se pone aquí, una vez, en vez de en cada archivo que lo necesite.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-function
Element.prototype.scrollIntoView = function scrollIntoView() {}

/**
 * `IntersectionObserver` tampoco existe en jsdom, y ahí no puede existir: no hay
 * ventana que desplazar ni nada que intersecar. Sin este relleno, el índice de
 * la columna lateral tumbaba **la pantalla entera** al montarse.
 *
 * El doble no observa nada a propósito. Lo que el observador decide —qué sección
 * está a la vista— solo tiene sentido con una ventana de verdad desplazándose,
 * así que se comprueba en el recorrido de Playwright, no aquí.
 */
class ObservadorDeIntersecciónQueNoObserva {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds: readonly number[] = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

globalThis.IntersectionObserver =
  ObservadorDeIntersecciónQueNoObserva as unknown as typeof IntersectionObserver
