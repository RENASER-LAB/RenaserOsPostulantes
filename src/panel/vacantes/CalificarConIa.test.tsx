/**
 * Lo que compila perfectamente estando mal al pedirle notas a la IA.
 *
 *   0. **Decir que quedo calificado.** Es el fallo grave de esta pantalla y el
 *      unico que no se ve leyendo el codigo: los cuatro endpoints contestan al
 *      momento, la llamada al modelo tarda decenas de segundos, y un 200 solo
 *      demuestra que **se pidio**. Es la regla de los indicadores que mienten,
 *      la que ya costo respuestas de candidatos perdidas en la evaluacion.
 *   1. **Lanzar una criba sin preguntar.** Cambia de golpe las notas de mucha
 *      gente, y la fina ademas pisa las provisionales de la rapida. Sin la
 *      pregunta se pulsa por curiosidad y no queda ni rastro de que se perdio.
 *   2. **Preguntar sin decir a cuantos alcanza.** Un «¿seguro?» a secas no es
 *      una pregunta: no hay forma de contestarla bien.
 *   3. **Contar un 403 como una averia.** Que este rol no pueda pedir notas es
 *      el reparto de permisos funcionando; ofrecerle reintentar es mandarlo a
 *      pulsar un boton que va a fallar siempre igual.
 *   4. **Sondear sin tope, o mentir al parar.** Con la clave de DeepSeek local
 *      muerta la nota no llega nunca: un sondeo infinito refresca hasta que
 *      alguien cierre la pestaña. Y al pararlo, lo unico cierto es que dejamos
 *      de mirar — no que fallara.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ErrorApi } from '../api/cliente'
import { CalificarAUno, CalificarLaTanda } from './CalificarConIa'

const pedirPrueba = vi.fn()
const pedirPerfil = vi.fn()
const rapida = vi.fn()
const fina = vi.fn()

vi.mock('../api/panel', () => ({
  calificarPruebaConIa: (id: number) => pedirPrueba(id),
  calificarPerfilIntegralConIa: (id: number) => pedirPerfil(id),
  cribaRapida: (id: number) => rapida(id),
  cribaFina: (id: number) => fina(id),
}))

/** Las palabras que este bloque no puede decir nunca despues de un 200. */
const MENTIRAS = [/calificad[oa]s?\b/i, /\blisto\b/i, /ya está\b/i, /terminó\b/i]

function loQueSeLee() {
  return document.body.textContent ?? ''
}

beforeEach(() => {
  pedirPrueba.mockReset()
  pedirPerfil.mockReset()
  rapida.mockReset()
  fina.mockReset()
  pedirPrueba.mockResolvedValue({ estado: 'ENCOLADA', mensaje: 'En cola' })
  pedirPerfil.mockResolvedValue({ estado: 'ENCOLADA', mensaje: 'En cola' })
  rapida.mockResolvedValue({ estado: 'ENCOLADA', candidatos: 24, mensaje: 'En cola' })
  fina.mockResolvedValue({ estado: 'ENCOLADA', candidatos: 6, mensaje: 'En cola' })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('pedirle la nota a la IA de una persona', () => {
  it('tras un 200 dice que se pidió, y en ningún sitio que quedó calificado', async () => {
    render(<CalificarAUno postulacionId={7} etapa="PRUEBA_PUESTO" alTerminar={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /califique la prueba/i }))

    await screen.findByText(/se pidió/i)
    // La etiqueta va en presente y con la palabra dentro: en gris tambien se lee.
    expect(screen.getByText('Está calificando')).toBeTruthy()

    for (const mentira of MENTIRAS) {
      expect(loQueSeLee()).not.toMatch(mentira)
    }
  })

  it('manda el id de la postulación y elige la ruta de la etapa', async () => {
    render(<CalificarAUno postulacionId={9} etapa="PERFIL_INTEGRAL" alTerminar={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /califique el perfil/i }))

    await waitFor(() => expect(pedirPerfil).toHaveBeenCalledWith(9))
    expect(pedirPrueba).not.toHaveBeenCalled()
  })

  /*
   * ⚠️ El agujero que encontro el e2e contra el backend vivo: un 200 con
   * `estado: 'SIN_CAMBIOS'` significa que **no se encolo nada**, y sin mirarlo
   * el bloque pintaba «Se pidió. La IA está calificando» y arrancaba cinco
   * refrescos sobre una cola vacia. Los mensajes de aqui son los del backend.
   */
  describe('cuando el 200 dice que no se encoló nada', () => {
    const RUBRICA_SIN_AGENTE = {
      estado: 'SIN_CAMBIOS',
      mensaje:
        'La rúbrica de esta prueba no tiene ningún criterio marcado para el agente: la ' +
        'califica una persona entera.',
    }

    it('no dice que se pidió, ni que está calificando', async () => {
      pedirPrueba.mockResolvedValue(RUBRICA_SIN_AGENTE)
      render(<CalificarAUno postulacionId={16} etapa="PRUEBA_PUESTO" alTerminar={() => {}} />)

      fireEvent.click(screen.getByRole('button', { name: /califique la prueba/i }))

      expect(await screen.findByText(/no se encoló nada/i)).toBeTruthy()
      expect(loQueSeLee()).not.toMatch(/se pidió/i)
      expect(screen.queryByText('Está calificando')).toBeNull()
      // No es una avería: la rúbrica está así a propósito.
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('el motivo del backend se lee en pantalla', async () => {
      pedirPrueba.mockResolvedValue(RUBRICA_SIN_AGENTE)
      render(<CalificarAUno postulacionId={16} etapa="PRUEBA_PUESTO" alTerminar={() => {}} />)

      fireEvent.click(screen.getByRole('button', { name: /califique la prueba/i }))

      // Son cuatro motivos distintos y solo el mensaje los separa: uno obliga a
      // calificar a mano y los otros tres se resuelven esperando.
      expect(await screen.findByText(/la califica una persona entera/i)).toBeTruthy()
    })

    it('no arranca el sondeo', async () => {
      vi.useFakeTimers()
      const refrescar = vi.fn()
      pedirPerfil.mockResolvedValue({
        estado: 'SIN_CAMBIOS',
        mensaje: 'Hay un trabajo de calificación en marcha ahora mismo.',
      })
      render(<CalificarAUno postulacionId={16} etapa="PERFIL_INTEGRAL" alTerminar={refrescar} />)

      fireEvent.click(screen.getByRole('button', { name: /califique el perfil/i }))
      for (let vuelta = 0; vuelta < 9; vuelta += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(120_000)
        })
      }

      // Ni un refresco: no hay nota en camino que esperar.
      expect(refrescar).not.toHaveBeenCalled()
      expect(loQueSeLee()).toMatch(/no se encoló nada/i)
    })

    it('un mensaje vacío no deja el bloque mudo', async () => {
      pedirPrueba.mockResolvedValue({ estado: 'SIN_CAMBIOS', mensaje: '   ' })
      render(<CalificarAUno postulacionId={16} etapa="PRUEBA_PUESTO" alTerminar={() => {}} />)

      fireEvent.click(screen.getByRole('button', { name: /califique la prueba/i }))

      expect(await screen.findByText(/no se encoló nada/i)).toBeTruthy()
      expect(screen.getByText(/el servidor no dijo por qué/i)).toBeTruthy()
      expect(loQueSeLee()).not.toMatch(/se pidió/i)
    })

    it('un estado que el panel no conoce tampoco se da por encolado', async () => {
      // Pasarse de prudente cuesta un mensaje de más; quedarse corto vuelve a
      // pintar «está calificando» sobre una cola vacía.
      pedirPrueba.mockResolvedValue({ estado: 'LO_QUE_SEA', mensaje: '' })
      render(<CalificarAUno postulacionId={16} etapa="PRUEBA_PUESTO" alTerminar={() => {}} />)

      fireEvent.click(screen.getByRole('button', { name: /califique la prueba/i }))

      expect(await screen.findByText(/no damos por hecho que se encolara/i)).toBeTruthy()
      expect(screen.getByText(/LO_QUE_SEA/)).toBeTruthy()
      expect(screen.queryByText('Está calificando')).toBeNull()
    })
  })

  it('el sondeo para solo, y al parar no dice que fallara', async () => {
    vi.useFakeTimers()
    const refrescar = vi.fn()
    render(
      <CalificarAUno postulacionId={9} etapa="PERFIL_INTEGRAL" alTerminar={refrescar} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /califique el perfil/i }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText(/se pidió/i)).toBeTruthy()

    // Vuelta a vuelta y no de un solo salto: cada refresco programa el
    // siguiente al volver a pintar, y hace falta dejar que React pinte en medio.
    for (let vuelta = 0; vuelta < 9; vuelta += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000)
      })
    }

    // Cinco y ni una mas: el tope es el que dice la pantalla, no una promesa.
    expect(refrescar).toHaveBeenCalledTimes(5)

    expect(loQueSeLee()).toMatch(/dejamos de refrescar después de 5 intentos/i)
    expect(loQueSeLee()).toMatch(/no quiere decir que fallara/i)
    // Al agotarse no se pinta como un error: no lo es, solo dejamos de mirar.
    expect(screen.queryByRole('alert')).toBeNull()
    for (const mentira of MENTIRAS) {
      expect(loQueSeLee()).not.toMatch(mentira)
    }
  })
})

describe('pedirle notas a la tanda entera', () => {
  it('la criba fina pregunta antes de llamar, y dice a cuánta gente alcanza', async () => {
    render(<CalificarLaTanda vacanteId={3} alTerminar={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Criba fina' }))

    // Nada se ha mandado: primero se dice el alcance y lo que se pierde.
    expect(fina).not.toHaveBeenCalled()
    expect(screen.getByText(/solo a la parte alta de la tanda/i)).toBeTruthy()
    expect(screen.getByText(/pisa las notas provisionales/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Sí, criba fina' }))
    await waitFor(() => expect(fina).toHaveBeenCalledWith(3))
  })

  it('la criba rápida también pregunta, y con el tamaño de la tanda dice el número', async () => {
    render(<CalificarLaTanda vacanteId={3} total={24} alTerminar={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Criba rápida' }))

    expect(rapida).not.toHaveBeenCalled()
    // En la rápida el número ES el alcance: alcanza a la tanda entera.
    expect(screen.getByText(/alcanza a las 24 personas de la tanda/i)).toBeTruthy()
    expect(screen.getByText(/también a quien ya tiene nota/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Sí, criba rápida' }))
    await waitFor(() => expect(rapida).toHaveBeenCalledWith(3))
  })

  it('sin el tamaño de la tanda la pregunta sigue diciendo el alcance', () => {
    // La rama seguirá existiendo el día que alguien monte esto desde otro sitio
    // sin el ranking a mano. Sin número no se calla el alcance: se dice en
    // palabras. Lo que no se hace nunca es inventarse una cifra.
    render(<CalificarLaTanda vacanteId={3} alTerminar={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Criba rápida' }))

    expect(screen.getByText(/alcanza a toda la tanda/i)).toBeTruthy()
    expect(screen.getByText(/también a quien ya tiene nota/i)).toBeTruthy()
  })

  it('la criba fina no nombra el tamaño de la tanda, aunque lo tenga', () => {
    // El número de la tanda no es el alcance de la fina, que va sobre la parte
    // alta y la decide un parámetro del backend. Metido en esa frase sería el
    // único número, y un número gana a la salvedad que lo rodea: se leería
    // «pisa las notas de 24 personas», que es justo lo que no sabemos.
    render(<CalificarLaTanda vacanteId={3} total={24} alTerminar={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Criba fina' }))

    expect(screen.getByText(/solo a la parte alta de la tanda/i)).toBeTruthy()
    expect(loQueSeLee()).not.toMatch(/24/)
  })

  it('«mejor no» no manda nada y devuelve los dos botones', () => {
    render(<CalificarLaTanda vacanteId={3} alTerminar={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Criba fina' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mejor no' }))

    expect(fina).not.toHaveBeenCalled()
    expect(rapida).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Criba fina' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Criba rápida' })).toBeTruthy()
  })

  it('a cuánta gente alcanzó lo dice el servidor, no la pantalla', async () => {
    rapida.mockResolvedValue({ estado: 'ENCOLADA', candidatos: 24, mensaje: '' })
    render(<CalificarLaTanda vacanteId={3} alTerminar={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Criba rápida' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, criba rápida' }))

    expect(await screen.findByText(/se pidió la criba rápida para 24 personas/i)).toBeTruthy()
    for (const mentira of MENTIRAS) {
      expect(loQueSeLee()).not.toMatch(mentira)
    }
  })

  it('una pasada que no alcanza a nadie lo dice, y no se queda esperando', async () => {
    // Aceptada y vacia: el 200 no demuestra que hubiera trabajo. Sin esta rama
    // se leia «para 0 personas. Están en cola» con el sondeo mirando la nada.
    rapida.mockResolvedValue({ estado: 'ENCOLADA', candidatos: 0, mensaje: '' })
    render(<CalificarLaTanda vacanteId={3} alTerminar={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Criba rápida' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, criba rápida' }))

    expect(await screen.findByText(/no alcanzó a nadie/i)).toBeTruthy()
    expect(loQueSeLee()).not.toMatch(/están en cola/i)
    expect(screen.queryByText('Está calificando')).toBeNull()
  })

  it('la criba que se está esperando no se puede volver a pedir; la otra sí', async () => {
    render(<CalificarLaTanda vacanteId={3} alTerminar={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Criba rápida' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, criba rápida' }))
    await screen.findByText(/se pidió la criba rápida/i)

    // Repetirla reiniciaria la cuenta de vueltas con la pasada anterior viva, y
    // pagaria una segunda llamada al modelo por los mismos currículums.
    expect((screen.getByRole('button', { name: 'Criba rápida' }) as HTMLButtonElement).disabled).toBe(true)
    // Encadenar la fina detrás de la rápida sí es una secuencia normal.
    expect((screen.getByRole('button', { name: 'Criba fina' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('una criba que no encola tampoco dice que se pidió', async () => {
    // Hoy las dos cribas contestan siempre `ENCOLADA`, pero la comprobación es
    // la misma y vive en el mismo sitio: el fallo que se arregló aquí fue dar
    // por hecho lo que el servidor no había dicho.
    rapida.mockResolvedValue({ estado: 'SIN_CAMBIOS', candidatos: 0, mensaje: 'Ya está todo.' })
    render(<CalificarLaTanda vacanteId={3} alTerminar={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Criba rápida' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, criba rápida' }))

    expect(await screen.findByText(/no se encoló nada/i)).toBeTruthy()
    expect(screen.getByText(/ya está todo/i)).toBeTruthy()
    expect(loQueSeLee()).not.toMatch(/se pidió/i)
    expect(screen.queryByText('Está calificando')).toBeNull()
  })

  it('un 403 habla del permiso y no ofrece reintentar', async () => {
    rapida.mockRejectedValue(new ErrorApi(403, 'Forbidden', null))
    render(<CalificarLaTanda vacanteId={3} alTerminar={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Criba rápida' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, criba rápida' }))

    expect(await screen.findByText(/ajustar nota/i)).toBeTruthy()
    expect(loQueSeLee()).not.toMatch(/vuelve a intentarlo/i)
    // No es una avería, así que no se anuncia como tal.
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('un 500 dice que no quedó nada en cola y que se reintente', async () => {
    rapida.mockRejectedValue(new ErrorApi(500, 'Internal Server Error', null))
    render(<CalificarLaTanda vacanteId={3} alTerminar={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Criba rápida' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, criba rápida' }))

    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toMatch(/error 500/i)
    // Lo que distingue este caso del 403: aquí no hay nada esperando y sí hay
    // algo que hacer. Sin decirlo, quien mira no sabe si esperar o repetir.
    expect(aviso.textContent).toMatch(/no quedó nada en cola/i)
    expect(aviso.textContent).toMatch(/vuelve a intentarlo/i)
    expect(aviso.textContent).not.toMatch(/permiso/i)
  })

  it('el botón vuelve a estar pulsable tras un fallo', async () => {
    rapida.mockRejectedValue(new ErrorApi(500, 'Internal Server Error', null))
    render(<CalificarLaTanda vacanteId={3} alTerminar={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Criba rápida' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, criba rápida' }))
    await screen.findByRole('alert')

    const boton = screen.getByRole('button', { name: 'Criba rápida' }) as HTMLButtonElement
    expect(boton.disabled).toBe(false)
  })
})
