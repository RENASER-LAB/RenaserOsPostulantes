/**
 * Qué marca el índice lateral del perfil (RES-QA-04).
 *
 * El caso que se escapaba: en una ventana alta y en el fondo de la página, la
 * última sección —«Reseñas» vacía— se ve entera pero nunca entra en la banda.
 */

import { describe, expect, it } from 'vitest'
import { seccionAMarcar, type LoQueSeVe } from './indice'

const ORDEN = ['acerca', 'trayectoria', 'certificaciones', 'idiomas', 'enlaces', 'resenas'] as const

const ver = (v: Partial<LoQueSeVe>): LoQueSeVe => ({
  enOrden: ORDEN,
  enBanda: new Set(),
  visibles: new Set(),
  pulsada: null,
  alFondo: false,
  cabeEntera: false,
  ...v,
})

describe('en el fondo de la página', () => {
  it('pulsar «Reseñas» la marca aunque no llegue a la banda (1440×1300, 2560×1440)', () => {
    expect(
      seccionAMarcar(
        ver({
          alFondo: true,
          pulsada: 'resenas',
          enBanda: new Set(['enlaces']),
          visibles: new Set(['idiomas', 'enlaces', 'resenas']),
        }),
      ),
    ).toBe('resenas')
  })

  it('bajando con la rueda, sin pulsar nada, marca la última que se ve y no «Idiomas»', () => {
    expect(
      seccionAMarcar(
        ver({
          alFondo: true,
          enBanda: new Set(['idiomas']),
          visibles: new Set(['idiomas', 'enlaces', 'resenas']),
        }),
      ),
    ).toBe('resenas')
  })

  it('respeta la pulsada si se ve, aunque no sea la última', () => {
    expect(
      seccionAMarcar(
        ver({ alFondo: true, pulsada: 'enlaces', visibles: new Set(['enlaces', 'resenas']) }),
      ),
    ).toBe('enlaces')
  })

  it('una pulsada que no se ve no manda: gana la última que se ve', () => {
    expect(
      seccionAMarcar(ver({ alFondo: true, pulsada: 'acerca', visibles: new Set(['enlaces', 'resenas']) })),
    ).toBe('resenas')
  })

  it('sin ninguna a la vista deja la que estaba', () => {
    expect(seccionAMarcar(ver({ alFondo: true }))).toBeNull()
  })
})

describe('fuera del fondo manda la banda', () => {
  it('la primera de la banda en orden de página', () => {
    expect(
      seccionAMarcar(
        ver({ enBanda: new Set(['enlaces', 'idiomas']), visibles: new Set(['idiomas', 'enlaces', 'resenas']) }),
      ),
    ).toBe('idiomas')
  })

  it('la pulsada, mientras esté en la banda', () => {
    expect(
      seccionAMarcar(ver({ pulsada: 'enlaces', enBanda: new Set(['idiomas', 'enlaces']) })),
    ).toBe('enlaces')
  })

  it('una pulsada que solo se ve, sin estar en la banda, no manda a media página', () => {
    expect(
      seccionAMarcar(
        ver({ pulsada: 'resenas', enBanda: new Set(['idiomas']), visibles: new Set(['idiomas', 'resenas']) }),
      ),
    ).toBe('idiomas')
  })

  it('sin ninguna en la banda —entre dos secciones largas— deja la que estaba', () => {
    expect(seccionAMarcar(ver({ visibles: new Set(['trayectoria']) }))).toBeNull()
  })

  it('en una página que cabe entera, la pulsada manda si se ve', () => {
    expect(
      seccionAMarcar(
        ver({
          cabeEntera: true,
          pulsada: 'resenas',
          enBanda: new Set(['acerca']),
          visibles: new Set(ORDEN),
        }),
      ),
    ).toBe('resenas')
  })
})
