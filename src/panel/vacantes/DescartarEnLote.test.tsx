/**
 * Lo que compila perfectamente estando mal al descartar a una tanda entera.
 *
 *   0. **Actuar al pulsar, como el botón de avanzar.** Es lo que trajo la
 *      ventana: los dos botones están pegados y hacen cosas opuestas, y aquí un
 *      clic manda N cartas de rechazo que no se recogen.
 *   1. **Enseñar la cifra y no los nombres.** El error real no es equivocarse de
 *      botón: es llegar con alguien marcado de una pestaña anterior. «Descartar
 *      a 6» parece correcto hasta que se leen los seis nombres, así que la
 *      ventana los escribe todos y sin recortar.
 *   2. **Perder a quien falla.** Una tanda lleva gente ya cerrada o fuera del
 *      alcance del rol. Si un fallo cortara el bucle, los demás se quedarían sin
 *      descartar y nadie sabría por dónde se paró.
 *   3. **Contar los correos de más.** A los ya cerrados no se les filtra antes
 *      —se les deja fallar y salir nombrados—, así que la ventana promete
 *      «hasta N» y no «N». Prometer N deja que el resultado la contradiga.
 *   4. **Arrastrar el «sin avisar» a la tanda siguiente.** Haberlo apagado una
 *      vez no puede callar los correos de la próxima sin que nadie lo mire.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ErrorApi } from '../api/cliente'
import { DescartarEnLote } from './DescartarEnLote'

const mover = vi.fn()

vi.mock('../api/panel', () => ({
  transicionar: (postulacionId: number, estadoDestino: string, motivo: string, avisar: boolean) =>
    mover(postulacionId, estadoDestino, motivo, avisar),
}))

const TRES = [
  { postulacionId: 31, candidato: 'Ana Ruiz' },
  { postulacionId: 32, candidato: 'Beto Salas' },
  { postulacionId: 33, candidato: 'Cira Núñez' },
]

function montar({
  marcados = TRES,
  motivo = 'La vacante se cubrió.',
  alTerminar = () => {},
} = {}) {
  return render(
    <DescartarEnLote marcados={marcados} motivo={motivo} alTerminar={alTerminar} />,
  )
}

const botonDeLaMesa = () => screen.getByRole('button', { name: /Descartar a|Marca a quienes/ })
const confirmar = () => screen.getByRole('button', { name: /^Descartar (y avisar|a \d+ sin)/ })

beforeEach(() => {
  mover.mockReset()
  mover.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('el botón de la mesa', () => {
  it('sin nadie marcado no se puede pulsar, y dice qué falta', () => {
    montar({ marcados: [] })
    const boton = screen.getByRole('button', { name: 'Marca a quienes no siguen' })
    expect((boton as HTMLButtonElement).disabled).toBe(true)
  })

  it('sin motivo escrito tampoco: el backend lo exige y la pantalla lo evita', () => {
    montar({ motivo: '   ' })
    expect((botonDeLaMesa() as HTMLButtonElement).disabled).toBe(true)
  })

  it('no descarta al pulsarlo: abre la ventana', () => {
    // ⚠️ La diferencia con el botón de avanzar, que sí actúa al pulsarse.
    montar()
    fireEvent.click(botonDeLaMesa())
    expect(mover).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Descartar a 3 personas' })).toBeTruthy()
  })
})

describe('la ventana', () => {
  it('escribe los tres nombres, enteros y sin recortar', () => {
    // Es el motivo de que exista: una cifra sola no enseña a quién se marcó de
    // una pestaña anterior, y un «y 1 más» esconde justo al que nadie repasó.
    montar()
    fireEvent.click(botonDeLaMesa())
    for (const quien of ['Ana Ruiz', 'Beto Salas', 'Cira Núñez']) {
      expect(screen.getByText(quien)).toBeTruthy()
    }
  })

  it('promete «hasta 3» correos, porque a los ya cerrados no se les filtra antes', () => {
    montar()
    fireEvent.click(botonDeLaMesa())
    expect(screen.getByText(/hasta/).textContent).toMatch(/3/)
  })

  it('cita el motivo tal cual se escribió arriba', () => {
    // Se confirma lo que va a quedar escrito, no una paráfrasis.
    montar({ motivo: '  La vacante se cubrió.  ' })
    fireEvent.click(botonDeLaMesa())
    expect(screen.getByText(/La vacante se cubrió/)).toBeTruthy()
  })
})

describe('lo que se manda', () => {
  it('va uno a uno, con el mismo motivo recortado y avisando', async () => {
    const alTerminar = vi.fn()
    montar({ alTerminar })
    fireEvent.click(botonDeLaMesa())
    fireEvent.click(confirmar())

    await waitFor(() => expect(mover).toHaveBeenCalledTimes(3))
    expect(mover).toHaveBeenNthCalledWith(1, 31, 'NO_CONTINUA', 'La vacante se cubrió.', true)
    expect(mover).toHaveBeenNthCalledWith(3, 33, 'NO_CONTINUA', 'La vacante se cubrió.', true)
    await waitFor(() => expect(alTerminar).toHaveBeenCalled())
  })

  it('quitando la casilla, los tres van sin aviso', async () => {
    montar()
    fireEvent.click(botonDeLaMesa())
    fireEvent.click(screen.getByRole('checkbox', { name: /Avisarles por correo/ }))
    fireEvent.click(confirmar())

    await waitFor(() => expect(mover).toHaveBeenCalledTimes(3))
    for (const n of [1, 2, 3]) {
      expect(mover.mock.calls[n - 1]![3]).toBe(false)
    }
  })

  it('el «sin avisar» no se arrastra a la tanda siguiente', async () => {
    // Apagarlo una vez no puede callar los correos de la próxima en silencio.
    montar()
    fireEvent.click(botonDeLaMesa())
    fireEvent.click(screen.getByRole('checkbox', { name: /Avisarles por correo/ }))
    fireEvent.click(confirmar())
    await waitFor(() => expect(mover).toHaveBeenCalledTimes(3))

    fireEvent.click(botonDeLaMesa())
    expect((screen.getByRole('checkbox', { name: /Avisarles por correo/ }) as HTMLInputElement).checked).toBe(true)
  })
})

describe('cuando alguno falla', () => {
  it('los demás siguen, y el resultado dice quién no pudo y por qué', async () => {
    // ⚠️ Una tanda lleva gente ya cerrada. Cortar el bucle dejaría a los demás
    // sin descartar y sin decir por dónde se paró.
    mover
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ErrorApi(409, 'Ya terminó su recorrido'))
      .mockResolvedValueOnce(undefined)
    montar()
    fireEvent.click(botonDeLaMesa())
    fireEvent.click(confirmar())

    await waitFor(() => expect(mover).toHaveBeenCalledTimes(3))
    const resultado = await screen.findByRole('status')
    expect(resultado.textContent).toMatch(/Ana Ruiz/)
    expect(resultado.textContent).toMatch(/Cira Núñez/)
    expect(resultado.textContent).toMatch(/No se descartaron: Beto Salas/)
  })
})
