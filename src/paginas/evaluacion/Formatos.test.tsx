/**
 * Que cada formato mande **exactamente** lo que el backend acepta.
 *
 * Esto no se puede comprobar mirando la pantalla. Los seis formatos nuevos
 * viajan en un campo `detalle` cuya forma depende del tipo de la pregunta, y el
 * backend la revisa item por item (`ValidadorDetalleV3`). Una clave de mas, un
 * id que no es de esa pregunta o media respuesta y contesta 400: el candidato
 * ve un error que no puede arreglar, porque el fallo no esta en lo que
 * respondio sino en como se lo mandamos.
 *
 * Por eso lo que se prueba aqui es el cuerpo del PUT, no los pixeles. Y la otra
 * mitad: que **no salga nada** mientras el formato este a medias.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type {
  EvaluacionCandidato,
  PreguntaEvaluacion,
  ResponderEvaluacion,
} from '@/api/tipos'
import { ProveedorAvisos } from '@/ui/Avisos'
import { Evaluacion } from './Evaluacion'

// ---------- El servidor de mentira ----------

/** Todo lo que salio hacia el servidor, en orden. */
let enviado: ResponderEvaluacion[]
/** La pregunta que se esta probando. Una sola: no hace falta navegar. */
let laPregunta: PreguntaEvaluacion

function evaluacionActual(): EvaluacionCandidato {
  return {
    id: 1,
    estado: 'EN_CURSO',
    venceEn: null,
    iniciadaEn: '2026-08-20T10:00:00Z',
    terminadaEn: null,
    minutosObjetivo: 45,
    total: 1,
    respondidas: 0,
    preguntas: [laPregunta],
  }
}

vi.mock('@/api/evaluacion', () => ({
  verEvaluacion: vi.fn(async () => evaluacionActual()),
  iniciarEvaluacion: vi.fn(async () => evaluacionActual()),
  responderEvaluacion: vi.fn(
    async (_uuid: string, _preguntaId: number, cuerpo: ResponderEvaluacion) => {
      enviado.push(cuerpo)
    },
  ),
  entregarEvaluacion: vi.fn(async () => ({ estado: 'ENTREGADA', respondidas: 1, total: 1 })),
}))

// ---------- Montaje ----------

/** Una pregunta con lo minimo, para no repetir ocho veces los mismos nulos. */
function pregunta(tipo: string, extra: Partial<PreguntaEvaluacion> = {}): PreguntaEvaluacion {
  return {
    id: 7,
    posicion: 1,
    tipo,
    enunciado: `Enunciado de ${tipo}`,
    situacion: null,
    opciones: null,
    respuestaTexto: null,
    respuestaOpcionId: null,
    ...extra,
  }
}

const CUATRO = [
  { id: 11, letra: 'a', texto: 'Aviso antes de mover nada' },
  { id: 12, letra: 'b', texto: 'Arreglo primero y aviso después' },
  { id: 13, letra: 'c', texto: 'Espero instrucciones' },
  { id: 14, letra: 'd', texto: 'Busco a quien lo escribió' },
]

async function montar(p: PreguntaEvaluacion) {
  laPregunta = p
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={datos}>
      <ProveedorAvisos>
        <MemoryRouter initialEntries={['/procesos/x1/evaluacion']}>
          <Routes>
            <Route path="/procesos/:uuid/evaluacion" element={<Evaluacion />} />
          </Routes>
        </MemoryRouter>
      </ProveedorAvisos>
    </QueryClientProvider>,
  )
  await screen.findByText(p.enunciado)
}

/** El ultimo detalle que salio hacia el servidor. */
const ultimoDetalle = () => enviado[enviado.length - 1]?.detalle

afterEach(cleanup)

beforeEach(() => {
  enviado = []
  vi.clearAllMocks()
})

// ---------- Las pruebas ----------

describe('EF-4', () => {
  it('manda «mas» y «menos», y no antes de tener las dos', async () => {
    await montar(pregunta('EF-4', { opciones: CUATRO }))

    fireEvent.click(screen.getByRole('radio', { name: 'La que más: Aviso antes de mover nada' }))
    // Con una sola marcada la respuesta esta a medias: el backend la rechazaria.
    expect(enviado).toHaveLength(0)
    expect(screen.getByText(/Te falta marcar la que menos/)).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: 'La que menos: Espero instrucciones' }))
    await waitFor(() => expect(ultimoDetalle()).toEqual({ mas: 11, menos: 13 }))
  })

  it('no deja que la misma sea la que mas y la que menos', async () => {
    await montar(pregunta('EF-4', { opciones: CUATRO }))

    fireEvent.click(screen.getByRole('radio', { name: 'La que más: Aviso antes de mover nada' }))
    fireEvent.click(screen.getByRole('radio', { name: 'La que menos: Espero instrucciones' }))
    await waitFor(() => expect(enviado).toHaveLength(1))

    // Marcar como «la que menos» la que ya era «la que mas» suelta la otra en
    // vez de mandar las dos iguales, que es un 400 seguro.
    fireEvent.click(screen.getByRole('radio', { name: 'La que menos: Aviso antes de mover nada' }))
    expect(enviado).toHaveLength(1)
    expect(screen.getByText(/Te falta marcar la que más/)).toBeTruthy()
  })
})

describe('SJT-R', () => {
  it('no manda nada hasta que estan calificadas todas', async () => {
    await montar(pregunta('SJT-R', { opciones: CUATRO.slice(0, 2) }))

    fireEvent.click(screen.getAllByRole('radio', { name: '5, Lo mejor que se puede hacer' })[0]!)
    expect(enviado).toHaveLength(0)
    expect(screen.getByText(/Te falta calificar una opción/)).toBeTruthy()

    fireEvent.click(screen.getAllByRole('radio', { name: '2, Poco apropiada' })[1]!)
    await waitFor(() =>
      expect(ultimoDetalle()).toEqual({ calificaciones: { '11': 5, '12': 2 } }),
    )
  })
})

describe('SEC', () => {
  it('manda todos los pasos en el orden elegido', async () => {
    await montar(pregunta('SEC', { opciones: CUATRO }))

    fireEvent.click(screen.getByRole('button', { name: 'Bajar: Aviso antes de mover nada' }))

    await waitFor(() => expect(ultimoDetalle()).toEqual({ orden: [12, 11, 13, 14] }))
  })

  it('deja confirmar el orden que ya venia, sin moverlo', async () => {
    await montar(pregunta('SEC', { opciones: CUATRO }))

    // Sin este boton, estar de acuerdo con el orden de salida seria lo mismo
    // que no responder.
    fireEvent.click(screen.getByRole('button', { name: 'Este orden es el mío' }))

    await waitFor(() => expect(ultimoDetalle()).toEqual({ orden: [11, 12, 13, 14] }))
  })
})

describe('INV y DE', () => {
  it('manda las marcadas', async () => {
    await montar(pregunta('INV', { opciones: CUATRO }))

    fireEvent.click(screen.getByRole('checkbox', { name: 'a. Aviso antes de mover nada' }))
    await waitFor(() => expect(ultimoDetalle()).toEqual({ marcadas: [11] }))

    fireEvent.click(screen.getByRole('checkbox', { name: 'c. Espero instrucciones' }))
    await waitFor(() => expect(ultimoDetalle()).toEqual({ marcadas: [11, 13] }))
  })

  it('«no reconozco ninguna» es una respuesta, no un hueco', async () => {
    await montar(pregunta('INV', { opciones: CUATRO }))

    fireEvent.click(screen.getByRole('checkbox', { name: 'No reconozco ninguna de estas' }))

    // Lista vacia, que el validador acepta: reconocer que no se conoce algo es
    // justo lo que este formato quiere poder medir.
    await waitFor(() => expect(ultimoDetalle()).toEqual({ marcadas: [] }))
  })

  it('en un DE la última casilla habla de errores, no de herramientas', async () => {
    await montar(pregunta('DE', { opciones: CUATRO }))
    expect(screen.getByRole('checkbox', { name: 'No encuentro ningún error' })).toBeTruthy()
  })
})

describe('CD', () => {
  it('espera a que estén todos los campos', async () => {
    await montar(pregunta('CD', { casosPedidos: 2 }))

    fireEvent.change(screen.getByLabelText('Campo 1 de 2'), { target: { value: '120 horas' } })
    expect(enviado).toHaveLength(0)
    expect(screen.getByText(/Te falta un campo por llenar/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Campo 2 de 2'), { target: { value: '3 personas' } })

    // Los campos de escribir esperan a que pare la mano, como el resto del
    // portal, asi que este tarda mas que los de marcar.
    await waitFor(
      () => expect(ultimoDetalle()).toEqual({ campos: { '1': '120 horas', '2': '3 personas' } }),
      { timeout: 3000 },
    )
  })

  it('cuando el backend manda «casosPedidos», pinta esos campos', async () => {
    // O03 en la base real pide 6. Antes el portal no tenia de donde sacarlo.
    await montar(pregunta('CD', { casosPedidos: 6, enunciado: 'Tu tarea principal.' }))
    expect(screen.getByLabelText('Campo 1 de 6')).toBeTruthy()
    expect(screen.getByLabelText('Campo 6 de 6')).toBeTruthy()
  })

  it('si «casosPedidos» no llega, se saca del «(N campos)» del enunciado', async () => {
    // El escalon que no depende del servidor: el numero esta en el texto que el
    // candidato ya esta leyendo.
    await montar(pregunta('CD', { enunciado: 'Un problema con un compañero. (4 campos)' }))
    expect(screen.getByLabelText('Campo 1 de 4')).toBeTruthy()
    expect(screen.getByLabelText('Campo 4 de 4')).toBeTruthy()
    expect(screen.queryByLabelText('Campo 5 de 4')).toBeNull()
  })
})

// ---------- V ----------

/** O01 tal como esta hoy en la base, pero entero. Tres datos en un enunciado. */
const V_EXPERIENCIA =
  'Años haciendo este trabajo: ___ · En cuántas empresas: ___ ·'
  + ' Nombre exacto de tu último puesto: (texto ≤ 40 car.)'

describe('V · el enunciado se parte en los datos que pide', () => {
  it('cada dato tiene su casilla y su etiqueta, no un cuadro para todo', async () => {
    // Esta es la queja que abrio todo: un solo cuadro de texto para tres datos
    // distintos, donde «Años» aceptaba cualquier cosa.
    await montar(pregunta('V', { enunciado: V_EXPERIENCIA }))

    expect(screen.getByLabelText('Años haciendo este trabajo')).toBeTruthy()
    expect(screen.getByLabelText('En cuántas empresas')).toBeTruthy()
    expect(screen.getByLabelText('Nombre exacto de tu último puesto')).toBeTruthy()
    // El cuadro unico de antes ya no existe.
    expect(screen.queryByLabelText('Tu respuesta')).toBeNull()
  })

  it('el que pide una cantidad no deja escribir letras', async () => {
    await montar(pregunta('V', { enunciado: V_EXPERIENCIA }))

    const anos = screen.getByLabelText('Años haciendo este trabajo') as HTMLInputElement
    fireEvent.change(anos, { target: { value: 'Ricardo' } })
    expect(anos.value).toBe('')

    fireEvent.change(anos, { target: { value: '5 años' } })
    expect(anos.value).toBe('5')

    // El teclado del telefono tiene que salir con numeros, no con letras.
    expect(anos.getAttribute('inputMode')).toBe('numeric')
  })

  it('el que pide texto sigue aceptando texto', async () => {
    await montar(pregunta('V', { enunciado: V_EXPERIENCIA }))

    const puesto = screen.getByLabelText('Nombre exacto de tu último puesto') as HTMLInputElement
    fireEvent.change(puesto, { target: { value: 'Operario de planta' } })
    expect(puesto.value).toBe('Operario de planta')
    // «(texto ≤ 40 car.)» es un tope de verdad, no un adorno del enunciado.
    expect(puesto.maxLength).toBe(40)
  })

  it('las opciones entre paréntesis son un desplegable, no un texto libre', async () => {
    // O32. Una lista se elige, y en el telefono eso es mas rapido que escribir
    // «esporádica» con tilde y sin erratas.
    await montar(
      pregunta('V', {
        enunciado:
          'Actividad física: (nunca / esporádica / 1–2 por semana / 3–4 / diaria)'
          + ' · Años sosteniéndola: ___',
      }),
    )

    const lista = screen.getByLabelText('Actividad física') as HTMLSelectElement
    expect(lista.tagName).toBe('SELECT')
    expect([...lista.options].map((o) => o.value)).toEqual([
      '', 'nunca', 'esporádica', '1–2 por semana', '3–4', 'diaria',
    ])
    expect(screen.getByLabelText('Años sosteniéndola')).toBeTruthy()
  })

  it('no se manda a medias, y al completarlo va todo junto en «texto»', async () => {
    await montar(pregunta('V', { enunciado: V_EXPERIENCIA }))

    fireEvent.change(screen.getByLabelText('Años haciendo este trabajo'), {
      target: { value: '5' },
    })
    fireEvent.change(screen.getByLabelText('En cuántas empresas'), { target: { value: '2' } })
    expect(screen.getByText(/Te falta un dato por llenar/)).toBeTruthy()
    expect(enviado).toHaveLength(0)

    fireEvent.change(screen.getByLabelText('Nombre exacto de tu último puesto'), {
      target: { value: 'Operario de planta' },
    })

    // El contrato no cambia: sigue viajando en `texto`, con la etiqueta de cada
    // dato delante para que quien lo lea despues sepa que contesto a que.
    await waitFor(
      () =>
        expect(enviado[enviado.length - 1]?.texto).toBe(
          'Años haciendo este trabajo: 5 · En cuántas empresas: 2'
          + ' · Nombre exacto de tu último puesto: Operario de planta',
        ),
      { timeout: 3000 },
    )
    expect(enviado[enviado.length - 1]?.detalle).toBeUndefined()
  })

  it('al volver a entrar, cada dato vuelve a su casilla', async () => {
    await montar(
      pregunta('V', {
        enunciado: V_EXPERIENCIA,
        respuestaTexto:
          'Años haciendo este trabajo: 5 · En cuántas empresas: 2'
          + ' · Nombre exacto de tu último puesto: Operario de planta',
      }),
    )

    expect((screen.getByLabelText('Años haciendo este trabajo') as HTMLInputElement).value)
      .toBe('5')
    expect((screen.getByLabelText('En cuántas empresas') as HTMLInputElement).value).toBe('2')
    expect((screen.getByLabelText('Nombre exacto de tu último puesto') as HTMLInputElement).value)
      .toBe('Operario de planta')
    expect(screen.getByText('Respuesta guardada')).toBeTruthy()
    // Repintar no es responder otra vez.
    expect(enviado).toHaveLength(0)
  })

  it('un trozo cortado a media frase no bloquea la entrega', async () => {
    // En la base hay enunciados truncados —«... · Nombre exacto de»—. Ese trozo
    // no se puede contestar, asi que se pide pero no se exige: si se exigiera,
    // el candidato se quedaria sin poder entregar por algo que no es suyo.
    await montar(
      pregunta('V', {
        enunciado: 'Años haciendo este trabajo: ___ · Nombre exacto de',
      }),
    )

    fireEvent.change(screen.getByLabelText('Años haciendo este trabajo'), {
      target: { value: '5' },
    })

    await waitFor(
      () => expect(enviado[enviado.length - 1]?.texto).toBe('Años haciendo este trabajo: 5'),
      { timeout: 3000 },
    )
  })
})

describe('al volver a entrar', () => {
  it('repinta lo que ya estaba respondido', async () => {
    // El examen son 190 preguntas: nadie lo hace de una sentada. Si al recargar
    // no se repinta, el candidato no sabe cuales ya contesto.
    await montar(
      pregunta('EF-4', { opciones: CUATRO, respuestaDetalle: { mas: 12, menos: 14 } }),
    )

    const mas = screen.getByRole('radio', {
      name: 'La que más: Arreglo primero y aviso después',
    }) as HTMLInputElement
    const menos = screen.getByRole('radio', {
      name: 'La que menos: Busco a quien lo escribió',
    }) as HTMLInputElement

    expect(mas.checked).toBe(true)
    expect(menos.checked).toBe(true)
    expect(screen.getByText('Respuesta guardada')).toBeTruthy()
    // Repintar no es responder otra vez: nada tuvo que salir hacia el servidor.
    expect(enviado).toHaveLength(0)
  })

  it('aguanta que el backend todavía no mande el detalle guardado', async () => {
    // `respuestaDetalle` es opcional a proposito. Sin el, la pantalla no
    // recuerda, pero tiene que seguir dejando responder.
    await montar(pregunta('SEC', { opciones: CUATRO }))

    expect(screen.getByText('Sin responder')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Bajar: Aviso antes de mover nada' }))
    await waitFor(() => expect(ultimoDetalle()).toEqual({ orden: [12, 11, 13, 14] }))
  })
})
