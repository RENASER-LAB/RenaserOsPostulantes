/**
 * Lo que compila perfectamente estando mal al descartar a un candidato.
 *
 *   0. **Descartar sin motivo.** Es el fallo que este archivo persigue primero,
 *      porque no se ve: el backend lo rechaza con un 400 y la pantalla no lo
 *      habia evitado, asi que quien descarta cree que lo hizo y la persona
 *      sigue en el proceso. El motivo es ademas lo unico que explica dentro de
 *      seis meses por que se cerro una postulacion.
 *   1. **Ensenar el boton a quien no tiene `mover_postulacion`.** El panel no
 *      sabe que permisos trae la sesion por ningun otro medio; sin el booleano
 *      de la ficha, el boton sale para todo el mundo y la mitad del equipo
 *      descubre su rol chocando contra un 403.
 *   2. **Ofrecerlo sobre una postulacion ya cerrada.** De un estado final no se
 *      sale: el control solo puede fallar, y ademas lo hace despues de haber
 *      escrito el motivo.
 *   3. **Mandar a `CERRADA` en vez de a `NO_CONTINUA`.** Los dos son finales y
 *      el compilador no distingue una cadena de otra, pero cierran cosas
 *      distintas —uno es el retiro administrativo, otro la empresa diciendo que
 *      no sigue— y disparan correos distintos al candidato.
 *   4. **Callar que sale un correo.** Es lo que separa «cambio un estado» de
 *      «le dije a una persona que no sigue», y no se puede recoger.
 *   5. **Leer el 404 como «esa ficha no existe».** El alcance se guarda POR
 *      permiso, asi que un rol puede abrir cualquier ficha y mover solo las de
 *      sus vacantes; el backend contesta 404 y no 403 a proposito, y sin
 *      traducirlo sale «No encontramos eso» sobre una ficha que se esta mirando.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { DescartarPostulacion } from './DescartarPostulacion'

const mover = vi.fn()

/*
  ⚠️ **El doble tiene que reenviar TODOS los argumentos.** Se quedó en tres
  cuando `transicionar` ya recibía cuatro, y el espía veía un `avisar` que nunca
  llegaba: un test sobre la casilla habría fallado sin que el componente tuviera
  nada malo, y —peor— uno escrito laxo habría pasado con el componente roto.
*/
vi.mock('../api/panel', () => ({
  transicionar: (postulacionId: number, estadoDestino: string, motivo: string, avisar: boolean) =>
    mover(postulacionId, estadoDestino, motivo, avisar),
}))

/*
  ⚠️ **`yaTermino` NO se desestructura con un valor por defecto.** Un default de
  desestructuracion se aplica cuando el valor es `undefined`, asi que
  `montar({ yaTermino: undefined })` —el caso «todavia no se sabe», que es justo
  el que hay que probar— se convertiria en `false` antes de llegar al componente,
  y el test pasaria por la razon contraria a la que dice.
*/
function montar(
  opciones: {
    yaTermino?: boolean | undefined
    puedeMover?: boolean
    alDescartar?: () => void
  } = {},
) {
  const yaTermino = 'yaTermino' in opciones ? opciones.yaTermino : false
  const { puedeMover = true, alDescartar = () => {} } = opciones
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <DescartarPostulacion
        postulacionId={31}
        candidato="Ana Ruiz"
        yaTermino={yaTermino}
        puedeMover={puedeMover}
        alDescartar={alDescartar}
      />
    </QueryClientProvider>,
  )
}

/** Abre el modal, que es donde vive todo lo demas. */
function abrir() {
  fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
}

/** El recorrido entero: abrir, escribir el motivo y confirmar. */
async function descartarCon(motivo: string) {
  montar()
  abrir()
  fireEvent.change(screen.getByLabelText(/Por qué no continúa/), { target: { value: motivo } })
  fireEvent.click(screen.getByRole('button', { name: 'Descartar y avisarle' }))
}

beforeEach(() => {
  mover.mockReset()
  mover.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('quien puede ver el botón', () => {
  it('sin «mover_postulacion» no se pinta nada', () => {
    // Y nada es nada: ni el botón ni una explicación del permiso que falta. La
    // ficha se abre sobre todo para leer, y un aviso de permiso en cada una es
    // ruido permanente para quien nunca va a descartar a nadie.
    montar({ puedeMover: false })
    expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull()
    expect(screen.queryByText(/ya terminó su recorrido/)).toBeNull()
  })

  it('sobre una postulación ya cerrada lo dice, en vez de esconderlo sin más', () => {
    // El botón desaparece igual —el backend lo rechazaría—, pero callar deja
    // pensando si es que falta un permiso. Una línea cierra la pregunta.
    montar({ yaTermino: true })
    expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull()
    expect(screen.getByText(/ya terminó su recorrido/)).toBeTruthy()
  })

  it('con el permiso y en carrera, se ofrece', () => {
    montar()
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeTruthy()
  })
})

describe('el motivo', () => {
  it('sin motivo no se llama al servidor, y se dice por qué', async () => {
    // ⚠️ El fallo que este test persigue: el backend lo rechaza con un 400 y,
    // sin esta comprobación, quien descarta se queda creyendo que lo hizo.
    montar()
    abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Descartar y avisarle' }))

    expect(await screen.findByText(/Escribe por qué no continúa/)).toBeTruthy()
    expect(mover).not.toHaveBeenCalled()
  })

  it('en blancos tampoco cuenta como motivo', async () => {
    // El `@NotBlank` del backend y el `CHECK` de la base miran lo mismo: una
    // cadena de espacios pasa un `required` del navegador y no pasa allí.
    montar()
    abrir()
    fireEvent.change(screen.getByLabelText(/Por qué no continúa/), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Descartar y avisarle' }))

    expect(await screen.findByText(/Escribe por qué no continúa/)).toBeTruthy()
    expect(mover).not.toHaveBeenCalled()
  })

  it('se manda recortado, a NO_CONTINUA, y solo entonces se refresca la ficha', async () => {
    // El estado destino va en el test a propósito: `CERRADA` compilaría igual y
    // cierra otra cosa —el retiro administrativo— con otro correo al candidato.
    const alDescartar = vi.fn()
    montar({ alDescartar })
    abrir()
    fireEvent.change(screen.getByLabelText(/Por qué no continúa/), {
      target: { value: '  No cumple el requisito de colegiatura.  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Descartar y avisarle' }))

    await waitFor(() =>
      expect(mover).toHaveBeenCalledWith(31, 'NO_CONTINUA', 'No cumple el requisito de colegiatura.', true),
    )
    await waitFor(() => expect(alDescartar).toHaveBeenCalled())
  })
})

describe('lo que se dice antes de pulsar', () => {
  it('el correo al candidato se avisa con su nombre, y antes del campo', () => {
    // ⚠️ Esto manda una carta de rechazo a una persona real. Decirlo después
    // sería decirlo cuando ya salió.
    montar()
    abrir()
    const aviso = screen.getByText(/le llega un correo/)
    expect(aviso.textContent).toContain('Ana Ruiz')

    // Y el modal nombra a quien se descarta: «este candidato» no confirma nada
    // cuando se abren cinco fichas seguidas.
    expect(screen.getByRole('dialog', { name: 'Descartar a Ana Ruiz' })).toBeTruthy()
  })

  it('el campo dice que el motivo no se lo mandamos al candidato', () => {
    // La suposición contraria es fácil y cara: alguien redacta una devolución
    // personal creyendo que la lee quien la merece, y acaba solo en la
    // auditoría.
    montar()
    abrir()
    expect(screen.getByText(/no el candidato/)).toBeTruthy()
  })
})

describe('cuando el servidor dice que no', () => {
  it('un 403 se explica como el permiso que es, no como un fallo', async () => {
    // El permiso puede cambiar entre que se abre la ficha y se pulsa, así que
    // el booleano de la ficha no sustituye a traducir el 403.
    mover.mockRejectedValue(new ErrorApi(403, 'Prohibido'))
    montar()
    abrir()
    fireEvent.change(screen.getByLabelText(/Por qué no continúa/), {
      target: { value: 'No sigue.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Descartar y avisarle' }))

    expect(await screen.findByText(/mover_postulacion/)).toBeTruthy()
  })

  it('un 404 se explica como el alcance del rol, no como una ficha que no existe', async () => {
    // ⚠️ El alcance se guarda POR permiso: un rol puede abrir la ficha de
    // cualquiera y mover solo las de sus vacantes. El backend contesta 404 y no
    // 403 a propósito —un 403 confirmaría que esa postulación existe—, así que
    // sin esta rama el mensaje sería «No encontramos eso, o no es tuyo» sobre
    // una ficha que se está mirando.
    mover.mockRejectedValue(new ErrorApi(404, 'No encontramos eso, o no es tuyo.'))
    await descartarCon('No sigue.')

    expect(await screen.findByText(/queda fuera de lo que tu rol puede mover/)).toBeTruthy()
    expect(screen.queryByText(/No encontramos eso/)).toBeNull()
  })

  it('un 409 dice que ya terminó, y que hay que recargar para ver cómo', async () => {
    // Pasa cuando alguien más la cerró entre que se abrió la ficha y se pulsó.
    mover.mockRejectedValue(new ErrorApi(409, 'Ya terminó'))
    await descartarCon('No sigue.')

    expect(await screen.findByText(/ya terminó su recorrido/)).toBeTruthy()
  })

  it('lo que no es un ErrorApi sale con su propio mensaje, no en blanco', async () => {
    // La red caída no es una respuesta del servidor. Sin la rama de reserva, el
    // modal se quedaba igual que antes de pulsar: parece que no pasó nada.
    mover.mockRejectedValue(new Error('Failed to fetch'))
    await descartarCon('No sigue.')

    expect(await screen.findByText('Failed to fetch')).toBeTruthy()
  })

  it('un 500 dice también que al candidato no le llegó nada', async () => {
    // Es la única duda que importa cuando falla: si la carta salió o no.
    mover.mockRejectedValue(new ErrorApi(500, 'Reventó'))
    montar()
    abrir()
    fireEvent.change(screen.getByLabelText(/Por qué no continúa/), {
      target: { value: 'No sigue.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Descartar y avisarle' }))

    expect(await screen.findByText(/no le llegó nada/)).toBeTruthy()
    // Y el modal sigue abierto: cerrarlo al fallar deja creyendo que funcionó.
    expect(screen.getByRole('dialog', { name: 'Descartar a Ana Ruiz' })).toBeTruthy()
  })
})

describe('lo que no se puede perder por el camino', () => {
  it('mientras la petición vuela, el modal no se deja cerrar por ninguna de las tres salidas', async () => {
    // ⚠️ **Es lo que separa «no salió» de «no me enteré».** Esta llamada tarda
    // —el correo va dentro de la misma transacción—, y quien se impacienta y
    // cierra deja el modal desmontado: el fallo que llega después se escribe en
    // algo que ya no se pinta, y un descarte que rebotó se ve igual que uno que
    // salió.
    let rechazar: (causa: unknown) => void = () => {}
    mover.mockReturnValue(new Promise((_, no) => { rechazar = no }))
    await descartarCon('No sigue.')

    const modal = () => screen.queryByRole('dialog', { name: 'Descartar a Ana Ruiz' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Descartando…' })).toBeTruthy())

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(modal()).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(modal()).toBeTruthy()

    // Y cuando por fin falla, el fallo se lee: es el sitio donde tenía que salir.
    rechazar(new ErrorApi(500, 'Reventó'))
    expect(await screen.findByText(/no le llegó nada/)).toBeTruthy()
  })

  it('descartar bien deja dicho que salió, y no solo un modal que se cierra', async () => {
    // Sin esta señal, el éxito y el fallo silencioso se veían igual desde fuera.
    await descartarCon('No sigue.')

    expect((await screen.findByRole('status')).textContent).toMatch(/ya le salió el correo/)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('un fallo de un intento no ensucia el siguiente', async () => {
    mover.mockRejectedValueOnce(new ErrorApi(500, 'Reventó'))
    await descartarCon('No sigue.')
    expect(await screen.findByText(/no le llegó nada/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))

    expect(screen.queryByText(/no le llegó nada/)).toBeNull()
    expect((screen.getByLabelText(/Por qué no continúa/) as HTMLTextAreaElement).value).toBe('')
  })

  it('el error de validación se va al empezar a escribir, no al volver a pulsar', async () => {
    // Un campo en rojo mientras se escribe la respuesta buena dice que lo que se
    // está escribiendo tampoco vale.
    montar()
    abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Descartar y avisarle' }))
    expect(await screen.findByText(/Escribe por qué no continúa/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/Por qué no continúa/), { target: { value: 'N' } })
    expect(screen.queryByText(/Escribe por qué no continúa/)).toBeNull()
  })
})

describe('mientras no se sabe si está cerrada', () => {
  it('sin catálogo no se ofrece descartar, y tampoco se dice que ya terminó', () => {
    // ⚠️ `undefined` NO es `false`. El catálogo y la ficha son dos consultas en
    // paralelo: dando por «no terminada» la que aún no se sabe, el botón sale
    // sobre alguien ya cerrado, promete un correo y el backend contesta 409.
    // Ante la duda no se ofrece nada, que es el fallo seguro.
    montar({ yaTermino: undefined })
    expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull()
    expect(screen.queryByText(/ya terminó su recorrido/)).toBeNull()
  })
})

describe('avisar o no al candidato', () => {
  it('nace avisando: callar tiene que ser una decisión, no un descuido', async () => {
    await descartarCon('No sigue.')
    await waitFor(() => expect(mover).toHaveBeenCalledWith(31, 'NO_CONTINUA', 'No sigue.', true))
  })

  it('quitando la casilla no sale el correo, y el botón lo dice antes de pulsarlo', async () => {
    montar()
    abrir()
    fireEvent.click(screen.getByRole('checkbox', { name: /Avisar a Ana Ruiz/ }))

    // El nombre del botón cambia con la casilla: «Descartar y avisarle» mientras
    // no va a avisar sería el botón mintiendo sobre lo que hace.
    expect(screen.getByRole('button', { name: 'Descartar sin avisar' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/Por qué no continúa/), {
      target: { value: 'Ya se lo dijimos en la entrevista.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Descartar sin avisar' }))

    await waitFor(() =>
      expect(mover).toHaveBeenCalledWith(31, 'NO_CONTINUA', 'Ya se lo dijimos en la entrevista.', false),
    )
  })

  it('el aviso de arriba deja de prometer un correo en cuanto se quita la casilla', () => {
    // ⚠️ Un texto que sigue diciendo «le llega un correo» mientras la casilla
    // dice lo contrario es peor que no decir nada.
    montar()
    abrir()
    expect(screen.getByText(/le llega un correo/)).toBeTruthy()

    fireEvent.click(screen.getByRole('checkbox', { name: /Avisar a Ana Ruiz/ }))
    expect(screen.queryByText(/le llega un correo/)).toBeNull()
    expect(screen.getByText(/no le va a llegar nada/i)).toBeTruthy()
  })

  it('y al terminar, lo que se dice es lo que pasó', async () => {
    montar()
    abrir()
    fireEvent.click(screen.getByRole('checkbox', { name: /Avisar a Ana Ruiz/ }))
    fireEvent.change(screen.getByLabelText(/Por qué no continúa/), { target: { value: 'Ya hablamos.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Descartar sin avisar' }))

    const dicho = await screen.findByRole('status')
    expect(dicho.textContent).toMatch(/sin avisar/)
    expect(dicho.textContent).not.toMatch(/le salió el correo/)
  })

  it('el «sin avisar» no se arrastra a la siguiente ficha que se abra', async () => {
    montar()
    abrir()
    fireEvent.click(screen.getByRole('checkbox', { name: /Avisar a Ana Ruiz/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    abrir()
    expect(
      (screen.getByRole('checkbox', { name: /Avisar a Ana Ruiz/ }) as HTMLInputElement).checked,
    ).toBe(true)
  })
})

