/**
 * Lo que esta pantalla no puede volver a hacer.
 *
 * Tres cosas, y las tres son de las que compilan estando mal:
 *
 *   1. **Dejar que dos PUBLICADA se vean igual.** El backend le fija a cada
 *      candidato la publicada mas reciente de su nivel; las demas dicen
 *      PUBLICADA y no se las lleva nadie. En la base local hay tres niveles
 *      asi. Dos filas identicas con la misma palabra es «indicadores que
 *      mienten» servido en bandeja.
 *   2. **Prometer menos de lo que hace.** Publicar archiva a TODAS las
 *      hermanas publicadas, en un `for`. Un aviso que diga «la anterior»
 *      archiva dos y solo avisa de una.
 *   3. **Colapsar los dos permisos en una bandera.** Publicar pide
 *      `publicar_version_banco` y descartar pide `editar_banco_preguntas`. Un
 *      403 de uno no dice nada del otro.
 *
 * Y una cuarta que ya costo un fallo en otra pantalla: el 404 de una version
 * ajena dice «no existe» sobre una fila que se esta viendo en la lista.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { BancoDePreguntas, agrupar } from './BancoDePreguntas'
import type { VersionBanco } from '../api/tipos'

const version = (parcial: Partial<VersionBanco> & { id: number }): VersionBanco => ({
  tipoBanco: 'NIVEL',
  nivelPuestoCodigo: 'DIRECCION',
  etiqueta: `Versión ${parcial.id}`,
  estado: 'PUBLICADA',
  publicadaEn: null,
  ...parcial,
})

/* El estado de la base local: dos publicadas del mismo nivel y un borrador. */
const LA_QUE_RIGE = version({
  id: 8,
  etiqueta: 'Banco desde Excel · Directivo',
  publicadaEn: '2026-08-22T22:38:31Z',
})
const LA_VIEJA = version({
  id: 4,
  etiqueta: 'Banco RENASER v3 · Directivo',
  publicadaEn: '2026-08-21T21:23:39Z',
})
const EL_BORRADOR = version({
  id: 13,
  etiqueta: 'Banco CAZATALENTOS · Directivo',
  estado: 'BORRADOR',
})

const PREGUNTAS = [
  {
    id: 1,
    versionBancoId: 13,
    codigo: 'D01',
    bloque: null,
    tipo: 'EF-4',
    enunciado: 'Elige la que más se parece a ti',
    situacion: null,
    esPuntuable: true,
    orden: 1,
    peso: 2,
    esClave: true,
    esEliminatorio: false,
    casosPedidos: null,
    rangosDePreguntaCodigo: null,
    formulaPuntaje: null,
  },
  {
    id: 2,
    versionBancoId: 13,
    codigo: 'D02',
    bloque: null,
    tipo: 'V',
    enunciado: '¿Cuántas personas te reportan?',
    situacion: null,
    esPuntuable: true,
    orden: 2,
    peso: 1,
    esClave: false,
    esEliminatorio: true,
    casosPedidos: null,
    rangosDePreguntaCodigo: null,
    formulaPuntaje: null,
  },
]

const listar = vi.fn()
const publicar = vi.fn()
const archivar = vi.fn()
const descartar = vi.fn()
const renombrar = vi.fn()
const preguntas = vi.fn()
const importar = vi.fn()

vi.mock('../api/panel', () => ({
  listarVersionesBanco: () => listar(),
  publicarVersionBanco: (id: number) => publicar(id),
  archivarVersionBanco: (id: number) => archivar(id),
  descartarBorradorBanco: (id: number) => descartar(id),
  renombrarVersionBanco: (id: number, etiqueta: string) => renombrar(id, etiqueta),
  verPreguntasDeVersion: (id: number) => preguntas(id),
  importarBanco: (...args: unknown[]) => importar(...args),
  verCatalogos: () => Promise.resolve({ nivelesPuesto: [{ codigo: 'DIRECCION', nombre: 'Directivo' }] }),
}))

/* Tres versiones en pantalla: «Ver qué contiene» sale tres veces. La fila del
   borrador es la unica con boton de publicar, y por ahi se la encuentra. */
const filaDe = (boton: string) =>
  within(screen.getByRole('button', { name: boton }).closest('li') as HTMLElement)

function montar() {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <BancoDePreguntas />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  for (const espia of [listar, publicar, archivar, descartar, renombrar, preguntas, importar]) {
    espia.mockReset()
  }
  listar.mockResolvedValue([LA_QUE_RIGE, LA_VIEJA, EL_BORRADOR])
  preguntas.mockResolvedValue(PREGUNTAS)
  for (const espia of [publicar, archivar, descartar, renombrar]) espia.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('cuál de las publicadas rige', () => {
  it('solo la más reciente dice que se asigna, y la otra dice que no', async () => {
    montar()
    expect(await screen.findByText('Se asigna a quien empiece ahora')).toBeTruthy()
    expect(screen.getByText('Publicada, pero no se asigna a nadie')).toBeTruthy()
  })

  it('avisa de que hay dos publicadas y solo una circula', async () => {
    montar()
    expect(
      await screen.findByText(/Hay 2 versiones publicadas de este banco y solo una se asigna/),
    ).toBeTruthy()
  })

  it('sin ninguna publicada lo dice, en vez de callarse', async () => {
    listar.mockResolvedValue([EL_BORRADOR])
    montar()
    expect(
      await screen.findByText(/quien empiece su evaluación en este nivel se queda sin banco/),
    ).toBeTruthy()
  })

  it('el desempate es publicadaEn, no el id ni el orden de llegada', () => {
    // El id mayor es el 4 en `publicadaEn` mas antiguo a proposito: si el
    // desempate mirase el id, esta prueba se pondria roja.
    const [grupo] = agrupar([
      version({ id: 40, publicadaEn: '2020-01-01T00:00:00Z' }),
      version({ id: 4, publicadaEn: '2026-08-22T00:00:00Z' }),
    ])
    expect(grupo!.rige?.id).toBe(4)
  })

  it('una publicada sin fecha no le gana a una con fecha', () => {
    const [grupo] = agrupar([
      version({ id: 1, publicadaEn: null }),
      version({ id: 2, publicadaEn: '2026-08-22T00:00:00Z' }),
    ])
    expect(grupo!.rige?.id).toBe(2)
  })
})

describe('cómo se agrupa', () => {
  it('un banco de alineación no pinta un hueco donde el nivel es null', () => {
    const grupos = agrupar([version({ id: 1, tipoBanco: 'ALINEACION', nivelPuestoCodigo: null })])
    expect(grupos[0]!.titulo).toBe('Banco de alineación')
    expect(grupos[0]!.titulo).not.toContain('—')
  })

  it('el título usa el nombre del nivel, no su código', () => {
    // «Nivel MEDIO» es el codigo crudo del backend, el mismo fallo que la
    // fixtura del embudo documenta.
    const grupos = agrupar(
      [version({ id: 1, nivelPuestoCodigo: 'DIRECCION' })],
      new Map([['DIRECCION', 'Directivo']]),
    )
    expect(grupos[0]!.titulo).toBe('Nivel Directivo')
  })

  it('sin catálogo cargado enseña el código en vez de un hueco', () => {
    const grupos = agrupar([version({ id: 1, nivelPuestoCodigo: 'DIRECCION' })])
    expect(grupos[0]!.titulo).toBe('Nivel DIRECCION')
  })

  it('el banco de alineación va al final, no delante por orden alfabético', () => {
    const grupos = agrupar([
      version({ id: 1, tipoBanco: 'ALINEACION', nivelPuestoCodigo: null }),
      version({ id: 2, nivelPuestoCodigo: 'DIRECCION' }),
    ])
    expect(grupos.map((g) => g.titulo)).toEqual(['Nivel DIRECCION', 'Banco de alineación'])
  })

  it('dos niveles distintos son dos grupos, y cada uno tiene su propia vigente', () => {
    const grupos = agrupar([
      version({ id: 1, nivelPuestoCodigo: 'EJECUCION', publicadaEn: '2026-01-01T00:00:00Z' }),
      version({ id: 2, nivelPuestoCodigo: 'DIRECCION', publicadaEn: '2026-01-01T00:00:00Z' }),
    ])
    expect(grupos).toHaveLength(2)
    expect(grupos.map((g) => g.rige?.id).sort()).toEqual([1, 2])
  })
})

describe('publicar', () => {
  it('nombra a TODAS las que va a archivar, no solo a la última', async () => {
    listar.mockResolvedValue([
      LA_QUE_RIGE,
      LA_VIEJA,
      version({ id: 2, etiqueta: 'Banco Dirección V0.1', publicadaEn: '2025-01-01T00:00:00Z' }),
      EL_BORRADOR,
    ])
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }))

    const aviso = await screen.findByText(/Publicar esta versión archiva/)
    expect(aviso.textContent).toContain('las 3 publicadas')
    expect(aviso.textContent).toContain('Banco desde Excel · Directivo')
    expect(aviso.textContent).toContain('Banco RENASER v3 · Directivo')
    expect(aviso.textContent).toContain('Banco Dirección V0.1')
  })

  it('dice que el rechazo nombra solo la primera pregunta que falla', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }))
    expect(await screen.findByText(/nombra solo la primera que encuentra/)).toBeTruthy()
  })

  it('pregunta antes: pulsar Publicar no publica nada todavía', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }))
    await screen.findByText(/Publicar esta versión archiva/)
    expect(publicar).not.toHaveBeenCalled()
  })

  it('el 409 del backend se enseña tal cual, con la pregunta que falla', async () => {
    publicar.mockRejectedValue(
      new ErrorApi(409, 'No se puede publicar: la pregunta D14 puntúa pero no tiene peso', null),
    )
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, publicar' }))
    expect(await screen.findByText(/la pregunta D14 puntúa pero no tiene peso/)).toBeTruthy()
  })
})

describe('un banco de alineación no reparte por nivel', () => {
  /*
    El backend mete la guarda de «archivar sin reemplazo» y el repunte de quien
    no empezo dentro de un `if ("NIVEL".equals(tipoBanco))`. En ALINEACION no
    se disparan, asi que prometerlas seria prometer lo que no pasa.
  */
  const ALINEACION = version({
    id: 21,
    tipoBanco: 'ALINEACION',
    nivelPuestoCodigo: null,
    etiqueta: 'Alineación cultural · v2',
    publicadaEn: '2026-07-01T00:00:00Z',
  })

  it('no dice «en este nivel» al archivarlo, ni promete la guarda del reemplazo', async () => {
    listar.mockResolvedValue([ALINEACION])
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Archivar' }))

    const texto = (await screen.findByText(/Archivar retira esta versión/)).textContent ?? ''
    expect(texto).not.toContain('en este nivel')
    expect(texto).toMatch(/no comprueba si queda alguna publicada/)
  })

  it('y sin ninguna publicada no habla de quien empieza su evaluación', async () => {
    listar.mockResolvedValue([{ ...ALINEACION, estado: 'BORRADOR' as const, publicadaEn: null }])
    montar()
    const texto = (await screen.findByText(/Ninguna versión publicada/)).textContent ?? ''
    expect(texto).not.toContain('en este nivel')
  })

  it('publicarlo tampoco habla de niveles', async () => {
    listar.mockResolvedValue([{ ...ALINEACION, estado: 'BORRADOR' as const, publicadaEn: null }])
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }))
    const texto = (await screen.findByText(/Al publicarla/)).textContent ?? ''
    expect(texto).not.toContain('en este nivel')
  })
})

describe('archivar y descartar', () => {
  it('archivar avisa de que a quien ya empezó no se le mueve nada', async () => {
    montar()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Archivar' }))[0]!)
    expect(await screen.findByText(/Quien no empezó pasa a la publicada que quede/)).toBeTruthy()
  })

  it('el 409 de archivar sin reemplazo dice a cuánta gente dejaría sin banco', async () => {
    archivar.mockRejectedValue(
      new ErrorApi(
        409,
        'Archivar dejaría a 12 candidato(s) sin banco de preguntas: publica antes una versión de reemplazo para este nivel',
        null,
      ),
    )
    montar()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Archivar' }))[0]!)
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, archivar' }))
    expect(await screen.findByText(/dejaría a 12 candidato\(s\) sin banco/)).toBeTruthy()
  })

  it('descartar dice que no se deshace, y cuántas preguntas se lleva', async () => {
    montar()
    // Abrir el contenido primero es lo que le da la cifra a la pregunta.
    await screen.findByRole('button', { name: 'Publicar' })
    fireEvent.click(filaDe('Publicar').getByRole('button', { name: 'Ver qué contiene' }))
    await screen.findByText(/2 preguntas · 2 puntúan/)
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))

    expect(await screen.findByText(/con sus 2 preguntas/)).toBeTruthy()
    expect(screen.getByText('No se deshace y no hay papelera.')).toBeTruthy()
  })

  it('sin haber mirado el contenido no se inventa un número', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar' }))
    expect(await screen.findByText(/con todas sus preguntas/)).toBeTruthy()
  })
})

describe('lo que cada estado deja hacer', () => {
  it('una archivada no ofrece ninguna acción y dice por qué', async () => {
    listar.mockResolvedValue([version({ id: 1, estado: 'ARCHIVADA', etiqueta: 'V0.1' })])
    montar()
    expect(await screen.findByText(/Archivada: ya no se asigna/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Archivar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Renombrar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull()
  })

  it('un borrador no ofrece renombrar: el backend contesta 409', async () => {
    listar.mockResolvedValue([EL_BORRADOR])
    montar()
    await screen.findByRole('button', { name: 'Publicar' })
    expect(screen.queryByRole('button', { name: 'Renombrar' })).toBeNull()
  })

  it('una publicada no ofrece publicar ni descartar', async () => {
    listar.mockResolvedValue([LA_QUE_RIGE])
    montar()
    await screen.findByRole('button', { name: 'Archivar' })
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull()
  })
})

describe('los dos permisos', () => {
  it('un 403 al publicar retira publicar, archivar y renombrar — y deja descartar', async () => {
    publicar.mockRejectedValue(new ErrorApi(403, 'Forbidden', null))
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, publicar' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull())
    expect(screen.queryByRole('button', { name: 'Archivar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Renombrar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeTruthy()
    expect(screen.getByText(/hace falta el permiso «publicar_version_banco»/)).toBeTruthy()
  })

  it('un 403 al descartar retira lo contrario: importar y descartar', async () => {
    descartar.mockRejectedValue(new ErrorApi(403, 'Forbidden', null))
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, descartar' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull())
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Importar el Excel' })).toBeNull()
    expect(screen.getByText(/hace falta el permiso «editar_banco_preguntas»/)).toBeTruthy()
  })
})

describe('una versión que no es de esta empresa', () => {
  it('el 404 se traduce: existe, se está viendo, y no es tuya', async () => {
    publicar.mockRejectedValue(new ErrorApi(404, 'Versión del banco no encontrada con id: 13', null))
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, publicar' }))

    expect(await screen.findByText(/es del banco de la plataforma/)).toBeTruthy()
    expect(screen.queryByText(/no encontrada con id/)).toBeNull()
  })
})

describe('lo que contiene una versión', () => {
  it('resume antes de listar: cuántas puntúan y cuántas descartan', async () => {
    montar()
    await screen.findByRole('button', { name: 'Publicar' })
    fireEvent.click(filaDe('Publicar').getByRole('button', { name: 'Ver qué contiene' }))
    expect(await screen.findByText(/2 preguntas · 2 puntúan · 1 eliminatorias/)).toBeTruthy()
    expect(screen.getByText('Elige la que más se parece a ti')).toBeTruthy()
  })

  it('una versión vacía dice que no se puede publicar', async () => {
    preguntas.mockResolvedValue([])
    listar.mockResolvedValue([EL_BORRADOR])
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver qué contiene' }))
    expect(await screen.findByText(/un banco vacío no se le puede poner delante a nadie/)).toBeTruthy()
  })
})

describe('importar el Excel', () => {
  it('enseña el recuento de lo que entró, no un «listo» a secas', async () => {
    importar.mockResolvedValue({
      versionBancoId: 16,
      etiqueta: 'v4 septiembre',
      preguntas: 85,
      opciones: 340,
      camposCaso: 4,
      rangos: 12,
      pares: 6,
      dimensionesAsignadas: 85,
    })
    montar()
    /* El desplegable de niveles sale de `verCatalogos`: sin esperarlo, elegir
       DIRECCION no elige nada y el boton se queda apagado. */
    await screen.findByRole('option', { name: 'Directivo' })

    const archivo = new File(['x'], 'banco.xlsx')
    fireEvent.change(screen.getByLabelText('La plantilla Excel del banco'), {
      target: { files: [archivo] },
    })
    fireEvent.change(screen.getByLabelText('Nivel del puesto al que pertenece el banco'), {
      target: { value: 'DIRECCION' },
    })
    fireEvent.change(screen.getByLabelText('Etiqueta de la versión'), {
      target: { value: 'v4 septiembre' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Importar el Excel' }))

    expect(await screen.findByText(/85 preguntas, 340 opciones/)).toBeTruthy()
  })
})
