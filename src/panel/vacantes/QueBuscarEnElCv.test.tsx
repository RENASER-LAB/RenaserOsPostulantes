/**
 * «Qué buscar en el CV» (V80): la casilla privada del formulario y la fila de su
 * peso en la confirmación del cambio de versión.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import type { CambioDePesosPrevisto } from '../api/tipos'
import { CasillaQueBuscar } from './QueBuscarEnElCv'
import { ConfirmacionDePesos } from './PesosDeLaDecision'

vi.mock('../api/panel', () => ({
  volverABuscarEnElCv: () => Promise.resolve({ estado: 'ENCOLADA', mensaje: '' }),
  asignarVersionPesos: () => Promise.resolve({}),
  listarVersionesPesos: () => Promise.resolve([]),
  preverCambioDePesos: () => Promise.resolve({}),
}))

afterEach(cleanup)

function Casilla({ inicial = '' }: { inicial?: string }) {
  const [valor, setValor] = useState(inicial)
  return <CasillaQueBuscar valor={valor} alCambiar={setValor} />
}

const escribir = (texto: string) =>
  fireEvent.change(screen.getByLabelText(/Qué buscar en el CV, uno por línea/), {
    target: { value: texto },
  })

describe('La casilla «Qué buscar en el CV»', () => {
  it('lleva su etiqueta, el chip privado y, sin líneas, dice que no hay nada', () => {
    render(<Casilla />)

    expect(screen.getByText('Qué buscar en el CV, uno por línea')).toBeTruthy()
    expect(screen.getByText('Solo lo ve tu equipo')).toBeTruthy()
    expect(screen.getByText('0 de 6 como máximo')).toBeTruthy()
    expect(
      screen.getByText('Nada todavía. Sin líneas, la ficha no muestra el checklist.'),
    ).toBeTruthy()
  })

  it('AC-01: con tres líneas lista las tres y dice «3 de 6 como máximo»', () => {
    render(<Casilla />)
    escribir('Experiencia en cocina saludable\nHa dirigido un equipo de cocina\nControla costos y mermas')

    expect(screen.getByText('3 de 6 como máximo')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('AC-03: la 7 y la 8 salen tachadas con «No se buscará: el máximo es 6.»', () => {
    render(<Casilla />)
    escribir('Uno\nDos\nTres\nCuatro\nCinco\nSeis\nSiete\nOcho')

    expect(screen.getByText('6 de 6 como máximo')).toBeTruthy()
    expect(screen.getAllByText('No se buscará: el máximo es 6.')).toHaveLength(2)
  })

  it('AC-02: «Menor de 35 años» sale en rojo con el motivo; «Carné de salud vigente» no', () => {
    render(<Casilla />)
    escribir('Menor de 35 años\nCarné de salud vigente')

    expect(screen.getAllByText(/no sirven para elegir a nadie/)).toHaveLength(1)
    expect(screen.getByText('1 de 6 como máximo')).toBeTruthy()
  })

  it('en solo lectura no se escribe ni enseña la vista previa', () => {
    render(<CasillaQueBuscar valor={'Controla costos'} soloLectura />)

    const area = screen.getByLabelText(/Qué buscar en el CV/) as HTMLTextAreaElement
    expect(area.readOnly).toBe(true)
    expect(screen.queryByText(/como máximo/)).toBeNull()
  })
})

describe('La confirmación del cambio de versión de pesos', () => {
  const previsto = (conLineas: boolean): CambioDePesosPrevisto => ({
    versionAnteriorId: 1,
    etiquetaAnterior: 'Con 25',
    versionNuevaId: 2,
    etiquetaNueva: 'Con 30',
    personasConNota: 7,
    cambia: true,
    etapas: [],
    perfilIntegral: [],
    queBuscarEnElCv: conLineas
      ? { codigo: 'QUE_BUSCAR_EN_EL_CV', nombre: 'Qué buscar en el CV', antes: 25, despues: 30 }
      : null,
  })

  it('AC-22: con líneas añade «Qué buscar en el CV 25 % → 30 %»', () => {
    render(
      <ConfirmacionDePesos
        previsto={previsto(true)}
        guardando={false}
        fallo={null}
        alCancelar={() => {}}
        alConfirmar={() => {}}
      />,
    )

    const fila = screen.getByRole('rowheader', { name: 'Qué buscar en el CV' }).closest('tr')!
    expect(fila.textContent).toContain('25 %')
    expect(fila.textContent).toContain('30 %')
  })

  it('sin líneas la fila no sale', () => {
    render(
      <ConfirmacionDePesos
        previsto={previsto(false)}
        guardando={false}
        fallo={null}
        alCancelar={() => {}}
        alConfirmar={() => {}}
      />,
    )

    expect(screen.queryByText('Qué buscar en el CV')).toBeNull()
  })
})
