/**
 * La tarjeta de una vacante, montada, en sus dos formas: lo que encuentran el
 * teclado y la vista.
 *
 *   1. **Una tarjeta es UNA parada de Tab: su enlace** (puntos 38 y 40). `motion`
 *      pone `tabindex="0"` a todo lo que tenga gesto de pulsar y no sea un
 *      control, así que la superficie que se hunde al pulsarla —un `<article>`—
 *      era una parada sin nombre ni acción antes del enlace (C2-F-01). Aquí jsdom
 *      no pide movimiento reducido, así que se monta la pieza con `motion`: la
 *      que tenía el fallo.
 *   2. **Un campo con solo espacios cuenta como vacío** (punto 2 y casos límite):
 *      un propósito en blanco deja paso a la descripción, y una empresa o un
 *      horario en blanco no dejan un hueco (C2-F-02).
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { VacantePublica } from '@/api/tipos'
import { Tarjeta } from './Tarjeta'

afterEach(cleanup)

function vacante(cambios: Partial<VacantePublica> = {}): VacantePublica {
  return {
    id: 7,
    titulo: 'Analista de datos',
    nombreEmpresa: 'RENASER CONSULTING S.A.C.',
    descripcion: 'La descripción',
    proposito: null,
    responsabilidades: null,
    requisitos: null,
    modalidad: 'Remoto',
    horario: '9am-6pm',
    ubicacion: null,
    ciudad: { codigo: '1501', nombre: 'Lima', departamento: 'Lima' },
    publicadaEn: null,
    remuneracion: { tipo: 'OCULTA', min: null, max: null, moneda: null, texto: 'No la publica', actualizadaEn: null },
    requisitosObjetivos: [],
    ...cambios,
  }
}

const FORMAS = ['dePie', 'aLoAncho'] as const

function montar(v: VacantePublica, forma: (typeof FORMAS)[number]) {
  return render(
    <MemoryRouter>
      <Tarjeta vacante={v} forma={forma} publicada="Publicada hoy" />
    </MemoryRouter>,
  )
}

/** Lo que Tab recorre dentro de `raiz`, en orden de documento. */
function paradasDeTab(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>('*')).filter(
    (e) => e.tabIndex >= 0 && !e.hasAttribute('disabled'),
  )
}

describe.each(FORMAS)('la tarjeta %s', (forma) => {
  it('es una sola parada de Tab, su enlace, y la superficie que responde al toque no es otra', () => {
    const { container } = montar(vacante(), forma)
    const paradas = paradasDeTab(container)
    expect(paradas.map((e) => e.tagName)).toEqual(['A'])
    expect(paradas[0]!.getAttribute('href')).toBe('/vacantes/7')
    // La superficie sigue siendo un <article>, pero fuera del recorrido de Tab.
    const superficie = container.querySelector('article')!
    expect(superficie).not.toBeNull()
    expect(superficie.tabIndex).toBeLessThan(0)
  })

  it('con el propósito en blanco, el resumen es la descripción', () => {
    const { container } = montar(vacante({ proposito: '   ', descripcion: 'Lo que se hace de verdad' }), forma)
    const parrafos = Array.from(container.querySelectorAll('p')).map((p) => p.textContent)
    expect(parrafos).toEqual(['Lo que se hace de verdad'])
  })

  it('sin propósito ni descripción con texto, no hay resumen', () => {
    const { container } = montar(vacante({ proposito: ' ', descripcion: '  \n ' }), forma)
    expect(container.querySelectorAll('p')).toHaveLength(0)
  })

  it('una empresa o un horario con solo espacios no dejan un hueco', () => {
    const { container } = montar(vacante({ nombreEmpresa: '   ', horario: '  ' }), forma)
    const vacios = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.children.length === 0 && (s.textContent ?? '').trim() === '',
    )
    expect(vacios).toEqual([])
    expect(container.textContent).not.toContain('9am-6pm')
  })
})
