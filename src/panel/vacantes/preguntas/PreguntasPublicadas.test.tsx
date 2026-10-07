/**
 * Las preguntas publicadas con gente dentro (AC-29): cambiar las instrucciones
 * de la IA sin saldo, o con la IA apagada, abre la ventana «sin saldo» y no da
 * nada por guardado; y «Reintentar» vuelve a pedir la recalificación.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../../api/cliente'
import type { EditorDePreguntas as Editor, EntregableDeLaVersion, VersionDePreguntas } from '../../api/preguntasPropias'
import { PreguntasPublicadas } from './PreguntasPublicadas'
import { ConModoDelEditor, MODO_PRUEBA } from './modo'
import { VistaDeVersion } from './VistaDeVersion'

const corregir = vi.fn()
const reintentar = vi.fn()
const cambiar = vi.fn()
vi.mock('../../api/preguntasPropias', async (original) => ({
  ...(await original<typeof import('../../api/preguntasPropias')>()),
  corregirInstrucciones: (id: number, datos: unknown) => corregir(id, datos),
  reintentarRecalificacion: (id: number) => reintentar(id),
  cambiarPuntos: (id: number, datos: unknown, ruta?: string) => cambiar(id, datos, ruta),
}))

const publicada: VersionDePreguntas = {
  id: 70,
  estado: 'PUBLICADA',
  guiaCalificacion: 'Premia el dato concreto',
  minutosObjetivo: 25,
  versionGuia: 1,
  total: 100,
  cuantosCriterios: 1,
  cuantasPreguntas: 1,
  criterios: [
    {
      id: 5,
      nombre: 'Contabilidad',
      queEvalua: 'El cierre mensual',
      orden: 1,
      puntos: 100,
      puntosSistema: 0,
      puntosIa: 100,
      preguntas: [
        {
          id: 10,
          tipo: 'ABIERTA',
          enunciado: 'Cuéntanos un cierre con un descuadre',
          puntos: 100,
          criterioId: 5,
          orden: 1,
          queDebeTener: 'El monto y la cuenta',
          opciones: [],
        },
      ],
    },
  ],
  sinCriterio: [],
  avisos: [],
}

const editor = (parte: Partial<Editor> = {}): Editor => ({
  vacanteId: 40,
  titulo: 'Asistente contable',
  nivel: 'EJECUCION',
  origen: 'VACANTE',
  aplicaEvaluacion: true,
  puedeEditar: true,
  hayPostulantes: true,
  borrador: null,
  publicada,
  resumen: { estado: 'PUBLICADAS', puntos: 100, criterios: 1, preguntas: 1 },
  recalificacion: { rindieron: 3, conNota: 3, alDia: 3, recalificando: 0, pendientes: 0, motivos: [] },
  ...parte,
})

function pintar(datos: Editor) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <PreguntasPublicadas editor={datos} publicada={publicada} alCambiar={vi.fn()} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('corregir las instrucciones sin IA (AC-29)', () => {
  const guardarSinSaldo = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Corregir las instrucciones de la IA' }))
    fireEvent.change(screen.getByLabelText(/Guía de calificación para la IA/), {
      target: { value: 'Premia el dato concreto y la fecha' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar las instrucciones' }))
    // Con gente calificada, primero se confirma que se va a recalificar
    expect(screen.getByRole('alertdialog', { name: 'Volver a calificar' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sí, volver a calificar' }))
    return screen.findByRole('dialog')
  }
  const vecesQueDice = (texto: string | null, frase: RegExp) =>
    (texto ?? '').match(new RegExp(frase.source, 'gi'))?.length ?? 0

  it.each([
    ['en el tope de uso', 'La IA no tiene saldo: la empresa llegó a su tope mensual de IA.'],
    ['con la IA apagada', 'La IA está apagada en este sistema: ahora no se puede usar.'],
    ['con la empresa suspendida', 'La empresa está suspendida: la IA no se usa mientras tanto.'],
  ])('%s: se abre la ventana «sin saldo», dice una vez por qué y no se da nada por guardado', async (_caso, motivo) => {
    corregir.mockRejectedValue(
      new ErrorApi(409, `${motivo} No se guardó el cambio: guardarlo sin recalificar dejaría a unos candidatos medidos con una guía y a otros con otra.`),
    )
    pintar(editor())

    const ventana = await guardarSinSaldo()
    expect(within(ventana).getByText('La IA no tiene saldo')).toBeTruthy()
    expect(ventana.textContent).toContain(motivo)
    // QA-PP-09: el mensaje del servidor ya lo explica; la ventana no lo repite.
    expect(vecesQueDice(ventana.textContent, /no se guardó/)).toBe(1)
    expect(vecesQueDice(ventana.textContent, /guardarlo sin recalificar/)).toBe(1)
    expect(corregir).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Instrucciones guardadas/)).toBeNull()
  })

  it('si el servidor solo da el motivo, la ventana explica ella que no se guardó, también una vez', async () => {
    const motivo = 'La IA está apagada en este sistema: ahora no se puede usar.'
    corregir.mockRejectedValue(new ErrorApi(409, motivo))
    pintar(editor())

    const ventana = await guardarSinSaldo()
    expect(ventana.textContent).toContain(motivo)
    expect(within(ventana).getByText(/el cambio no se guardó/)).toBeTruthy()
    expect(vecesQueDice(ventana.textContent, /guardarlo sin recalificar/)).toBe(1)
    expect(screen.queryByText(/Instrucciones guardadas/)).toBeNull()
  })
})

describe('la recalificación detenida', () => {
  it('dice quién quedó pendiente y por qué, y «Reintentar» la vuelve a pedir', async () => {
    reintentar.mockResolvedValue({ personas: 1 })
    pintar(
      editor({
        recalificacion: {
          rindieron: 3,
          conNota: 3,
          alDia: 2,
          recalificando: 0,
          pendientes: 1,
          motivos: ['El proveedor contestó 402: la cuenta no tiene saldo.'],
        },
      }),
    )

    expect(screen.getByText(/Pendiente de recalificar: 1 persona conserva/)).toBeTruthy()
    expect(screen.getByText(/contestó 402/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(reintentar).toHaveBeenCalledWith(40))
    expect(await screen.findByText('Se volvió a pedir la recalificación de 1 persona.')).toBeTruthy()
  })
})

describe('«Reintentar» dice qué pasó (QA-PP-05)', () => {
  const pendiente = editor({
    recalificacion: { rindieron: 3, conNota: 3, alDia: 2, recalificando: 0, pendientes: 1, motivos: ['El proveedor contestó 402.'] },
  })

  it.each([
    ['con la IA apagada', 'La IA está apagada en este sistema: ahora no se puede usar.'],
    ['en el tope de uso', 'La IA no tiene saldo: la empresa llegó a su tope mensual de IA.'],
  ])('%s no dice que no quedaba nadie: dice por qué no se encoló', async (_caso, motivo) => {
    const dicho = `${motivo} No se volvió a pedir la recalificación: 1 persona sigue con la nota de la guía anterior.`
    reintentar.mockResolvedValue({ personas: 0, motivo: dicho })
    pintar(pendiente)

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    const estado = await screen.findByText(dicho)
    expect(estado.getAttribute('role')).toBe('status')
    expect(screen.queryByText('No quedó nadie por volver a encolar.')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('sin motivo y sin nadie encolado, sí dice que no quedaba nadie', async () => {
    reintentar.mockResolvedValue({ personas: 0, motivo: null })
    pintar(pendiente)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No quedó nadie por volver a encolar.')).toBeTruthy()
  })
})

describe('los avisos con una sola persona (QA-PP-06)', () => {
  const una = editor({
    recalificacion: { rindieron: 1, conNota: 1, alDia: 1, recalificando: 0, pendientes: 0, motivos: [] },
  })

  it('cambiar la guía: «a la persona que ya tiene nota», no «a las 1 persona»', () => {
    pintar(una)
    fireEvent.click(screen.getByRole('button', { name: 'Corregir las instrucciones de la IA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar las instrucciones' }))
    const aviso = screen.getByRole('alertdialog', { name: 'Volver a calificar' })
    expect(aviso.textContent).toContain('Se volverá a calificar a la persona que ya tiene nota.')
    expect(aviso.textContent).toContain('Las notas ajustadas a mano no cambian')
    expect(aviso.textContent).not.toMatch(/las 1 /)
  })

  it('cambiar los puntos: «la nota de la persona que ya rindió», no «las 1 persona»', () => {
    pintar(una)
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar los puntos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar los puntos' }))
    const aviso = screen.getByRole('alertdialog', { name: 'Recalcular las notas' })
    expect(aviso.textContent).toBe('Se recalculará la nota de la persona que ya rindió. No se llama a la IA.')
  })

  it('con varias, el plural con su número', () => {
    pintar(editor())
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar los puntos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar los puntos' }))
    expect(screen.getByRole('alertdialog', { name: 'Recalcular las notas' }).textContent).toBe(
      'Se recalcularán las notas de las 3 personas que ya rindieron. No se llama a la IA.',
    )
  })
})

describe('cambiar los puntos de la prueba publicada (V69)', () => {
  // «Contable» vale 100: una cerrada de 60 y 40 de la IA mirando su abierta.
  const prueba: VersionDePreguntas = {
    ...publicada,
    criterios: [
      {
        id: 5,
        nombre: 'Contable',
        queEvalua: null,
        orden: 1,
        puntos: 100,
        puntosSistema: 60,
        puntosIa: 40,
        puntosCalificados: 40,
        calificador: 'IA',
        entregables: [],
        preguntas: [
          {
            id: 10,
            tipo: 'OPCION_UNICA',
            enunciado: '¿Qué libro?',
            puntos: 60,
            criterioId: 5,
            orden: 1,
            queDebeTener: null,
            opciones: [
              { id: 1, texto: 'Diario', puntos: 60, orden: 1 },
              { id: 2, texto: 'Mayor', puntos: 0, orden: 2 },
            ],
          },
          { id: 11, tipo: 'ABIERTA', enunciado: '¿Cómo cuadras?', puntos: 0, criterioId: 5, orden: 2, queDebeTener: null, opciones: [] },
        ],
      },
    ],
  }

  it('se escribe lo que vale el criterio; si baja una cerrada sigue valiendo lo mismo y su parte calificada crece', async () => {
    cambiar.mockResolvedValue({ personas: 3 })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <ConModoDelEditor modo={MODO_PRUEBA}>
          <PreguntasPublicadas editor={editor({ publicada: prueba })} publicada={prueba} alCambiar={vi.fn()} />
        </ConModoDelEditor>
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar los puntos' }))
    const form = screen.getByRole('form', { name: 'Cambiar los puntos' })
    const total = within(form).getByRole('spinbutton', { name: 'Puntos del criterio «Contable»' }) as HTMLInputElement
    expect(total.value).toBe('100')
    // El reparto, con el formato del lápiz y sin selector (AC-03).
    expect(form.textContent).toContain('Cerradas: 60 pts · Abiertas y archivos: 40 pts, los califica la IA')

    // Sus preguntas salen plegadas: se despliega el criterio para cambiarlas.
    fireEvent.click(within(form).getByRole('button', { name: 'Contable' }))
    fireEvent.change(within(form).getByRole('spinbutton', { name: 'Puntos de «¿Qué libro?»' }), { target: { value: '50' } })
    fireEvent.change(within(form).getByRole('spinbutton', { name: 'Puntos de la opción «Diario»' }), { target: { value: '50' } })
    expect(form.textContent).toContain('Cerradas: 50 pts · Abiertas y archivos: 50 pts, los califica la IA')
    expect(form.textContent).toContain('Suma de lo escrito: 100 de 100.')

    fireEvent.change(total, { target: { value: '40' } })
    expect(within(form).getByText('Las cerradas de «Contable» suman 50 y el criterio vale 40.')).toBeTruthy()
    fireEvent.change(total, { target: { value: '50' } })
    expect(form.textContent).toContain('no le queda nada que calificar')

    // Un total que no es un entero de 0 a 100 no se reparte: se dice qué está mal.
    fireEvent.change(total, { target: { value: '150' } })
    expect(within(form).getByText('Los puntos del criterio van de 0 a 100.')).toBeTruthy()
    expect(form.textContent).not.toContain('Abiertas y archivos')
    fireEvent.change(total, { target: { value: '25.5' } })
    expect(within(form).getByText('Los puntos del criterio tienen que ser un número entero, sin decimales.')).toBeTruthy()

    fireEvent.change(total, { target: { value: '100' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar los puntos' }))
    fireEvent.click(within(form).getByRole('button', { name: 'Sí, recalcular a todos' }))
    await waitFor(() =>
      expect(cambiar).toHaveBeenCalledWith(
        40,
        {
          preguntas: [{ id: 10, puntos: 50, opciones: [{ id: 1, puntos: 50 }, { id: 2, puntos: 0 }] }],
          criterios: [{ id: 5, puntos: 100 }],
        },
        'prueba-propia',
      ),
    )
  })

  it('con un total mal escrito no se envía nada: el campo queda señalado y se enfoca (QA-11)', async () => {
    cambiar.mockResolvedValue({ personas: 0 })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <ConModoDelEditor modo={MODO_PRUEBA}>
          <PreguntasPublicadas
            editor={editor({ publicada: prueba, recalificacion: { rindieron: 0, conNota: 0, alDia: 0, recalificando: 0, pendientes: 0, motivos: [] } })}
            publicada={prueba}
            alCambiar={vi.fn()}
          />
        </ConModoDelEditor>
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar los puntos' }))
    const form = screen.getByRole('form', { name: 'Cambiar los puntos' })
    const total = within(form).getByRole('spinbutton', { name: 'Puntos del criterio «Contable»' }) as HTMLInputElement
    const guardar = within(form).getByRole('button', { name: 'Guardar los puntos' })
    expect(total.getAttribute('aria-invalid')).toBeNull()

    for (const malo of ['150', '25.5', '-1', '']) {
      fireEvent.change(total, { target: { value: malo } })
      expect(total.getAttribute('aria-invalid')).toBe('true')
      // Lo describe su propia falta, la misma que se ve bajo el campo.
      const falta = document.getElementById(total.getAttribute('aria-describedby')!)
      expect(falta?.textContent).toMatch(/^(Los puntos del criterio|Faltan los puntos del criterio)/)
      total.blur()
      fireEvent.submit(form)
      expect(document.activeElement).toBe(total)
    }
    expect(form.textContent).not.toMatch(/Los puntos suman/)
    expect(cambiar).not.toHaveBeenCalled()
    // Bien escrito, se envía y deja de estar señalado.
    fireEvent.change(total, { target: { value: '100' } })
    expect(total.getAttribute('aria-invalid')).toBeNull()
    fireEvent.click(guardar)
    await waitFor(() =>
      expect(cambiar).toHaveBeenCalledWith(40, expect.objectContaining({ criterios: [{ id: 5, puntos: 100 }] }), 'prueba-propia'),
    )
    expect(cambiar).toHaveBeenCalledTimes(1)
  })

  it('con gente que ya rindió, un total mal escrito tampoco abre la confirmación (QA-11)', () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <ConModoDelEditor modo={MODO_PRUEBA}>
          <PreguntasPublicadas editor={editor({ publicada: prueba })} publicada={prueba} alCambiar={vi.fn()} />
        </ConModoDelEditor>
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar los puntos' }))
    const form = screen.getByRole('form', { name: 'Cambiar los puntos' })
    const total = within(form).getByRole('spinbutton', { name: 'Puntos del criterio «Contable»' })
    fireEvent.change(total, { target: { value: '150' } })
    fireEvent.submit(form)
    expect(within(form).queryByRole('alertdialog', { name: 'Recalcular las notas' })).toBeNull()
    expect(within(form).getByRole('button', { name: 'Guardar los puntos' })).toBeTruthy()
    expect(cambiar).not.toHaveBeenCalled()
  })
})

describe('la prueba publicada se lee plegada', () => {
  // «Contable» vale 60 (cerrada de 20 + IA 40) y su abierta pide un archivo; «Excel» vale 40 (persona).
  const archivo: EntregableDeLaVersion = {
    id: 90, nombre: 'Flujo.xlsx', detalle: null, formato: 'ARCHIVO', obligatorio: true, queDebeTener: null,
    orden: 1, criterios: [5], alcance: 'PREGUNTA', preguntaId: 11, cubre: null,
  }
  const dos: VersionDePreguntas = {
    ...publicada,
    cuantosCriterios: 2,
    cuantasPreguntas: 3,
    criterios: [
      {
        id: 5, nombre: 'Contable', queEvalua: 'El cierre mensual', orden: 1, puntos: 60, puntosSistema: 20, puntosIa: 40,
        puntosCalificados: 40, calificador: 'IA', entregables: [90],
        preguntas: [
          {
            id: 10, tipo: 'OPCION_UNICA', enunciado: '¿Qué libro?', puntos: 20, criterioId: 5, orden: 1, queDebeTener: null,
            opciones: [{ id: 1, texto: 'Diario', puntos: 20, orden: 1 }, { id: 2, texto: 'Mayor', puntos: 0, orden: 2 }],
          },
          { id: 11, tipo: 'ABIERTA', enunciado: '¿Cómo cuadras?', puntos: 0, criterioId: 5, orden: 2, queDebeTener: 'La cuenta', opciones: [] },
        ],
      },
      {
        id: 6, nombre: 'Excel', queEvalua: null, orden: 2, puntos: 40, puntosSistema: 0, puntosIa: 0,
        puntosCalificados: 40, calificador: 'PERSONA', entregables: [],
        preguntas: [{ id: 12, tipo: 'ABIERTA', enunciado: 'Arma el flujo de caja.', puntos: 0, criterioId: 6, orden: 1, queDebeTener: null, opciones: [] }],
      },
    ],
    prueba: {
      enunciado: null, consigna: null, materiales: null, herramientasPermitidas: null, modalidad: 'CRONOMETRADA',
      duracionMinutos: 60, plazoDias: null, cuestionario: false, entregables: [archivo],
    },
  }
  const nadie = { rindieron: 0, conNota: 0, alDia: 0, recalificando: 0, pendientes: 0, motivos: [] }
  const pintarLaPrueba = (parte: Partial<Editor> = {}) =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <ConModoDelEditor modo={MODO_PRUEBA}>
          <PreguntasPublicadas editor={editor({ publicada: dos, recalificacion: nadie, ...parte })} publicada={dos} alCambiar={vi.fn()} />
        </ConModoDelEditor>
      </QueryClientProvider>,
    )
  const criterio = (nombre: string) => screen.getByRole('region', { name: `Criterio ${nombre}` })
  const desplegado = (nombre: string) =>
    within(criterio(nombre)).getByRole('button', { name: nombre }).getAttribute('aria-expanded') === 'true'
  const linea = (nombre: string) => criterio(nombre).querySelector('header')!.textContent

  const scrollIntoView = Element.prototype.scrollIntoView
  const bajar = vi.fn()
  beforeEach(() => {
    Element.prototype.scrollIntoView = bajar
  })
  afterEach(() => {
    Element.prototype.scrollIntoView = scrollIntoView
  })

  it('al entrar todos están plegados; su línea dice puntos, desglose, preguntas y archivos (AC-15)', () => {
    pintarLaPrueba()
    expect(desplegado('Contable')).toBe(false)
    expect(desplegado('Excel')).toBe(false)
    expect(linea('Contable')).toContain('60 pts (sistema 20 + IA 40)')
    expect(linea('Contable')).toContain('· 2 preguntas · 1 archivo')
    expect(linea('Excel')).toContain('40 pts (persona 40)')
    expect(linea('Excel')).toContain('· 1 pregunta')
    expect(linea('Excel')).not.toContain('archivo')
    expect(screen.queryByText('¿Qué libro?')).toBeNull()
    expect(screen.queryByText('El cierre mensual')).toBeNull()
    // La guía no se pliega.
    expect(screen.getByText('Premia el dato concreto')).toBeTruthy()
  })

  it('«Desplegar todo», «Plegar todo» y cada criterio por su nombre', () => {
    pintarLaPrueba()
    fireEvent.click(screen.getByRole('button', { name: 'Desplegar todo' }))
    expect(desplegado('Contable') && desplegado('Excel')).toBe(true)
    expect(screen.getByText('¿Qué libro?')).toBeTruthy()
    expect(screen.getByText('El cierre mensual')).toBeTruthy()
    expect(screen.getByText('Arma el flujo de caja.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Plegar todo' }))
    expect(desplegado('Contable') || desplegado('Excel')).toBe(false)
    expect(screen.queryByText('Arma el flujo de caja.')).toBeNull()

    fireEvent.click(within(criterio('Excel')).getByRole('button', { name: 'Excel' }))
    expect(desplegado('Excel')).toBe(true)
    expect(desplegado('Contable')).toBe(false)
    expect(screen.getByText('Arma el flujo de caja.')).toBeTruthy()
  })

  it('sin editar_vacante también se pliega y se despliega, y no hay botones que acaben en 403 (AC-23)', () => {
    pintarLaPrueba({ puedeEditar: false })
    expect(screen.queryByRole('button', { name: 'Cambiar los puntos' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Corregir las instrucciones de la IA' })).toBeNull()
    fireEvent.click(within(criterio('Contable')).getByRole('button', { name: 'Contable' }))
    expect(desplegado('Contable')).toBe(true)
    expect(screen.getByText('¿Qué libro?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Plegar todo' }))
    expect(screen.queryByText('¿Qué libro?')).toBeNull()
  })

  it('otra versión vuelve a salir plegada, como al entrar', () => {
    const { rerender } = render(<VistaDeVersion version={dos} />)
    fireEvent.click(screen.getByRole('button', { name: 'Desplegar todo' }))
    expect(desplegado('Contable')).toBe(true)
    rerender(<VistaDeVersion version={{ ...dos, id: 71 }} />)
    expect(desplegado('Contable') || desplegado('Excel')).toBe(false)
  })

  describe('«Cambiar los puntos»', () => {
    const abrirElFormulario = () => {
      pintarLaPrueba()
      fireEvent.click(screen.getByRole('button', { name: 'Cambiar los puntos' }))
      return screen.getByRole('form', { name: 'Cambiar los puntos' })
    }
    const totalDe = (form: HTMLElement, nombre: string) =>
      within(form).getByRole('spinbutton', { name: `Puntos del criterio «${nombre}»` }) as HTMLInputElement

    it('cada criterio es su línea con el total a la vista; sus preguntas, plegadas', () => {
      const form = abrirElFormulario()
      for (const nombre of ['Contable', 'Excel']) {
        expect(criterio(nombre).querySelector('header')!.contains(totalDe(form, nombre))).toBe(true)
        // Con su total al final de la línea, los puntos siguen tras el nombre (AC-12).
        expect(criterio(nombre).querySelector('header')!.className).not.toContain('cabeceraSinBotones')
        expect(desplegado(nombre)).toBe(false)
      }
      expect(form.textContent).toContain('Cerradas: 20 pts · Abiertas y archivos: 40 pts, los califica la IA')
      expect(within(form).queryByRole('spinbutton', { name: 'Puntos de «¿Qué libro?»' })).toBeNull()
      fireEvent.click(within(form).getByRole('button', { name: 'Desplegar todo' }))
      expect(within(form).getByRole('spinbutton', { name: 'Puntos de «¿Qué libro?»' })).toBeTruthy()
    })

    it('un total vacío despliega su criterio, baja a su línea y le da el foco (QA-12)', () => {
      const form = abrirElFormulario()
      const total = totalDe(form, 'Excel')
      fireEvent.change(total, { target: { value: '' } })
      fireEvent.submit(form)
      expect(document.activeElement).toBe(total)
      expect(desplegado('Excel')).toBe(true)
      expect(desplegado('Contable')).toBe(false)
      expect(bajar).toHaveBeenCalledWith({ block: 'start' })
      expect(bajar.mock.contexts.at(-1)).toBe(criterio('Excel'))
      expect(cambiar).not.toHaveBeenCalled()
    })

    it('cuando el navegador frena un total fuera de 0 a 100, se despliegan sus criterios y se baja al primero (QA-12)', () => {
      const form = abrirElFormulario()
      const contable = totalDe(form, 'Contable')
      const excel = totalDe(form, 'Excel')
      fireEvent.change(contable, { target: { value: '150' } })
      fireEvent.change(excel, { target: { value: '-5' } })
      // El navegador avisa a cada campo mal escrito, en orden, y da el foco al primero.
      fireEvent.invalid(contable)
      fireEvent.invalid(excel)
      expect(desplegado('Contable') && desplegado('Excel')).toBe(true)
      expect(bajar).toHaveBeenCalledTimes(1)
      expect(bajar.mock.contexts[0]).toBe(criterio('Contable'))
      expect(document.activeElement).toBe(contable)
      expect(cambiar).not.toHaveBeenCalled()
    })

    it('decimales en una pregunta o una opción plegadas: se despliega su criterio y se lleva a ese campo', () => {
      const form = abrirElFormulario()
      const contable = within(criterio('Contable')).getByRole('button', { name: 'Contable' })
      fireEvent.click(contable)
      fireEvent.change(within(form).getByRole('spinbutton', { name: 'Puntos de «¿Qué libro?»' }), { target: { value: '1.5' } })
      fireEvent.click(contable)
      expect(within(form).queryByRole('spinbutton', { name: 'Puntos de «¿Qué libro?»' })).toBeNull()

      fireEvent.submit(form)
      const pregunta = within(form).getByRole('spinbutton', { name: 'Puntos de «¿Qué libro?»' })
      expect(desplegado('Contable')).toBe(true)
      expect(document.activeElement).toBe(pregunta)
      expect((bajar.mock.contexts.at(-1) as HTMLElement).contains(pregunta)).toBe(true)

      fireEvent.change(pregunta, { target: { value: '20' } })
      fireEvent.change(within(form).getByRole('spinbutton', { name: 'Puntos de la opción «Diario»' }), { target: { value: '2.5' } })
      fireEvent.click(contable)
      fireEvent.submit(form)
      expect(document.activeElement).toBe(within(form).getByRole('spinbutton', { name: 'Puntos de la opción «Diario»' }))
      expect(cambiar).not.toHaveBeenCalled()
    })

    it('un 400 del servidor de una pregunta plegada despliega su criterio y lleva a ella (QA-13)', async () => {
      const falta = 'La pregunta 1 («¿Qué libro?»): alguna opción tiene que dar los 20 puntos de la pregunta.'
      cambiar.mockRejectedValue(new ErrorApi(400, 'Los puntos no se cambiaron: falta una cosa', { faltas: [falta] }))
      const form = abrirElFormulario()
      fireEvent.click(within(form).getByRole('button', { name: 'Guardar los puntos' }))
      const pregunta = await within(form).findByRole('spinbutton', { name: 'Puntos de «¿Qué libro?»' })
      expect(desplegado('Contable')).toBe(true)
      expect(desplegado('Excel')).toBe(false)
      expect(document.activeElement).toBe(pregunta)
      expect((bajar.mock.contexts.at(-1) as HTMLElement).contains(pregunta)).toBe(true)
      expect(document.getElementById(pregunta.getAttribute('aria-describedby')!)!.textContent).toBe(falta)
    })

    it('un 400 del servidor de un criterio lleva a su total, en su línea', async () => {
      cambiar.mockRejectedValue(
        new ErrorApi(400, 'Los puntos no se cambiaron: falta una cosa', {
          faltas: ['El criterio «Excel»: su parte calificada no puede quedar en 0, porque tiene abiertas o entregables que alguien califica.'],
        }),
      )
      const form = abrirElFormulario()
      fireEvent.click(within(form).getByRole('button', { name: 'Guardar los puntos' }))
      await within(form).findByRole('alert')
      expect(document.activeElement).toBe(totalDe(form, 'Excel'))
      expect(desplegado('Excel')).toBe(true)
      expect(bajar.mock.contexts.at(-1)).toBe(criterio('Excel'))
    })
  })
})

describe('«Cambiar los puntos» del banco (QA-13)', () => {
  // En el banco no hay total del criterio en su línea: los únicos campos son los
  // puntos de sus preguntas. La spec (punto 19) dice que en el banco «el cambio de
  // puntos» no cambia; la decisión de plegarlo es de la prueba publicada.
  it('abre con los puntos de sus preguntas a la vista, sin desplegar nada', () => {
    pintar(editor({ recalificacion: { rindieron: 0, conNota: 0, alDia: 0, recalificando: 0, pendientes: 0, motivos: [] } }))
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar los puntos' }))
    const form = screen.getByRole('form', { name: 'Cambiar los puntos' })
    expect(
      within(form).queryByRole('spinbutton', { name: 'Puntos de «Cuéntanos un cierre con un descuadre»' }),
      'el campo de la única pregunta, a la vista al abrir el formulario',
    ).not.toBeNull()
  })

  // «Contabilidad» (una abierta de 60) y «Personal» (una cerrada de 40).
  const banco: VersionDePreguntas = {
    ...publicada,
    cuantosCriterios: 2,
    cuantasPreguntas: 2,
    criterios: [
      {
        id: 5, nombre: 'Contabilidad', queEvalua: 'El cierre mensual', orden: 1, puntos: 60, puntosSistema: 0, puntosIa: 60,
        preguntas: [
          {
            id: 10, tipo: 'ABIERTA', enunciado: 'Cuéntanos un cierre con un descuadre', puntos: 60, criterioId: 5, orden: 1,
            queDebeTener: 'El monto y la cuenta', opciones: [],
          },
        ],
      },
      {
        id: 6, nombre: 'Personal', queEvalua: null, orden: 2, puntos: 40, puntosSistema: 40, puntosIa: 0,
        preguntas: [
          {
            id: 20, tipo: 'OPCION_UNICA', enunciado: '¿Cómo repartes los turnos?', puntos: 40, criterioId: 6, orden: 1,
            queDebeTener: null,
            opciones: [{ id: 21, texto: 'Por antigüedad', puntos: 40, orden: 1 }, { id: 22, texto: 'Al azar', puntos: 0, orden: 2 }],
          },
        ],
      },
    ],
  }
  const nadie = { rindieron: 0, conNota: 0, alDia: 0, recalificando: 0, pendientes: 0, motivos: [] }
  const criterio = (nombre: string) => screen.getByRole('region', { name: `Criterio ${nombre}` })
  const desplegado = (nombre: string) =>
    within(criterio(nombre)).getByRole('button', { name: nombre }).getAttribute('aria-expanded') === 'true'
  const scrollIntoView = Element.prototype.scrollIntoView
  const bajar = vi.fn()
  beforeEach(() => {
    Element.prototype.scrollIntoView = bajar
  })
  afterEach(() => {
    Element.prototype.scrollIntoView = scrollIntoView
  })
  const abrirElDelBanco = () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <PreguntasPublicadas editor={editor({ publicada: banco, recalificacion: nadie })} publicada={banco} alCambiar={vi.fn()} />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar los puntos' }))
    return screen.getByRole('form', { name: 'Cambiar los puntos' })
  }

  it('con varios criterios, todos desplegados al abrir; «Plegar todo» y cada criterio siguen plegando', () => {
    const form = abrirElDelBanco()
    expect(desplegado('Contabilidad') && desplegado('Personal')).toBe(true)
    expect(within(form).getByRole('spinbutton', { name: 'Puntos de la opción «Por antigüedad»' })).toBeTruthy()
    fireEvent.click(within(form).getByRole('button', { name: 'Plegar todo' }))
    expect(desplegado('Contabilidad') || desplegado('Personal')).toBe(false)
    fireEvent.click(within(criterio('Personal')).getByRole('button', { name: 'Personal' }))
    expect(desplegado('Personal')).toBe(true)
  })

  it('un 400 del servidor con los criterios plegados despliega el de la pregunta, la dice bajo su campo y lleva a él', async () => {
    const falta = 'La pregunta 2 («¿Cómo repartes los turnos?»): alguna opción tiene que dar los 40 puntos de la pregunta.'
    cambiar.mockRejectedValue(new ErrorApi(400, 'Los puntos no se cambiaron: falta una cosa', { faltas: [falta] }))
    const form = abrirElDelBanco()
    fireEvent.change(within(form).getByRole('spinbutton', { name: 'Puntos de la opción «Por antigüedad»' }), {
      target: { value: '30' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Plegar todo' }))
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar los puntos' }))

    const pregunta = await within(form).findByRole('spinbutton', { name: 'Puntos de «¿Cómo repartes los turnos?»' })
    expect(desplegado('Personal')).toBe(true)
    expect(desplegado('Contabilidad')).toBe(false)
    expect(document.activeElement).toBe(pregunta)
    expect(bajar).toHaveBeenCalledWith({ block: 'start' })
    expect((bajar.mock.contexts.at(-1) as HTMLElement).contains(pregunta)).toBe(true)
    // Lo dice bajo su campo, además de en la lista de abajo.
    expect(pregunta.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(pregunta.getAttribute('aria-describedby')!)!.textContent).toBe(falta)
    expect(within(form).getByRole('alert').textContent).toContain(falta)
    // Al tocar la pregunta, su aviso se va: ya no es lo último que se dijo de ella.
    fireEvent.change(within(form).getByRole('spinbutton', { name: 'Puntos de la opción «Por antigüedad»' }), {
      target: { value: '40' },
    })
    expect(pregunta.getAttribute('aria-invalid')).toBeNull()
    expect(within(criterio('Personal')).queryByText(falta)).toBeNull()
  })

  it('un 400 que solo dice la suma no despliega nada: la suma ya está arriba', async () => {
    cambiar.mockRejectedValue(
      new ErrorApi(400, 'Los puntos no se cambiaron: falta una cosa', { faltas: ['Los puntos suman 90 de 100: faltan 10.'] }),
    )
    const form = abrirElDelBanco()
    fireEvent.click(within(form).getByRole('button', { name: 'Plegar todo' }))
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar los puntos' }))
    expect(await within(form).findByRole('alert')).toBeTruthy()
    expect(desplegado('Contabilidad') || desplegado('Personal')).toBe(false)
    expect(bajar).not.toHaveBeenCalled()
  })

  it('no envía una pregunta en 25.5 ni en 150, ni una opción fuera de −100 a 100: lleva a su campo (AC-10)', () => {
    const form = abrirElDelBanco()
    const abierta = within(form).getByRole('spinbutton', {
      name: 'Puntos de «Cuéntanos un cierre con un descuadre»',
    }) as HTMLInputElement
    // Desplegada, el navegador la frena por sus límites, que son los del servidor.
    expect([abierta.min, abierta.max, abierta.step]).toEqual(['0', '100', '1'])
    const opcion = within(form).getByRole('spinbutton', { name: 'Puntos de la opción «Por antigüedad»' }) as HTMLInputElement
    expect([opcion.min, opcion.max]).toEqual(['-100', '100'])

    // Plegada no hay campo que frenar: se despliega su criterio y se lleva a él.
    const plegarContabilidad = () => fireEvent.click(within(criterio('Contabilidad')).getByRole('button', { name: 'Contabilidad' }))
    for (const escrito of ['25.5', '150', '-1']) {
      fireEvent.change(within(form).getByRole('spinbutton', { name: 'Puntos de «Cuéntanos un cierre con un descuadre»' }), {
        target: { value: escrito },
      })
      plegarContabilidad()
      expect(desplegado('Contabilidad')).toBe(false)
      fireEvent.submit(form)
      expect(desplegado('Contabilidad')).toBe(true)
      expect(document.activeElement).toBe(
        within(form).getByRole('spinbutton', { name: 'Puntos de «Cuéntanos un cierre con un descuadre»' }),
      )
    }
    fireEvent.change(within(form).getByRole('spinbutton', { name: 'Puntos de «Cuéntanos un cierre con un descuadre»' }), {
      target: { value: '60' },
    })
    fireEvent.change(within(form).getByRole('spinbutton', { name: 'Puntos de la opción «Al azar»' }), {
      target: { value: '-150' },
    })
    fireEvent.click(within(criterio('Personal')).getByRole('button', { name: 'Personal' }))
    fireEvent.submit(form)
    expect(document.activeElement).toBe(within(form).getByRole('spinbutton', { name: 'Puntos de la opción «Al azar»' }))
    expect(cambiar).not.toHaveBeenCalled()
  })

  it('su línea no lleva campo: los puntos del criterio van al borde derecho; en la prueba, con su total, no (AC-12)', () => {
    abrirElDelBanco()
    expect(criterio('Contabilidad').querySelector('header')!.className).toContain('cabeceraSinBotones')
  })
})
