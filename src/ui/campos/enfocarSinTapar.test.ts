/**
 * Llevar el foco a un campo con error sin que la cabecera fija lo tape (el fallo
 * de agosto que vio QA en el registro: la etiqueta, y a veces medio campo, quedaban
 * detrás de la píldora).
 *
 * jsdom no maqueta: aquí se le dan a mano las cajas que mediría el navegador —la
 * cabecera, la etiqueta, el campo, el error— y se mira cuánto se pide rodar. Que en
 * un navegador de verdad quede bien lo mira QA en escritorio y a 390 × 844.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enfocarPrimerCampoConError, enfocarSinTapar } from './enfocarSinTapar'

/** La caja que daría el navegador: `top` y alto, en coordenadas de la ventana. */
function caja(elemento: Element, top: number, alto: number, ancho = 320) {
  vi.spyOn(elemento, 'getBoundingClientRect').mockReturnValue({
    top,
    bottom: top + alto,
    height: alto,
    left: 0,
    right: ancho,
    width: ancho,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect)
}

function montar(html: string) {
  document.body.innerHTML = html
  const de = (selector: string) => document.querySelector<HTMLElement>(selector)!
  return de
}

/** La cabecera pegada arriba, como la del portal: 84 px y `sticky` en 0. */
const CABECERA_DEL_PORTAL = `<header data-pegada-arriba="" style="position: sticky; top: 0px">Portal</header>`

const UN_CAMPO = `
  <form>
    <div>
      <label for="ciudad">Ciudad</label>
      <input id="ciudad" aria-invalid="true" aria-describedby="ciudad-error" />
      <p id="ciudad-error">Elige tu ciudad.</p>
    </div>
  </form>`

let rodar: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  rodar = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
  Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true })
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
})

/** Pone el campo de la ciudad con la etiqueta en `arriba`: 21 px de etiqueta, 44 de campo y 20 de error. */
function ciudadEn(de: (s: string) => HTMLElement, arriba: number) {
  caja(de('label'), arriba, 21)
  caja(de('#ciudad'), arriba + 27, 44)
  caja(de('#ciudad-error'), arriba + 77, 20)
}

describe('enfocarSinTapar', () => {
  it('enfoca sin el salto del navegador y no rueda si el campo ya se ve entero bajo la cabecera', () => {
    const de = montar(CABECERA_DEL_PORTAL + UN_CAMPO)
    caja(de('header'), 0, 84)
    ciudadEn(de, 300)
    const enfocar = vi.spyOn(de('#ciudad'), 'focus')

    enfocarSinTapar(de('#ciudad'))

    expect(enfocar).toHaveBeenCalledWith({ preventScroll: true })
    expect(document.activeElement).toBe(de('#ciudad'))
    expect(rodar).not.toHaveBeenCalled()
  })

  it('con el campo debajo de la cabecera, baja la etiqueta a 16 px por debajo de ella', () => {
    const de = montar(CABECERA_DEL_PORTAL + UN_CAMPO)
    caja(de('header'), 0, 84)
    // Lo que dejaba `focus()`: el campo pegado al borde de arriba, tapado.
    ciudadEn(de, -27)

    enfocarSinTapar(de('#ciudad'))

    // La etiqueta está en -27 y tiene que quedar en 84 + 16 = 100.
    expect(rodar).toHaveBeenCalledWith(0, -127)
  })

  it('cuenta la etiqueta: con el campo a la vista pero la etiqueta tapada, también rueda', () => {
    const de = montar(CABECERA_DEL_PORTAL + UN_CAMPO)
    caja(de('header'), 0, 84)
    // El campo empieza en 87, ya fuera de la píldora; la etiqueta, en 60, debajo.
    ciudadEn(de, 60)

    enfocarSinTapar(de('#ciudad'))

    expect(rodar).toHaveBeenCalledWith(0, -40)
  })

  it('con el campo por debajo del pliegue, lo sube hasta debajo de la cabecera', () => {
    const de = montar(CABECERA_DEL_PORTAL + UN_CAMPO)
    caja(de('header'), 0, 84)
    ciudadEn(de, 1200)

    enfocarSinTapar(de('#ciudad'))

    expect(rodar).toHaveBeenCalledWith(0, 1100)
  })

  it('el mensaje cuenta: con el error cortado por abajo, rueda', () => {
    const de = montar(CABECERA_DEL_PORTAL + UN_CAMPO)
    caja(de('header'), 0, 84)
    // Etiqueta y campo dentro; el error acaba en 851, pasada la ventana de 844.
    ciudadEn(de, 754)

    enfocarSinTapar(de('#ciudad'))

    expect(rodar).toHaveBeenCalledWith(0, 654)
  })

  it('mide la cabecera que haya, no un número escrito: la barra del panel son 58 px', () => {
    const de = montar(
      `<header data-pegada-arriba="" style="position: sticky; top: 0px">Panel</header>` + UN_CAMPO,
    )
    caja(de('header'), 0, 58)
    ciudadEn(de, 10)

    enfocarSinTapar(de('#ciudad'))

    expect(rodar).toHaveBeenCalledWith(0, -64)
  })

  it('mide el alto aunque la cabecera aún no esté pegada: después de rodar lo estará', () => {
    // Algo encima de la cabecera la tiene 40 px más abajo antes de rodar.
    const de = montar(CABECERA_DEL_PORTAL + UN_CAMPO)
    caja(de('header'), 40, 84)
    ciudadEn(de, 1200)

    enfocarSinTapar(de('#ciudad'))

    expect(rodar).toHaveBeenCalledWith(0, 1100)
  })

  it('una cabecera que no va pegada no reserva nada: al rodar se va con la página', () => {
    const de = montar(`<header data-pegada-arriba="">Suelta</header>` + UN_CAMPO)
    caja(de('header'), 0, 84)
    ciudadEn(de, 1200)

    enfocarSinTapar(de('#ciudad'))

    expect(rodar).toHaveBeenCalledWith(0, 1184)
  })

  it('dentro de un modal fijo, rueda su cuerpo y no la ventana', () => {
    const de = montar(
      CABECERA_DEL_PORTAL +
        `<div role="dialog" style="position: fixed">
          <div class="cuerpo" style="overflow-y: auto">${UN_CAMPO}</div>
        </div>`,
    )
    caja(de('header'), 0, 84)
    const cuerpo = de('.cuerpo')
    Object.defineProperty(cuerpo, 'clientHeight', { value: 400, configurable: true })
    Object.defineProperty(cuerpo, 'scrollHeight', { value: 1200, configurable: true })
    cuerpo.scrollTop = 300
    caja(cuerpo, 100, 400)
    // El cuerpo va de 100 a 500; la etiqueta asoma en 90, cortada por arriba.
    ciudadEn(de, 90)

    enfocarSinTapar(de('#ciudad'))

    // La etiqueta tiene que quedar en 100 + 16 = 116.
    expect(cuerpo.scrollTop).toBe(274)
    expect(rodar).not.toHaveBeenCalled()
  })

  it('en un grupo de opciones enseña la pregunta (la leyenda), no solo el rótulo de la opción', () => {
    const de = montar(
      CABECERA_DEL_PORTAL +
        `<fieldset aria-invalid="true" aria-describedby="estrellas-error">
          <legend>Calificación</legend>
          <label class="una"><input type="radio" name="e" value="1" />1 estrella</label>
          <p id="estrellas-error">Elige cuántas estrellas le das.</p>
        </fieldset>`,
    )
    caja(de('header'), 0, 84)
    caja(de('legend'), 70, 20)
    caja(de('label.una'), 100, 28)
    // La radio de verdad es de `.solo-lectores`: 1 × 1 px, no cuenta.
    caja(de('input'), 100, 1, 1)
    caja(de('#estrellas-error'), 136, 20)

    enfocarSinTapar(de('input'))

    // La leyenda, en 70, tiene que bajar a 100.
    expect(rodar).toHaveBeenCalledWith(0, -30)
  })

  it('con `data-bloque-del-campo` enseña el bloque entero si cabe', () => {
    const de = montar(
      CABECERA_DEL_PORTAL +
        `<section data-bloque-del-campo="">
          <h2>Tu currículum</h2>
          <button type="button" aria-invalid="true" aria-describedby="error-cv">Buscar en mi equipo</button>
          <p id="error-cv">Adjunta tu currículum.</p>
        </section>`,
    )
    caja(de('header'), 0, 84)
    caja(de('section'), 40, 300)
    caja(de('button'), 150, 44)
    caja(de('#error-cv'), 300, 20)

    enfocarSinTapar(de('button'))

    expect(rodar).toHaveBeenCalledWith(0, -60)
  })

  it('si el bloque no cabe, se queda con el campo, su etiqueta y su error', () => {
    const de = montar(
      CABECERA_DEL_PORTAL + `<section data-bloque-del-campo="">${UN_CAMPO}<p>Muy largo</p></section>`,
    )
    caja(de('header'), 0, 84)
    caja(de('section'), -2000, 4000)
    ciudadEn(de, -27)

    enfocarSinTapar(de('#ciudad'))

    expect(rodar).toHaveBeenCalledWith(0, -127)
  })

  it('si ni el campo cabe, deja la etiqueta arriba aunque el final se corte', () => {
    const de = montar(
      CABECERA_DEL_PORTAL +
        `<label for="texto">Opinión</label>
        <textarea id="texto" aria-invalid="true"></textarea>`,
    )
    caja(de('header'), 0, 84)
    caja(de('label'), 900, 21)
    caja(de('textarea'), 927, 2000)

    enfocarSinTapar(de('textarea'))

    expect(rodar).toHaveBeenCalledWith(0, 800)
  })

  it('sin cajas (nada maquetado) solo enfoca, sin rodar', () => {
    const de = montar(CABECERA_DEL_PORTAL + UN_CAMPO)

    enfocarSinTapar(de('#ciudad'))

    expect(document.activeElement).toBe(de('#ciudad'))
    expect(rodar).not.toHaveBeenCalled()
  })

  it('sin campo no hace nada', () => {
    expect(() => enfocarSinTapar(null)).not.toThrow()
    expect(rodar).not.toHaveBeenCalled()
  })
})

describe('enfocarPrimerCampoConError', () => {
  it('enfoca el primer `aria-invalid` de la zona que se le da, no el de otra', () => {
    const de = montar(`
      <form id="otro"><input id="fuera" aria-invalid="true" /></form>
      <form id="este">
        <input id="bien" />
        <input id="primero" aria-invalid="true" />
        <input id="segundo" aria-invalid="true" />
      </form>`)

    enfocarPrimerCampoConError(de('#este'))

    expect(document.activeElement).toBe(de('#primero'))
  })

  it('sin zona busca en todo el documento', () => {
    const de = montar(`<input id="bien" /><input id="mal" aria-invalid="true" />`)

    enfocarPrimerCampoConError()

    expect(document.activeElement).toBe(de('#mal'))
  })
})
